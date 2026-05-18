import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  captured,
  mockDisconnect,
  mockResolveOrCreateUserId,
  mockReviewLogFindMany,
} = vi.hoisted(() => ({
  captured: { get: null as ((ctx: any) => Promise<any>) | null },
  mockDisconnect: vi.fn().mockResolvedValue(undefined),
  mockResolveOrCreateUserId: vi.fn(),
  mockReviewLogFindMany: vi.fn(),
}));

const mockPrisma = {
  reviewLog: {
    findMany: mockReviewLogFindMany,
  },
};

vi.mock('../_shared/middleware', () => ({
  authenticatedEndpoint: (_schema: unknown, handler: (ctx: any) => Promise<any>) => {
    captured.get = handler;
    return handler;
  },
}));

vi.mock('../_shared/prisma-edge', () => ({
  createEdgePrismaClient: () => mockPrisma,
  safePrismaDisconnect: (...args: unknown[]) => mockDisconnect(...args),
}));

vi.mock('../_shared/user-resolver', () => ({
  resolveOrCreateUserId: (...args: unknown[]) => mockResolveOrCreateUserId(...args),
}));

import './review-history';

function makeContext(query: Record<string, unknown> = {}) {
  return {
    env: { DATABASE_URL: 'postgres://test' },
    auth: { userId: 'clerk_user_123' },
    validated: { query },
  };
}

describe('GET /api/user/review-history', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveOrCreateUserId.mockResolvedValue('user-db-1');
  });

  it('queries canonical ReviewLog history for the internal user and maps export-compatible fields', async () => {
    mockReviewLogFindMany.mockResolvedValue([
      {
        id: 'review-1',
        userId: 'user-db-1',
        questionId: 'q-1',
        conditionId: 'mc-1',
        medicalContentId: 'mc-1',
        grade: 3,
        grade_continuous: 3.25,
        wasCorrect: true,
        reviewedAt: new Date('2026-05-01T12:00:00.000Z'),
        scheduledAt: new Date('2026-05-03T12:00:00.000Z'),
        elapsedDays: 2,
        responseTimeMs: 25_000,
        state: 2,
        stability: 6.5,
        difficulty: 4.2,
        retrievability: 0.84,
        sessionId: 'session-1',
        attemptId: 'attempt-1',
        sessionType: 'MAIN',
        review_type: 'real',
        system: 'Cardiovascular',
        telemetry: { server_computed: { telemetry_quality: 'full' } },
        QuestionAttempt: {
          selectedAnswer: 'A',
          durationMs: 23_000,
          telemetryJson: { mouse_efficiency_index: 0.8 },
          answerChangedCount: 1,
          timeSpentMs: 24_000,
          createdAt: new Date('2026-05-01T11:59:59.000Z'),
        },
      },
    ]);

    const result = await captured.get!(
      makeContext({ limit: 2, mainOnly: 'true', includeRapidGuesses: 'false' })
    );

    expect(mockResolveOrCreateUserId).toHaveBeenCalledWith(mockPrisma, 'clerk_user_123');
    expect(mockReviewLogFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 'user-db-1',
          review_type: { in: ['real'] },
          sessionType: { in: ['MAIN', 'DRILL'] },
        },
        orderBy: { reviewedAt: 'asc' },
        take: 2,
      })
    );
    expect(mockReviewLogFindMany.mock.calls[0][0].select).toEqual(
      expect.objectContaining({
        grade: true,
        grade_continuous: true,
        stability: true,
        difficulty: true,
        retrievability: true,
        QuestionAttempt: expect.any(Object),
      })
    );

    expect(result.data).toMatchObject({
      count: 1,
      userId: 'clerk_user_123',
    });
    expect(result.data.events).toBe(result.data.reviews);
    expect(result.data.reviews[0]).toMatchObject({
      id: 'attempt-1',
      reviewLogId: 'review-1',
      attemptId: 'attempt-1',
      userId: 'clerk_user_123',
      questionId: 'q-1',
      conditionId: 'mc-1',
      medicalContentId: 'mc-1',
      wasCorrect: true,
      createdAt: '2026-05-01T12:00:00.000Z',
      reviewedAt: '2026-05-01T12:00:00.000Z',
      scheduledAt: '2026-05-03T12:00:00.000Z',
      durationMs: 23_000,
      responseTimeMs: 25_000,
      answerChangedCount: 1,
      timeSpentMs: 24_000,
      telemetryJson: { mouse_efficiency_index: 0.8 },
      system: 'Cardiovascular',
      selectedAnswer: 'A',
      rating: 3,
      gradeContinuous: 3.25,
      state: 2,
      stability: 6.5,
      difficulty: 4.2,
      retrievability: 0.84,
      elapsedDays: 2,
      sessionId: 'session-1',
      sessionType: 'MAIN',
      reviewType: 'real',
      telemetryQuality: 'full',
    });
    expect(mockDisconnect).toHaveBeenCalledWith(mockPrisma);
  });

  it('can include rapid guesses and falls back to ReviewLog telemetry when no attempt row exists', async () => {
    mockReviewLogFindMany.mockResolvedValue([
      {
        id: 'review-rapid',
        userId: 'user-db-1',
        questionId: 'q-rapid',
        conditionId: 'mc-rapid',
        medicalContentId: null,
        grade: 1,
        grade_continuous: null,
        wasCorrect: false,
        reviewedAt: new Date('2026-05-02T10:00:00.000Z'),
        scheduledAt: null,
        elapsedDays: 0,
        responseTimeMs: 1_200,
        state: 0,
        stability: 0,
        difficulty: 0,
        retrievability: null,
        sessionId: null,
        attemptId: null,
        sessionType: 'DRILL',
        review_type: 'rapid_guess',
        system: null,
        telemetry: {
          answer_changes: 2,
          server_computed: { telemetry_quality: 'minimal' },
        },
        QuestionAttempt: null,
      },
    ]);

    const result = await captured.get!(
      makeContext({ limit: 10, mainOnly: 'false', includeRapidGuesses: 'true' })
    );

    expect(mockReviewLogFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 'user-db-1',
          review_type: { in: ['real', 'rapid_guess'] },
        },
        take: 10,
      })
    );
    expect(result.data.reviews[0]).toMatchObject({
      id: 'review-rapid',
      reviewLogId: 'review-rapid',
      attemptId: null,
      durationMs: 1_200,
      responseTimeMs: 1_200,
      answerChangedCount: 2,
      timeSpentMs: 1_200,
      telemetryJson: {
        answer_changes: 2,
        server_computed: { telemetry_quality: 'minimal' },
      },
      reviewType: 'rapid_guess',
      telemetryQuality: 'minimal',
    });
  });
});
