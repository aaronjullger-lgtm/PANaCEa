/**
 * Tests for Content Quality Feedback Loop
 *
 * Covers:
 *   - Flagging criteria (discrimination, point-biserial, distractors)
 *   - Attempt mapping to ItemAttemptRecord format
 *   - Regeneration pipeline (critique + rewrite via selfRefineService)
 *   - Full pipeline orchestration with mocked dependencies
 *   - Deduplication (already-flagged items skipped)
 *   - Edge cases (no attempts, Gemini failures, parse errors)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getQualifyingFlags,
  hasNonFunctioningDistractors,
  hasConcentratedWrongOption,
  computeFlagTypes,
  mapToItemAttemptRecords,
  toGeneratedQuestion,
  attemptRegeneration,
  runContentQualityLoop,
  DEFAULT_CONTENT_QUALITY_CONFIG,
  type QuestionWithAttempts,
  type ContentQualityFlagRecord,
  type FlagStatus,
} from '@/lib/services/contentQualityLoop';
import type { ItemAnalysis, ItemAttemptRecord } from '@/lib/services/itemAnalysisService';

// ─── Test Fixtures ─────────────────────────────────────────────────────

function makeQuestion(overrides: Partial<QuestionWithAttempts> = {}): QuestionWithAttempts {
  return {
    id: 'q-1',
    question: 'A 45-year-old man presents with chest pain...',
    options: ['A. MI', 'B. PE', 'C. GERD', 'D. Costochondritis'],
    correctAnswer: 'A',
    explanation: 'The patient has risk factors for MI...',
    difficulty: 'medium',
    source: 'auto-author',
    system: 'Cardiovascular',
    attempts: [],
    ...overrides,
  };
}

/** Generate N attempts with configurable correctness distribution */
function makeAttempts(count: number, correctRate: number, userIdPrefix = 'user'): QuestionWithAttempts['attempts'] {
  return Array.from({ length: count }, (_, i) => ({
    userId: `${userIdPrefix}-${i}`,
    wasCorrect: Math.random() < correctRate,
    selectedAnswer: Math.random() < correctRate ? 'A' : ['B', 'C', 'D'][Math.floor(Math.random() * 3)]!,
    timeSpentMs: 15000 + Math.floor(Math.random() * 30000),
  }));
}

/**
 * Create a batch of questions where "q-bad" has non-functioning distractors.
 * Uses 3 questions per user so total scores vary independently from q-bad performance.
 * q-bad has 96% correct → all distractors are non-functioning (<5%).
 */
function makeFlaggableQuestionBatch(): QuestionWithAttempts[] {
  const userCount = 50;
  const users = Array.from({ length: userCount }, (_, i) => `user-${i}`);

  // q-other1 and q-other2 discriminate well (top half correct, bottom half wrong)
  // q-bad: 48/50 users correct → 96% difficulty, distractors each ≤2%
  return [
    {
      id: 'q-bad',
      question: 'A 45-year-old with chest pain...',
      options: ['A. MI', 'B. PE', 'C. GERD', 'D. Costochondritis'],
      correctAnswer: 'A',
      explanation: 'MI is most likely...',
      difficulty: 'easy',
      source: 'auto-author',
      system: 'Cardiovascular',
      attempts: users.map((userId, i) => ({
        userId,
        wasCorrect: i !== 48 && i !== 49, // 48/50 correct
        selectedAnswer: i !== 48 && i !== 49 ? 'A' : (i === 48 ? 'B' : 'C'),
        timeSpentMs: 15000,
      })),
    },
    {
      id: 'q-other1',
      question: 'A different clinical vignette...',
      options: ['A. Right', 'B. Wrong1', 'C. Wrong2', 'D. Wrong3'],
      correctAnswer: 'A',
      explanation: '...',
      difficulty: 'medium',
      source: 'auto-author',
      system: 'Pulmonary',
      attempts: users.map((userId, i) => ({
        userId,
        wasCorrect: i < 25, // top 50% correct
        selectedAnswer: i < 25 ? 'A' : 'B',
        timeSpentMs: 20000,
      })),
    },
    {
      id: 'q-other2',
      question: 'Another clinical vignette...',
      options: ['A. Right', 'B. Wrong1', 'C. Wrong2', 'D. Wrong3'],
      correctAnswer: 'A',
      explanation: '...',
      difficulty: 'medium',
      source: 'auto-author',
      system: 'GI',
      attempts: users.map((userId, i) => ({
        userId,
        wasCorrect: i < 30, // top 60% correct
        selectedAnswer: i < 30 ? 'A' : 'C',
        timeSpentMs: 18000,
      })),
    },
  ];
}

