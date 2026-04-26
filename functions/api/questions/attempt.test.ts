import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPrisma: any = {
  user: { findUnique: vi.fn(), create: vi.fn() },
  questionAttempt: { create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
  userQuestionSeen: { findUnique: vi.fn(), upsert: vi.fn() },
  question: { update: vi.fn() },
  $queryRaw: vi.fn(),
  $transaction: vi.fn(),
};

vi.mock('../_shared/middleware', () => ({
  authenticatedEndpoint: vi.fn((_schema: unknown, handler: any) => async (context: any) => {
    const result = await handler(context);
    if (result instanceof Response) return result;
    const status = result.status || 200;
    const body =
      result.error != null
        ? JSON.stringify({ error: result.error })
        : JSON.stringify(result.data ?? result);
    return new Response(body, {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }),
  withCors: vi.fn(() => () => new Response(null, { status: 204 })),
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

vi.mock('../ai/learning/profile-crud', () => ({
  scheduleConceptReview: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../lib/answerLetterMap', () => ({
  ANSWER_LETTERS: ['A', 'B', 'C', 'D', 'E'],
}));

vi.mock('../../../lib/api/schemas/questions', async () => {
  const { z } = await import('zod');
  return {
    QuestionAttemptRequestSchema: z.any(),
  };
});

// Import after mocks
import { onRequestPost } from './attempt';
import { safePrismaDisconnect } from '../_shared/prisma-edge';
import { scheduleConceptReview } from '../ai/learning/profile-crud';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeContext(
  bodyOverrides: Record<string, unknown> = {},
  authOverrides: Record<string, unknown> = {},
  envOverrides: Record<string, unknown> = {}
) {
  return {
    env: { DATABASE_URL: 'postgresql://test', CLERK_SECRET_KEY: 'sk_test_123', ...envOverrides },
    auth: { userId: 'clerk_user_1', ...authOverrides },
    validated: {
      body: {
        questionId: 'q-1',
        isCorrect: true,
        system: 'Cardiovascular',
        questionType: 'MCQ',
        timeSpentMs: 5000,
        selectedAnswer: 1,
        ...bodyOverrides,
      },
    },
  };
}

function makeKV() {
  const store = new Map<string, string>();
  return {
    get: vi.fn(async (key: string, options?: { type?: string }) => {
      const value = store.get(key);
      if (!value) return null;
      return options?.type === 'json' ? JSON.parse(value) : value;
    }),
    put: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
  };
}

/** Build a mock tx that mirrors prisma shape and tracks calls. */
function makeMockTx() {
  const tx: any = {
    questionAttempt: { create: vi.fn().mockResolvedValue({}) },
    userQuestionSeen: { findUnique: vi.fn().mockResolvedValue(null), upsert: vi.fn().mockResolvedValue({}) },
    question: { update: vi.fn().mockResolvedValue({}) },
    $queryRaw: vi.fn().mockResolvedValue([{ total: BigInt(10), correct: BigInt(7) }]),
  };
  return tx;
}

function setupDefaultMocks(tx?: any) {
  const mockTx = tx ?? makeMockTx();
  mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-db-1' });
  mockPrisma.questionAttempt.findUnique.mockResolvedValue(null);
  mockPrisma.$transaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => cb(mockTx));
  // getUserSystemStats after transaction
  mockPrisma.questionAttempt.findMany.mockResolvedValue([
    { wasCorrect: true, createdAt: new Date() },
    { wasCorrect: false, createdAt: new Date() },
  ]);
  return mockTx;
}

async function callEndpoint(ctx: any): Promise<{ status: number; body: any }> {
  const response = (await (onRequestPost as any)(ctx)) as Response;
  const status = response.status;
  const body = await response.json();
  return { status, body };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/questions/attempt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---- User lookup ----
  describe('user lookup', () => {
    it('creates a placeholder user when Clerk auth succeeds before webhook sync', async () => {
      const tx = makeMockTx();
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'user-db-1' });
      mockPrisma.user.create.mockResolvedValue({ id: 'user-db-1' });
      mockPrisma.$transaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => cb(tx));
      mockPrisma.questionAttempt.findMany.mockResolvedValue([]);

      const { status, body } = await callEndpoint(makeContext());

      expect(status).toBe(200);
      expect(body.success).toBe(true);
      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            clerkId: 'clerk_user_1',
            email: 'clerk_user_1@placeholder.panacea.app',
          }),
        })
      );
    });
  });

  // ---- Answer normalization ----
  describe('answer normalization', () => {
    it('uses isCorrect when provided', async () => {
      const tx = makeMockTx();
      setupDefaultMocks(tx);
      await callEndpoint(makeContext({ isCorrect: true, wasCorrect: false }));
      // correctness should be true (isCorrect takes precedence via ??)
      const createCall = tx.questionAttempt.create.mock.calls[0][0];
      expect(createCall.data.wasCorrect).toBe(true);
    });

    it('falls back to wasCorrect when isCorrect is undefined', async () => {
      const tx = makeMockTx();
      setupDefaultMocks(tx);
      await callEndpoint(makeContext({ isCorrect: undefined, wasCorrect: false }));
      const createCall = tx.questionAttempt.create.mock.calls[0][0];
      expect(createCall.data.wasCorrect).toBe(false);
    });

    it('converts numeric selectedAnswer to letter (0→A, 1→B, etc.)', async () => {
      const tx = makeMockTx();
      setupDefaultMocks(tx);
      await callEndpoint(makeContext({ selectedAnswer: 2 }));
      const createCall = tx.questionAttempt.create.mock.calls[0][0];
      expect(createCall.data.selectedAnswer).toBe('C');
    });

    it('converts selectedAnswer 0 to A', async () => {
      const tx = makeMockTx();
      setupDefaultMocks(tx);
      await callEndpoint(makeContext({ selectedAnswer: 0 }));
      const createCall = tx.questionAttempt.create.mock.calls[0][0];
      expect(createCall.data.selectedAnswer).toBe('A');
    });

    it('passes string selectedAnswer through unchanged', async () => {
      const tx = makeMockTx();
      setupDefaultMocks(tx);
      await callEndpoint(makeContext({ selectedAnswer: 'D' }));
      const createCall = tx.questionAttempt.create.mock.calls[0][0];
      expect(createCall.data.selectedAnswer).toBe('D');
    });

    it('sets selectedAnswer to null when undefined', async () => {
      const tx = makeMockTx();
      setupDefaultMocks(tx);
      await callEndpoint(makeContext({ selectedAnswer: undefined }));
      const createCall = tx.questionAttempt.create.mock.calls[0][0];
      expect(createCall.data.selectedAnswer).toBeNull();
    });
  });

  // ---- Time normalization ----
  describe('time normalization', () => {
    it('prefers timeSpentMs over timeSpent', async () => {
      const tx = makeMockTx();
      setupDefaultMocks(tx);
      await callEndpoint(makeContext({ timeSpentMs: 3000, timeSpent: 9999 }));
      const createCall = tx.questionAttempt.create.mock.calls[0][0];
      expect(createCall.data.timeSpentMs).toBe(3000);
    });

    it('falls back to timeSpent when timeSpentMs is undefined', async () => {
      const tx = makeMockTx();
      setupDefaultMocks(tx);
      await callEndpoint(makeContext({ timeSpentMs: undefined, timeSpent: 4200 }));
      const createCall = tx.questionAttempt.create.mock.calls[0][0];
      expect(createCall.data.timeSpentMs).toBe(4200);
    });
  });

  // ---- Transaction logic ----
  describe('transaction logic', () => {
    it('creates QuestionAttempt with correct fields', async () => {
      const tx = makeMockTx();
      setupDefaultMocks(tx);
      await callEndpoint(makeContext({ questionId: 'q-42', isCorrect: false, system: 'Pulmonary', mode: 'drill' }));
      const createCall = tx.questionAttempt.create.mock.calls[0][0];
      expect(createCall.data.userId).toBe('user-db-1');
      expect(createCall.data.questionId).toBe('q-42');
      expect(createCall.data.wasCorrect).toBe(false);
      expect(createCall.data.system).toBe('Pulmonary');
      expect(createCall.data.mode).toBe('drill');
      expect(createCall.data.id).toMatch(/^attempt-user-db-1-q-42-/);
    });

    it('ignores client-supplied userId and writes attempt for authenticated user only', async () => {
      const tx = makeMockTx();
      setupDefaultMocks(tx);

      await callEndpoint(makeContext({ userId: 'user-db-other', questionId: 'q-99' }));

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { clerkId: 'clerk_user_1' },
        select: { id: true },
      });
      const createCall = tx.questionAttempt.create.mock.calls[0][0];
      expect(createCall.data.userId).toBe('user-db-1');
      expect(createCall.data.userId).not.toBe('user-db-other');
    });

    it('upserts UserQuestionSeen for new item (timesShown=1)', async () => {
      const tx = makeMockTx();
      tx.userQuestionSeen.findUnique.mockResolvedValue(null);
      setupDefaultMocks(tx);
      await callEndpoint(makeContext({ timeSpentMs: 5000, isCorrect: true }));
      const upsertCall = tx.userQuestionSeen.upsert.mock.calls[0][0];
      expect(upsertCall.create.timesShown).toBe(1);
      expect(upsertCall.create.timesCorrect).toBe(1);
      expect(upsertCall.create.timesIncorrect).toBe(0);
      expect(upsertCall.create.avgTimeMs).toBe(5000);
      expect(upsertCall.create.firstSeenAt).toBeInstanceOf(Date);
    });

    it('upserts UserQuestionSeen with running average time for existing item', async () => {
      const tx = makeMockTx();
      tx.userQuestionSeen.findUnique.mockResolvedValue({ avgTimeMs: 4000, timesShown: 3 });
      setupDefaultMocks(tx);
      // Running avg: (4000 * (3-1) + 6000) / 3 = (8000 + 6000) / 3 = 14000/3 ≈ 4667
      await callEndpoint(makeContext({ timeSpentMs: 6000 }));
      const upsertCall = tx.userQuestionSeen.upsert.mock.calls[0][0];
      expect(upsertCall.update.avgTimeMs).toBe(Math.round((4000 * 2 + 6000) / 3));
    });

    it('updates Question stats (increment timesSeen, timesCorrect when correct)', async () => {
      const tx = makeMockTx();
      setupDefaultMocks(tx);
      await callEndpoint(makeContext({ isCorrect: true }));
      const updateCall = tx.question.update.mock.calls[0][0];
      expect(updateCall.data.timesSeen).toEqual({ increment: 1 });
      expect(updateCall.data.timesCorrect).toEqual({ increment: 1 });
    });

    it('does not increment timesCorrect when incorrect', async () => {
      const tx = makeMockTx();
      setupDefaultMocks(tx);
      await callEndpoint(makeContext({ isCorrect: false }));
      const updateCall = tx.question.update.mock.calls[0][0];
      expect(updateCall.data.timesSeen).toEqual({ increment: 1 });
      expect(updateCall.data.timesCorrect).toBeUndefined();
    });

    it('handles missing question gracefully (try/catch)', async () => {
      const tx = makeMockTx();
      tx.question.update.mockRejectedValue(new Error('Record not found'));
      setupDefaultMocks(tx);
      const { status, body } = await callEndpoint(makeContext());
      // Should still succeed — question.update failure is caught
      expect(status).toBe(200);
      expect(body.success).toBe(true);
    });

    it('computes overall stats from aggregate SQL', async () => {
      const tx = makeMockTx();
      tx.$queryRaw.mockResolvedValueOnce([{ total: BigInt(20), correct: BigInt(15) }]);
      setupDefaultMocks(tx);
      const { body } = await callEndpoint(makeContext({ system: undefined }));
      expect(body.stats.totalQuestionsAnswered).toBe(20);
      expect(body.stats.correctAnswers).toBe(15);
      expect(body.stats.overallAccuracy).toBe(75);
    });

    it('returns attemptId in response', async () => {
      const tx = makeMockTx();
      setupDefaultMocks(tx);
      const { body } = await callEndpoint(makeContext());
      expect(body.attemptId).toMatch(/^attempt-user-db-1-q-1-/);
    });

    it('short-circuits duplicate submissions with the same idempotency key', async () => {
      const tx = makeMockTx();
      setupDefaultMocks(tx);
      const cache = makeKV();
      const body = { idempotencyKey: 'attempt-idem-1' };
      const env = { CACHE: cache };

      const first = await callEndpoint(makeContext(body, {}, env));
      const second = await callEndpoint(makeContext(body, {}, env));

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(second.body.attemptId).toBe(first.body.attemptId);
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('dedupes idempotent submissions from the primary key when KV is unavailable', async () => {
      setupDefaultMocks();
      mockPrisma.questionAttempt.findUnique.mockResolvedValueOnce({
        id: 'attempt-user-db-1-attempt-idem-2',
      });
      mockPrisma.$queryRaw.mockResolvedValueOnce([{ total: BigInt(1), correct: BigInt(1) }]);

      const { status, body } = await callEndpoint(
        makeContext({ idempotencyKey: 'attempt-idem-2', system: undefined })
      );

      expect(status).toBe(200);
      expect(body.deduped).toBe(true);
      expect(body.attemptId).toBe('attempt-user-db-1-attempt-idem-2');
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
  });

  // ---- System stats ----
  describe('system stats', () => {
    it('includes system-specific stats when system is provided', async () => {
      const tx = makeMockTx();
      // First $queryRaw call = overall stats, second = system stats
      tx.$queryRaw
        .mockResolvedValueOnce([{ total: BigInt(10), correct: BigInt(7) }])
        .mockResolvedValueOnce([{ total: BigInt(5), correct: BigInt(4) }]);
      setupDefaultMocks(tx);
      // getUserSystemStats returns detailed stats
      mockPrisma.questionAttempt.findMany.mockResolvedValue([
        { wasCorrect: true, createdAt: new Date() },
        { wasCorrect: true, createdAt: new Date() },
        { wasCorrect: false, createdAt: new Date() },
      ]);
      const { body } = await callEndpoint(makeContext({ system: 'Cardiovascular' }));
      expect(body.systemStats).toBeDefined();
      expect(body.systemStats.system).toBe('Cardiovascular');
    });

    it('skips system stats when system is absent', async () => {
      const tx = makeMockTx();
      setupDefaultMocks(tx);
      const { body } = await callEndpoint(makeContext({ system: undefined }));
      // systemStats should be null (no system provided, no getUserSystemStats called)
      expect(body.systemStats).toBeNull();
    });
  });

  // ---- SRS scheduling ----
  describe('SRS scheduling', () => {
    it('calls scheduleConceptReview with correct conceptKey', async () => {
      const tx = makeMockTx();
      setupDefaultMocks(tx);
      await callEndpoint(makeContext({ system: 'Cardio', conditionId: 'cond-1', isCorrect: true }));
      expect(scheduleConceptReview).toHaveBeenCalledWith(
        mockPrisma,
        'user-db-1',
        'Cardio|cond-1',
        true
      );
    });

    it('uses questionType in conceptKey when conditionId is absent', async () => {
      const tx = makeMockTx();
      setupDefaultMocks(tx);
      await callEndpoint(makeContext({ system: 'Neuro', conditionId: undefined, questionType: 'MCQ', isCorrect: false }));
      expect(scheduleConceptReview).toHaveBeenCalledWith(
        mockPrisma,
        'user-db-1',
        'Neuro|MCQ',
        false
      );
    });

    it('does not fail if scheduleConceptReview throws', async () => {
      const tx = makeMockTx();
      setupDefaultMocks(tx);
      (scheduleConceptReview as any).mockRejectedValue(new Error('SRS boom'));
      const { status, body } = await callEndpoint(makeContext({ isCorrect: true, system: 'Cardio' }));
      expect(status).toBe(200);
      expect(body.success).toBe(true);
    });

    it('skips scheduleConceptReview when correctness is not boolean', async () => {
      const tx = makeMockTx();
      setupDefaultMocks(tx);
      await callEndpoint(makeContext({ isCorrect: undefined, wasCorrect: undefined, system: 'Cardio' }));
      expect(scheduleConceptReview).not.toHaveBeenCalled();
    });
  });

  // ---- Error handling ----
  describe('error handling', () => {
    it('throws on transaction failure', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-db-1' });
      mockPrisma.$transaction.mockRejectedValue(new Error('DB down'));
      // The middleware wrapper will catch the thrown error as a 500
      // Since our mock middleware re-throws, we expect the promise to reject
      await expect(callEndpoint(makeContext())).rejects.toThrow('Failed to record attempt');
    });

    it('calls safePrismaDisconnect in finally (success path)', async () => {
      const tx = makeMockTx();
      setupDefaultMocks(tx);
      await callEndpoint(makeContext());
      expect(safePrismaDisconnect).toHaveBeenCalledWith(mockPrisma);
    });

    it('calls safePrismaDisconnect in finally (error path)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-db-1' });
      mockPrisma.$transaction.mockRejectedValue(new Error('DB down'));
      try {
        await callEndpoint(makeContext());
      } catch {
        // expected
      }
      expect(safePrismaDisconnect).toHaveBeenCalledWith(mockPrisma);
    });
  });

  // ---- Success response shape ----
  describe('success response', () => {
    it('returns { success, attemptId, stats, systemStats }', async () => {
      const tx = makeMockTx();
      setupDefaultMocks(tx);
      const { status, body } = await callEndpoint(makeContext());
      expect(status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.attemptId).toBeDefined();
      expect(body.stats).toBeDefined();
      expect(body.stats).toHaveProperty('totalQuestionsAnswered');
      expect(body.stats).toHaveProperty('correctAnswers');
      expect(body.stats).toHaveProperty('overallAccuracy');
    });
  });
});
