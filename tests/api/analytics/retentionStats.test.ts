/**
 * Reconciliation tests: GET /api/stats/retention
 *
 * Regression guard for the dashboard-trust audit finding (2026-04-17):
 * The retention stats endpoint previously fabricated a forgetting curve even
 * when the user had no reviewed items — it filled in a default avgStability
 * of 5 and used the Ebbinghaus formula `exp(-t/S)` instead of the FSRS v6
 * retrievability formula `(1 + FACTOR * t / S)^DECAY`. It also emitted
 * hardcoded tuning metadata ("Pharmacology" / "tighten") that wasn't tied
 * to any real optimizer run, so the dashboard surfaced a confident but
 * imaginary algorithm-health status.
 *
 * These tests assert the fixed behavior:
 *   1. No reviewed items → meta.status === 'insufficient_data', empty
 *      decayCurveData, empty lastTuned. No fabricated curve.
 *   2. Real fsrsStability in → FSRS v6 retrievability curve out. The day-10
 *      probability for S=10 must be ≈ 90.1% (FSRS), NOT ≈ 36.8% (Ebbinghaus).
 *   3. decayCurveData.length === 31 (days 0..30 inclusive).
 *   4. stabilityBuckets count only reviewedItems — unreviewed items must
 *      not inflate the buckets.
 *   5. Unsynced user (prisma.user.findUnique → null) returns 404 with an
 *      error message (no silent zeros).
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

const CLERK_ID = 'user_clerk_2abc123XYZ';
const INTERNAL_ID = 'internal-uuid-1111-2222-3333';

// ── Shared mocks ────────────────────────────────────────────────────────────

vi.mock('../../../functions/api/_shared/prisma-edge', () => ({
  createEdgePrismaClient: vi.fn(),
  safePrismaDisconnect: vi.fn(),
}));

vi.mock('../../../functions/api/_shared/middleware', () => ({
  authenticatedEndpoint: vi.fn((_schema: any, handler: any) => handler),
  withCors: vi.fn(() => vi.fn()),
}));

vi.mock('../../../functions/api/_shared/secureLogger', () => ({
  createEndpointLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    addContext: vi.fn(),
  })),
}));

vi.mock('../../../functions/api/_shared/env-validation', () => ({
  validateFunctionEnv: vi.fn(),
  MissingEnvError: class MissingEnvError extends Error {
    toResponse() {
      return new Response('missing env', { status: 500 });
    }
  },
}));

import { createEdgePrismaClient } from '../../../functions/api/_shared/prisma-edge';

// ── Helpers ─────────────────────────────────────────────────────────────────

interface SRSItemFixture {
  id: string;
  interval: number;
  dueDate: Date;
  lastReviewed: Date | null;
  easiness: number;
  repetition: number;
  fsrsStability: number | null;
}

interface FakePrismaOptions {
  userFound?: boolean;
  srsItems?: SRSItemFixture[];
}

function makeFakePrisma(opts: FakePrismaOptions = {}) {
  const { userFound = true, srsItems = [] } = opts;

  return {
    user: {
      findUnique: vi.fn().mockResolvedValue(userFound ? { id: INTERNAL_ID } : null),
    },
    sRSItem: {
      findMany: vi.fn().mockResolvedValue(srsItems),
    },
  };
}

function baseContext() {
  return {
    env: { DATABASE_URL: 'postgresql://test' },
    auth: { userId: CLERK_ID },
    validated: {},
  };
}

async function parseBody(result: any): Promise<{ status: number; body: any }> {
  if (result instanceof Response) {
    return { status: result.status, body: await result.json() };
  }
  return { status: result.status ?? 200, body: result.data ?? result };
}

function makeReviewedItem(overrides: Partial<SRSItemFixture> = {}): SRSItemFixture {
  const now = new Date();
  return {
    id: `item-${Math.random().toString(36).slice(2, 9)}`,
    interval: 10,
    dueDate: new Date(now.getTime() + 24 * 60 * 60 * 1000),
    lastReviewed: new Date(now.getTime() - 24 * 60 * 60 * 1000),
    easiness: 2.5,
    repetition: 3,
    fsrsStability: 10,
    ...overrides,
  };
}

function makeUnreviewedItem(overrides: Partial<SRSItemFixture> = {}): SRSItemFixture {
  const now = new Date();
  return {
    id: `item-${Math.random().toString(36).slice(2, 9)}`,
    interval: 0,
    dueDate: now,
    lastReviewed: null,
    easiness: 2.5,
    repetition: 0,
    fsrsStability: null,
    ...overrides,
  };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('GET /api/stats/retention — dashboard-trust reconciliation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns meta.status=insufficient_data and empty curve when no items are reviewed', async () => {
    const prisma = makeFakePrisma({
      userFound: true,
      srsItems: [makeUnreviewedItem(), makeUnreviewedItem()],
    });
    (createEdgePrismaClient as Mock).mockReturnValue(prisma);

    const { onRequestGet } = await import('../../../functions/api/stats/retention');
    const result = await (onRequestGet as any)(baseContext());
    const { status, body } = await parseBody(result);

    expect(status).toBe(200);
    expect(body?.success).toBe(true);
    expect(body?.data?.meta?.status).toBe('insufficient_data');
    expect(body?.data?.meta?.reason).toBe('no_reviewed_items');
    expect(body?.data?.decayCurveData).toEqual([]);
    expect(body?.data?.stabilityBuckets).toEqual([]);
    // No fabricated tuning metadata
    expect(body?.data?.lastTuned).toBe('');
    expect(body?.data?.tuningReason).toBe('');
    // Total cards should still reflect reality
    expect(body?.data?.totalCards).toBe(2);
  });

  it('returns the same insufficient_data shape when the user has zero SRS items at all', async () => {
    const prisma = makeFakePrisma({ userFound: true, srsItems: [] });
    (createEdgePrismaClient as Mock).mockReturnValue(prisma);

    const { onRequestGet } = await import('../../../functions/api/stats/retention');
    const result = await (onRequestGet as any)(baseContext());
    const { status, body } = await parseBody(result);

    expect(status).toBe(200);
    expect(body?.data?.meta?.status).toBe('insufficient_data');
    expect(body?.data?.decayCurveData).toEqual([]);
    expect(body?.data?.totalCards).toBe(0);
    expect(body?.data?.dueCount).toBe(0);
  });

  it('uses the FSRS v6 retrievability formula (not Ebbinghaus) when reviewed items exist', async () => {
    // One reviewed item with stability = 10. avgStability = 10.
    // FSRS v6: R(t) = (1 + (19/81) * t / S)^(-0.5)
    //   Day 10:   (1 + (19/81) * 10/10)^(-0.5) * 100 ≈ 90.06%
    //   Ebbinghaus: exp(-10/10) * 100 ≈ 36.79%  ← must NOT be this
    const prisma = makeFakePrisma({
      userFound: true,
      srsItems: [makeReviewedItem({ fsrsStability: 10, interval: 10 })],
    });
    (createEdgePrismaClient as Mock).mockReturnValue(prisma);

    const { onRequestGet } = await import('../../../functions/api/stats/retention');
    const result = await (onRequestGet as any)(baseContext());
    const { body } = await parseBody(result);

    expect(body?.data?.meta?.status).toBe('ok');
    const curve = body?.data?.decayCurveData as Array<{ day: number; retentionProb: number }>;
    expect(curve).toBeDefined();
    expect(curve.length).toBe(31);

    // Day 0 = 100% (or numerically very close)
    expect(curve[0]?.day).toBe(0);
    expect(curve[0]?.retentionProb).toBeCloseTo(100, 5);

    // Day 10 ≈ 90.06% for FSRS; definitely NOT 36.79% (Ebbinghaus)
    const day10 = curve.find((p) => p.day === 10);
    expect(day10).toBeDefined();
    const FSRS_FACTOR = 19 / 81;
    const FSRS_DECAY = -0.5;
    const expectedDay10 = Math.pow(1 + (FSRS_FACTOR * 10) / 10, FSRS_DECAY) * 100;
    expect(day10!.retentionProb).toBeCloseTo(expectedDay10, 5);

    // Regression guard: must not match the old Ebbinghaus formula
    const ebbinghausDay10 = Math.exp(-10 / 10) * 100;
    expect(Math.abs(day10!.retentionProb - ebbinghausDay10)).toBeGreaterThan(10);
  });

  it('returns exactly 31 curve points covering days 0..30', async () => {
    const prisma = makeFakePrisma({
      userFound: true,
      srsItems: [makeReviewedItem({ fsrsStability: 20 })],
    });
    (createEdgePrismaClient as Mock).mockReturnValue(prisma);

    const { onRequestGet } = await import('../../../functions/api/stats/retention');
    const result = await (onRequestGet as any)(baseContext());
    const { body } = await parseBody(result);

    const curve = body?.data?.decayCurveData as Array<{ day: number; retentionProb: number }>;
    expect(curve.length).toBe(31);
    expect(curve.map((p) => p.day)).toEqual(Array.from({ length: 31 }, (_, i) => i));

    // Monotonically non-increasing — retention should only decay with time
    for (let i = 1; i < curve.length; i++) {
      expect(curve[i]!.retentionProb).toBeLessThanOrEqual(curve[i - 1]!.retentionProb + 1e-9);
    }
  });

  it('counts only reviewed items in stabilityBuckets (unreviewed items must not inflate buckets)', async () => {
    const reviewed = [
      makeReviewedItem({ fsrsStability: 2, interval: 0.5 }),   // <1d
      makeReviewedItem({ fsrsStability: 5, interval: 2 }),     // 1-3d
      makeReviewedItem({ fsrsStability: 8, interval: 5 }),     // 3-7d
      makeReviewedItem({ fsrsStability: 15, interval: 14 }),   // 7-21d
      makeReviewedItem({ fsrsStability: 40, interval: 30 }),   // 21d+
    ];
    const unreviewed = [
      makeUnreviewedItem({ interval: 0 }),
      makeUnreviewedItem({ interval: 0 }),
      makeUnreviewedItem({ interval: 0 }),
    ];
    const prisma = makeFakePrisma({
      userFound: true,
      srsItems: [...reviewed, ...unreviewed],
    });
    (createEdgePrismaClient as Mock).mockReturnValue(prisma);

    const { onRequestGet } = await import('../../../functions/api/stats/retention');
    const result = await (onRequestGet as any)(baseContext());
    const { body } = await parseBody(result);

    const buckets = body?.data?.stabilityBuckets as Array<{ bucket: string; count: number }>;
    expect(buckets).toBeDefined();
    expect(buckets.length).toBe(5);

    const totalBucketCount = buckets.reduce((sum, b) => sum + b.count, 0);
    expect(totalBucketCount).toBe(reviewed.length); // 5, NOT 8

    // Distribution sanity check
    expect(buckets.find((b) => b.bucket === '<1d')!.count).toBe(1);
    expect(buckets.find((b) => b.bucket === '1-3d')!.count).toBe(1);
    expect(buckets.find((b) => b.bucket === '3-7d')!.count).toBe(1);
    expect(buckets.find((b) => b.bucket === '7-21d')!.count).toBe(1);
    expect(buckets.find((b) => b.bucket === '21d+')!.count).toBe(1);

    // totalCards still reflects everything
    expect(body?.data?.totalCards).toBe(reviewed.length + unreviewed.length);
    // meta.reviewedCount reflects the actual reviewed subset
    expect(body?.data?.meta?.reviewedCount).toBe(reviewed.length);
  });

  it('returns 404 with an error payload when the user is not synced', async () => {
    const prisma = makeFakePrisma({ userFound: false });
    (createEdgePrismaClient as Mock).mockReturnValue(prisma);

    const { onRequestGet } = await import('../../../functions/api/stats/retention');
    const result = await (onRequestGet as any)(baseContext());
    const { status, body } = await parseBody(result);

    expect(status).toBe(404);
    expect(typeof body?.error).toBe('string');
    expect(body.error.length).toBeGreaterThan(0);

    // Critical: we must NOT have queried the SRSItem table when the user
    // couldn't be resolved. No silent zeros.
    expect(prisma.sRSItem.findMany).not.toHaveBeenCalled();
  });

  it('emits empty tuning metadata even when reviewed data exists (optimizer not yet wired)', async () => {
    const prisma = makeFakePrisma({
      userFound: true,
      srsItems: [makeReviewedItem({ fsrsStability: 10 })],
    });
    (createEdgePrismaClient as Mock).mockReturnValue(prisma);

    const { onRequestGet } = await import('../../../functions/api/stats/retention');
    const result = await (onRequestGet as any)(baseContext());
    const { body } = await parseBody(result);

    // These fields stay blank until a real optimizer run populates them.
    // Blank values are load-bearing: DashboardPage hides the Algorithm Status
    // widget via `safeData.lastTuned && ...` when lastTuned is empty.
    expect(body?.data?.lastTuned).toBe('');
    expect(body?.data?.tuningReason).toBe('');
  });
});
