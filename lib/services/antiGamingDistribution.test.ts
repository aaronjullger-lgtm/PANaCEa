/**
 * Unit tests for lib/services/antiGamingDistribution.ts
 *
 * Pure exports tested (no I/O, no async):
 *   buildSessionConstraints(analysis, sessionSize?)
 *   getOptimizationWeight(system, analysis)
 *
 * Constants:
 *   SKEW_THRESHOLD = 2.0   (over-represented if actualW/targetW > 2)
 *   DEFICIT_THRESHOLD = 0.4 (under-represented if actualW/targetW < 0.4)
 *   MAX_SYSTEM_FRACTION = 0.40 (absolute cap per session)
 *   MIN_REVIEWS_FOR_ENFORCEMENT = 30 (cold-start bypass)
 *   DEFAULT_SESSION_SIZE = 20
 *
 * getOptimizationWeight formula (when windowSize >= 30):
 *   ratio <= 1.5 → 1.0
 *   ratio > 1.5  → max(0.3, 1.0 - (ratio - 1.5) × 0.4)
 *   targetW == 0 → 0.3
 */

import { describe, it, expect } from 'vitest';
import {
  buildSessionConstraints,
  getOptimizationWeight,
  type DistributionAnalysis,
  type SessionConstraints,
} from './antiGamingDistribution';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BLUEPRINT: Record<string, number> = {
  Cardiology: 0.11,
  Pulmonology: 0.09,
  Neurology: 0.08,
  GI: 0.07,
  Musculoskeletal: 0.07,
};

function makeAnalysis(overrides: Partial<DistributionAnalysis> = {}): DistributionAnalysis {
  const base: DistributionAnalysis = {
    actual: {
      Cardiology: 0.11,
      Pulmonology: 0.09,
      Neurology: 0.08,
      GI: 0.07,
      Musculoskeletal: 0.07,
    },
    target: BLUEPRINT,
    overRepresented: [],
    underRepresented: [],
    skewScore: 0,
    windowSize: 50,
    isBalanced: true,
    systemSuppressionFactors: {
      Cardiology: 1.0,
      Pulmonology: 1.0,
      Neurology: 1.0,
      GI: 1.0,
      Musculoskeletal: 1.0,
    },
  };
  return { ...base, ...overrides };
}

// ─── buildSessionConstraints ──────────────────────────────────────────────────

describe('buildSessionConstraints', () => {
  it('returns perSystemCaps for each system in target', () => {
    const analysis = makeAnalysis();
    const constraints = buildSessionConstraints(analysis);
    for (const sys of Object.keys(BLUEPRINT)) {
      expect(constraints.perSystemCaps).toHaveProperty(sys);
    }
  });

  it('all perSystemCaps are positive integers', () => {
    const analysis = makeAnalysis();
    const constraints = buildSessionConstraints(analysis);
    for (const cap of Object.values(constraints.perSystemCaps)) {
      expect(cap).toBeGreaterThanOrEqual(1);
      expect(Number.isInteger(cap)).toBe(true);
    }
  });

  it('no cap exceeds absoluteMax (ceil(sessionSize × 0.40))', () => {
    const sessionSize = 20;
    const absoluteMax = Math.ceil(sessionSize * 0.40); // 8
    const analysis = makeAnalysis();
    const constraints = buildSessionConstraints(analysis, sessionSize);
    for (const cap of Object.values(constraints.perSystemCaps)) {
      expect(cap).toBeLessThanOrEqual(absoluteMax);
    }
  });

  it('minimum cap is 1 (even for tiny target weights)', () => {
    const analysis = makeAnalysis({
      target: { Tiny: 0.001 },
      actual: { Tiny: 0.001 },
      systemSuppressionFactors: { Tiny: 1.0 },
    });
    const constraints = buildSessionConstraints(analysis, 10);
    expect(constraints.perSystemCaps['Tiny']).toBeGreaterThanOrEqual(1);
  });

  it('over-represented system with suppression factor < 1 gets reduced cap', () => {
    const cardiologySuppressed = makeAnalysis({
      systemSuppressionFactors: {
        ...Object.fromEntries(Object.keys(BLUEPRINT).map(k => [k, 1.0])),
        Cardiology: 0.4, // heavily suppressed
      },
      overRepresented: ['Cardiology'],
    });
    const normal = makeAnalysis();

    const suppressedConstraints = buildSessionConstraints(cardiologySuppressed, 20);
    const normalConstraints = buildSessionConstraints(normal, 20);

    expect(suppressedConstraints.perSystemCaps['Cardiology']!)
      .toBeLessThanOrEqual(normalConstraints.perSystemCaps['Cardiology']!);
  });

  it('boostSystems matches analysis.underRepresented', () => {
    const analysis = makeAnalysis({ underRepresented: ['Neurology', 'GI'] });
    const constraints = buildSessionConstraints(analysis);
    expect(constraints.boostSystems).toEqual(['Neurology', 'GI']);
  });

  it('suppressSystems matches analysis.overRepresented', () => {
    const analysis = makeAnalysis({ overRepresented: ['Cardiology'] });
    const constraints = buildSessionConstraints(analysis);
    expect(constraints.suppressSystems).toEqual(['Cardiology']);
  });

  it('strictInterleaving is true when skewScore > 0.2', () => {
    const skewed = makeAnalysis({ skewScore: 0.5 });
    expect(buildSessionConstraints(skewed).strictInterleaving).toBe(true);
  });

  it('strictInterleaving is false when skewScore ≤ 0.2', () => {
    const balanced = makeAnalysis({ skewScore: 0.1 });
    expect(buildSessionConstraints(balanced).strictInterleaving).toBe(false);
  });

  it('strictInterleaving boundary: skewScore = 0.2 → false', () => {
    const boundary = makeAnalysis({ skewScore: 0.2 });
    // 0.2 > 0.2 is false → strictInterleaving = false
    expect(buildSessionConstraints(boundary).strictInterleaving).toBe(false);
  });

  it('custom sessionSize scales caps proportionally', () => {
    const analysis = makeAnalysis();
    const small = buildSessionConstraints(analysis, 10);
    const large = buildSessionConstraints(analysis, 40);
    // Larger session → larger or equal caps
    for (const sys of Object.keys(BLUEPRINT)) {
      expect(large.perSystemCaps[sys]!).toBeGreaterThanOrEqual(small.perSystemCaps[sys]!);
    }
  });
});

