import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPrisma, MockContentService } = vi.hoisted(() => {
  const mockContent = {
    getConditionsContent: vi.fn().mockResolvedValue(new Map()),
    getConditionContent: vi.fn().mockResolvedValue(null),
    getConditionMeta: vi.fn().mockResolvedValue(null),
    disconnect: vi.fn().mockResolvedValue(undefined),
  };
  return {
    mockPrisma: {
      userQuestionSeen: {
        findMany: vi.fn(),
        upsert: vi.fn(),
      },
      preGeneratedQuestion: {
        count: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
      },
      questionSeed: {
        findMany: vi.fn(),
        update: vi.fn(),
      },
      question: {
        findMany: vi.fn(),
        updateMany: vi.fn(),
      },
      userProgress: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
      medicalContent: {
        findMany: vi.fn(),
      },
    } as any,
    MockContentService: vi.fn(function (this: any) {
      Object.assign(this, mockContent);
      return this;
    }),
  };
});

vi.mock('../../../functions/api/_shared/prisma-edge', () => ({
  createEdgePrismaClient: vi.fn(() => mockPrisma),
}));

vi.mock('../content/contentService', () => ({
  ContentService: MockContentService,
}));

import { SessionService, parseRationaleFromExplanation } from './sessionService';

function makePregeneratedQuestion(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pg-1',
    questionType: 'mcq',
    system: 'CV',
    conditionId: 'condition-1',
    medicalContentId: 'medical-content-1',
    difficulty: 'medium',
    validationStatus: 'approved',
    generatedAt: new Date('2026-05-01T12:00:00Z'),
    questionData: {
      question: 'What is the next best step?',
      options: ['A', 'B', 'C', 'D'],
      correctAnswer: 'A',
      explanation: 'A is correct.',
    },
    ...overrides,
  };
}

describe('SessionService production serving contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.userQuestionSeen.findMany.mockResolvedValue([]);
    mockPrisma.userQuestionSeen.upsert.mockResolvedValue({});
    mockPrisma.preGeneratedQuestion.count.mockResolvedValue(1);
    mockPrisma.preGeneratedQuestion.findMany.mockResolvedValue([makePregeneratedQuestion()]);
    mockPrisma.preGeneratedQuestion.create.mockResolvedValue({});
    mockPrisma.question.findMany.mockResolvedValue([]);
    mockPrisma.question.updateMany.mockResolvedValue({});
    mockPrisma.questionSeed.findMany.mockResolvedValue([]);
    mockPrisma.questionSeed.update.mockResolvedValue({});
    mockPrisma.userProgress.findMany.mockResolvedValue([]);
    mockPrisma.userProgress.findFirst.mockResolvedValue(null);
    mockPrisma.medicalContent.findMany.mockResolvedValue([]);
  });

  it('queries only approved pregenerated and active approved canonical questions', async () => {
    const service = new SessionService('postgresql://test', {} as any);

    await service.getSessionQuestions({
      userId: 'user-1',
      count: 5,
      system: 'Cardiovascular',
      sessionLane: 'drill',
    });

    expect(mockPrisma.preGeneratedQuestion.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          usedAt: null,
          validationStatus: 'approved',
        }),
      })
    );
    expect(mockPrisma.preGeneratedQuestion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          validationStatus: 'approved',
        }),
      })
    );
    expect(mockPrisma.question.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          lifecycleStatus: 'ACTIVE',
          qaStatus: 'APPROVED',
        }),
      })
    );
  });

  it('only serves questions the review writer can schedule (conditionId present)', async () => {
    const linkageFilter = { conditionId: { not: null } };

    const service = new SessionService('postgresql://test', {} as any);
    await service.getSessionQuestions({
      userId: 'user-1',
      count: 15,
      system: 'Cardiovascular',
      sessionLane: 'drill',
    });

    expect(mockPrisma.preGeneratedQuestion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([linkageFilter]),
        }),
      })
    );
    expect(mockPrisma.question.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([linkageFilter]),
        }),
      })
    );
  });

  it('serves explicit review-pipeline identity for pool and main questions', async () => {
    mockPrisma.question.findMany.mockResolvedValue([
      {
        id: 'q-main-1',
        question: 'Main question?',
        vignette: null,
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 'A',
        explanation: 'Because A.',
        system: 'CV',
        conditionId: 'condition-1',
        medicalContentId: 'medical-content-1',
        difficulty: 'medium',
        timesSeen: 0,
        Condition: { name: 'Heart failure' },
      },
    ]);

    const service = new SessionService('postgresql://test', {} as any);
    // count >= 11 so fetchSimpleSession allocates a non-zero main-table quota
    const result = await service.getSessionQuestions({
      userId: 'user-1',
      count: 15,
      system: 'Cardiovascular',
      sessionLane: 'drill',
    });

    const pool = result.questions.find((q) => q.source === 'pool');
    const main = result.questions.find((q) => q.source === 'main');

    expect(pool).toMatchObject({
      questionSource: 'pre_generated',
      canonicalQuestionId: null,
      sourceQuestionId: 'pg-1',
    });
    expect(main).toMatchObject({
      questionSource: 'question',
      canonicalQuestionId: 'q-main-1',
      sourceQuestionId: 'q-main-1',
    });
  });

  it('does not serve seed-expanded or hot-path generated questions when safe persisted content is short', async () => {
    mockPrisma.preGeneratedQuestion.count.mockResolvedValue(0);
    mockPrisma.preGeneratedQuestion.findMany.mockResolvedValue([]);
    mockPrisma.question.findMany.mockResolvedValue([]);

    const service = new SessionService('postgresql://test', { GEMINI_API_KEY: 'test-key' } as any);
    const result = await service.getSessionQuestions({
      userId: 'user-1',
      count: 5,
      system: 'Cardiovascular',
      sessionLane: 'drill',
    });

    expect(result.questions).toEqual([]);
    expect(mockPrisma.questionSeed.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.medicalContent.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.preGeneratedQuestion.create).not.toHaveBeenCalled();
  });
});

