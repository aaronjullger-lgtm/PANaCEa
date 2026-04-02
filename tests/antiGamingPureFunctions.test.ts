import { describe, it, expect } from 'vitest';
import {
  buildSessionConstraints,
  getOptimizationWeight,
  type DistributionAnalysis,
} from '../lib/services/antiGamingDistribution';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeAnalysis(overrides: Partial<DistributionAnalysis> = {}): DistributionAnalysis {
  return {
    actual: { Cardiology: 0.4, Pulmonary: 0.3, GI: 0.3 },
    target: { Cardiology: 0.33, Pulmonary: 0.33, GI: 0.34 },
    skewScore: 0.1,
    overRepresented: [],
    underRepresented: [],
    windowSize: 100,
    systemSuppressionFactors: {
      Cardiology: 1.0, Pulmonary: 1.0, GI: 1.0,
    },
    ...overrides,
  };
}

// ─── buildSessionConstraints ────────────────────────────────────────────────

describe('buildSessionConstraints', () => {
  it('produces per-system caps for each target system', () => {
    const constraints = buildSessionConstraints(makeAnalysis(), 20);
    expect(constraints.perSystemCaps).toHaveProperty('Cardiology');
    expect(constraints.perSystemCaps).toHaveProperty('Pulmonary');
    expect(constraints.perSystemCaps).toHaveProperty('GI');
  });

  it('ensures each system cap is at least 1', () => {
    const constraints = buildSessionConstraints(makeAnalysis(), 20);
    for (const cap of Object.values(constraints.perSystemCaps)) {
      expect(cap).toBeGreaterThanOrEqual(1);
    }
  });

  it('enables strict interleaving when skewScore > 0.2', () => {
    const skewed = makeAnalysis({ skewScore: 0.3 });
    const constraints = buildSessionConstraints(skewed, 20);
    expect(constraints.strictInterleaving).toBe(true);
  });

  it('disables strict interleaving when skewScore <= 0.2', () => {
    const balanced = makeAnalysis({ skewScore: 0.1 });
    const constraints = buildSessionConstraints(balanced, 20);
    expect(constraints.strictInterleaving).toBe(false);
  });

  it('passes through boost and suppress system lists', () => {
    const analysis = makeAnalysis({
      underRepresented: ['Neuro'],
      overRepresented: ['Cardiology'],
    });
    const constraints = buildSessionConstraints(analysis, 20);
    expect(constraints.boostSystems).toContain('Neuro');
    expect(constraints.suppressSystems).toContain('Cardiology');
  });

  it('reduces caps for suppressed systems', () => {
    const analysis = makeAnalysis({
      systemSuppressionFactors: {
        Cardiology: 0.3,
        Pulmonary: 1.0,
        GI: 1.0,
      },
    });
    const constraints = buildSessionConstraints(analysis, 20);
    expect(constraints.perSystemCaps.Cardiology)
      .toBeLessThanOrEqual(constraints.perSystemCaps.Pulmonary);
  });
});

// ─── getOptimizationWeight ──────────────────────────────────────────────────

describe('getOptimizationWeight', () => {
  it('returns 1.0 when window is too small', () => {
    const analysis = makeAnalysis({ windowSize: 5 });
    expect(getOptimizationWeight('Cardiology', analysis)).toBe(1.0);
  });

  it('returns 1.0 for under-represented systems', () => {
    const analysis = makeAnalysis({
      actual: { Cardiology: 0.1, Pulmonary: 0.5, GI: 0.4 },
    });
    expect(getOptimizationWeight('Cardiology', analysis)).toBe(1.0);
  });

  it('returns 0.3 for systems not in blueprint', () => {
    const analysis = makeAnalysis();
    // 'Dermatology' not in target
    expect(getOptimizationWeight('Dermatology', analysis)).toBe(0.3);
  });

  it('dampens over-represented systems (ratio > 1.5)', () => {
    const analysis = makeAnalysis({
      actual: { Cardiology: 0.66, Pulmonary: 0.17, GI: 0.17 },
      target: { Cardiology: 0.33, Pulmonary: 0.33, GI: 0.34 },
    });
    const weight = getOptimizationWeight('Cardiology', analysis);
    expect(weight).toBeLessThan(1.0);
    expect(weight).toBeGreaterThanOrEqual(0.3);
  });

  it('never returns below 0.3', () => {
    const analysis = makeAnalysis({
      actual: { Cardiology: 0.99, Pulmonary: 0.005, GI: 0.005 },
      target: { Cardiology: 0.33, Pulmonary: 0.33, GI: 0.34 },
    });
    expect(getOptimizationWeight('Cardiology', analysis)).toBeGreaterThanOrEqual(0.3);
  });
});