/**
 * Create a batch where "q-bad" has concentrated wrong option (>80% on one wrong answer).
 * 30/50 correct on A, 16/50 wrong on B (84% of wrong answers concentrated).
 */
function makeConcentratedQuestionBatch(): QuestionWithAttempts[] {
  const userCount = 50;
  const users = Array.from({ length: userCount }, (_, i) => `user-${i}`);

  return [
    {
      id: 'q-concentrated',
      question: 'A concentrated distractor question...',
      options: ['A. Correct', 'B. Popular Wrong', 'C. Rare Wrong', 'D. Rare Wrong'],
      correctAnswer: 'A',
      explanation: '...',
      difficulty: 'medium',
      source: 'auto-author',
      system: 'Cardiovascular',
      attempts: users.map((userId, i) => ({
        userId,
        wasCorrect: i < 30,
        selectedAnswer: i < 30 ? 'A' : (i < 46 ? 'B' : (i < 48 ? 'C' : 'D')),
        timeSpentMs: 20000,
      })),
    },
    {
      id: 'q-discriminator1',
      question: 'Another vignette...',
      options: ['A. Right', 'B. Wrong1', 'C. Wrong2', 'D. Wrong3'],
      correctAnswer: 'A',
      explanation: '...',
      difficulty: 'medium',
      source: 'auto-author',
      system: 'Pulmonary',
      attempts: users.map((userId, i) => ({
        userId,
        wasCorrect: i < 25,
        selectedAnswer: i < 25 ? 'A' : 'B',
        timeSpentMs: 20000,
      })),
    },
  ];
}

/**
 * Generate attempts where high-performing students get it wrong and
 * low-performing students get it right → negative discrimination.
 * Users 0-24 are "high performers" (wrong), users 25-49 are "low performers" (correct).
 */
function makeNegativeDiscriminationAttempts(count: number): QuestionWithAttempts['attempts'] {
  const half = Math.floor(count / 2);
  return Array.from({ length: count }, (_, i) => ({
    userId: `user-${i}`,
    wasCorrect: i >= half,
    selectedAnswer: i >= half ? 'A' : 'B',
    timeSpentMs: 20000,
  }));
}

/** Create a mock analysis with specific flags */
function makeAnalysis(overrides: Partial<ItemAnalysis> = {}): ItemAnalysis {
  return {
    questionId: 'q-1',
    attemptCount: 50,
    difficulty: 0.5,
    discriminationIndex: 0.05,
    pointBiserial: 0.02,
    distractors: [
      { option: 'A', isCorrect: true, selectionCount: 25, selectionRate: 0.5, isNonFunctioning: false, avgTotalScore: 0.7 },
      { option: 'B', isCorrect: false, selectionCount: 10, selectionRate: 0.2, isNonFunctioning: false, avgTotalScore: 0.5 },
      { option: 'C', isCorrect: false, selectionCount: 3, selectionRate: 0.06, isNonFunctioning: false, avgTotalScore: 0.4 },
      { option: 'D', isCorrect: false, selectionCount: 2, selectionRate: 0.04, isNonFunctioning: true, avgTotalScore: 0.3 },
    ],
    avgTimeMs: 20000,
    medianTimeMs: 18000,
    flags: [
      { type: 'NON_DISCRIMINATING', severity: 'warning', message: 'D = 0.05' },
      { type: 'NON_FUNCTIONING_DISTRACTOR', severity: 'info', message: 'Option D < 5%' },
    ],
    grade: 'review',
    ...overrides,
  };
}

// ─── Flagging Criteria Tests ────────────────────────────────────────────

describe('getQualifyingFlags', () => {
  it('returns critical-severity flags', () => {
    const analysis = makeAnalysis({
      flags: [
        { type: 'NEGATIVE_DISCRIMINATION', severity: 'critical', message: 'D = -0.10' },
        { type: 'NON_FUNCTIONING_DISTRACTOR', severity: 'info', message: 'Option D < 5%' },
      ],
    });
    const qualifying = getQualifyingFlags(analysis);
    expect(qualifying).toHaveLength(1);
    expect(qualifying[0]!.type).toBe('NEGATIVE_DISCRIMINATION');
  });

  it('returns warning-severity flags for critical flag types', () => {
    const analysis = makeAnalysis({
      flags: [
        { type: 'NON_DISCRIMINATING', severity: 'warning', message: 'D = 0.05' },
        { type: 'TOO_EASY', severity: 'warning', message: 'p = 0.97' },
      ],
    });
    const qualifying = getQualifyingFlags(analysis);
    // NON_DISCRIMINATING is in CRITICAL_FLAG_TYPES → included
    // TOO_EASY is NOT in CRITICAL_FLAG_TYPES → excluded
    expect(qualifying).toHaveLength(1);
    expect(qualifying[0]!.type).toBe('NON_DISCRIMINATING');
  });

  it('returns empty array when no flags qualify', () => {
    const analysis = makeAnalysis({
      flags: [
        { type: 'TOO_EASY', severity: 'warning', message: 'p = 0.97' },
        { type: 'NON_FUNCTIONING_DISTRACTOR', severity: 'info', message: 'Option D' },
      ],
    });
    expect(getQualifyingFlags(analysis)).toHaveLength(0);
  });

  it('returns empty array for empty flags', () => {
    const analysis = makeAnalysis({ flags: [] });
    expect(getQualifyingFlags(analysis)).toHaveLength(0);
  });
});

