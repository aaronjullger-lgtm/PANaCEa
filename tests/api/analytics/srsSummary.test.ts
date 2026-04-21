/**
 * Reconciliation tests: GET /api/analytics/srs-summary
 *
 * Regression guard for the dashboard-trust audit (2026-04-19).
 * Bugs fixed by this audit:
 *   P0-A: projectedRetention used the wrong FSRS formula (factor=1, decay=-1
 *         instead of factor=19/81, decay=-0.5).  For S=14, t=7 the old formula
 *         gives ~67% vs the correct FSRS ≈ 91%.
 *   P0-B: stabilityTrend was fabricated from session accuracy × current avgStability.
 *         Fixed: use actual card stability from UserProgress.lastReviewAt.
 *         Days with no reviews are omitted (sparse), not zero-filled.
 *   P1-A: FSRS state > 3 fell through to 'new' via `stateNames[state] || 'new'`.
 *         Fixed: clamped + `?? 'unknown'`.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

// ── Mocks (must precede imports) ──────────────────────────────────────────────

vi.mock('../../../functions/api/_shared/prisma-edge', () => ({
  createEdgePrismaClient: vi.fn(),
  safePrismaDisconnect: vi.fn(),
}));

vi.mock('../../../functions/api/_shared/middleware', () => ({
  authenticatedEndpoint: vi.fn((_schema: any, handler: any) => handler),
  withCors: vi.fn(() => vi.fn()),
}));

vi.mock('../../../functions/api/_shared/zodSchemas', () => ({
  srsSummaryQuerySchema: { parse: (v: unknown) => v },
}));

import { createEdgePrismaClient } from '../../../functions/api/_shared/prisma-edge';

// ── Constants ──────────────────────────────────────────────────────────────────

const CLERK_ID = 'user_clerk_srs_summary';
const INTERNAL_ID = 'internal-uuid-srs-0001';

// ── FSRS constants (match lib/fsrs-retrievability.ts) ────────────────────────
// Imported directly so the test can never drift from the canonical defaults.
import { FSRS_FACTOR_DEFAULT, FSRS_DECAY_DEFAULT } from '@/lib/fsrs-retrievability';
function fsrsR(t: number, s: number): number {
  return Math.pow(1 + (FSRS_FACTOR_DEFAULT * t) / s, FSRS_DECAY_DEFAULT);
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeCard(overrides: {
  fsrsStability?: number;
  fsrsDifficulty?: number;
  fsrsState?: number;
  lastReviewAt?: Date | null;
  nextReviewAt?: Date | null;
  createdAt?: Date;
  system?: string;
} = {}) {
  const now = new Date();
  const s = overrides.fsrsStability ?? 10;
  const d = overrides.fsrsDifficulty ?? 5;
  const state = overrides.fsrsState ?? 2;
  return {
    id: Math.random().toString(36).slice(2),
    fsrsParams: { S: s, D: d, state },
    fsrsCard: null,
    lastReviewAt:
      overrides.lastReviewAt !== undefined
        ? overrides.lastReviewAt
        : new Date(now.getTime() - 24 * 60 * 60 * 1000),
    nextReviewAt:
      overrides.nextReviewAt !== undefined
        ? overrides.nextReviewAt
        : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
    totalAttempts: 5,
    createdAt: overrides.createdAt ?? new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
    MedicalContent: {
      system: overrides.system ?? 'Cardiovascular',
      condition: 'Test condition',
    },
  };
}

function makeFakePrisma(cards: ReturnType<typeof makeCard>[], userFound = true) {
  return {
    user: {
      findUnique: vi.fn().mockResolvedValue(userFound ? { id: INTERNAL_ID } : null),
    },
    userProgress: {
      findMany: vi.fn().mockResolvedValue(cards),
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

async function callEndpoint(cards: ReturnType<typeof makeCard>[], userFound = true) {
  const prisma = makeFakePrisma(cards, userFound);
  (createEdgePrismaClient as Mock).mockReturnValue(prisma);
  const { onRequestGet } = await import('../../../functions/api/analytics/srs-summary');
  const result = await (onRequestGet as any)(baseContext());
  const body = result?.data ?? result;
  return { body, prisma, result };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/analytics/srs-summary — dashboard-trust reconciliation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  // ── P0-A: projectedRetention formula ─────────────────────────────────────

  it('P0-A: projectedRetention uses FSRS v6 formula, not the old (1 + t/S)^-1', async () => {
    const now = new Date();
    // One card reviewed exactly 7 days ago, stability = 14
    const card = makeCard({
      fsrsStability: 14,
      lastReviewAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
    });
    const { body } = await callEndpoint([card]);

    const reported = body.projectedRetention as number;
    expect(reported).toBeDefined();
    expect(typeof reported).toBe('number');
    expect(isFinite(reported)).toBe(true);

    // FSRS v6 (canonical defaults): R(7, 14) ≈ 77%
    //   R = (1 + 0.1597 * 7/14)^(-2.27) ≈ (1.0799)^(-2.27) ≈ 0.8386
    const expectedFSRS = fsrsR(7, 14) * 100;
    // Old wrong formula: R(7, 14) = (1 + 7/14)^-1 = (1.5)^-1 ≈ 66.7%
    const oldWrong = (1 / (1 + 7 / 14)) * 100;

    expect(Math.abs(reported - expectedFSRS)).toBeLessThan(2);
    expect(Math.abs(reported - oldWrong)).toBeGreaterThan(10); // regression guard
  });

  it('P0-A: day-0 card (just reviewed) has near-100% retention', async () => {
    const card = makeCard({ fsrsStability: 10, lastReviewAt: new Date() });
    const { body } = await callEndpoint([card]);
    expect(body.projectedRetention).toBeGreaterThan(95);
  });

  it('P0-A: card reviewed 30 days ago with S=10 has clearly decayed retention', async () => {
    const now = new Date();
    const card = makeCard({
      fsrsStability: 10,
      lastReviewAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
    });
    const { body } = await callEndpoint([card]);
    // FSRS v6 (canonical defaults): R(30, 10) ≈ 21%
    //   R = (1 + 0.1597 * 30/10)^(-2.27) ≈ (1.4791)^(-2.27) ≈ 0.4198
    const expectedFSRS = fsrsR(30, 10) * 100;
    expect(Math.abs(body.projectedRetention - expectedFSRS)).toBeLessThan(2);
  });

  it('P0-A: projectedRetention is 0 when totalCards is 0', async () => {
    const { body } = await callEndpoint([]);
    expect(body.projectedRetention).toBe(0);
    expect(body.totalCards).toBe(0);
  });

  // ── P0-B: stabilityTrend from real data ──────────────────────────────────

  it('P0-B: stabilityTrend is empty when no cards reviewed in last 7 days', async () => {
    const now = new Date();
    // Card reviewed 10 days ago — outside the 7-day window
    const card = makeCard({
      fsrsStability: 12,
      lastReviewAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
    });
    const { body } = await callEndpoint([card]);
    expect(Array.isArray(body.stabilityTrend)).toBe(true);
    expect(body.stabilityTrend).toHaveLength(0);
  });

  it('P0-B: stabilityTrend omits days with no reviews (sparse, not zero-filled)', async () => {
    const now = new Date();
    // Only yesterday has a review
    const card = makeCard({
      fsrsStability: 8,
      lastReviewAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
    });
    const { body } = await callEndpoint([card]);
    // Should have exactly 1 point, not 7 (no zero-fill for empty days)
    expect(body.stabilityTrend).toHaveLength(1);
    expect(body.stabilityTrend[0].avgStability).toBeCloseTo(8, 1);
  });

  it('P0-B: stabilityTrend reflects actual stability values from UserProgress', async () => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    // Three cards all reviewed today with stabilities 4, 6, 8 → avg 6
    const cards = [
      makeCard({ fsrsStability: 4, lastReviewAt: new Date(now.getTime() - 1000) }),
      makeCard({ fsrsStability: 6, lastReviewAt: new Date(now.getTime() - 2000) }),
      makeCard({ fsrsStability: 8, lastReviewAt: new Date(now.getTime() - 3000) }),
    ];
    const { body } = await callEndpoint(cards);
    const todayEntry = body.stabilityTrend.find(
      (p: { date: string }) => p.date === today
    );
    expect(todayEntry).toBeDefined();
    expect(todayEntry.avgStability).toBeCloseTo(6, 1);
  });

  it('P0-B: stabilityTrend never shows a fabricated session-accuracy proxy', async () => {
    const now = new Date();
    // S=25 is distinct from any accuracy*avgStability product (which would ≈ 0.7 * avgS * 1.07)
    const card = makeCard({
      fsrsStability: 25,
      lastReviewAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
    });
    const { body } = await callEndpoint([card]);
    expect(body.stabilityTrend).toHaveLength(1);
    expect(body.stabilityTrend[0].avgStability).toBeCloseTo(25, 1);
  });

  // ── P1-A: state label bounds check ───────────────────────────────────────

  it('P1-A: out-of-range FSRS state (99) clamps to relearning, not silently "new"', async () => {
    const card = makeCard({ fsrsStability: 5 });
    // Inject invalid state
    (card.fsrsParams as any).state = 99;
    const { body } = await callEndpoint([card]);
    const dist = body.stateDistribution as Array<{ state: string; count: number }>;
    // 'new' must be 0 — card was clamped to stateNames[3]='relearning'
    const newEntry = dist.find((d) => d.state === 'new');
    expect(newEntry?.count ?? 0).toBe(0);
  });

  it('P1-A: all valid states 0–3 are correctly labeled', async () => {
    const cards = [
      makeCard({ fsrsStability: 1, fsrsState: 0 }),
      makeCard({ fsrsStability: 2, fsrsState: 1 }),
      makeCard({ fsrsStability: 3, fsrsState: 2 }),
      makeCard({ fsrsStability: 4, fsrsState: 3 }),
    ];
    const { body } = await callEndpoint(cards);
    const dist = body.stateDistribution as Array<{ state: string; count: number }>;
    const byState = Object.fromEntries(dist.map((d) => [d.state, d.count]));
    expect(byState['new']).toBe(1);
    expect(byState['learning']).toBe(1);
    expect(byState['review']).toBe(1);
    expect(byState['relearning']).toBe(1);
  });

  // ── Core metric sanity ────────────────────────────────────────────────────

  it('totalCards matches number of UserProgress records', async () => {
    const cards = [makeCard(), makeCard(), makeCard()];
    const { body } = await callEndpoint(cards);
    expect(body.totalCards).toBe(3);
  });

  it('reviewsDue counts only cards with nextReviewAt in the past', async () => {
    const now = new Date();
    const due = makeCard({ nextReviewAt: new Date(now.getTime() - 1000) });
    const notDue = makeCard({ nextReviewAt: new Date(now.getTime() + 86_400_000) });
    const { body } = await callEndpoint([due, notDue]);
    expect(body.reviewsDue).toBe(1);
  });

  it('avgStability correctly averages multiple cards', async () => {
    const cards = [
      makeCard({ fsrsStability: 4 }),
      makeCard({ fsrsStability: 8 }),
      makeCard({ fsrsStability: 12 }),
    ];
    const { body } = await callEndpoint(cards);
    expect(body.avgStability).toBeCloseTo(8, 1);
  });

  it('systemBreakdown groups cards by MedicalContent.system', async () => {
    const cards = [
      makeCard({ system: 'Cardiovascular', fsrsStability: 10 }),
      makeCard({ system: 'Cardiovascular', fsrsStability: 20 }),
      makeCard({ system: 'Pulmonary', fsrsStability: 5 }),
    ];
    const { body } = await callEndpoint(cards);
    const cv = body.systemBreakdown.find(
      (s: { system: string }) => s.system === 'Cardiovascular'
    );
    const pulm = body.systemBreakdown.find(
      (s: { system: string }) => s.system === 'Pulmonary'
    );
    expect(cv?.cardCount).toBe(2);
    expect(cv?.avgStability).toBeCloseTo(15, 1);
    expect(pulm?.cardCount).toBe(1);
  });

  it('returns 404 with error when user is not synced', async () => {
    const { result, prisma } = await callEndpoint([], false);
    expect(result.status).toBe(404);
    expect(typeof result.data?.error).toBe('string');
    // UserProgress must not have been queried
    expect(prisma.userProgress.findMany).not.toHaveBeenCalled();
  });
});
