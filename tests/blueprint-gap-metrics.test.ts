/**
 * Metric-correctness tests for blueprint gap analysis.
 *
 * Verifies that:
 * 1. actualPercent denominators are correct (sum = 100% across all systems)
 * 2. gapPercent = actualPercent − targetPercent (signed, not absolute)
 * 3. coverageScore degrades linearly with average misalignment
 * 4. accuracy = correctAttempts / totalAttempts (guarded against div-by-zero)
 * 5. Systems with 0 attempts produce accuracy=0, not NaN
 * 6. totalAttempts is the sum of all per-system attempts (no double-count)
 */

import { describe, it, expect } from 'vitest';

// ─── Pure helpers mirroring blueprint-gaps.ts logic ──────────────────────────

interface SystemAgg {
  total: number;
  correct: number;
}

interface BlueprintGapSystem {
  system: string;
  targetPercent: number;
  actualPercent: number;
  gapPercent: number;
  totalAttempts: number;
  correctAttempts: number;
  accuracy: number;
}

function buildGapSystems(
  nccpaTarget: Record<string, number>,
  systemAgg: Record<string, SystemAgg>,
  totalAttempts: number
): BlueprintGapSystem[] {
  return Object.entries(nccpaTarget).map(([system, targetWeight]) => {
    const agg = systemAgg[system] ?? { total: 0, correct: 0 };
    const actualPercent = totalAttempts > 0 ? (agg.total / totalAttempts) * 100 : 0;
    const targetPercent = targetWeight * 100;
    return {
      system,
      targetPercent,
      actualPercent: Math.round(actualPercent * 10) / 10,
      gapPercent: Math.round((actualPercent - targetPercent) * 10) / 10,
      totalAttempts: agg.total,
      correctAttempts: agg.correct,
      accuracy: agg.total > 0 ? Math.round((agg.correct / agg.total) * 100) : 0,
    };
  });
}