describe('hasNonFunctioningDistractors', () => {
  it('returns true when a wrong option has < 5% selection rate', () => {
    const analysis = makeAnalysis({
      distractors: [
        { option: 'A', isCorrect: true, selectionCount: 47, selectionRate: 0.94, isNonFunctioning: false, avgTotalScore: 0.8 },
        { option: 'B', isCorrect: false, selectionCount: 2, selectionRate: 0.04, isNonFunctioning: true, avgTotalScore: 0.3 },
        { option: 'C', isCorrect: false, selectionCount: 1, selectionRate: 0.02, isNonFunctioning: true, avgTotalScore: 0.2 },
      ],
    });
    expect(hasNonFunctioningDistractors(analysis)).toBe(true);
  });

  it('returns false when all wrong options function', () => {
    const analysis = makeAnalysis({
      distractors: [
        { option: 'A', isCorrect: true, selectionCount: 30, selectionRate: 0.6, isNonFunctioning: false, avgTotalScore: 0.8 },
        { option: 'B', isCorrect: false, selectionCount: 10, selectionRate: 0.2, isNonFunctioning: false, avgTotalScore: 0.4 },
        { option: 'C', isCorrect: false, selectionCount: 10, selectionRate: 0.2, isNonFunctioning: false, avgTotalScore: 0.5 },
      ],
    });
    expect(hasNonFunctioningDistractors(analysis)).toBe(false);
  });
});

describe('hasConcentratedWrongOption', () => {
  it('returns false when wrong answers are evenly distributed', () => {
    const analysis = makeAnalysis({
      distractors: [
        { option: 'A', isCorrect: true, selectionCount: 34, selectionRate: 0.567, isNonFunctioning: false, avgTotalScore: 0.8 },
        { option: 'B', isCorrect: false, selectionCount: 9, selectionRate: 0.15, isNonFunctioning: false, avgTotalScore: 0.3 },
        { option: 'C', isCorrect: false, selectionCount: 9, selectionRate: 0.15, isNonFunctioning: false, avgTotalScore: 0.4 },
        { option: 'D', isCorrect: false, selectionCount: 8, selectionRate: 0.133, isNonFunctioning: false, avgTotalScore: 0.5 },
      ],
    });
    // Wrong total = 26. B = 9/26 = 34.6% — well under 80%
    expect(hasConcentratedWrongOption(analysis)).toBe(false);
  });

  it('returns true when one wrong option dominates', () => {
    const analysis = makeAnalysis({
      distractors: [
        { option: 'A', isCorrect: true, selectionCount: 30, selectionRate: 0.40, isNonFunctioning: false, avgTotalScore: 0.8 },
        { option: 'B', isCorrect: false, selectionCount: 42, selectionRate: 0.56, isNonFunctioning: false, avgTotalScore: 0.3 },
        { option: 'C', isCorrect: false, selectionCount: 2, selectionRate: 0.027, isNonFunctioning: true, avgTotalScore: 0.4 },
        { option: 'D', isCorrect: false, selectionCount: 1, selectionRate: 0.013, isNonFunctioning: true, avgTotalScore: 0.5 },
      ],
    });
    // Wrong total = 45. B = 42/45 = 93.3% — concentrated
    expect(hasConcentratedWrongOption(analysis)).toBe(true);
  });

  it('returns false when no wrong distractors exist', () => {
    const analysis = makeAnalysis({
      distractors: [
        { option: 'A', isCorrect: true, selectionCount: 50, selectionRate: 1.0, isNonFunctioning: false, avgTotalScore: 0.8 },
      ],
    });
    expect(hasConcentratedWrongOption(analysis)).toBe(false);
  });
});

