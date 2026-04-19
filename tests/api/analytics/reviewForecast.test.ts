/**
 * Reconciliation tests: GET /api/analytics/review-forecast
 *
 * Regression guard for the dashboard-trust audit finding (2026-04-17):
 * The review-forecast endpoint previously bucketed cards by UTC calendar
 * day. For a PT student studying at 22:00 local, a card `nextReviewAt`
 * of 2026-04-19T02:00Z showed as "tomorrow" by UTC but was actually
 * "today" on their wristwatch — so "today=0 / tomorrow=N" lied about the
 * real workload. This file pins the fixed behavior.
 *
 * These tests assert:
 *   1. Tz fallback chain: ?tz → UserPreferences.consolidationTimezone → UTC.
 *   2. Forecast day-keys are emitted in user-local calendar (YYYY-MM-DD).
 *   3. A card scheduled at 2026-04-19T02:00Z lands in the LA-local
 *      "today" bucket for a user at 2026-04-18T22:00 PT, not "tomorrow".
 *   4. Overdue threshold is the start of *local* today, not UTC.
 *   5. Forecast array has exactly 7 contiguous local-day entries.
 *   6. Unsynced user → 404 + meta.status='user_not_synced' + empty
 *      arrays. No silent zeros.
 *   7. Unknown ?tz falls through cleanly to the stored pref / UTC.
 *   8. response.timezone reflects the zone actually used for bucketing
 *      (so the client can trust-audit).
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

const CLERK_ID = 'user_clerk_rf123';
const INTERNAL_ID = 'internal-uuid-rf-aaaa-bbbb';

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
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../../functions/api/_shared/env-validation', () => ({
  validateFunctionEnv: vi.fn(),
  MissingEnvError: class MissingEnvError extends Error {
    toResponse() {
      return new Response('missing env', { status: 500 });
    }
  },
}));

vi.mock('../../../functions/api/_shared/user-resolver', () => ({
  resolveUserId: vi.fn(async (_p: any, clerkId: string) =>
    clerkId === CLERK_ID ? INTERNAL_ID : null
  ),
}));

import { createEdgePrismaClient } from '../../../functions/api/_shared/prisma-edge';
import { resolveUserId } from '../../../functions/api/_shared/user-resolver';

// ── Helpers ─────────────────────────────────────────────────────────────────

interface UpcomingCardFixture {
  nextReviewAt: Date | null;
  system: string | null;
}

interface FakePrismaOptions {
  userFound?: boolean;
  overdueCount?: number;
  upcoming?: UpcomingCardFixture[];
  totalActive?: number;
  consolidationTimezone?: string | null;
}

function makeFakePrisma(opts: FakePrismaOptions = {}) {
  const {
    overdueCount = 0,
    upcoming = [],
    totalActive = 0,
    consolidationTimezone = null,
  } = opts;

  const counts: number[] = [overdueCount, totalActive];
  let countIdx = 0;

  return {
    userProgress: {
      count: vi.fn().mockImplementation(async () => {
        const n = counts[countIdx] ?? 0;
        countIdx++;
        return n;
      }),
      findMany: vi.fn().mockResolvedValue(upcoming),
    },
    userPreferences: {
      findUnique: vi.fn().mockResolvedValue(
        consolidationTimezone
          ? { consolidationTimezone }
          : null
      ),
    },
  };
}

function makeRequest(url: string, clerkId: string = CLERK_ID) {
  return new Request(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${clerkId}` },
  });
}

function baseContext(tz?: string, clerkId: string = CLERK_ID) {
  const base = 'https://example.com/api/analytics/review-forecast';
  const url = tz ? `${base}?tz=${encodeURIComponent(tz)}` : base;
  return {
    request: makeRequest(url, clerkId),
    env: { DATABASE_URL: 'postgresql://test' },
    auth: { userId: clerkId },
    validated: {},
  };
}

async function parseBody(result: any): Promise<{ status: number; body: any }> {
  if (result instanceof Response) {
    return { status: result.status, body: await result.json() };
  }
  return { status: result.status ?? 200, body: result.data ?? result };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('GET /api/analytics/review-forecast — timezone reconciliation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (resolveUserId as Mock).mockImplementation(async (_p: any, clerkId: string) =>
      clerkId === CLERK_ID ? INTERNAL_ID : null
    );
  });

  it('returns 404 + meta.status=user_not_synced when the Clerk id does not map', async () => {
    const prisma = makeFakePrisma();
    (createEdgePrismaClient as Mock).mockReturnValue(prisma);

    const { onRequestGet } = await import(
      '../../../functions/api/analytics/review-forecast'
    );
    const result = await (onRequestGet as any)(baseContext(undefined, 'user_missing'));
    const { status, body } = await parseBody(result);

    expect(status).toBe(404);
    // Body shape: either Response.json wrapping { data: {...} } or handler-return
    const data = body?.data ?? body;
    expect(data?.meta?.status).toBe('user_not_synced');
    expect(data?.forecast).toEqual([]);
    expect(data?.overdue).toBe(0);
    expect(data?.today).toBe(0);
  });

  it('emits exactly 7 contiguous local-day keys, starting with user-local today', async () => {
    const prisma = makeFakePrisma();
    (createEdgePrismaClient as Mock).mockReturnValue(prisma);

    const { onRequestGet } = await import(
      '../../../functions/api/analytics/review-forecast'
    );
    const result = await (onRequestGet as any)(
      baseContext('America/Los_Angeles')
    );
    const { status, body } = await parseBody(result);

    expect(status).toBe(200);
    const data = body?.data ?? body;
    expect(Array.isArray(data.forecast)).toBe(true);
    expect(data.forecast).toHaveLength(7);

    // Day keys are contiguous
    for (let i = 1; i < data.forecast.length; i++) {
      const prev = new Date(data.forecast[i - 1].date + 'T12:00:00Z').getTime();
      const cur = new Date(data.forecast[i].date + 'T12:00:00Z').getTime();
      const diff = cur - prev;
      // Allow 23h / 24h / 25h (DST) — all "one calendar day apart" in UTC noon.
      expect(diff).toBeGreaterThanOrEqual(23 * 3600_000);
      expect(diff).toBeLessThanOrEqual(25 * 3600_000);
    }
  });

  it('buckets a 02:00Z card into LA-local "today" for a 22:00 PT user', async () => {
    // Fix "now" at 2026-04-19T05:00Z → it's 22:00 on 2026-04-18 in LA.
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-04-19T05:00:00Z'));

      // A card due at 2026-04-19T02:00Z is 19:00 on 2026-04-18 in LA.
      // By UTC bucketing (old bug) it would land in "2026-04-19" → tomorrow.
      // By LA bucketing (fix) it lands in "2026-04-18" → today.
      const todayLaCard: UpcomingCardFixture = {
        nextReviewAt: new Date('2026-04-19T02:00:00Z'),
        system: 'Cardiovascular',
      };
      const prisma = makeFakePrisma({
        upcoming: [todayLaCard],
        totalActive: 1,
      });
      (createEdgePrismaClient as Mock).mockReturnValue(prisma);

      const { onRequestGet } = await import(
        '../../../functions/api/analytics/review-forecast'
      );
      const result = await (onRequestGet as any)(
        baseContext('America/Los_Angeles')
      );
      const { body } = await parseBody(result);
      const data = body?.data ?? body;

      expect(data.forecast[0].date).toBe('2026-04-18');
      expect(data.forecast[0].count).toBe(1);
      expect(data.today).toBe(1);
      // The card should NOT have leaked into day 1.
      expect(data.forecast[1].count).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('falls back to UserPreferences.consolidationTimezone when ?tz is absent', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-04-19T05:00:00Z'));

      const prisma = makeFakePrisma({
        consolidationTimezone: 'America/Los_Angeles',
        upcoming: [
          {
            nextReviewAt: new Date('2026-04-19T02:00:00Z'),
            system: 'Pulmonary',
          },
        ],
      });
      (createEdgePrismaClient as Mock).mockReturnValue(prisma);

      const { onRequestGet } = await import(
        '../../../functions/api/analytics/review-forecast'
      );
      // No ?tz → should pick up LA from UserPreferences.
      const result = await (onRequestGet as any)(baseContext());
      const { body } = await parseBody(result);
      const data = body?.data ?? body;

      expect(data.timezone).toBe('America/Los_Angeles');
      expect(data.forecast[0].date).toBe('2026-04-18');
      expect(data.today).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('junk ?tz falls through to stored pref (or UTC)', async () => {
    const prisma = makeFakePrisma({ consolidationTimezone: 'Europe/London' });
    (createEdgePrismaClient as Mock).mockReturnValue(prisma);

    const { onRequestGet } = await import(
      '../../../functions/api/analytics/review-forecast'
    );
    const result = await (onRequestGet as any)(baseContext('not-a-real-tz'));
    const { status, body } = await parseBody(result);
    const data = body?.data ?? body;

    expect(status).toBe(200);
    expect(data.timezone).toBe('Europe/London');
  });

  it('?tz wins over UserPreferences even when both are set', async () => {
    const prisma = makeFakePrisma({
      consolidationTimezone: 'America/Los_Angeles',
    });
    (createEdgePrismaClient as Mock).mockReturnValue(prisma);

    const { onRequestGet } = await import(
      '../../../functions/api/analytics/review-forecast'
    );
    const result = await (onRequestGet as any)(baseContext('Asia/Tokyo'));
    const { body } = await parseBody(result);
    const data = body?.data ?? body;

    expect(data.timezone).toBe('Asia/Tokyo');
  });

  it('surfaces response.timezone so the client can audit bucketing', async () => {
    const prisma = makeFakePrisma();
    (createEdgePrismaClient as Mock).mockReturnValue(prisma);

    const { onRequestGet } = await import(
      '../../../functions/api/analytics/review-forecast'
    );
    const result = await (onRequestGet as any)(
      baseContext('America/New_York')
    );
    const { body } = await parseBody(result);
    const data = body?.data ?? body;

    expect(typeof data.timezone).toBe('string');
    expect(data.timezone).toBe('America/New_York');
  });

  it('preserves overdue count semantics against local midnight', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-04-19T05:00:00Z')); // 22:00 LA on 4/18

      const prisma = makeFakePrisma({
        overdueCount: 7,
        totalActive: 20,
      });
      (createEdgePrismaClient as Mock).mockReturnValue(prisma);

      const { onRequestGet } = await import(
        '../../../functions/api/analytics/review-forecast'
      );
      const result = await (onRequestGet as any)(
        baseContext('America/Los_Angeles')
      );
      const { body } = await parseBody(result);
      const data = body?.data ?? body;

      expect(data.overdue).toBe(7);
      expect(data.totalActive).toBe(20);

      // Prisma count was called with `lt: <local-midnight-UTC>`.
      // Pluck the first call's where clause.
      const firstCountCall = prisma.userProgress.count.mock.calls[0]?.[0];
      expect(firstCountCall).toBeDefined();
      const ltInstant = firstCountCall.where.nextReviewAt.lt as Date;
      // 00:00 local LA on 2026-04-18 is 07:00 UTC (PDT).
      expect(ltInstant.toISOString()).toBe('2026-04-18T07:00:00.000Z');
    } finally {
      vi.useRealTimers();
    }
  });

  it('aggregates multiple cards per day with top-5 system breakdown', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-04-18T12:00:00Z'));

      const cards: UpcomingCardFixture[] = [
        { nextReviewAt: new Date('2026-04-18T13:00:00Z'), system: 'Cardiovascular' },
        { nextReviewAt: new Date('2026-04-18T15:00:00Z'), system: 'Cardiovascular' },
        { nextReviewAt: new Date('2026-04-18T17:00:00Z'), system: 'Pulmonary' },
        { nextReviewAt: new Date('2026-04-19T08:00:00Z'), system: 'Renal' },
      ];
      const prisma = makeFakePrisma({ upcoming: cards });
      (createEdgePrismaClient as Mock).mockReturnValue(prisma);

      const { onRequestGet } = await import(
        '../../../functions/api/analytics/review-forecast'
      );
      const result = await (onRequestGet as any)(baseContext('UTC'));
      const { body } = await parseBody(result);
      const data = body?.data ?? body;

      expect(data.forecast[0].date).toBe('2026-04-18');
      expect(data.forecast[0].count).toBe(3);
      expect(data.forecast[0].systems).toEqual(
        expect.arrayContaining([
          { system: 'Cardiovascular', count: 2 },
          { system: 'Pulmonary', count: 1 },
        ])
      );
      expect(data.forecast[1].date).toBe('2026-04-19');
      expect(data.forecast[1].count).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
