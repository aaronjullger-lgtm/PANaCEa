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