describe('computeFlagTypes', () => {
  it('includes NON_DISCRIMINATING from analysis flags', () => {
    const analysis = makeAnalysis({
      flags: [
        { type: 'NON_DISCRIMINATING', severity: 'warning', message: 'D = 0.05' },
      ],
    });
    const types = computeFlagTypes(analysis);
    expect(types).toContain('NON_DISCRIMINATING');
  });

  it('includes NEGATIVE_RPB from analysis flags', () => {
    const analysis = makeAnalysis({
      flags: [
        { type: 'NEGATIVE_RPB', severity: 'critical', message: 'rpb = -0.15' },
      ],
    });
    const types = computeFlagTypes(analysis);
    expect(types).toContain('NEGATIVE_RPB');
  });

  it('includes NON_FUNCTIONING_DISTRACTOR from distractor analysis', () => {
    const analysis = makeAnalysis({
      flags: [],
      distractors: [
        { option: 'A', isCorrect: true, selectionCount: 48, selectionRate: 0.96, isNonFunctioning: false, avgTotalScore: 0.8 },
        { option: 'B', isCorrect: false, selectionCount: 2, selectionRate: 0.04, isNonFunctioning: true, avgTotalScore: 0.3 },
      ],
    });
    const types = computeFlagTypes(analysis);
    expect(types).toContain('NON_FUNCTIONING_DISTRACTOR');
  });

  it('includes CONCENTRATED_WRONG_OPTION when concentrated', () => {
    const analysis = makeAnalysis({
      flags: [],
      distractors: [
        { option: 'A', isCorrect: true, selectionCount: 30, selectionRate: 0.40, isNonFunctioning: false, avgTotalScore: 0.8 },
        { option: 'B', isCorrect: false, selectionCount: 42, selectionRate: 0.56, isNonFunctioning: false, avgTotalScore: 0.3 },
        { option: 'C', isCorrect: false, selectionCount: 2, selectionRate: 0.027, isNonFunctioning: true, avgTotalScore: 0.4 },
        { option: 'D', isCorrect: false, selectionCount: 1, selectionRate: 0.013, isNonFunctioning: true, avgTotalScore: 0.5 },
      ],
    });
    const types = computeFlagTypes(analysis);
    expect(types).toContain('CONCENTRATED_WRONG_OPTION');
  });

  it('returns empty array for excellent items', () => {
    const analysis = makeAnalysis({
      flags: [],
      discriminationIndex: 0.45,
      pointBiserial: 0.35,
      distractors: [
        { option: 'A', isCorrect: true, selectionCount: 30, selectionRate: 0.6, isNonFunctioning: false, avgTotalScore: 0.8 },
        { option: 'B', isCorrect: false, selectionCount: 10, selectionRate: 0.2, isNonFunctioning: false, avgTotalScore: 0.4 },
        { option: 'C', isCorrect: false, selectionCount: 7, selectionRate: 0.14, isNonFunctioning: false, avgTotalScore: 0.5 },
        { option: 'D', isCorrect: false, selectionCount: 3, selectionRate: 0.06, isNonFunctioning: false, avgTotalScore: 0.45 },
      ],
      grade: 'excellent',
    });
    expect(computeFlagTypes(analysis)).toEqual([]);
  });
});

// ─── Attempt Mapping Tests ──────────────────────────────────────────────

describe('mapToItemAttemptRecords', () => {
  it('maps question attempts to ItemAttemptRecord format', () => {
    const questions = [
      makeQuestion({
        id: 'q-1',
        attempts: [
          { userId: 'u-1', wasCorrect: true, selectedAnswer: 'A', timeSpentMs: 20000 },
          { userId: 'u-2', wasCorrect: false, selectedAnswer: 'B', timeSpentMs: 15000 },
        ],
      }),
    ];

    const records = mapToItemAttemptRecords(questions);
    const q1Records = records.get('q-1');

    expect(q1Records).toHaveLength(2);
    expect(q1Records![0]!.studentId).toBe('u-1');
    expect(q1Records![0]!.isCorrect).toBe(true);
    expect(q1Records![0]!.selectedOption).toBe('A');
    expect(q1Records![0]!.timeSpentMs).toBe(20000);
  });

  it('computes per-user total scores across questions', () => {
    const questions = [
      makeQuestion({
        id: 'q-1',
        attempts: [
          { userId: 'u-1', wasCorrect: true, selectedAnswer: 'A', timeSpentMs: 10000 },
          { userId: 'u-2', wasCorrect: false, selectedAnswer: 'B', timeSpentMs: 10000 },
        ],
      }),
      makeQuestion({
        id: 'q-2',
        attempts: [
          { userId: 'u-1', wasCorrect: true, selectedAnswer: 'C', timeSpentMs: 10000 },
          { userId: 'u-2', wasCorrect: true, selectedAnswer: 'A', timeSpentMs: 10000 },
        ],
      }),
    ];

    const records = mapToItemAttemptRecords(questions);
    const q1Records = records.get('q-1')!;

    // u-1: 2/2 correct → totalScore=1.0
    expect(q1Records[0]!.totalScore).toBe(1.0);
    expect(q1Records[0]!.totalItems).toBe(2);

    // u-2: 1/2 correct → totalScore=0.5
    expect(q1Records[1]!.totalScore).toBe(0.5);
    expect(q1Records[1]!.totalItems).toBe(2);
  });

  it('handles null selectedAnswer by defaulting to empty string', () => {
    const questions = [
      makeQuestion({
        attempts: [
          { userId: 'u-1', wasCorrect: true, selectedAnswer: null, timeSpentMs: 10000 },
        ],
      }),
    ];

    const records = mapToItemAttemptRecords(questions);
    expect(records.get('q-1')![0]!.selectedOption).toBe('');
  });

  it('handles null timeSpentMs by defaulting to 0', () => {
    const questions = [
      makeQuestion({
        attempts: [
          { userId: 'u-1', wasCorrect: true, selectedAnswer: 'A', timeSpentMs: null },
        ],
      }),
    ];

    const records = mapToItemAttemptRecords(questions);
    expect(records.get('q-1')![0]!.timeSpentMs).toBe(0);
  });

  it('returns empty map for no questions', () => {
    expect(mapToItemAttemptRecords([])).toEqual(new Map());
  });
});

