/**
 * Unit tests for lib/services/contentQualityLoop.ts
 *
 * Pure exports tested (no I/O, no async):
 *   getQualifyingFlags(analysis)
 *   hasNonFunctioningDistractors(analysis)
 *   hasConcentratedWrongOption(analysis)
 *   computeFlagTypes(analysis)
 *   mapToItemAttemptRecords(questions)
 *   toGeneratedQuestion(q)
 *
 * Notes:
 *   - CRITICAL_FLAG_TYPES = { NON_DISCRIMINATING, NEGATIVE_DISCRIMINATION, NEGATIVE_RPB }
 *   - getQualifyingFlags: includes all 'critical' severity flags AND
 *     'warning' severity flags that are in CRITICAL_FLAG_TYPES
 *   - hasConcentratedWrongOption: >80% of wrong selections on a single wrong option
 *   - mapToItemAttemptRecords: computes cross-question per-user total scores
 */

import { describe, it, expect } from 'vitest';
import type { ItemAnalysis, ItemFlag, DistractorAnalysis } from './itemAnalysisService';
import {
  getQualifyingFlags,
  hasNonFunctioningDistractors,
  hasConcentratedWrongOption,
  computeFlagTypes,
  mapToItemAttemptRecords,
  toGeneratedQuestion,
  type QuestionWithAttempts,
} from './contentQualityLoop';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeFlag(
  type: ItemFlag['type'],
  severity: ItemFlag['severity'],
  message = 'Test flag'
): ItemFlag {
  return { type, severity, message };
}

function makeDistractor(
  option: string,
  isCorrect: boolean,
  selectionCount: number,
  selectionRate = selectionCount / 100,
  isNonFunctioning = !isCorrect && selectionRate < 0.05
): DistractorAnalysis {
  return {
    option,
    isCorrect,
    selectionCount,
    selectionRate,
    isNonFunctioning,
    avgTotalScore: 0.5,
  };
}

function makeAnalysis(overrides: Partial<ItemAnalysis> = {}): ItemAnalysis {
  return {
    questionId: 'q-001',
    attemptCount: 50,
    difficulty: 0.70,
    discriminationIndex: 0.25,
    pointBiserial: 0.30,
    distractors: [
      makeDistractor('A', true, 70),
      makeDistractor('B', false, 15),
      makeDistractor('C', false, 10),
      makeDistractor('D', false, 5),
    ],
    avgTimeMs: 45000,
    medianTimeMs: 40000,
    flags: [],
    grade: 'good',
    ...overrides,
  };
}

function makeQuestion(
  id = 'q-001',
  attempts: QuestionWithAttempts['attempts'] = []
): QuestionWithAttempts {
  return {
    id,
    question: 'What is the mechanism of action of ACE inhibitors?',
    options: ['A', 'B', 'C', 'D'],
    correctAnswer: 'A',
    explanation: 'ACE inhibitors block angiotensin converting enzyme.',
    difficulty: 'medium',
    source: 'NBME',
    system: 'Cardiology',
    attempts,
  };
}

// ─── getQualifyingFlags ───────────────────────────────────────────────────────

