/**
 * Sprint S3 — Idempotency key end-to-end tests for the /api/drills/submit-review
 * (singular) and /api/drills/submit-reviews (batch) Edge handlers.
 *
 * These tests exercise the KV-backed idempotency cache short-circuit:
 *   - Same key twice → pipeline runs once; second call returns cached response.
 *   - Missing key → every call runs the pipeline (backward-compatible).
 *   - Different keys → each call runs the pipeline.
 *   - KV unavailable → pipeline always runs (graceful degradation).
 *
 * The handler is imported AFTER mocking every edge-only dependency, because
 * `authenticatedEndpoint` is mocked to return the bare handler — which we can
 * then invoke directly with a synthetic context.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks: edge-only dependencies ───────────────────────────────
const mockSubmitDrillReview = vi.fn();
const mockResolveReviewQuestion = vi.fn();
const mockGetEorRotationEnd = vi.fn();
const mockScheduleConceptReview = vi.fn();
const mockEnsureDueVariant = vi.fn();
const mockGetRelativeDrillPerformance = vi.fn();
const idemStore = new Map<string, { id: string; status: string; response?: Record<string, unknown> }>();

vi.mock('../functions/api/_shared/submission-idempotency', () => ({
  beginSubmissionIdempotency: vi.fn(async (_prisma: unknown, options: any) => {
    if (!options.idempotencyKey) return null;
    const key = `${options.userId}:${options.endpoint}:${options.idempotencyKey}`;
    const existing = idemStore.get(key);
    if (existing?.status === 'completed') {
      return { state: 'completed', response: existing.response };
    }
    if (existing?.status === 'processing') {
      return { state: 'in_progress', retryAfterSeconds: 5 };
    }
    const id = `idem-${idemStore.size + 1}`;
    idemStore.set(key, { id, status: 'processing' });
    return { state: 'started', id };
  }),
  completeSubmissionIdempotency: vi.fn(async (_prisma: unknown, id: string, response: Record<string, unknown>) => {
    for (const record of idemStore.values()) {
      if (record.id === id) {
        record.status = 'completed';
        record.response = response;
      }
    }
  }),
  failSubmissionIdempotency: vi.fn(async (_prisma: unknown, id: string) => {
    for (const record of idemStore.values()) {
      if (record.id === id) {
        record.status = 'failed';
      }
    }
  }),
}));

vi.mock('../functions/api/_shared/prisma-edge', () => ({
  createEdgePrismaClient: vi.fn(() => ({
    user: {
      findUnique: vi.fn(async () => ({
        id: 'user-internal-id',
        yearInProgram: 'PA2',
        currentRotation: null,
        eorTestDate: null,
        rotationEndDate: null,
      })),
    },
    question: {
      findUnique: vi.fn(async () => ({ conditionFamily: null })),
    },
  })),
  safePrismaDisconnect: vi.fn(),
}));
vi.mock('../functions/api/_shared/middleware', () => ({
  authenticatedEndpoint: vi.fn((_schema: unknown, handler: unknown) => handler),
  withCors: vi.fn(() => async () => ({})),
}));
vi.mock('../functions/api/_shared/secureLogger', () => ({
  createEndpointLogger: vi.fn(() => ({
    addContext: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));
vi.mock('../functions/api/_shared/requestLogger', () => ({
  attachLogMeta: vi.fn(),
  getRequestId: vi.fn(() => 'test-req-id'),
}));
vi.mock('../functions/api/_shared/structuredLogger', () => ({
  createSpan: vi.fn(() => ({ end: vi.fn(() => ({ durationMs: 1 })) })),
}));
vi.mock('../lib/services/drillReviewService', () => ({
  submitDrillReview: (...args: unknown[]) => mockSubmitDrillReview(...args),
}));
vi.mock('../lib/observability/pipelineTracer', () => ({
  createPipelineTracer: vi.fn(() => ({
    addContext: vi.fn(),
    step: vi.fn(),
    getSummary: vi.fn(() => ({
      decisions: [],
      spans: [],
      warnings: [],
      totalDurationMs: 0,
    })),
  })),
}));
vi.mock('../lib/fsrs/eorScheduler', () => ({
  getEorRotationEnd: (...args: unknown[]) => mockGetEorRotationEnd(...args),
}));
vi.mock('../functions/api/ai/learning/profile-crud', () => ({
  scheduleConceptReview: (...args: unknown[]) => mockScheduleConceptReview(...args),
}));
vi.mock('../lib/ensureDueVariant', () => ({
  ensureDueVariant: (...args: unknown[]) => mockEnsureDueVariant(...args),
}));
vi.mock('../functions/api/drills/_shared/reviewQuestionResolver', () => ({
  resolveReviewQuestion: (...args: unknown[]) => mockResolveReviewQuestion(...args),
}));
vi.mock('../lib/services/drillAnalyticsService', () => ({
  getRelativeDrillPerformance: (...args: unknown[]) => mockGetRelativeDrillPerformance(...args),
}));

// Handlers must be imported after mocks so their module-level imports resolve
// against the mocked modules.
//
// Cast to `any` because the real handler type is `PagesFunction<...> => Response`,
// but `authenticatedEndpoint` is mocked to return the bare handler which we
// invoke with a synthetic context and receive a plain `{ data, status? }` object.
// The type shim is confined to this test file.
import { onRequestPost as onRequestPostSingleReal } from '../functions/api/drills/submit-review';
import { onRequestPost as onRequestPostBatchReal } from '../functions/api/drills/submit-reviews';

type RawHandlerResult = { data?: unknown; status?: number; error?: string };
const onRequestPostSingle = onRequestPostSingleReal as unknown as (ctx: unknown) => Promise<RawHandlerResult>;
const onRequestPostBatch = onRequestPostBatchReal as unknown as (ctx: unknown) => Promise<RawHandlerResult>;

// ── KV mock helpers ──────────────────────────────────────────────

function makeKvMock(): { kv: any; store: Map<string, string> } {
  const store = new Map<string, string>();
  const kv = {
    get: vi.fn(async (key: string, opts?: { type?: string }) => {
      const value = store.get(key);
      if (value === undefined) return null;
      if (opts?.type === 'json') {
        try {
          return JSON.parse(value);
        } catch {
          return null;
        }
      }
      return value;
    }),
    put: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    list: vi.fn(async () => ({ keys: [] })),
  };
  return { kv, store };
}

const BASE_VALIDATED = {
  questionId: 'q-001',
  selectedAnswer: 'A',
  timeSpentMs: 12000,
  sessionType: 'drill' as const,
};

function makeContext(kv: any, overrides: Record<string, unknown> = {}) {
  return {
    env: {
      DATABASE_URL: 'postgres://test',
      CACHE: kv,
    },
    auth: { userId: 'clerk_user_abc' },
    validated: { ...BASE_VALIDATED, ...overrides },
  } as any;
}

// ── Common test doubles ─────────────────────────────────────────

const FAKE_RESOLVED_QUESTION = {
  question: {
    id: 'q-001',
    conditionId: 'cond-1',
    system: 'Cardiovascular',
    difficulty: 'medium' as const,
    questionType: 'mcq' as const,
    questionData: {},
  },
  source: 'question',
};

const FAKE_RESULT = {
  isCorrect: true,
  rating: 1,
  fsrsSchedule: {
    intervalDays: 2,
    nextDueDate: '2026-04-19T00:00:00.000Z',
    stability: 2.3,
    difficulty: 5.1,
  },
};

beforeEach(() => {
  idemStore.clear();
  mockSubmitDrillReview.mockReset();
  mockResolveReviewQuestion.mockReset();
  mockGetEorRotationEnd.mockReset();
  mockScheduleConceptReview.mockReset();
  mockEnsureDueVariant.mockReset();
  mockGetRelativeDrillPerformance.mockReset();

  mockResolveReviewQuestion.mockResolvedValue(FAKE_RESOLVED_QUESTION);
  mockGetEorRotationEnd.mockReturnValue(null);
  mockSubmitDrillReview.mockResolvedValue(FAKE_RESULT);
  mockScheduleConceptReview.mockResolvedValue(undefined);
  mockEnsureDueVariant.mockResolvedValue(undefined);
  mockGetRelativeDrillPerformance.mockResolvedValue(null);
});

// ── Singular endpoint ───────────────────────────────────────────

describe('submit-review singular — idempotency', () => {
  it('runs the pipeline on first call with a key and caches the response', async () => {
    const { kv, store } = makeKvMock();
    const ctx = makeContext(kv, { idempotencyKey: 'review-1744934400000-abc123' });

    const res = await onRequestPostSingle(ctx);

    expect(res.data).toBeDefined();
    expect(mockSubmitDrillReview).toHaveBeenCalledTimes(1);
    // Filter to idempotency-cache keys — the cache module also writes its own
    // `metrics:daily` counter on every get/put, which we don't care about here.
    const idemKeys = [...store.keys()].filter((k) => k.startsWith('idem:submit-review:'));
    expect(idemKeys).toHaveLength(1);
    expect(idemKeys[0]).toContain('clerk_user_abc:');
  });

  it('short-circuits on second call with the same key — no pipeline re-entry', async () => {
    const { kv } = makeKvMock();
    const ctx1 = makeContext(kv, { idempotencyKey: 'review-1744934400000-abc123' });
    const ctx2 = makeContext(kv, { idempotencyKey: 'review-1744934400000-abc123' });

    await onRequestPostSingle(ctx1);
    const res2 = await onRequestPostSingle(ctx2);

    expect(mockSubmitDrillReview).toHaveBeenCalledTimes(1);
    // Second response echoes persisted idempotency data — preventing duplicate FSRS writes.
    expect(res2.data).toBeDefined();
    expect((res2.data as { isCorrect?: boolean }).isCorrect).toBe(true);
  });

  it('runs pipeline every time when no idempotencyKey is provided (backward-compat)', async () => {
    const { kv } = makeKvMock();
    const ctx1 = makeContext(kv);
    const ctx2 = makeContext(kv);

    await onRequestPostSingle(ctx1);
    await onRequestPostSingle(ctx2);

    expect(mockSubmitDrillReview).toHaveBeenCalledTimes(2);
  });

  it('runs pipeline when KV is unavailable and still uses durable idempotency', async () => {
    const ctx = makeContext(undefined, { idempotencyKey: 'review-999-xyz456' });
    await onRequestPostSingle(ctx);

    expect(mockSubmitDrillReview).toHaveBeenCalledTimes(1);
  });

  it('distinct keys each run the pipeline once', async () => {
    const { kv } = makeKvMock();
    await onRequestPostSingle(makeContext(kv, { idempotencyKey: 'review-aaa-111111' }));
    await onRequestPostSingle(makeContext(kv, { idempotencyKey: 'review-bbb-222222' }));

    expect(mockSubmitDrillReview).toHaveBeenCalledTimes(2);
  });
});

// ── Batch endpoint ──────────────────────────────────────────────

describe('submit-reviews batch — idempotency', () => {
  function makeBatchContext(kv: any, items: Array<Record<string, unknown>>) {
    return {
      env: { DATABASE_URL: 'postgres://test', CACHE: kv },
      auth: { userId: 'clerk_user_abc' },
      validated: items,
    } as any;
  }

  it('runs pipeline per item on first batch and caches each result', async () => {
    const { kv, store } = makeKvMock();
    const items = [
      { ...BASE_VALIDATED, questionId: 'q-A', idempotencyKey: 'review-111-aaa111' },
      { ...BASE_VALIDATED, questionId: 'q-B', idempotencyKey: 'review-222-bbb222' },
    ];

    const res = await onRequestPostBatch(makeBatchContext(kv, items));

    expect(mockSubmitDrillReview).toHaveBeenCalledTimes(2);
    expect((res.data as Array<{ success: boolean }>).every((r) => r.success)).toBe(true);
    const idemKeys = [...store.keys()].filter((k) => k.startsWith('idem:submit-reviews:'));
    expect(idemKeys).toHaveLength(2);
  });

  it('short-circuits individual items on retry of the same batch', async () => {
    const { kv } = makeKvMock();
    const items = [
      { ...BASE_VALIDATED, questionId: 'q-A', idempotencyKey: 'review-111-aaa111' },
      { ...BASE_VALIDATED, questionId: 'q-B', idempotencyKey: 'review-222-bbb222' },
    ];

    await onRequestPostBatch(makeBatchContext(kv, items));
    expect(mockSubmitDrillReview).toHaveBeenCalledTimes(2);

    // Simulate offline-sync retry — identical batch re-submitted.
    const res2 = await onRequestPostBatch(makeBatchContext(kv, items));
    // Pipeline count unchanged — both items served from durable idempotency.
    expect(mockSubmitDrillReview).toHaveBeenCalledTimes(2);
    const results = res2.data as Array<{ success: boolean; source?: string }>;
    expect(results.every((r) => r.success)).toBe(true);
    expect(results.every((r) => r.source === 'idempotent-store')).toBe(true);
  });

  it('only short-circuits items whose key is cached; new items still run', async () => {
    const { kv } = makeKvMock();
    await onRequestPostBatch(
      makeBatchContext(kv, [
        { ...BASE_VALIDATED, questionId: 'q-A', idempotencyKey: 'review-111-aaa111' },
      ]),
    );
    expect(mockSubmitDrillReview).toHaveBeenCalledTimes(1);

    // Mixed batch: one cached, one new.
    await onRequestPostBatch(
      makeBatchContext(kv, [
        { ...BASE_VALIDATED, questionId: 'q-A', idempotencyKey: 'review-111-aaa111' },
        { ...BASE_VALIDATED, questionId: 'q-C', idempotencyKey: 'review-333-ccc333' },
      ]),
    );
    // Only the new item triggers the pipeline.
    expect(mockSubmitDrillReview).toHaveBeenCalledTimes(2);
  });

  it('runs pipeline for every item when no idempotencyKey is supplied', async () => {
    const { kv } = makeKvMock();
    const items = [
      { ...BASE_VALIDATED, questionId: 'q-A' },
      { ...BASE_VALIDATED, questionId: 'q-B' },
    ];

    await onRequestPostBatch(makeBatchContext(kv, items));
    await onRequestPostBatch(makeBatchContext(kv, items));

    // No keys → every submission re-runs the pipeline (legacy behavior).
    expect(mockSubmitDrillReview).toHaveBeenCalledTimes(4);
  });
});