// ─── GeneratedQuestion Conversion Tests ─────────────────────────────────

describe('toGeneratedQuestion', () => {
  it('converts question data to GeneratedQuestion format', () => {
    const q = makeQuestion();
    const generated = toGeneratedQuestion(q);

    expect(generated.type).toBe('Cardiovascular');
    expect(generated.question).toBe(q.question);
    expect(generated.options).toEqual(q.options);
    expect(generated.correctAnswer).toBe('A');
    expect(generated.explanation.rationale).toBe(q.explanation);
  });

  it('maps difficulty string to numeric', () => {
    expect(toGeneratedQuestion(makeQuestion({ difficulty: 'easy' })).difficulty).toBe(0.2);
    expect(toGeneratedQuestion(makeQuestion({ difficulty: 'medium' })).difficulty).toBe(0.5);
    expect(toGeneratedQuestion(makeQuestion({ difficulty: 'hard' })).difficulty).toBe(0.8);
    expect(toGeneratedQuestion(makeQuestion({ difficulty: 'expert' })).difficulty).toBe(0.5);
  });

  it('handles non-array options', () => {
    const q = makeQuestion({ options: { A: 'Option A', B: 'Option B' } });
    const generated = toGeneratedQuestion(q);
    expect(generated.options).toEqual([]);
  });
});

// ─── Regeneration Tests ─────────────────────────────────────────────────

describe('attemptRegeneration', () => {
  const mockCallGemini = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns regenerated content when critique and rewrite succeed', async () => {
    const critiqueResponse = JSON.stringify({
      overallScore: 0.4,
      dimensions: [{ name: 'clinical_accuracy', score: 0.3, feedback: 'Needs improvement' }],
      issues: [{ severity: 'critical', category: 'clinical_accuracy', description: 'Incorrect fact', suggestion: 'Fix it' }],
      feedbackForRewrite: 'Clinical accuracy needs fixing.',
    });

    const rewriteResponse = JSON.stringify({
      type: 'MCQ',
      question: 'Improved question...',
      options: ['A. Correct', 'B. Wrong', 'C. Wrong', 'D. Wrong'],
      correctAnswer: 'A',
      explanation: { rationale: 'Better rationale' },
      difficulty: 0.5,
    });

    mockCallGemini
      .mockResolvedValueOnce(critiqueResponse)
      .mockResolvedValueOnce(rewriteResponse);

    const question = makeQuestion();
    const analysis = makeAnalysis();
    const mockLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

    const result = await attemptRegeneration(question, analysis, mockCallGemini, mockLog);

    expect(result.critiqueResult).not.toBeNull();
    expect(result.critiqueResult!.overallScore).toBe(0.4);
    expect(result.regeneratedContent).not.toBeNull();
    expect(result.regeneratedContent!.question).toBe('Improved question...');
    expect(mockCallGemini).toHaveBeenCalledTimes(2);
  });

  it('returns null regeneratedContent when Gemini critique fails', async () => {
    mockCallGemini.mockRejectedValueOnce(new Error('API rate limit'));

    const question = makeQuestion();
    const analysis = makeAnalysis();
    const mockLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

    const result = await attemptRegeneration(question, analysis, mockCallGemini, mockLog);

    expect(result.critiqueResult).toBeNull();
    expect(result.regeneratedContent).toBeNull();
    expect(mockLog.warn).toHaveBeenCalledWith(
      'Gemini critique call failed',
      expect.objectContaining({ questionId: 'q-1' })
    );
  });

  it('returns null when critique response cannot be parsed', async () => {
    mockCallGemini.mockResolvedValueOnce('not valid json at all');

    const question = makeQuestion();
    const analysis = makeAnalysis();
    const mockLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

    const result = await attemptRegeneration(question, analysis, mockCallGemini, mockLog);

    expect(result.critiqueResult).toBeNull();
    expect(result.regeneratedContent).toBeNull();
    expect(mockLog.warn).toHaveBeenCalledWith(
      'Failed to parse critique response',
      { questionId: 'q-1' }
    );
  });

  it('returns critique but null regeneratedContent when rewrite fails', async () => {
    const critiqueResponse = JSON.stringify({
      overallScore: 0.4,
      dimensions: [],
      issues: [],
      feedbackForRewrite: 'Needs work.',
    });

    mockCallGemini
      .mockResolvedValueOnce(critiqueResponse)
      .mockRejectedValueOnce(new Error('Network error'));

    const question = makeQuestion();
    const analysis = makeAnalysis();
    const mockLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

    const result = await attemptRegeneration(question, analysis, mockCallGemini, mockLog);

    expect(result.critiqueResult).not.toBeNull();
    expect(result.regeneratedContent).toBeNull();
  });

  it('returns critique but null regeneratedContent when rewrite cannot be parsed', async () => {
    const critiqueResponse = JSON.stringify({
      overallScore: 0.4,
      dimensions: [],
      issues: [],
      feedbackForRewrite: 'Needs work.',
    });

    mockCallGemini
      .mockResolvedValueOnce(critiqueResponse)
      .mockResolvedValueOnce('definitely not json');

    const question = makeQuestion();
    const analysis = makeAnalysis();
    const mockLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

    const result = await attemptRegeneration(question, analysis, mockCallGemini, mockLog);

    expect(result.critiqueResult).not.toBeNull();
    expect(result.regeneratedContent).toBeNull();
  });
});