describe('getQualifyingFlags', () => {
  it('returns empty array when no flags', () => {
    const analysis = makeAnalysis({ flags: [] });
    expect(getQualifyingFlags(analysis)).toHaveLength(0);
  });

  it('includes all critical-severity flags', () => {
    const flags = [
      makeFlag('TOO_EASY', 'critical'),
      makeFlag('TOO_HARD', 'critical'),
    ];
    const result = getQualifyingFlags(makeAnalysis({ flags }));
    expect(result).toHaveLength(2);
  });

  it('includes warning flags in CRITICAL_FLAG_TYPES (NON_DISCRIMINATING)', () => {
    const flags = [makeFlag('NON_DISCRIMINATING', 'warning')];
    const result = getQualifyingFlags(makeAnalysis({ flags }));
    expect(result).toHaveLength(1);
    expect(result[0]!.type).toBe('NON_DISCRIMINATING');
  });

  it('includes warning flags for NEGATIVE_DISCRIMINATION', () => {
    const flags = [makeFlag('NEGATIVE_DISCRIMINATION', 'warning')];
    const result = getQualifyingFlags(makeAnalysis({ flags }));
    expect(result).toHaveLength(1);
  });

  it('includes warning flags for NEGATIVE_RPB', () => {
    const flags = [makeFlag('NEGATIVE_RPB', 'warning')];
    const result = getQualifyingFlags(makeAnalysis({ flags }));
    expect(result).toHaveLength(1);
  });

  it('excludes info-severity flags', () => {
    const flags = [makeFlag('SLOW_ITEM', 'info')];
    const result = getQualifyingFlags(makeAnalysis({ flags }));
    expect(result).toHaveLength(0);
  });

  it('excludes warning flags NOT in CRITICAL_FLAG_TYPES', () => {
    const flags = [
      makeFlag('TOO_EASY', 'warning'),   // not in CRITICAL_FLAG_TYPES
      makeFlag('TOO_HARD', 'warning'),   // not in CRITICAL_FLAG_TYPES
      makeFlag('SLOW_ITEM', 'warning'),  // not in CRITICAL_FLAG_TYPES
    ];
    const result = getQualifyingFlags(makeAnalysis({ flags }));
    expect(result).toHaveLength(0);
  });

  it('handles mix: critical + qualifying warning + non-qualifying warning', () => {
    const flags = [
      makeFlag('NON_FUNCTIONING_DISTRACTOR', 'critical'),   // critical → include
      makeFlag('NEGATIVE_RPB', 'warning'),                   // in CRITICAL_FLAG_TYPES → include
      makeFlag('TOO_EASY', 'warning'),                       // NOT in CRITICAL_FLAG_TYPES → exclude
    ];
    const result = getQualifyingFlags(makeAnalysis({ flags }));
    expect(result).toHaveLength(2);
  });
});

// ─── hasNonFunctioningDistractors ────────────────────────────────────────────

describe('hasNonFunctioningDistractors', () => {
  it('returns false when all distractors function normally', () => {
    const analysis = makeAnalysis({
      distractors: [
        makeDistractor('A', true, 70),
        makeDistractor('B', false, 15, 0.15, false),
        makeDistractor('C', false, 10, 0.10, false),
        makeDistractor('D', false, 5, 0.05, false),
      ],
    });
    expect(hasNonFunctioningDistractors(analysis)).toBe(false);
  });

  it('returns true when one wrong distractor is non-functioning', () => {
    const analysis = makeAnalysis({
      distractors: [
        makeDistractor('A', true, 90),
        makeDistractor('B', false, 3, 0.03, true), // non-functioning
        makeDistractor('C', false, 5, 0.05, false),
        makeDistractor('D', false, 2, 0.02, false),
      ],
    });
    expect(hasNonFunctioningDistractors(analysis)).toBe(true);
  });

  it('ignores the correct option when it is non-functioning', () => {
    // isCorrect=true → ignored even if isNonFunctioning=true
    const analysis = makeAnalysis({
      distractors: [
        makeDistractor('A', true, 2, 0.02, true), // correct option, ignored
        makeDistractor('B', false, 35, 0.35, false),
        makeDistractor('C', false, 35, 0.35, false),
        makeDistractor('D', false, 28, 0.28, false),
      ],
    });
    expect(hasNonFunctioningDistractors(analysis)).toBe(false);
  });

  it('returns false with empty distractors array', () => {
    expect(hasNonFunctioningDistractors(makeAnalysis({ distractors: [] }))).toBe(false);
  });
});

// ─── hasConcentratedWrongOption ───────────────────────────────────────────────