// ─── getOptimizationWeight ────────────────────────────────────────────────────

describe('getOptimizationWeight', () => {
  it('returns 1.0 for cold-start user (windowSize < 30)', () => {
    const analysis = makeAnalysis({ windowSize: 29 });
    expect(getOptimizationWeight('Cardiology', analysis)).toBe(1.0);
  });

  it('returns 1.0 for cold-start even if system is over-represented', () => {
    const analysis = makeAnalysis({
      windowSize: 10,
      actual: { Cardiology: 0.80 },
      target: { Cardiology: 0.11 },
    });
    expect(getOptimizationWeight('Cardiology', analysis)).toBe(1.0);
  });

  it('returns 0.3 for system not in blueprint (targetW = 0)', () => {
    const analysis = makeAnalysis({
      windowSize: 50,
      actual: { Cardiology: 0.15 },
      target: { Cardiology: 0 },
    });
    expect(getOptimizationWeight('Cardiology', analysis)).toBeCloseTo(0.3, 5);
  });

  it('returns 1.0 when ratio ≤ 1.5 (at target)', () => {
    const analysis = makeAnalysis({
      windowSize: 50,
      actual: { Cardiology: 0.11 }, // ratio = 1.0
      target: { Cardiology: 0.11 },
    });
    expect(getOptimizationWeight('Cardiology', analysis)).toBeCloseTo(1.0, 5);
  });

  it('returns 1.0 at boundary ratio = 1.5', () => {
    const analysis = makeAnalysis({
      windowSize: 50,
      actual: { Cardiology: 0.165 }, // ratio = 0.165/0.11 = 1.5
      target: { Cardiology: 0.11 },
    });
    expect(getOptimizationWeight('Cardiology', analysis)).toBeCloseTo(1.0, 5);
  });

  it('returns 0.8 when ratio = 2.0 (2× over target)', () => {
    // weight = max(0.3, 1.0 - (2.0 - 1.5) × 0.4) = max(0.3, 0.8) = 0.8
    const analysis = makeAnalysis({
      windowSize: 50,
      actual: { Cardiology: 0.22 }, // ratio = 2.0
      target: { Cardiology: 0.11 },
    });
    expect(getOptimizationWeight('Cardiology', analysis)).toBeCloseTo(0.8, 5);
  });

  it('returns 0.4 when ratio = 3.0 (3× over target)', () => {
    // weight = max(0.3, 1.0 - (3.0 - 1.5) × 0.4) = max(0.3, 0.4) = 0.4
    const analysis = makeAnalysis({
      windowSize: 50,
      actual: { Cardiology: 0.33 }, // ratio = 3.0
      target: { Cardiology: 0.11 },
    });
    expect(getOptimizationWeight('Cardiology', analysis)).toBeCloseTo(0.4, 5);
  });

  it('clamps to 0.3 at very high ratio (ratio ≥ 4.0)', () => {
    // weight = max(0.3, 1.0 - (4.0 - 1.5) × 0.4) = max(0.3, 0.0) = 0.3
    const analysis = makeAnalysis({
      windowSize: 50,
      actual: { Cardiology: 0.44 }, // ratio = 4.0
      target: { Cardiology: 0.11 },
    });
    expect(getOptimizationWeight('Cardiology', analysis)).toBeCloseTo(0.3, 5);
  });

  it('weight is monotonically decreasing as ratio increases', () => {
    const weights = [1.5, 2.0, 2.5, 3.0, 3.5, 4.0].map(ratio => {
      const analysis = makeAnalysis({
        windowSize: 50,
        actual: { Cardiology: 0.11 * ratio },
        target: { Cardiology: 0.11 },
      });
      return getOptimizationWeight('Cardiology', analysis);
    });
    for (let i = 1; i < weights.length; i++) {
      expect(weights[i]!).toBeLessThanOrEqual(weights[i - 1]!);
    }
  });

  it('returns 1.0 for missing system (not in actual)', () => {
    const analysis = makeAnalysis({
      windowSize: 50,
      actual: {}, // system not reviewed
      target: { Cardiology: 0.11 },
    });
    // actualW = 0, ratio = 0/0.11 = 0 → ratio ≤ 1.5 → 1.0
    expect(getOptimizationWeight('Cardiology', analysis)).toBeCloseTo(1.0, 5);
  });
});