function computeCoverageScore(systems: BlueprintGapSystem[]): number {
  if (systems.length === 0) return 0;
  const avgAbsGap =
    systems.reduce((sum, s) => sum + Math.abs(s.gapPercent), 0) / systems.length;
  return Math.max(0, Math.min(100, Math.round(100 - avgAbsGap * 2)));
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

/** Minimal 3-system blueprint whose weights sum to 1.0 */
const BLUEPRINT_3: Record<string, number> = {
  CV: 0.3,
  PULM: 0.2,
  GI: 0.5,
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('blueprint gap: actualPercent denominators', () => {
  it('actualPercent values sum to ~100 when every attempt maps to a valid system', () => {
    const agg: Record<string, SystemAgg> = {
      CV: { total: 30, correct: 25 },
      PULM: { total: 20, correct: 15 },
      GI: { total: 50, correct: 40 },
    };
    const total = 100;
    const systems = buildGapSystems(BLUEPRINT_3, agg, total);
    const sumActual = systems.reduce((s, x) => s + x.actualPercent, 0);
    // May not be exactly 100 due to rounding, but within 1%
    expect(sumActual).toBeCloseTo(100, 0);
  });

  it('returns actualPercent=0 for all systems when totalAttempts is 0', () => {
    const systems = buildGapSystems(BLUEPRINT_3, {}, 0);
    expect(systems.every((s) => s.actualPercent === 0)).toBe(true);
  });

  it('sums per-system totalAttempts to equal totalAttempts', () => {
    const agg: Record<string, SystemAgg> = {
      CV: { total: 30, correct: 25 },
      PULM: { total: 20, correct: 15 },
      GI: { total: 50, correct: 40 },
    };
    const total = 100;
    const systems = buildGapSystems(BLUEPRINT_3, agg, total);
    const sumParts = systems.reduce((s, x) => s + x.totalAttempts, 0);
    expect(sumParts).toBe(total);
  });
});

describe('blueprint gap: gapPercent = actualPercent − targetPercent', () => {
  it('is negative when a system is under-studied relative to blueprint', () => {
    // CV target=30%, actual=10% → gap=-20%
    const agg: Record<string, SystemAgg> = {
      CV: { total: 10, correct: 8 },
      PULM: { total: 40, correct: 30 },
      GI: { total: 50, correct: 40 },
    };
    const systems = buildGapSystems(BLUEPRINT_3, agg, 100);
    const cv = systems.find((s) => s.system === 'CV')!;
    expect(cv.gapPercent).toBeLessThan(0);
    expect(cv.gapPercent).toBeCloseTo(cv.actualPercent - cv.targetPercent, 1);
  });

  it('is positive when a system is over-studied relative to blueprint', () => {
    // GI target=50%, actual=80% → gap=+30%
    const agg: Record<string, SystemAgg> = {
      CV: { total: 10, correct: 8 },
      PULM: { total: 10, correct: 8 },
      GI: { total: 80, correct: 70 },
    };
    const systems = buildGapSystems(BLUEPRINT_3, agg, 100);
    const gi = systems.find((s) => s.system === 'GI')!;
    expect(gi.gapPercent).toBeGreaterThan(0);
    expect(gi.gapPercent).toBeCloseTo(gi.actualPercent - gi.targetPercent, 1);
  });

  it('is 0 for perfectly aligned distribution', () => {
    const agg: Record<string, SystemAgg> = {
      CV: { total: 30, correct: 25 },
      PULM: { total: 20, correct: 15 },
      GI: { total: 50, correct: 40 },
    };
    const systems = buildGapSystems(BLUEPRINT_3, agg, 100);
    systems.forEach((s) => {
      expect(Math.abs(s.gapPercent)).toBeLessThanOrEqual(0.2); // rounding only
    });
  });
});

describe('blueprint gap: accuracy calculation', () => {
  it('is correct / total * 100', () => {
    const agg: Record<string, SystemAgg> = {
      CV: { total: 10, correct: 7 },
      PULM: { total: 0, correct: 0 },
      GI: { total: 50, correct: 50 },
    };
    const systems = buildGapSystems(BLUEPRINT_3, agg, 60);
    const cv = systems.find((s) => s.system === 'CV')!;
    expect(cv.accuracy).toBe(70);
  });

  it('returns accuracy=0 (not NaN) for systems with 0 attempts', () => {
    const systems = buildGapSystems(BLUEPRINT_3, {}, 0);
    systems.forEach((s) => {
      expect(s.accuracy).toBe(0);
      expect(Number.isNaN(s.accuracy)).toBe(false);
    });
  });

  it('returns 100 when all attempts are correct', () => {
    const agg: Record<string, SystemAgg> = { GI: { total: 50, correct: 50 } };
    const systems = buildGapSystems(BLUEPRINT_3, agg, 50);
    const gi = systems.find((s) => s.system === 'GI')!;
    expect(gi.accuracy).toBe(100);
  });
});

describe('blueprint gap: coverageScore', () => {
  it('returns 100 for a perfectly aligned distribution', () => {
    const agg: Record<string, SystemAgg> = {
      CV: { total: 30, correct: 28 },
      PULM: { total: 20, correct: 18 },
      GI: { total: 50, correct: 45 },
    };
    const systems = buildGapSystems(BLUEPRINT_3, agg, 100);
    const score = computeCoverageScore(systems);
    expect(score).toBeGreaterThanOrEqual(98); // rounding may prevent 100
  });

  it('is substantially lower for a misaligned distribution', () => {
    // All attempts in GI (target 50%) → CV and PULM are 100% missed.
    // avgAbsGap = (30 + 20 + 50) / 3 ≈ 33.3  →  score = round(100 − 33.3×2) ≈ 33.
    // Much lower than 98+ for the aligned case above.
    const agg: Record<string, SystemAgg> = { GI: { total: 100, correct: 70 } };
    const systems = buildGapSystems(BLUEPRINT_3, agg, 100);
    const score = computeCoverageScore(systems);
    expect(score).toBeLessThanOrEqual(40);
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it('is clamped to [0, 100]', () => {
    // Fabricate extreme gap to drive avgAbsGap > 50
    const systems: BlueprintGapSystem[] = [
      {
        system: 'CV',
        targetPercent: 30,
        actualPercent: 100,
        gapPercent: 70,
        totalAttempts: 100,
        correctAttempts: 80,
        accuracy: 80,
      },
    ];
    const score = computeCoverageScore(systems);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('returns 0 for an empty system list', () => {
    expect(computeCoverageScore([])).toBe(0);
  });
});