describe('hasConcentratedWrongOption', () => {
  it('returns false when wrong selections are evenly distributed', () => {
    const analysis = makeAnalysis({
      distractors: [
        makeDistractor('A', true, 70),
        makeDistractor('B', false, 10),
        makeDistractor('C', false, 10),
        makeDistractor('D', false, 10),
      ],
    });
    // Each wrong option = 33% of wrong selections → not concentrated
    expect(hasConcentratedWrongOption(analysis)).toBe(false);
  });

  it('returns true when one wrong option has >80% of wrong selections', () => {
    const analysis = makeAnalysis({
      distractors: [
        makeDistractor('A', true, 50),
        makeDistractor('B', false, 45), // 45/50 = 90% of wrong selections
        makeDistractor('C', false, 3),
        makeDistractor('D', false, 2),
      ],
    });
    expect(hasConcentratedWrongOption(analysis)).toBe(true);
  });

  it('returns false when concentration is exactly 80% (boundary: must be >0.80)', () => {
    const analysis = makeAnalysis({
      distractors: [
        makeDistractor('A', true, 60),
        makeDistractor('B', false, 32), // 32/40 = 0.80 → NOT > 0.80
        makeDistractor('C', false, 8),
      ],
    });
    expect(hasConcentratedWrongOption(analysis)).toBe(false);
  });

  it('returns false with no wrong distractors', () => {
    const analysis = makeAnalysis({
      distractors: [makeDistractor('A', true, 100)],
    });
    expect(hasConcentratedWrongOption(analysis)).toBe(false);
  });

  it('returns false when totalWrongSelections is 0', () => {
    const analysis = makeAnalysis({
      distractors: [
        makeDistractor('A', true, 100),
        makeDistractor('B', false, 0),
        makeDistractor('C', false, 0),
      ],
    });
    expect(hasConcentratedWrongOption(analysis)).toBe(false);
  });

  it('correct option not counted in wrong selections', () => {
    // Correct option has many selections but wrong B has 90% of *wrong* selections
    const analysis = makeAnalysis({
      distractors: [
        makeDistractor('A', true, 90), // not counted
        makeDistractor('B', false, 9),  // 9/10 = 90% of wrong selections
        makeDistractor('C', false, 1),
      ],
    });
    expect(hasConcentratedWrongOption(analysis)).toBe(true);
  });
});

// ─── computeFlagTypes ─────────────────────────────────────────────────────────

