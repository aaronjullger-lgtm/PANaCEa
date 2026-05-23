import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

// ── Capture the handler passed to authenticatedEndpoint ────────────────────
const _capture = vi.hoisted(() => ({
  handler: null as ((context: any) => Promise<any>) | null,
}));

// ── Mock all external dependencies ─────────────────────────────────────────

// KV Cache
const mockGetFromCache = vi.fn();
const mockSetInCache = vi.fn();
const mockIsKVAvailable = vi.fn();
vi.mock('../_shared/cache', () => ({
  getFromCache: (...args: any[]) => mockGetFromCache(...args),
  setInCache: (...args: any[]) => mockSetInCache(...args),
  isKVAvailable: (...args: any[]) => mockIsKVAvailable(...args),
  getConditionCacheKey: vi.fn(),
  getQuestionPoolCacheKey: vi.fn(),
}));

// Idempotency
const mockBeginSubmissionIdempotency = vi.fn();
const mockCompleteSubmissionIdempotency = vi.fn();
const mockFailSubmissionIdempotency = vi.fn();
vi.mock('../_shared/submission-idempotency', () => ({
  beginSubmissionIdempotency: (...args: any[]) => mockBeginSubmissionIdempotency(...args),
  completeSubmissionIdempotency: (...args: any[]) => mockCompleteSubmissionIdempotency(...args),
  failSubmissionIdempotency: (...args: any[]) => mockFailSubmissionIdempotency(...args),
}));

vi.mock('../_shared/prisma-edge', () => ({
  createEdgePrismaClient: vi.fn(),
  safePrismaDisconnect: vi.fn(),
}));

vi.mock('../_shared/middleware', () => ({
  authenticatedEndpoint: vi.fn((_schema: any, handler: any) => {
    _capture.handler = handler;
    return handler;
  }),
  withCors: vi.fn(() => vi.fn()),
}));

vi.mock('../_shared/secureLogger', () => ({
  createEndpointLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    addContext: vi.fn(),
  })),
}));

vi.mock('../_shared/cors', () => ({
  handleCorsPreflightSecure: vi.fn(),
}));

vi.mock('../../../lib/services/drillReviewService', () => ({
  submitDrillReview: vi.fn(),
}));

vi.mock('../../../lib/fsrs/eorScheduler', () => ({
  getEorRotationEnd: vi.fn(() => null),
}));

vi.mock('../../../lib/ensureDueVariant', () => ({
  ensureDueVariant: vi.fn(() => Promise.resolve()),
}));

vi.mock('./_shared/reviewQuestionResolver', () => ({
  resolveReviewQuestion: vi.fn(),
}));

vi.mock('../../../lib/services/reservoir', () => ({
  markConsumed: vi.fn().mockResolvedValue(1),
}));

vi.mock('../_shared/user-resolver', () => ({
  resolveOrCreateUserRecord: vi.fn(),
}));

vi.mock('./submit-review', () => ({
  buildBatchIdemKey: vi.fn((clerkId: string, key: string) => `idem:submit-reviews:${clerkId}:${key}`),
  DrillSubmitReviewSchema: { parse: (x: any) => x },
  getTelemetryUrgencyMultiplier: vi.fn((telemetry: any) =>
    telemetry?.urgency_multiplier ? Math.min(2, Math.max(0.5, telemetry.urgency_multiplier)) : undefined
  ),
  IDEM_TTL_SECONDS: 86400,
}));

// ── Import mocked functions ────────────────────────────────────────────────
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { submitDrillReview } from '../../../lib/services/drillReviewService';
import { ensureDueVariant } from '../../../lib/ensureDueVariant';
import { resolveReviewQuestion } from './_shared/reviewQuestionResolver';
import { resolveOrCreateUserRecord } from '../_shared/user-resolver';
import { markConsumed } from '../../../lib/services/reservoir';

// Force module load so capturedHandler gets assigned
import './submit-reviews';