describe('parseRationaleFromExplanation', () => {
  it('returns empty string for null/undefined/empty input', () => {
    expect(parseRationaleFromExplanation(null)).toBe('');
    expect(parseRationaleFromExplanation(undefined)).toBe('');
    expect(parseRationaleFromExplanation('')).toBe('');
    expect(parseRationaleFromExplanation('  ')).toBe('');
  });

  it('returns plain string for non-JSON input', () => {
    expect(parseRationaleFromExplanation('The correct answer is B because...')).toBe(
      'The correct answer is B because...'
    );
  });

  it('returns plain string for JSON that is not structured rationale', () => {
    expect(parseRationaleFromExplanation('{"foo": "bar"}')).toBe('{"foo": "bar"}');
    expect(parseRationaleFromExplanation('["array"]')).toBe('["array"]');
  });

  it('parses JSON-structured rationale with whyCorrect into EnrichedRationale', () => {
    const json = JSON.stringify({
      bottomLine: 'The diagnosis is MI.',
      whyCorrect: 'ST elevation on ECG with elevated troponin confirms MI.',
      whyIncorrectA: 'A is incorrect, consistent with pericarditis.',
      whyIncorrectB: 'B is incorrect, consistent with PE.',
      whyIncorrectC: 'C is incorrect, consistent with aortic dissection.',
      whyIncorrectD: 'D is incorrect, consistent with costochondritis.',
      clinicalPearl: 'Remember: Always check posterior leads for isolated posterior MI.',
    });

    const result = parseRationaleFromExplanation(json);
    expect(result).not.toBeTypeOf('string');
    expect(typeof result).toBe('object');
    const obj = result as Record<string, unknown>;
    expect(obj.bottomLine).toBe('The diagnosis is MI.');
    expect(obj.whyCorrect).toBe('ST elevation on ECG with elevated troponin confirms MI.');
    expect(obj.clinicalPearl).toBe(
      'Remember: Always check posterior leads for isolated posterior MI.'
    );
  });

  it('returns plain string for malformed JSON', () => {
    expect(parseRationaleFromExplanation('{broken json')).toBe('{broken json');
  });

  it('returns empty string for non-string input types', () => {
    expect(parseRationaleFromExplanation(42)).toBe('');
    expect(parseRationaleFromExplanation(true)).toBe('');
    expect(parseRationaleFromExplanation({ whyCorrect: 'x' })).toBe('');
  });

  it('round-trips: JSON string → parse → EnrichedRationale', () => {
    const json = JSON.stringify({
      bottomLine: 'Pneumonia confirmed.',
      whyCorrect: 'CXR shows consolidation. Fever + cough + crackles.',
      whyIncorrectA: 'A: Bronchitis — no consolidation on CXR.',
      whyIncorrectB: 'B: CHF — no pulmonary edema or JVD.',
      whyIncorrectC: 'C: PE — no risk factors, no S1Q3T3.',
      whyIncorrectD: 'D: Pleural effusion — blunted costophrenic angle, not consolidation.',
      clinicalPearl: 'CURB-65 score determines inpatient vs outpatient management.',
      highYieldImageOrTable: 'CXR showing lobar consolidation',
    });

    const result = parseRationaleFromExplanation(json);
    expect(typeof result).toBe('object');
    const r = result as Record<string, unknown>;
    expect(r.whyCorrect).toContain('CXR');
    expect(r.whyIncorrectA).toContain('Bronchitis');
    expect(r.whyIncorrectB).toContain('CHF');
    expect(r.whyIncorrectC).toContain('PE');
    expect(r.whyIncorrectD).toContain('Pleural effusion');
    expect(r.highYieldImageOrTable).toBe('CXR showing lobar consolidation');
  });
});