describe('computeFlagTypes', () => {
  it('returns empty array when no critical flags and no distractor issues', () => {
    const analysis = makeAnalysis({
      flags: [],
      distractors: [
        makeDistractor('A', true, 70),
        makeDistractor('B', false, 15, 0.15, false),
        makeDistractor('C', false, 15, 0.15, false),
      ],
    });
    expect(computeFlagTypes(analysis)).toHaveLength(0);
  });

  it('includes NON_DISCRIMINATING from flags', () => {
    const analysis = makeAnalysis({
      flags: [makeFlag('NON_DISCRIMINATING', 'warning')],
    });
    expect(computeFlagTypes(analysis)).toContain('NON_DISCRIMINATING');
  });

  it('includes NEGATIVE_DISCRIMINATION from flags', () => {
    const analysis = makeAnalysis({
      flags: [makeFlag('NEGATIVE_DISCRIMINATION', 'critical')],
    });
    expect(computeFlagTypes(analysis)).toContain('NEGATIVE_DISCRIMINATION');
  });

  it('adds NON_FUNCTIONING_DISTRACTOR when distractors are non-functioning', () => {
    const analysis = makeAnalysis({
      flags: [],
      distractors: [
        makeDistractor('A', true, 90),
        makeDistractor('B', false, 3, 0.03, true), // non-functioning
        makeDistractor('C', false, 7, 0.07, false),
      ],
    });
    expect(computeFlagTypes(analysis)).toContain('NON_FUNCTIONING_DISTRACTOR');
  });

  it('adds CONCENTRATED_WRONG_OPTION when one wrong option dominates', () => {
    const analysis = makeAnalysis({
      flags: [],
      distractors: [
        makeDistractor('A', true, 50),
        makeDistractor('B', false, 45), // 90% of wrong selections
        makeDistractor('C', false, 3),
        makeDistractor('D', false, 2),
      ],
    });
    expect(computeFlagTypes(analysis)).toContain('CONCENTRATED_WRONG_OPTION');
  });

  it('returns unique types (no duplicates)', () => {
    const analysis = makeAnalysis({
      flags: [
        makeFlag('NON_DISCRIMINATING', 'warning'),
        makeFlag('NON_DISCRIMINATING', 'warning'), // duplicate
      ],
    });
    const types = computeFlagTypes(analysis);
    const unique = new Set(types);
    expect(types.length).toBe(unique.size);
  });

  it('excludes non-CRITICAL_FLAG_TYPES from flags (e.g., TOO_EASY)', () => {
    const analysis = makeAnalysis({
      flags: [makeFlag('TOO_EASY', 'warning')],
    });
    // TOO_EASY is not in CRITICAL_FLAG_TYPES
    expect(computeFlagTypes(analysis)).not.toContain('TOO_EASY');
  });

  it('can return multiple flag types together', () => {
    const analysis = makeAnalysis({
      flags: [
        makeFlag('NON_DISCRIMINATING', 'warning'),
        makeFlag('NEGATIVE_RPB', 'warning'),
      ],
      distractors: [
        makeDistractor('A', true, 50),
        makeDistractor('B', false, 45),
        makeDistractor('C', false, 3),
        makeDistractor('D', false, 2),
      ],
    });
    const types = computeFlagTypes(analysis);
    expect(types).toContain('NON_DISCRIMINATING');
    expect(types).toContain('NEGATIVE_RPB');
    expect(types).toContain('CONCENTRATED_WRONG_OPTION');
  });
});

// ─── mapToItemAttemptRecords ──────────────────────────────────────────────────

describe('mapToItemAttemptRecords', () => {
  it('returns empty Map for empty question array', () => {
    const result = mapToItemAttemptRecords([]);
    expect(result.size).toBe(0);
  });

  it('creates one Map entry per question', () => {
    const questions = [
      makeQuestion('q-1', [{ userId: 'u1', wasCorrect: true, selectedAnswer: 'A', timeSpentMs: 10000 }]),
      makeQuestion('q-2', [{ userId: 'u1', wasCorrect: false, selectedAnswer: 'B', timeSpentMs: 8000 }]),
    ];
    const result = mapToItemAttemptRecords(questions);
    expect(result.size).toBe(2);
    expect(result.has('q-1')).toBe(true);
    expect(result.has('q-2')).toBe(true);
  });

  it('maps wasCorrect → isCorrect', () => {
    const questions = [
      makeQuestion('q-1', [
        { userId: 'u1', wasCorrect: true, selectedAnswer: 'A', timeSpentMs: 5000 },
        { userId: 'u2', wasCorrect: false, selectedAnswer: 'B', timeSpentMs: 6000 },
      ]),
    ];
    const result = mapToItemAttemptRecords(questions);
    const records = result.get('q-1')!;
    expect(records[0]!.isCorrect).toBe(true);
    expect(records[1]!.isCorrect).toBe(false);
  });

  it('maps selectedAnswer → selectedOption (null → empty string)', () => {
    const questions = [
      makeQuestion('q-1', [
        { userId: 'u1', wasCorrect: false, selectedAnswer: null, timeSpentMs: 5000 },
      ]),
    ];
    const result = mapToItemAttemptRecords(questions);
    expect(result.get('q-1')![0]!.selectedOption).toBe('');
  });

  it('maps timeSpentMs → timeSpentMs (null → 0)', () => {
    const questions = [
      makeQuestion('q-1', [
        { userId: 'u1', wasCorrect: false, selectedAnswer: 'A', timeSpentMs: null },
      ]),
    ];
    const result = mapToItemAttemptRecords(questions);
    expect(result.get('q-1')![0]!.timeSpentMs).toBe(0);
  });

  it('computes totalScore as per-user correct/total across ALL questions', () => {
    // u1 answers q1 correctly + q2 incorrectly → totalScore = 1/2 = 0.5
    const questions = [
      makeQuestion('q-1', [{ userId: 'u1', wasCorrect: true, selectedAnswer: 'A', timeSpentMs: 5000 }]),
      makeQuestion('q-2', [{ userId: 'u1', wasCorrect: false, selectedAnswer: 'B', timeSpentMs: 4000 }]),
    ];
    const result = mapToItemAttemptRecords(questions);
    const q1records = result.get('q-1')!;
    expect(q1records[0]!.totalScore).toBeCloseTo(0.5, 5);
    expect(q1records[0]!.totalItems).toBe(2);
  });

  it('each record has studentId set to userId', () => {
    const questions = [
      makeQuestion('q-1', [{ userId: 'user-abc', wasCorrect: true, selectedAnswer: 'A', timeSpentMs: 5000 }]),
    ];
    const result = mapToItemAttemptRecords(questions);
    expect(result.get('q-1')![0]!.studentId).toBe('user-abc');
  });

  it('multiple attempts on same question all appear in records', () => {
    const questions = [
      makeQuestion('q-1', [
        { userId: 'u1', wasCorrect: true, selectedAnswer: 'A', timeSpentMs: 5000 },
        { userId: 'u2', wasCorrect: false, selectedAnswer: 'B', timeSpentMs: 6000 },
        { userId: 'u3', wasCorrect: true, selectedAnswer: 'A', timeSpentMs: 7000 },
      ]),
    ];
    const result = mapToItemAttemptRecords(questions);
    expect(result.get('q-1')).toHaveLength(3);
  });
});

