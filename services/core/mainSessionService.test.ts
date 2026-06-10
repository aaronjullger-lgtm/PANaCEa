import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchSessionQuestions } from './mainSessionService';

vi.mock('./questionService', () => ({
  getQuestionBatch: vi.fn(),
}));

vi.mock('@/services/session', () => ({
  resetMomentum: vi.fn(),
}));

const analytics = {
  questionsServed: 1,
  fromPool: 1,
  fromMain: 0,
  generated: 0,
  fromSeeds: 0,
  avgDifficulty: 2,
  systemDistribution: { CV: 1 },
};

describe('fetchSessionQuestions', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('unwraps the standard API envelope from /api/questions/session', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          ok: true,
          data: {
            questions: [
              {
                id: 'q-1',
                question: 'Question?',
                options: ['A', 'B', 'C', 'D'],
                correctAnswerIndex: 0,
                rationale: 'A is correct.',
                system: 'CV',
                pearls: [],
                source: 'pool',
              },
            ],
            analytics,
            poolStatus: { available: 12, needsGeneration: false },
          },
        }),
      })
    );

    const result = await fetchSessionQuestions({ focus: 'all' } as any, 'token', 1);

    expect(result.questions).toHaveLength(1);
    expect(result.questions[0]).toMatchObject({
      id: 'q-1',
      question: 'Question?',
      system: 'CV',
    });
    expect(result.analytics).toEqual(analytics);
    expect(result.poolStatus).toEqual({ available: 12, needsGeneration: false });
  });

  it('preserves identity and content-linkage fields from the session API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          ok: true,
          data: {
            questions: [
              {
                id: 'pg-1',
                question: 'Question?',
                vignette: 'A 24-year-old presents with...',
                options: ['A', 'B', 'C', 'D'],
                correctAnswerIndex: 0,
                rationale: 'A is correct.',
                system: 'CV',
                pearls: [],
                source: 'pool',
                questionSource: 'pre_generated',
                canonicalQuestionId: null,
                sourceQuestionId: 'pg-1',
                medicalContentId: 'mc-1',
                difficulty: 'medium',
              },
            ],
            analytics,
            poolStatus: { available: 12, needsGeneration: false },
          },
        }),
      })
    );

    const result = await fetchSessionQuestions({ focus: 'all' } as any, 'token', 1);

    expect(result.questions[0]).toMatchObject({
      questionSource: 'pre_generated',
      canonicalQuestionId: null,
      sourceQuestionId: 'pg-1',
      medicalContentId: 'mc-1',
      difficulty: 'medium',
      vignette: 'A 24-year-old presents with...',
    });
  });

  it('derives questionSource from the legacy source field when identity is absent', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          ok: true,
          data: {
            questions: [
              {
                id: 'pg-legacy',
                question: 'Pool question?',
                options: ['A', 'B'],
                correctAnswerIndex: 0,
                rationale: 'A.',
                system: 'CV',
                pearls: [],
                source: 'pool',
              },
              {
                id: 'q-main',
                question: 'Main question?',
                options: ['A', 'B'],
                correctAnswerIndex: 1,
                rationale: 'B.',
                system: 'PULM',
                pearls: [],
                source: 'main',
              },
            ],
            analytics,
            poolStatus: { available: 12, needsGeneration: false },
          },
        }),
      })
    );

    const result = await fetchSessionQuestions({ focus: 'all' } as any, 'token', 2);

    expect(result.questions[0]).toMatchObject({
      questionSource: 'pre_generated',
      canonicalQuestionId: null,
      sourceQuestionId: 'pg-legacy',
    });
    expect(result.questions[1]).toMatchObject({
      questionSource: 'question',
      canonicalQuestionId: 'q-main',
      sourceQuestionId: 'q-main',
    });
  });

  it('fails closed instead of serving client-generated fallback questions when the canonical session API is unavailable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: vi.fn().mockResolvedValue({ message: 'database unavailable' }),
      })
    );

    const result = await fetchSessionQuestions({ focus: 'all' } as any, 'token', 1);

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result.questions).toEqual([]);
    expect(result.analytics.generated).toBe(0);
    expect(result.poolStatus).toEqual({ available: 0, needsGeneration: false });
    expect(result.emptyState).toMatchObject({
      code: 'SESSION_CANONICAL_SOURCE_UNAVAILABLE',
    });
  });
});
