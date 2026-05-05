import { beforeEach, describe, expect, it, vi } from 'vitest';

const _capture = vi.hoisted(() => ({
  handler: null as ((context: any) => Promise<any>) | null,
}));

const { mockPrisma, mocks } = vi.hoisted(() => ({
  mockPrisma: {} as any,
  mocks: {
    submitDrillReview: vi.fn(),
    resolveCorrectAnswer: vi.fn(),
    resolveOrCreateUserRecord: vi.fn(),
    resolveReviewQuestion: vi.fn(),
    ensureDueVariant: vi.fn(),
    markConsumed: vi.fn(),
    getEorRotationEnd: vi.fn(),
    scheduleConceptReview: vi.fn(),
  },
}));

vi.mock('../_shared/middleware', () => ({
  authenticatedEndpoint: vi.fn((_schema: unknown, handler: any) => {
    _capture.handler = handler;
    return handler;
  }),
}));

vi.mock('../_shared/prisma-edge', () => ({
  createEdgePrismaClient: vi.fn(() => mockPrisma),
  safePrismaDisconnect: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../_shared/secureLogger', () => ({
  createEndpointLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock('../_shared/user-resolver', () => ({
  resolveOrCreateUserRecord: (...args: unknown[]) => mocks.resolveOrCreateUserRecord(...args),
}));

vi.mock('../../../lib/services/drillReviewService', () => ({
  submitDrillReview: (...args: unknown[]) => mocks.submitDrillReview(...args),
  resolveCorrectAnswer: (...args: unknown[]) => mocks.resolveCorrectAnswer(...args),
}));

vi.mock('../../../lib/fsrs/eorScheduler', () => ({
  getEorRotationEnd: (...args: unknown[]) => mocks.getEorRotationEnd(...args),
}));

vi.mock('../ai/learning/profile-crud', () => ({
  scheduleConceptReview: (...args: unknown[]) => mocks.scheduleConceptReview(...args),
}));

vi.mock('../../../lib/ensureDueVariant', () => ({
  ensureDueVariant: (...args: unknown[]) => mocks.ensureDueVariant(...args),
}));

vi.mock('../drills/_shared/reviewQuestionResolver', () => ({
  PLACEHOLDER_CORRECT_ANSWER: '__correct_answer__',
  resolveReviewQuestion: (...args: unknown[]) => mocks.resolveReviewQuestion(...args),
}));

vi.mock('../../../lib/services/reservoir', () => ({
  markConsumed: (...args: unknown[]) => mocks.markConsumed(...args),
}));

import './submit';

function makeContext(overrides: Record<string, unknown> = {}) {
  return {
    env: { DATABASE_URL: 'postgresql://test', GEMINI_API_KEY: 'test-key' },
    auth: { userId: 'clerk-user-1' },
    validated: {
      body: {
        questionId: 'pg-1',
        rating: 3,
        isCorrect: true,
        userAnswer: 'A',
        timeSpent: 15000,
      },
    },
    ...overrides,
  };
}

describe('POST /api/srs/submit compatibility adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveOrCreateUserRecord.mockResolvedValue({
      id: 'user-db-1',
      yearInProgram: 2,
      currentRotation: 'FM',
      eorTestDate: null,
      rotationEndDate: null,
    });
    mocks.resolveReviewQuestion.mockResolvedValue({
      question: {
        id: 'pg-1',
        sourceQuestionId: 'pg-1',
        questionSource: 'pre_generated',
        conditionId: 'condition-1',
        system: 'CV',
        difficulty: 'medium',
        questionType: 'mcq',
        questionData: {
          question: 'Question?',
          options: ['A', 'B', 'C', 'D'],
          correctAnswer: 'A',
        },
      },
    });
    mocks.resolveCorrectAnswer.mockReturnValue('A');
    mocks.getEorRotationEnd.mockReturnValue(null);
    mocks.submitDrillReview.mockResolvedValue({
      isCorrect: true,
      fsrsSchedule: { nextDueDate: '2026-05-05T00:00:00.000Z' },
    });
    mocks.ensureDueVariant.mockResolvedValue(undefined);
    mocks.markConsumed.mockResolvedValue(1);
    mocks.scheduleConceptReview.mockResolvedValue(undefined);
  });

  it('delegates to drillReviewService without writing a legacy concept schedule', async () => {
    const result = await _capture.handler!(makeContext());

    expect(result.data.success).toBe(true);
    expect(mocks.submitDrillReview).toHaveBeenCalledTimes(1);
    expect(mocks.scheduleConceptReview).not.toHaveBeenCalled();
  });

  it('preserves TARGETED progress context when submitting a targeted due card', async () => {
    await _capture.handler!(
      makeContext({
        validated: {
          body: {
            questionId: 'pg-1',
            rating: 3,
            isCorrect: true,
            userAnswer: 'A',
            timeSpent: 15000,
            progressContext: 'TARGETED',
          },
        },
      })
    );

    expect(mocks.submitDrillReview).toHaveBeenCalledWith(
      expect.anything(),
      'user-db-1',
      expect.objectContaining({
        questionId: 'pg-1',
        sessionType: 'targeted',
      }),
      expect.anything(),
      expect.anything(),
      null,
      undefined
    );
  });

  it('uses legacy attemptId as the canonical drill-review idempotency key', async () => {
    await _capture.handler!(
      makeContext({
        validated: {
          body: {
            questionId: 'pg-1',
            rating: 3,
            isCorrect: true,
            userAnswer: 'A',
            timeSpent: 15000,
            attemptId: 'legacy-attempt-123',
          },
        },
      })
    );

    expect(mocks.submitDrillReview).toHaveBeenCalledWith(
      expect.anything(),
      'user-db-1',
      expect.objectContaining({
        questionId: 'pg-1',
        idempotencyKey: 'legacy-attempt-123',
      }),
      expect.anything(),
      expect.anything(),
      null,
      undefined
    );
  });
});