// ─── Full Pipeline Tests ────────────────────────────────────────────────

describe('runContentQualityLoop', () => {
  const mockFetchQuestions = vi.fn();
  const mockCreateFlag = vi.fn();
  const mockFindActiveFlag = vi.fn();
  const mockUpdateFlag = vi.fn();
  const mockCallGemini = vi.fn();

  function makeDeps() {
    return {
      fetchQuestionsWithAttempts: mockFetchQuestions,
      createFlag: mockCreateFlag,
      findActiveFlag: mockFindActiveFlag,
      updateFlag: mockUpdateFlag,
      callGemini: mockCallGemini,
      log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockFindActiveFlag.mockResolvedValue(null);
    mockCreateFlag.mockImplementation((data: Record<string, unknown>) =>
      Promise.resolve({
        id: 'flag-1',
        questionId: data.questionId,
        flagType: data.flagType,
        metrics: data.metrics,
        status: data.status,
        regeneratedContent: data.regeneratedContent ?? null,
        critiqueFeedback: data.critiqueFeedback ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
        resolvedAt: null,
        resolvedBy: null,
      } as ContentQualityFlagRecord)
    );
  });

  it('skips questions with fewer than minAttempts', async () => {
    const questions = [
      makeQuestion({ id: 'q-1', attempts: makeAttempts(10, 0.5) }),
    ];
    mockFetchQuestions.mockResolvedValue(questions);

    const result = await runContentQualityLoop(makeDeps(), {
      ...DEFAULT_CONTENT_QUALITY_CONFIG,
      minAttempts: 30,
      attemptRegeneration: false,
    });

    expect(result.questionsScanned).toBe(1);
    expect(result.questionsAnalyzed).toBe(0);
    expect(result.newlyFlagged).toBe(0);
  });

  it('analyzes qualifying questions and flags poor items', async () => {
    const questions = makeFlaggableQuestionBatch();
    mockFetchQuestions.mockResolvedValue(questions);

    const result = await runContentQualityLoop(makeDeps(), {
      ...DEFAULT_CONTENT_QUALITY_CONFIG,
      attemptRegeneration: false,
    });

    expect(result.questionsScanned).toBe(3);
    expect(result.questionsAnalyzed).toBe(3);
    expect(result.newlyFlagged).toBeGreaterThanOrEqual(1);
    expect(mockCreateFlag).toHaveBeenCalled();
  });

  it('does not flag items that pass all quality criteria', async () => {
    // 50 attempts with ~60% correct, well-distributed wrong answers → good discrimination
    const questions = [
      makeQuestion({
        id: 'q-good',
        attempts: Array.from({ length: 50 }, (_, i) => ({
          userId: `user-${i}`,
          wasCorrect: i < 30,
          selectedAnswer: i < 30 ? 'A' : (i < 40 ? 'B' : (i < 45 ? 'C' : 'D')),
          timeSpentMs: 20000,
        })),
      }),
    ];
    mockFetchQuestions.mockResolvedValue(questions);

    const result = await runContentQualityLoop(makeDeps(), {
      ...DEFAULT_CONTENT_QUALITY_CONFIG,
      attemptRegeneration: false,
    });

    // Single question: D=1.0 since total=item score, no critical flags → computeFlagTypes empty
    expect(result.questionsAnalyzed).toBe(1);
    expect(result.newlyFlagged).toBe(0);
    expect(mockCreateFlag).not.toHaveBeenCalled();
  });

  it('skips already-flagged items (deduplication)', async () => {
    const questions = makeFlaggableQuestionBatch();
    mockFetchQuestions.mockResolvedValue(questions);
    // Return an existing flag for any flag type check
    mockFindActiveFlag.mockResolvedValue({
      id: 'existing-flag',
      questionId: 'q-bad',
      flagType: 'NON_FUNCTIONING_DISTRACTOR',
      status: 'FLAGGED' as FlagStatus,
      metrics: {},
      regeneratedContent: null,
      critiqueFeedback: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      resolvedAt: null,
      resolvedBy: null,
    });

    const result = await runContentQualityLoop(makeDeps(), {
      ...DEFAULT_CONTENT_QUALITY_CONFIG,
      attemptRegeneration: false,
    });

    expect(result.alreadyFlagged).toBeGreaterThanOrEqual(1);
    expect(mockCreateFlag).not.toHaveBeenCalled();
  });

  it('attempts regeneration when callGemini is provided', async () => {
    const questions = makeFlaggableQuestionBatch();
    mockFetchQuestions.mockResolvedValue(questions);

    const critiqueResponse = JSON.stringify({
      overallScore: 0.3,
      dimensions: [],
      issues: [{ severity: 'critical', category: 'clinical_accuracy', description: 'Bad', suggestion: 'Fix' }],
      feedbackForRewrite: 'Fix the clinical accuracy.',
    });
    const rewriteResponse = JSON.stringify({
      type: 'MCQ',
      question: 'Improved question...',
      options: ['A. Correct', 'B. Wrong', 'C. Wrong', 'D. Wrong'],
      correctAnswer: 'A',
      explanation: { rationale: 'Better rationale' },
      difficulty: 0.5,
    });

    mockCallGemini
      .mockResolvedValueOnce(critiqueResponse)
      .mockResolvedValueOnce(rewriteResponse);

    const result = await runContentQualityLoop(makeDeps());

    expect(result.regenerated).toBeGreaterThanOrEqual(1);
    // Check that the created flag has regenerated content
    const createCall = mockCreateFlag.mock.calls.find(
      (call: Array<Record<string, unknown>>) => call[0]!.regeneratedContent
    )?.[0] as Record<string, unknown> | undefined;
    expect(createCall?.status).toBe('REVIEWED');
    expect(createCall?.regeneratedContent).not.toBeNull();
    expect(createCall?.critiqueFeedback).toBe('Fix the clinical accuracy.');
  });

  it('sets status to "flagged" when regeneration fails', async () => {
    const questions = makeFlaggableQuestionBatch();
    mockFetchQuestions.mockResolvedValue(questions);
    mockCallGemini.mockRejectedValue(new Error('Gemini down'));

    const result = await runContentQualityLoop(makeDeps());

    expect(result.regenerated).toBe(0);
    expect(result.newlyFlagged).toBeGreaterThanOrEqual(1);
    const createCall = mockCreateFlag.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(createCall?.status).toBe('FLAGGED');
    expect(createCall?.regeneratedContent).toBeUndefined();
  });

  it('does not attempt regeneration when attemptRegeneration is false', async () => {
    const questions = makeFlaggableQuestionBatch();
    mockFetchQuestions.mockResolvedValue(questions);

    await runContentQualityLoop(makeDeps(), {
      ...DEFAULT_CONTENT_QUALITY_CONFIG,
      attemptRegeneration: false,
    });

    expect(mockCallGemini).not.toHaveBeenCalled();
    expect(mockCreateFlag.mock.calls.length).toBeGreaterThanOrEqual(1);
    const createCall = mockCreateFlag.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(createCall?.status).toBe('FLAGGED');
  });

  it('caps regeneration at 10 items per run', async () => {
    // Create 5 batches of flaggable questions (15 total questions, 5 are "bad")
    const questions = [
      ...makeFlaggableQuestionBatch(),
      ...makeFlaggableQuestionBatch().map((q) => ({ ...q, id: `${q.id}-b2`, attempts: q.attempts.map((a) => ({ ...a, userId: `${a.userId}-b2` })) })),
      ...makeFlaggableQuestionBatch().map((q) => ({ ...q, id: `${q.id}-b3`, attempts: q.attempts.map((a) => ({ ...a, userId: `${a.userId}-b3` })) })),
      ...makeFlaggableQuestionBatch().map((q) => ({ ...q, id: `${q.id}-b4`, attempts: q.attempts.map((a) => ({ ...a, userId: `${a.userId}-b4` })) })),
      ...makeFlaggableQuestionBatch().map((q) => ({ ...q, id: `${q.id}-b5`, attempts: q.attempts.map((a) => ({ ...a, userId: `${a.userId}-b5` })) })),
    ];
    mockFetchQuestions.mockResolvedValue(questions);

    const critiqueResponse = JSON.stringify({
      overallScore: 0.3,
      dimensions: [],
      issues: [],
      feedbackForRewrite: 'Fix it.',
    });
    const rewriteResponse = JSON.stringify({
      type: 'MCQ',
      question: 'Improved...',
      options: ['A. Correct', 'B. Wrong', 'C. Wrong', 'D. Wrong'],
      correctAnswer: 'A',
      explanation: { rationale: 'Better' },
      difficulty: 0.5,
    });
    mockCallGemini
      .mockResolvedValue(critiqueResponse)
      .mockResolvedValue(rewriteResponse);

    const result = await runContentQualityLoop(makeDeps());

    // All should be flagged but max 10 regenerated
    expect(result.newlyFlagged).toBeGreaterThanOrEqual(5);
    expect(result.regenerated).toBeLessThanOrEqual(10);
  });

  it('handles empty question set gracefully', async () => {
    mockFetchQuestions.mockResolvedValue([]);

    const result = await runContentQualityLoop(makeDeps(), {
      ...DEFAULT_CONTENT_QUALITY_CONFIG,
      attemptRegeneration: false,
    });

    expect(result.questionsScanned).toBe(0);
    expect(result.questionsAnalyzed).toBe(0);
    expect(result.newlyFlagged).toBe(0);
    expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('handles fetchQuestionsWithAttempts rejection', async () => {
    mockFetchQuestions.mockRejectedValue(new Error('DB connection failed'));

    await expect(runContentQualityLoop(makeDeps())).rejects.toThrow('DB connection failed');
  });

  it('reports processingTimeMs', async () => {
    mockFetchQuestions.mockResolvedValue([]);

    const result = await runContentQualityLoop(makeDeps(), {
      ...DEFAULT_CONTENT_QUALITY_CONFIG,
      attemptRegeneration: false,
    });

    expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
    expect(typeof result.processingTimeMs).toBe('number');
  });

  it('works without a log dependency', async () => {
    mockFetchQuestions.mockResolvedValue([]);

    const deps = makeDeps();
    delete (deps as Record<string, unknown>).log;

    const result = await runContentQualityLoop(deps, {
      ...DEFAULT_CONTENT_QUALITY_CONFIG,
      attemptRegeneration: false,
    });

    expect(result.questionsScanned).toBe(0);
  });

  it('handles mixed good and bad questions', async () => {
    const goodQuestion = makeQuestion({
      id: 'q-good',
      attempts: Array.from({ length: 50 }, (_, i) => ({
        userId: `user-${i}`,
        wasCorrect: i < 30,
        selectedAnswer: i < 30 ? 'A' : (i < 40 ? 'B' : (i < 45 ? 'C' : 'D')),
        timeSpentMs: 20000,
      })),
    });

    const questions = [
      goodQuestion,
      ...makeFlaggableQuestionBatch(),
    ];
    mockFetchQuestions.mockResolvedValue(questions);

    const result = await runContentQualityLoop(makeDeps(), {
      ...DEFAULT_CONTENT_QUALITY_CONFIG,
      attemptRegeneration: false,
    });

    expect(result.questionsScanned).toBe(4);
    expect(result.questionsAnalyzed).toBe(4);
    // q-bad should be flagged
    expect(result.newlyFlagged).toBeGreaterThanOrEqual(1);
  });

  it('creates separate flags for different flag types on the same question', async () => {
    // Use concentrated batch which should produce CONCENTRATED_WRONG_OPTION
    const questions = makeConcentratedQuestionBatch();
    mockFetchQuestions.mockResolvedValue(questions);

    await runContentQualityLoop(makeDeps(), {
      ...DEFAULT_CONTENT_QUALITY_CONFIG,
      attemptRegeneration: false,
    });

    // Should have at least 1 flag
    expect(mockCreateFlag.mock.calls.length).toBeGreaterThanOrEqual(1);
    const flagTypes = mockCreateFlag.mock.calls.map(
      (call: Array<Record<string, unknown>>) => call[0]!.flagType
    );
    // Each flag type should be unique per question
    const uniqueTypes = [...new Set(flagTypes)];
    expect(uniqueTypes.length).toBe(flagTypes.length);
  });
});
