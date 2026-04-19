import { describe, it, expect } from 'vitest';
import {
  buildSessionConstraints,
  getOptimizationWeight,
  type DistributionAnalysis,
} from '../lib/services/antiGamingDistribution';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BLUEPRINT_TARGETS: Record<string, number> = {
  Cardiovascular: 0.16,
  Pulmonary: 0.12,
  GI: 0.10,
  MSK: 0.10,
  Neuro: 0.08,
  Endo: 0.06,
  Renal: 0.06,
  Derm: 0.05,
  EENT: 0.05,
  Psych: 0.06,
  Heme: 0.05,
  ID: 0.05,
  Repro: 0.06,
};

function makeAnalysis(overrides: Partial<DistributionAnalysis> = {}): DistributionAnalysis {
  return {
    actual: { ...BLUEPRINT_TARGETS },
    target: { ...BLUEPRINT_TARGETS },
    overRepresented: [],
    underRepresented: [],
    skewScore: 0,
    windowSize: 100,
    isBalanced: true,
    systemSuppressionFactors: Object.fromEntries(
      Object.keys(BLUEPRINT_TARGETS).map((s) => [s, 1.0])
    ),
    ...overrides,
  };
}

// ─── buildSessionConstraints ──────────────────────────────────────────────────

describe('antiGamingDistribution — buildSessionConstraints', () => {
  it('returns per-system caps that respect MAX_SYSTEM_FRACTION (40%)', () => {
    const analysis = makeAnalysis();
    const constraints = buildSessionConstraints(analysis, 25);
    // No system cap should exceed ceil(25 * 0.4) = 10
    for (const cap of Object.values(constraints.perSystemCaps)) {
      expect(cap).toBeLessThanOrEqual(10);
    }
  });

  it('suppresses over-represented systems', () => {
    const analysis = makeAnalysis({
      overRepresented: ['Cardiovascular'],
      systemSuppressionFactors: {
        ...Object.fromEntries(Object.keys(BLUEPRINT_TARGETS).map((s) => [s, 1.0])),
        Cardiovascular: 0.4, // heavily suppressed
      },
    });
    const constraints = buildSessionConstraints(analysis, 25);
    // Suppressed system should have a lower cap than its normal allocation
    // Normal CV: ceil(25 * 0.16 * 1.5) = ceil(6) = 6; suppressed: round(6*0.4)=2, min 1
    expect(constraints.perSystemCaps['Cardiovascular']).toBeLessThanOrEqual(3);
    expect(constraints.suppressSystems).toContain('Cardiovascular');
  });

  it('boosts under-represented systems', () => {
    const analysis = makeAnalysis({
      underRepresented: ['Pulmonary'],
    });
    const constraints = buildSessionConstraints(analysis, 25);
    expect(constraints.boostSystems).toContain('Pulmonary');
  });

  it('enforces strict interleaving when skew > 0.2', () => {
    const analysis = makeAnalysis({ skewScore: 0.5 });
    const constraints = buildSessionConstraints(analysis, 25);
    expect(constraints.strictInterleaving).toBe(true);
  });

  it('does not enforce strict interleaving when balanced', () => {
    const analysis = makeAnalysis({ skewScore: 0.1 });
    const constraints = buildSessionConstraints(analysis, 25);
    expect(constraints.strictInterleaving).toBe(false);
  });

  it('guarantees minimum cap of 1 for every targeted system', () => {
    const analysis = makeAnalysis({
      systemSuppressionFactors: Object.fromEntries(
        Object.keys(BLUEPRINT_TARGETS).map((s) => [s, 0.15]) // max suppression
      ),
    });
    const constraints = buildSessionConstraints(analysis, 25);
    for (const [sys, cap] of Object.entries(constraints.perSystemCaps)) {
      expect(cap).toBeGreaterThanOrEqual(1);
    }
  });
});

// ─── getOptimizationWeight ────────────────────────────────────────────────────

describe('antiGamingDistribution — getOptimizationWeight', () => {
  it('returns 1.0 for cold-start users (< 30 reviews)', () => {
    const analysis = makeAnalysis({ windowSize: 20 });
    expect(getOptimizationWeight('Cardiovascular', analysis)).toBe(1.0);
  });

  it('returns 1.0 for systems at or below target', () => {
    // CV actual=0.16, target=0.16 → ratio=1.0 ≤ 1.5 → weight=1.0
    const analysis = makeAnalysis({ windowSize: 100 });
    expect(getOptimizationWeight('Cardiovascular', analysis)).toBe(1.0);
  });

  it('dampens weight for over-represented systems (ratio > 1.5)', () => {
    // CV actual=0.40, target=0.16 → ratio=2.5 → weight = max(0.3, 1.0 - (2.5-1.5)*0.4) = max(0.3, 0.6) = 0.6
    const analysis = makeAnalysis({
      actual: { ...BLUEPRINT_TARGETS, Cardiovascular: 0.40 },
      windowSize: 100,
    });
    const weight = getOptimizationWeight('Cardiovascular', analysis);
    expect(weight).toBeCloseTo(0.6, 1);
    expect(weight).toBeLessThan(1.0);
    expect(weight).toBeGreaterThanOrEqual(0.3);
  });

  it('floors weight at 0.3 for extremely over-represented systems', () => {
    // CV actual=0.80, target=0.16 → ratio=5.0 → weight = max(0.3, 1.0 - (5.0-1.5)*0.4) = max(0.3, -0.4) = 0.3
    const analysis = makeAnalysis({
      actual: { ...BLUEPRINT_TARGETS, Cardiovascular: 0.80 },
      windowSize: 100,
    });
    const weight = getOptimizationWeight('Cardiovascular', analysis);
    expect(weight).toBe(0.3);
  });

  it('returns 0.3 for systems not in the blueprint', () => {
    const analysis = makeAnalysis({
      actual: { ...BLUEPRINT_TARGETS, Unknown: 0.10 },
      target: { ...BLUEPRINT_TARGETS, Unknown: 0 },
      windowSize: 100,
    });
    const weight = getOptimizationWeight('Unknown', analysis);
    expect(weight).toBe(0.3);
  });
});