// ── Helpers ────────────────────────────────────────────────────────────────

const MOCK_USER = {
  id: 'user-internal-123',
  yearInProgram: 1 as const,
  currentRotation: 'IM',
  eorTestDate: null,
  rotationEndDate: null,
};

const MOCK_QUESTION = {
  id: 'question-abc',
  questionId: 'question-abc',
  conditionId: 'cond-xyz',
  system: 'Cardiovascular',
  difficulty: 'medium',
  questionType: 'mcq',
  questionData: {},
};

const REVIEW_ITEM_A = {
  questionId: 'question-aaa',
  selectedAnswer: 'B',
  timeSpentMs: 12000,
  timeToFirstClick: 2500,
  answerSwitches: 1,
  totalDwellTime: 11500,
  timezone: 'America/New_York',
  wakeTimeHHMM: '07:00',
  telemetry: null,
  sessionType: 'main' as const,
  idempotencyKey: 'idem-a',
};

const REVIEW_ITEM_B = {
  questionId: 'question-bbb',
  selectedAnswer: 'C',
  timeSpentMs: 8000,
  timeToFirstClick: 1200,
  answerSwitches: 0,
  totalDwellTime: 7800,
  timezone: 'America/New_York',
  wakeTimeHHMM: '07:00',
  telemetry: { session_id: 'sess-xyz' } as any,
  sessionType: 'drill' as const,
  idempotencyKey: 'idem-b',
};

const REVIEW_ITEM_C = {
  questionId: 'question-ccc',
  selectedAnswer: 'A',
  timeSpentMs: 30000,
  timeToFirstClick: 5000,
  answerSwitches: 2,
  totalDwellTime: 29000,
  timezone: 'America/New_York',
  wakeTimeHHMM: '07:00',
  telemetry: null,
  sessionType: 'main' as const,
  idempotencyKey: 'idem-c',
};

function makePrisma(userResult: any = MOCK_USER) {
  return {
    user: {
      findUnique: vi.fn().mockResolvedValue(userResult),
      create: vi.fn().mockResolvedValue(userResult ?? MOCK_USER),
    },
    question: {
      findUnique: vi.fn().mockResolvedValue({ conditionFamily: 'Cardiac Arrhythmias' }),
    },
  };
}

