/**
 * Reconciliation tests: GET /api/analytics/blueprint-gaps
 *
 * Sprint 7 (dashboard-trust audit §136) regression guards:
 *
 *   1. Canonical weights: the endpoint MUST source NCCPA 2025 weights from
 *      lib/constants/blueprint.ts (single source of truth), not an inlined
 *      dict that silently drifts. Target percentages must match canonical.
 *
 *   2. Per-row integrity: correctAttempts ≤ totalAttempts, 0 ≤ accuracy ≤ 100,
 *      and actualPercent is computed off the post-normalization total (not
 *      raw rows, which include un-mappable systems).
 *
 *   3. Conservation: sum of per-system totalAttempts equals the reported
 *      totalAttempts in the response.
 *
 *   4. Normalization: alias handling (CV → Cardiovascular, "Infectious
 *      Diseases" → Infectious Disease, "Psychiatry/Behavioral" → Psychiatry,
 *      etc.) routes rows to the correct canonical bucket. Unknown systems
 *      are dropped (not silently counted under a wrong bucket). The
 *      "General" fallback category is excluded from output rows.
 *
 *   5. Coverage score is a bounded 0..100 integer.
 *
 *   6. Unsynced user short-circuits with status 404 and an empty systems
 *      payload (no silent zeros).
 *
 *   7. Empty attempts fall through to the PerformanceRecord table rather
 *      than fabricating data.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import {
  NCCPA_2025_BLUEPRINT,
  normalizeSystemName,
} from '../../../lib/constants/blueprint';

const CLERK_ID = 'user_clerk_bp_123';
const INTERNAL_ID = 'internal-uuid-bp-0000';

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

vi.mock('../../../functions/api/_shared/user-resolver', () => ({
  resolveUserId: vi.fn(async () => INTERNAL_ID),
}));

import { createEdgePrismaClient } from '../../../functions/api/_shared/prisma-edge';
import { resolveUserId } from '../../../functions/api/_shared/user-resolver';

// ── Helpers ─────────────────────────────────────────────────────────────────

interface QuestionAttemptFixture {
  systemNormalized: string | null;
  wasCorrect: boolean;
}

interface PerformanceRecordFixture {
  system: string | null;
  isCorrect: boolean;
}

interface FakePrismaOptions {
  attempts?: QuestionAttemptFixture[];
  performanceRecords?: PerformanceRecordFixture[];
}

function makeFakePrisma(opts: FakePrismaOptions = {}) {
  const { attempts = [], performanceRecords = [] } = opts;
  return {
    questionAttempt: {
      findMany: vi.fn().mockResolvedValue(attempts),
    },
    performanceRecord: {
      findMany: vi.fn().mockResolvedValue(performanceRecords),
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

function attempt(systemNormalized: string | null, wasCorrect: boolean): QuestionAttemptFixture {
  return { systemNormalized, wasCorrect };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('GET /api/analytics/blueprint-gaps — dashboard-trust reconciliation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: user is resolvable
    (resolveUserId as Mock).mockResolvedValue(INTERNAL_ID);
  });

  it('sources target percentages from the canonical blueprint (no inlined drift)', async () => {
    const prisma = makeFakePrisma({
      attempts: [attempt('Cardiovascular', true)],
    });
    (createEdgePrismaClient as Mock).mockReturnValue(prisma);

    const { onRequestGet } = await import('../../../functions/api/analytics/blueprint-gaps');
    const result = await (onRequestGet as any)(baseContext());
    const { status, body } = await parseBody(result);

    expect(status).toBe(200);
    const systems = body?.systems as Array<{ system: string; targetPercent: number }>;
    expect(systems).toBeDefined();

    // Every row's targetPercent must equal canonical weight × 100.
    for (const row of systems) {
      const canonicalWeight = NCCPA_2025_BLUEPRINT[row.system];
      expect(canonicalWeight).toBeDefined();
      expect(row.targetPercent).toBeCloseTo((canonicalWeight ?? 0) * 100, 6);
    }

    // "General" fallback must not appear as its own row.
    expect(systems.some((r) => r.system === 'General')).toBe(false);

    // All 15 real NCCPA systems (blueprint minus General) should be present.
    const expectedSystems = Object.keys(NCCPA_2025_BLUEPRINT).filter((s) => s !== 'General');
    expect(systems.map((r) => r.system).sort()).toEqual(expectedSystems.sort());
  });

  it('per-row: correctAttempts ≤ totalAttempts and accuracy in [0, 100]', async () => {
    const prisma = makeFakePrisma({
      attempts: [
        attempt('Cardiovascular', true),
        attempt('Cardiovascular', true),
        attempt('Cardiovascular', false),
        attempt('Pulmonary', true),
        attempt('Psychiatry', false),
      ],
    });
    (createEdgePrismaClient as Mock).mockReturnValue(prisma);

    const { onRequestGet } = await import('../../../functions/api/analytics/blueprint-gaps');
    const result = await (onRequestGet as any)(baseContext());
    const { body } = await parseBody(result);

    for (const row of body.systems as Array<any>) {
      expect(row.correctAttempts).toBeLessThanOrEqual(row.totalAttempts);
      expect(row.accuracy).toBeGreaterThanOrEqual(0);
      expect(row.accuracy).toBeLessThanOrEqual(100);
      // Accuracy should be correct/total (rounded) when total > 0.
      if (row.totalAttempts > 0) {
        const expected = Math.round((row.correctAttempts / row.totalAttempts) * 100);
        expect(row.accuracy).toBe(expected);
      } else {
        expect(row.accuracy).toBe(0);
      }
    }
  });

  it('conservation: sum of per-system totalAttempts equals response totalAttempts', async () => {
    const rows = [
      attempt('Cardiovascular', true),
      attempt('Cardiovascular', false),
      attempt('Pulmonary', true),
      attempt('MSK', true),
      attempt('Dermatologic', false),
      attempt('GI', true),
    ];
    const prisma = makeFakePrisma({ attempts: rows });
    (createEdgePrismaClient as Mock).mockReturnValue(prisma);

    const { onRequestGet } = await import('../../../functions/api/analytics/blueprint-gaps');
    const result = await (onRequestGet as any)(baseContext());
    const { body } = await parseBody(result);

    const sumTotals = (body.systems as Array<{ totalAttempts: number }>).reduce(
      (s, r) => s + r.totalAttempts,
      0
    );
    expect(sumTotals).toBe(body.totalAttempts);
    expect(body.totalAttempts).toBe(rows.length);
  });

  it('normalizes common aliases to the canonical blueprint bucket', async () => {
    // Feed aliased system strings; expect them routed to canonical names.
    const rows = [
      attempt('CV', true), // → Cardiovascular
      attempt('cardiology', true), // → Cardiovascular
      attempt('Pulm', true), // → Pulmonary
      attempt('Infectious Diseases', false), // → Infectious Disease (plural alias)
      attempt('Psychiatry/Behavioral', true), // → Psychiatry (slash alias)
      attempt('Neurologic', false), // → Neurological
      attempt('Hematologic', true), // → Hematology
      attempt('Dermatologic', false), // → Dermatology
      attempt('Renal', true), // → Nephrology
    ];
    const prisma = makeFakePrisma({ attempts: rows });
    (createEdgePrismaClient as Mock).mockReturnValue(prisma);

    const { onRequestGet } = await import('../../../functions/api/analytics/blueprint-gaps');
    const result = await (onRequestGet as any)(baseContext());
    const { body } = await parseBody(result);

    const byName = Object.fromEntries(
      (body.systems as Array<{ system: string; totalAttempts: number }>).map((r) => [
        r.system,
        r.totalAttempts,
      ])
    );

    expect(byName['Cardiovascular']).toBe(2);
    expect(byName['Pulmonary']).toBe(1);
    expect(byName['Infectious Disease']).toBe(1);
    expect(byName['Psychiatry']).toBe(1);
    expect(byName['Neurological']).toBe(1);
    expect(byName['Hematology']).toBe(1);
    expect(byName['Dermatology']).toBe(1);
    expect(byName['Nephrology']).toBe(1);

    // Untouched buckets should be zero, not undefined.
    expect(byName['Emergency Medicine']).toBe(0);
    expect(byName['Endocrine']).toBe(0);

    // Sanity: every alias was accepted — no rows silently dropped.
    expect(body.totalAttempts).toBe(rows.length);
  });

  it('drops unknown and General system strings from the output total', async () => {
    const rows = [
      attempt('Cardiovascular', true),
      attempt('General', true), // fallback — must be dropped
      attempt('Pulmonary', true),
      attempt('NotARealSystem', true), // unknown — must be dropped
      attempt(null, true), // null — must be dropped
    ];
    const prisma = makeFakePrisma({ attempts: rows });
    (createEdgePrismaClient as Mock).mockReturnValue(prisma);

    const { onRequestGet } = await import('../../../functions/api/analytics/blueprint-gaps');
    const result = await (onRequestGet as any)(baseContext());
    const { body } = await parseBody(result);

    // Only Cardiovascular + Pulmonary were mappable.
    expect(body.totalAttempts).toBe(2);

    // No "General" row in the response.
    const systemNames = (body.systems as Array<{ system: string }>).map((r) => r.system);
    expect(systemNames).not.toContain('General');
    expect(systemNames).not.toContain('NotARealSystem');
  });

  it('actualPercent is computed off the normalized total (not raw rows)', async () => {
    const rows = [
      attempt('Cardiovascular', true),
      attempt('Cardiovascular', false),
      attempt('Pulmonary', true),
      attempt('NotARealSystem', true), // dropped
      attempt('General', true), // dropped
    ];
    const prisma = makeFakePrisma({ attempts: rows });
    (createEdgePrismaClient as Mock).mockReturnValue(prisma);

    const { onRequestGet } = await import('../../../functions/api/analytics/blueprint-gaps');
    const result = await (onRequestGet as any)(baseContext());
    const { body } = await parseBody(result);

    // totalAttempts should be 3 (normalized), NOT 5 (raw).
    expect(body.totalAttempts).toBe(3);

    const cardio = (body.systems as Array<any>).find((r) => r.system === 'Cardiovascular');
    const pulm = (body.systems as Array<any>).find((r) => r.system === 'Pulmonary');
    expect(cardio.actualPercent).toBeCloseTo((2 / 3) * 100, 1);
    expect(pulm.actualPercent).toBeCloseTo((1 / 3) * 100, 1);

    // Sum of actualPercent across systems should equal ~100 (since every
    // attempt lives in some bucket) — tolerance for rounding to 1 decimal.
    const sumActual = (body.systems as Array<any>).reduce(
      (s: number, r: any) => s + r.actualPercent,
      0
    );
    expect(sumActual).toBeGreaterThan(99);
    expect(sumActual).toBeLessThan(101);
  });

  it('coverageScore is an integer in [0, 100]', async () => {
    const prisma = makeFakePrisma({
      attempts: [
        attempt('Cardiovascular', true),
        attempt('Pulmonary', true),
        attempt('GI', true),
      ],
    });
    (createEdgePrismaClient as Mock).mockReturnValue(prisma);

    const { onRequestGet } = await import('../../../functions/api/analytics/blueprint-gaps');
    const result = await (onRequestGet as any)(baseContext());
    const { body } = await parseBody(result);

    expect(Number.isInteger(body.coverageScore)).toBe(true);
    expect(body.coverageScore).toBeGreaterThanOrEqual(0);
    expect(body.coverageScore).toBeLessThanOrEqual(100);
  });

  it('returns 404 with empty systems when user is unsynced (no silent zeros)', async () => {
    (resolveUserId as Mock).mockResolvedValue(null);
    const prisma = makeFakePrisma();
    (createEdgePrismaClient as Mock).mockReturnValue(prisma);

    const { onRequestGet } = await import('../../../functions/api/analytics/blueprint-gaps');
    const result = await (onRequestGet as any)(baseContext());
    const { status, body } = await parseBody(result);

    expect(status).toBe(404);
    expect(body?.systems).toEqual([]);
    expect(body?.totalAttempts).toBe(0);
    expect(body?.meta?.status).toBe('user_not_synced');

    // Must NOT have hit the attempts table when we failed to resolve the user.
    expect(prisma.questionAttempt.findMany).not.toHaveBeenCalled();
    expect(prisma.performanceRecord.findMany).not.toHaveBeenCalled();
  });

  it('falls back to PerformanceRecord when QuestionAttempt is empty', async () => {
    const prisma = makeFakePrisma({
      attempts: [],
      performanceRecords: [
        { system: 'Cardiovascular', isCorrect: true },
        { system: 'CV', isCorrect: false }, // alias
        { system: 'Pulm', isCorrect: true }, // alias
        { system: null, isCorrect: true }, // dropped
      ],
    });
    (createEdgePrismaClient as Mock).mockReturnValue(prisma);

    const { onRequestGet } = await import('../../../functions/api/analytics/blueprint-gaps');
    const result = await (onRequestGet as any)(baseContext());
    const { body } = await parseBody(result);

    expect(body.totalAttempts).toBe(3); // null row dropped
    expect(prisma.performanceRecord.findMany).toHaveBeenCalledOnce();

    const cardio = (body.systems as Array<any>).find((r) => r.system === 'Cardiovascular');
    expect(cardio.totalAttempts).toBe(2);
    expect(cardio.correctAttempts).toBe(1);
  });

  it('canonical blueprint weights (excluding General) still sum to ≥ 0.98 of 1.0', async () => {
    // Defensive guard against canonical drift — the audit requires that the
    // weights used for target% sum close to 1.0 so gap math stays meaningful.
    const real = Object.entries(NCCPA_2025_BLUEPRINT).filter(([k]) => k !== 'General');
    const sum = real.reduce((s, [, w]) => s + (w as number), 0);
    expect(sum).toBeGreaterThanOrEqual(0.98);
    expect(sum).toBeLessThanOrEqual(1.0);
  });

  it('normalizeSystemName round-trips every alias that real DB rows might use', async () => {
    // Sanity: the aliases tested in the "normalizes common aliases" case
    // above are all actually in canonical SYSTEM_ALIASES. Guards against
    // someone removing an alias and silently breaking this endpoint.
    const aliasesToCheck: Array<[string, string]> = [
      ['CV', 'Cardiovascular'],
      ['cardiology', 'Cardiovascular'],
      ['Pulm', 'Pulmonary'],
      ['Infectious Diseases', 'Infectious Disease'],
      ['Psychiatry/Behavioral', 'Psychiatry'],
      ['Neurologic', 'Neurological'],
      ['Hematologic', 'Hematology'],
      ['Dermatologic', 'Dermatology'],
      ['Renal', 'Nephrology'],
      ['Gastrointestinal/Nutrition', 'Gastrointestinal'],
    ];

    for (const [alias, canonical] of aliasesToCheck) {
      expect(normalizeSystemName(alias)).toBe(canonical);
    }
  });
});