// ─── toGeneratedQuestion ──────────────────────────────────────────────────────

describe('toGeneratedQuestion', () => {
  it('maps question text', () => {
    const q = makeQuestion();
    const result = toGeneratedQuestion(q);
    expect(result.question).toBe(q.question);
  });

  it('maps correctAnswer', () => {
    const q = makeQuestion();
    const result = toGeneratedQuestion(q);
    expect(result.correctAnswer).toBe('A');
  });

  it('maps explanation into rationale', () => {
    const q = makeQuestion();
    const result = toGeneratedQuestion(q);
    expect(result.explanation.rationale).toBe(q.explanation);
  });

  it('maps system to type', () => {
    const q = makeQuestion();
    const result = toGeneratedQuestion(q);
    expect(result.type).toBe('Cardiology');
  });

  it('maps options array', () => {
    const q = { ...makeQuestion(), options: ['A', 'B', 'C', 'D'] };
    const result = toGeneratedQuestion(q);
    expect(result.options).toEqual(['A', 'B', 'C', 'D']);
  });

  it('non-array options defaults to empty array', () => {
    const q = { ...makeQuestion(), options: {} };
    const result = toGeneratedQuestion(q);
    expect(result.options).toEqual([]);
  });

  it('difficulty "easy" → 0.2', () => {
    const result = toGeneratedQuestion({ ...makeQuestion(), difficulty: 'easy' });
    expect(result.difficulty).toBeCloseTo(0.2, 5);
  });

  it('difficulty "medium" → 0.5', () => {
    const result = toGeneratedQuestion({ ...makeQuestion(), difficulty: 'medium' });
    expect(result.difficulty).toBeCloseTo(0.5, 5);
  });

  it('difficulty "hard" → 0.8', () => {
    const result = toGeneratedQuestion({ ...makeQuestion(), difficulty: 'hard' });
    expect(result.difficulty).toBeCloseTo(0.8, 5);
  });

  it('unknown difficulty defaults to 0.5', () => {
    const result = toGeneratedQuestion({ ...makeQuestion(), difficulty: 'unknown_level' });
    expect(result.difficulty).toBeCloseTo(0.5, 5);
  });
});