function makeContext(overrides: Partial<{ env: Record<string, any>; validated: any[] }> = {}) {
  return {
    env: {
      DATABASE_URL: 'postgresql://test',
      GEMINI_API_KEY: 'test-key',
      CACHE: {},
      ...overrides.env,
    },
    auth: { userId: 'clerk-user-batch' },
    validated: overrides.validated ?? [REVIEW_ITEM_A, REVIEW_ITEM_B, REVIEW_ITEM_C],
    request: new Request('http://localhost/api/drills/submit-reviews'),
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('POST /api/drills/submit-reviews (batch)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockIsKVAvailable.mockReturnValue(false);
    mockGetFromCache.mockResolvedValue(null);
    mockSetInCache.mockResolvedValue(undefined);
    mockBeginSubmissionIdempotency.mockResolvedValue(null);
    mockCompleteSubmissionIdempotency.mockResolvedValue(undefined);
    mockFailSubmissionIdempotency.mockResolvedValue(undefined);

    const prisma = makePrisma();
    (createEdgePrismaClient as Mock).mockReturnValue(prisma);
    (resolveOrCreateUserRecord as Mock).mockResolvedValue(MOCK_USER);
    (resolveReviewQuestion as Mock).mockResolvedValue({ question: MOCK_QUESTION, source: 'question' });
    (submitDrillReview as Mock).mockResolvedValue({
      isCorrect: true,
      fsrsSchedule: {
        intervalDays: 3,
        nextDueDate: '2026-04-10T00:00:00Z',
        stability: 4.5,
        difficulty: 0.3,
      },
    });
    (markConsumed as Mock).mockResolvedValue(1);
  });

  // ── 1. DATABASE_URL not configured ───────────────────────────────────
  it('returns 500 when DATABASE_URL is not configured', async () => {
    const result = await _capture.handler!(
      makeContext({ env: { DATABASE_URL: '' } })
    );

    expect(result).toMatchObject({ status: 500, error: 'Database not configured' });
    expect(createEdgePrismaClient).not.toHaveBeenCalled();
  });

  // ── 2. Empty batch ──────────────────────────────────────────────────
  it('returns empty data array for an empty batch', async () => {
    const result = await _capture.handler!(makeContext({ validated: [] }));

    expect(result.data).toEqual([]);
    expect(submitDrillReview).not.toHaveBeenCalled();
  });

  // ── 3. Processes each item ──────────────────────────────────────────
  it('calls submitDrillReview for each item in the batch', async () => {
    await _capture.handler!(makeContext());

    expect(submitDrillReview).toHaveBeenCalledTimes(3);
  });

  // ── 4. Returns per-item results ─────────────────────────────────────
  it('returns success results for each item', async () => {
    const result = await _capture.handler!(makeContext());

    expect(result.data).toHaveLength(3);
    expect(result.data[0]).toMatchObject({ questionId: 'question-aaa', success: true });
    expect(result.data[1]).toMatchObject({ questionId: 'question-bbb', success: true });
    expect(result.data[2]).toMatchObject({ questionId: 'question-ccc', success: true });
  });

  // ── 5. Calls submitDrillReview with correct parameters ──────────────
  it('passes correct parameters to submitDrillReview for each item', async () => {
    await _capture.handler!(makeContext());

    const calls = (submitDrillReview as Mock).mock.calls;
    expect(calls).toHaveLength(3);

    // First call: REVIEW_ITEM_A
    const [prismaA, userIdA, reviewDataA] = calls[0] as any[];
    expect(userIdA).toBe(MOCK_USER.id);
    expect(reviewDataA.questionId).toBe('question-aaa');
    expect(reviewDataA.selectedAnswer).toBe('B');
    expect(reviewDataA.sessionType).toBe('main');

    // Second call: REVIEW_ITEM_B
    const [, userIdB, reviewDataB] = calls[1] as any[];
    expect(userIdB).toBe(MOCK_USER.id);
    expect(reviewDataB.questionId).toBe('question-bbb');
    expect(reviewDataB.selectedAnswer).toBe('C');
    expect(reviewDataB.sessionType).toBe('drill');
  });

  // ── 6. Normalizes string answers for question resolution only ──────
  it('normalizes selectedAnswer to string for resolveReviewQuestion', async () => {
    const numericReview = { ...REVIEW_ITEM_A, selectedAnswer: 0 as any, idempotencyKey: 'num-idem' };
    await _capture.handler!(makeContext({ validated: [numericReview] }));

    // resolveReviewQuestion receives normalized string
    expect(resolveReviewQuestion).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ selectedAnswer: '0' }),
    );
    // submitDrillReview receives the raw value from the request body
    expect((submitDrillReview as Mock).mock.calls[0][2].selectedAnswer).toBe(0);
  });

  // ── 7. Question not found per-item ──────────────────────────────────
  it('returns error for items where question is not found', async () => {
    (resolveReviewQuestion as Mock)
      .mockResolvedValueOnce({ question: null, source: null }) // ITEM_A not found
      .mockResolvedValueOnce({ question: MOCK_QUESTION, source: 'question' })
      .mockResolvedValueOnce({ question: MOCK_QUESTION, source: 'question' });

    const result = await _capture.handler!(makeContext());

    expect(result.data[0]).toMatchObject({
      questionId: 'question-aaa',
      success: false,
      error: 'Question not found',
      source: 'missing',
    });
    expect(result.data[1]).toMatchObject({ questionId: 'question-bbb', success: true });
    expect(result.data[2]).toMatchObject({ questionId: 'question-ccc', success: true });
    expect(submitDrillReview).toHaveBeenCalledTimes(2); // skipped missing item
  });

  // ── 8. Error resilience — one item fails, others succeed ────────────
  it('continues processing when one item throws', async () => {
    (submitDrillReview as Mock)
      .mockResolvedValueOnce({ isCorrect: true, fsrsSchedule: null }) // ITEM_A ok
      .mockRejectedValueOnce(new Error('db error')) // ITEM_B fails
      .mockResolvedValueOnce({ isCorrect: false, fsrsSchedule: null }); // ITEM_C ok

    const result = await _capture.handler!(makeContext());

    expect(result.data[0]).toMatchObject({ questionId: 'question-aaa', success: true });
    expect(result.data[1]).toMatchObject({
      questionId: 'question-bbb',
      success: false,
      error: 'Failed to submit review',
    });
    expect(result.data[2]).toMatchObject({ questionId: 'question-ccc', success: true });
    expect(submitDrillReview).toHaveBeenCalledTimes(3);
  });

  // ── 9. Calls markConsumed when telemetry has session_id ─────────────
  it('calls markConsumed for items with session_id in telemetry', async () => {
    await _capture.handler!(makeContext());

    // ITEM_B has telemetry.session_id = 'sess-xyz'
    expect(markConsumed).toHaveBeenCalledTimes(1);
    expect(markConsumed).toHaveBeenCalledWith(
      expect.anything(),
      'sess-xyz',
      ['question-bbb']
    );
  });

  it('does not call markConsumed when telemetry has no session_id', async () => {
    // Items with telemetry=null or no session_id
    const reviewsWithoutSession = [
      REVIEW_ITEM_A,
      { ...REVIEW_ITEM_B, telemetry: {} as any },
      REVIEW_ITEM_C,
    ];
    await _capture.handler!(makeContext({ validated: reviewsWithoutSession }));

    expect(markConsumed).not.toHaveBeenCalled();
  });

  // ── 10. markConsumed errors are non-fatal ───────────────────────────
  it('continues after markConsumed throws', async () => {
    (markConsumed as Mock).mockRejectedValue(new Error('reservoir error'));

    const result = await _capture.handler!(makeContext());

    // All items should still succeed despite markConsumed failures
    expect(result.data).toHaveLength(3);
    expect(result.data.every((r: any) => r.success)).toBe(true);
    expect(submitDrillReview).toHaveBeenCalledTimes(3);
  });

  // ── 11. Calls ensureDueVariant for incorrect answers ────────────────
  it('calls ensureDueVariant for incorrect answers (fire-and-forget)', async () => {
    (submitDrillReview as Mock)
      .mockResolvedValueOnce({ isCorrect: false, fsrsSchedule: null })
      .mockResolvedValueOnce({ isCorrect: true, fsrsSchedule: null })
      .mockResolvedValueOnce({ isCorrect: false, fsrsSchedule: null });

    await _capture.handler!(makeContext());

    expect(ensureDueVariant).toHaveBeenCalledTimes(2); // items A and C incorrect
  });

  // ── 12. Does not call ensureDueVariant for correct answers ──────────
  it('does not call ensureDueVariant for correct answers', async () => {
    (submitDrillReview as Mock)
      .mockResolvedValueOnce({ isCorrect: true, fsrsSchedule: null })
      .mockResolvedValueOnce({ isCorrect: true, fsrsSchedule: null })
      .mockResolvedValueOnce({ isCorrect: true, fsrsSchedule: null });

    await _capture.handler!(makeContext());

    expect(ensureDueVariant).not.toHaveBeenCalled();
  });

  // ── 13. safePrismaDisconnect always called ──────────────────────────
  it('calls safePrismaDisconnect on success', async () => {
    await _capture.handler!(makeContext());

    expect(safePrismaDisconnect).toHaveBeenCalledTimes(1);
  });

  it('calls safePrismaDisconnect on error', async () => {
    (resolveOrCreateUserRecord as Mock).mockRejectedValue(new Error('user lookup failed'));

    await _capture.handler!(makeContext());

    expect(safePrismaDisconnect).toHaveBeenCalledTimes(1);
  });

  it('does not call safePrismaDisconnect when prisma was never created', async () => {
    await _capture.handler!(makeContext({ env: { DATABASE_URL: '' } }));

    expect(safePrismaDisconnect).not.toHaveBeenCalled();
  });

  // ── 14. Returns 500 for top-level errors ────────────────────────────
  it('returns 500 for top-level errors with details', async () => {
    (resolveOrCreateUserRecord as Mock).mockRejectedValue(new Error('unexpected failure'));

    const result = await _capture.handler!(makeContext());

    expect(result).toMatchObject({
      status: 500,
      error: 'Failed to submit reviews',
      details: 'unexpected failure',
    });
  });

  // ── 15. Persistent idempotency per-item ─────────────────────────────
  describe('per-item persistent idempotency', () => {
    const CACHED_RESPONSE = {
      isCorrect: true,
      isRapidGuess: false,
      nextReview: null,
    };

    it('returns persisted response without calling submitDrillReview for completed items', async () => {
      mockBeginSubmissionIdempotency
        .mockResolvedValueOnce({ state: 'completed', response: CACHED_RESPONSE }) // ITEM_A cached
        .mockResolvedValueOnce(null) // ITEM_B fresh
        .mockResolvedValueOnce(null); // ITEM_C fresh

      const result = await _capture.handler!(makeContext());

      expect(result.data[0]).toMatchObject({
        questionId: 'question-aaa',
        success: true,
        source: 'idempotent-store',
      });
      // Pipeline entered for cached items — submitDrillReview skipped
      // ITEM_B and ITEM_C go through the pipeline
      expect(submitDrillReview).toHaveBeenCalledTimes(2);
    });

    it('returns conflict when duplicate submission is still processing', async () => {
      mockBeginSubmissionIdempotency
        .mockResolvedValueOnce({
          state: 'in_progress',
          retryAfterSeconds: 5,
        })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      const result = await _capture.handler!(makeContext());

      expect(result.data[0]).toMatchObject({
        questionId: 'question-aaa',
        success: false,
        error: 'Submission is still processing. Retry shortly.',
        source: 'idempotent-in-progress',
        retryAfterSeconds: 5,
      });
      expect(submitDrillReview).toHaveBeenCalledTimes(2); // ITEM_B and ITEM_C
    });

    it('completes durable idempotency for successful items', async () => {
      mockBeginSubmissionIdempotency
        .mockResolvedValueOnce({ state: 'started', id: 'idem-row-1' })
        .mockResolvedValueOnce({ state: 'started', id: 'idem-row-2' })
        .mockResolvedValueOnce({ state: 'started', id: 'idem-row-3' });

      await _capture.handler!(makeContext());

      expect(mockCompleteSubmissionIdempotency).toHaveBeenCalledTimes(3);
      expect(mockCompleteSubmissionIdempotency).toHaveBeenCalledWith(
        expect.anything(),
        'idem-row-1',
        expect.any(Object),
      );
      expect(mockCompleteSubmissionIdempotency).toHaveBeenCalledWith(
        expect.anything(),
        'idem-row-2',
        expect.any(Object),
      );
      expect(mockCompleteSubmissionIdempotency).toHaveBeenCalledWith(
        expect.anything(),
        'idem-row-3',
        expect.any(Object),
      );
    });

    it('fails durable idempotency for items that throw', async () => {
      mockBeginSubmissionIdempotency
        .mockResolvedValueOnce({ state: 'started', id: 'idem-row-1' })
        .mockResolvedValueOnce({ state: 'started', id: 'idem-row-2' })
        .mockResolvedValueOnce({ state: 'started', id: 'idem-row-3' });
      (submitDrillReview as Mock)
        .mockResolvedValueOnce({ isCorrect: true, fsrsSchedule: null })
        .mockRejectedValueOnce(new Error('db crash'))
        .mockResolvedValueOnce({ isCorrect: false, fsrsSchedule: null });

      await _capture.handler!(makeContext());

      expect(mockCompleteSubmissionIdempotency).toHaveBeenCalledTimes(2); // rows 1 and 3
      expect(mockFailSubmissionIdempotency).toHaveBeenCalledTimes(1); // row 2 failed
      expect(mockFailSubmissionIdempotency).toHaveBeenCalledWith(
        expect.anything(),
        'idem-row-2',
        'INTERNAL_ERROR',
      );
    });

    it('writes KV cache for successful items when KV is available', async () => {
      mockIsKVAvailable.mockReturnValue(true);
      mockBeginSubmissionIdempotency
        .mockResolvedValueOnce({ state: 'started', id: 'idem-row-1' })
        .mockResolvedValueOnce({ state: 'started', id: 'idem-row-2' })
        .mockResolvedValueOnce({ state: 'started', id: 'idem-row-3' });

      await _capture.handler!(makeContext());

      expect(mockSetInCache).toHaveBeenCalledTimes(3);
      // Each call uses the correct batch idempotency key
      const keys = (mockSetInCache as Mock).mock.calls.map((c: any[]) => c[1]);
      expect(keys[0]).toContain('clerk-user-batch');
      expect(keys[0]).toContain('idem-a');
      expect(keys[1]).toContain('idem-b');
      expect(keys[2]).toContain('idem-c');
    });

    it('does not write KV cache when unavailable', async () => {
      mockIsKVAvailable.mockReturnValue(false);
      mockBeginSubmissionIdempotency.mockResolvedValue({ state: 'started', id: 'idem-row-1' });

      await _capture.handler!(makeContext());

      expect(mockSetInCache).not.toHaveBeenCalled();
    });

    it('handles KV cache write failure gracefully (non-fatal)', async () => {
      mockIsKVAvailable.mockReturnValue(true);
      mockBeginSubmissionIdempotency.mockResolvedValue({ state: 'started', id: 'idem-row-1' });
      mockSetInCache.mockRejectedValue(new Error('KV write failed'));

      const result = await _capture.handler!(makeContext());

      // All items should still succeed despite KV failures
      expect(result.data.every((r: any) => r.success)).toBe(true);
    });
  });

  // ── 16. Telemetry urgency multiplier ────────────────────────────────
  it('passes telemetry urgency multiplier to submitDrillReview', async () => {
    const reviewWithUrgency = {
      ...REVIEW_ITEM_A,
      telemetry: { urgency_multiplier: 1.8 },
      idempotencyKey: 'urgent-idem',
    };

    await _capture.handler!(makeContext({ validated: [reviewWithUrgency] }));

    const call = (submitDrillReview as Mock).mock.calls[0] as any[];
    expect(call[6]).toBe(1.8);
  });

  it('clamps telemetry urgency multiplier to [0.5, 2.0]', async () => {
    const overUrgency = {
      ...REVIEW_ITEM_A,
      telemetry: { urgency_multiplier: 3.5 },
      idempotencyKey: 'over-urgent',
    };

    await _capture.handler!(makeContext({ validated: [overUrgency] }));

    const call = (submitDrillReview as Mock).mock.calls[0] as any[];
    expect(call[6]).toBe(2.0);
  });

  // ── 17. User resolution via shared resolver ─────────────────────────
  it('resolves user via resolveOrCreateUserRecord (delegates first-login bootstrap)', async () => {
    const result = await _capture.handler!(makeContext({ validated: [REVIEW_ITEM_A] }));

    expect(resolveOrCreateUserRecord).toHaveBeenCalledWith(
      expect.anything(),
      'clerk-user-batch',
      expect.objectContaining({
        id: true,
        yearInProgram: true,
        currentRotation: true,
        eorTestDate: true,
        rotationEndDate: true,
      }),
    );
    expect(result.data[0].success).toBe(true);
  });
});
