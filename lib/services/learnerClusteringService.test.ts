/**
 * Unit tests for lib/services/learnerClusteringService.ts
 *
 * Pure exports tested (no I/O, no async):
 *   featuresToVector(f)
 *   euclideanDistance(a, b)
 *   coefficientOfVariation(values)
 *   computeSpacingRegularity(gapHours)
 *   assignArchetype(features)
 *   kMeansClustering(learners, k?, maxIterations?, initialCentroids?)
 *   detectWarnings(input, thresholds?)
 *   computeRiskScore(warnings)
 *   analyzeLearner(features, warningInput, thresholds?)
 *
 * Constants:
 *   FEATURE_DIM = 10
 *   DEFAULT_WARNING_THRESHOLDS: accuracyDropWarning=0.05, accuracyDropCritical=0.10
 *     frequencyDropWarning=0.5, frequencyDropCritical=0.25
 *     burnoutWarning=0.6, burnoutCritical=0.8
 *     systemNeglectDays=14, readinessGapWarning=0.10, readinessGapCritical=0.20
 *
 * computeRiskScore: critical=0.4, warning=0.15, info=0.05; capped at 1.0
 * computeSpacingRegularity: max(0, 1 - cv/2) where cv = std/mean
 */

import { describe, it, expect } from 'vitest';
import {
  featuresToVector,
  euclideanDistance,
  coefficientOfVariation,
  computeSpacingRegularity,
  assignArchetype,
  kMeansClustering,
  detectWarnings,
  computeRiskScore,
  analyzeLearner,
  FEATURE_DIM,
  DEFAULT_WARNING_THRESHOLDS,
  ARCHETYPE_CENTROIDS,
  type LearnerFeatures,
  type WarningInput,
  type EarlyWarning,
} from './learnerClusteringService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeFeatures(overrides: Partial<LearnerFeatures> = {}): LearnerFeatures {
  return {
    dailyVolume: 0.5,
    volumeVariability: 0.2,
    accuracy: 0.70,
    relativeSpeed: 0.50,
    spacingRegularity: 0.85,
    systemBreadth: 0.70,
    systemDepth: 0.60,
    engagementTrend: 0.55,
    calibrationScore: 0.75,
    sessionCompletionRate: 0.90,
    ...overrides,
  };
}

function makeWarningInput(overrides: Partial<WarningInput> = {}): WarningInput {
  return {
    recentAccuracy: 0.75,
    baselineAccuracy: 0.75,
    sessionsLast7Days: 5,
    sessionsPrior21Days: 15,
    burnoutRisk: 0.20,
    engagementTrend: 0.0,
    daysUntilExam: null,
    projectedReadiness: 0.80,
    requiredReadiness: 0.75,
    systemLastReviewed: {},
    activeBlueprintSystems: [],
    responseTimeTrend: 0.0,
    ...overrides,
  };
}

function makeWarning(severity: EarlyWarning['severity']): EarlyWarning {
  return {
    type: 'accuracy_decline',
    message: 'test',
    severity,
    value: 0.1,
    threshold: 0.05,
    recommendation: 'test',
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────

describe('constants', () => {
  it('FEATURE_DIM = 10', () => expect(FEATURE_DIM).toBe(10));
  it('DEFAULT_WARNING_THRESHOLDS.accuracyDropWarning = 0.05', () =>
    expect(DEFAULT_WARNING_THRESHOLDS.accuracyDropWarning).toBeCloseTo(0.05, 5));
  it('DEFAULT_WARNING_THRESHOLDS.accuracyDropCritical = 0.10', () =>
    expect(DEFAULT_WARNING_THRESHOLDS.accuracyDropCritical).toBeCloseTo(0.10, 5));
  it('DEFAULT_WARNING_THRESHOLDS.burnoutWarning = 0.6', () =>
    expect(DEFAULT_WARNING_THRESHOLDS.burnoutWarning).toBeCloseTo(0.6, 5));
  it('DEFAULT_WARNING_THRESHOLDS.systemNeglectDays = 14', () =>
    expect(DEFAULT_WARNING_THRESHOLDS.systemNeglectDays).toBe(14));
  it('ARCHETYPE_CENTROIDS has 6 archetypes', () =>
    expect(Object.keys(ARCHETYPE_CENTROIDS)).toHaveLength(6));
});

// ─── featuresToVector ─────────────────────────────────────────────────────────

describe('featuresToVector', () => {
  it('returns array of length FEATURE_DIM (10)', () => {
    const vec = featuresToVector(makeFeatures());
    expect(vec).toHaveLength(FEATURE_DIM);
  });

  it('vector values match feature struct in order', () => {
    const f = makeFeatures({
      dailyVolume: 0.1,
      volumeVariability: 0.2,
      accuracy: 0.3,
    });
    const vec = featuresToVector(f);
    expect(vec[0]).toBe(0.1);
    expect(vec[1]).toBe(0.2);
    expect(vec[2]).toBe(0.3);
  });

  it('identical features → identical vectors', () => {
    const f = makeFeatures();
    expect(featuresToVector(f)).toEqual(featuresToVector(f));
  });
});

// ─── euclideanDistance ────────────────────────────────────────────────────────

describe('euclideanDistance', () => {
  it('[0,0] to [3,4] = 5 (3-4-5 triangle)', () => {
    expect(euclideanDistance([0, 0], [3, 4])).toBeCloseTo(5, 5);
  });

  it('same vector → distance = 0', () => {
    expect(euclideanDistance([1, 2, 3], [1, 2, 3])).toBeCloseTo(0, 8);
  });

  it('[1,0] to [0,1] = √2', () => {
    expect(euclideanDistance([1, 0], [0, 1])).toBeCloseTo(Math.sqrt(2), 5);
  });

  it('distance is symmetric', () => {
    const a = [1, 2, 3];
    const b = [4, 5, 6];
    expect(euclideanDistance(a, b)).toBeCloseTo(euclideanDistance(b, a), 8);
  });

  it('handles unequal lengths (pads missing values with 0)', () => {
    // Short vector treated as zero-padded
    expect(() => euclideanDistance([1, 2], [1, 2, 3])).not.toThrow();
  });
});

// ─── coefficientOfVariation ───────────────────────────────────────────────────

describe('coefficientOfVariation', () => {
  it('fewer than 2 values → 0', () => {
    expect(coefficientOfVariation([5])).toBe(0);
    expect(coefficientOfVariation([])).toBe(0);
  });

  it('all same values → 0 (no variation)', () => {
    expect(coefficientOfVariation([3, 3, 3])).toBeCloseTo(0, 8);
  });

  it('mean = 0 → 0 (guarded)', () => {
    expect(coefficientOfVariation([0, 0, 0])).toBe(0);
  });

  it('[1, 2, 3]: mean=2, population std=√(2/3), cv=√(2/3)/2', () => {
    const expectedCV = Math.sqrt(2 / 3) / 2;
    expect(coefficientOfVariation([1, 2, 3])).toBeCloseTo(expectedCV, 5);
  });

  it('higher spread → higher CV', () => {
    const low = coefficientOfVariation([10, 11, 10, 11]);
    const high = coefficientOfVariation([1, 100, 1, 100]);
    expect(high).toBeGreaterThan(low);
  });
});

// ─── computeSpacingRegularity ─────────────────────────────────────────────────

describe('computeSpacingRegularity', () => {
  it('fewer than 2 gaps → 0.5 (insufficient data)', () => {
    expect(computeSpacingRegularity([])).toBeCloseTo(0.5, 5);
    expect(computeSpacingRegularity([24])).toBeCloseTo(0.5, 5);
  });

  it('perfectly regular gaps (all 24h) → regularity = 1.0', () => {
    expect(computeSpacingRegularity([24, 24, 24, 24])).toBeCloseTo(1.0, 5);
  });

  it('highly irregular gaps → regularity is low (< 0.6)', () => {
    // gaps alternating 0.001 and 200 produce CV close to 2 → regularity near 0
    const gaps = [0.001, 0.001, 0.001, 0.001, 0.001, 200];
    expect(computeSpacingRegularity(gaps)).toBeLessThan(0.1);
  });

  it('regularity is always in [0, 1]', () => {
    const gaps = [1, 1000, 2, 500, 3];
    const r = computeSpacingRegularity(gaps);
    expect(r).toBeGreaterThanOrEqual(0);
    expect(r).toBeLessThanOrEqual(1);
  });

  it('more regular spacing → higher score', () => {
    const regular = computeSpacingRegularity([24, 25, 24, 25]); // low CV
    const irregular = computeSpacingRegularity([5, 48, 3, 60]); // high CV
    expect(regular).toBeGreaterThan(irregular);
  });
});

// ─── assignArchetype ──────────────────────────────────────────────────────────

describe('assignArchetype', () => {
  it('features matching CONSISTENT_REVIEWER centroid → CONSISTENT_REVIEWER', () => {
    // Exactly the CONSISTENT_REVIEWER centroid
    const centroid = ARCHETYPE_CENTROIDS['CONSISTENT_REVIEWER'];
    const features = makeFeatures({
      dailyVolume: centroid[0],
      volumeVariability: centroid[1],
      accuracy: centroid[2],
      relativeSpeed: centroid[3],
      spacingRegularity: centroid[4],
      systemBreadth: centroid[5],
      systemDepth: centroid[6],
      engagementTrend: centroid[7],
      calibrationScore: centroid[8],
      sessionCompletionRate: centroid[9],
    });
    const result = assignArchetype(features);
    expect(result.archetype).toBe('CONSISTENT_REVIEWER');
  });

  it('features matching DISENGAGING centroid → DISENGAGING', () => {
    const centroid = ARCHETYPE_CENTROIDS['DISENGAGING'];
    const features = makeFeatures({
      dailyVolume: centroid[0],
      volumeVariability: centroid[1],
      accuracy: centroid[2],
      relativeSpeed: centroid[3],
      spacingRegularity: centroid[4],
      systemBreadth: centroid[5],
      systemDepth: centroid[6],
      engagementTrend: centroid[7],
      calibrationScore: centroid[8],
      sessionCompletionRate: centroid[9],
    });
    expect(assignArchetype(features).archetype).toBe('DISENGAGING');
  });

  it('result includes all 6 archetypes in distances', () => {
    const result = assignArchetype(makeFeatures());
    const archetypes = Object.keys(result.distances);
    expect(archetypes).toContain('CONSISTENT_REVIEWER');
    expect(archetypes).toContain('CRAMMER');
    expect(archetypes).toContain('PERFECTIONIST');
    expect(archetypes).toContain('DISENGAGING');
    expect(archetypes).toContain('SPRINTER');
    expect(archetypes).toContain('EXPLORER');
  });

  it('assigned archetype has minimum distance', () => {
    const result = assignArchetype(makeFeatures());
    const minDist = Math.min(...Object.values(result.distances));
    expect(result.distances[result.archetype]).toBeCloseTo(minDist, 3);
  });

  it('confidence is in [0, 1]', () => {
    const result = assignArchetype(makeFeatures());
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it('features are passed through to result', () => {
    const f = makeFeatures({ accuracy: 0.42 });
    expect(assignArchetype(f).features.accuracy).toBe(0.42);
  });
});

// ─── kMeansClustering ─────────────────────────────────────────────────────────

describe('kMeansClustering', () => {
  it('empty input → empty output', () => {
    const result = kMeansClustering([]);
    expect(result.centroids).toEqual([]);
    expect(result.assignments).toEqual([]);
    expect(result.iterations).toBe(0);
  });

  it('assignments length matches input length', () => {
    const learners = [makeFeatures(), makeFeatures({ accuracy: 0.5 }), makeFeatures({ accuracy: 0.9 })];
    const result = kMeansClustering(learners, 2);
    expect(result.assignments).toHaveLength(3);
  });

  it('all assignment values are in [0, k-1]', () => {
    const learners = Array.from({ length: 6 }, () => makeFeatures());
    const k = 3;
    const { assignments } = kMeansClustering(learners, k);
    for (const a of assignments) {
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThan(k);
    }
  });

  it('respects k (number of centroids)', () => {
    const learners = Array.from({ length: 10 }, () => makeFeatures());
    const { centroids } = kMeansClustering(learners, 3);
    expect(centroids).toHaveLength(3);
  });

  it('each centroid has FEATURE_DIM elements', () => {
    const learners = [makeFeatures(), makeFeatures({ dailyVolume: 0.9 })];
    const { centroids } = kMeansClustering(learners, 2);
    for (const c of centroids) {
      expect(c).toHaveLength(FEATURE_DIM);
    }
  });

  it('identical learners → converges quickly (low iterations)', () => {
    const learners = Array.from({ length: 5 }, () => makeFeatures());
    const { iterations } = kMeansClustering(learners, 2, 20);
    // Should converge after 1-2 iterations since all points are the same
    expect(iterations).toBeLessThanOrEqual(5);
  });

  it('initial centroids override the default selection', () => {
    const learners = [makeFeatures(), makeFeatures({ accuracy: 0.9 })];
    const initCentroids = [featuresToVector(makeFeatures()), featuresToVector(makeFeatures({ accuracy: 0.9 }))];
    const result = kMeansClustering(learners, 2, 10, initCentroids);
    expect(result.centroids).toHaveLength(2);
  });
});

// ─── detectWarnings ───────────────────────────────────────────────────────────

describe('detectWarnings', () => {
  it('no concerning inputs → no warnings', () => {
    const input = makeWarningInput();
    expect(detectWarnings(input)).toHaveLength(0);
  });

  it('accuracy drop ≥ 0.10 → critical warning', () => {
    const input = makeWarningInput({ recentAccuracy: 0.60, baselineAccuracy: 0.75 });
    const warnings = detectWarnings(input);
    const w = warnings.find(w => w.type === 'accuracy_decline');
    expect(w).toBeDefined();
    expect(w!.severity).toBe('critical');
  });

  it('accuracy drop ≥ 0.05 but < 0.10 → warning', () => {
    const input = makeWarningInput({ recentAccuracy: 0.69, baselineAccuracy: 0.75 });
    const warnings = detectWarnings(input);
    const w = warnings.find(w => w.type === 'accuracy_decline');
    expect(w).toBeDefined();
    expect(w!.severity).toBe('warning');
  });

  it('no accuracy drop → no accuracy_decline warning', () => {
    const input = makeWarningInput({ recentAccuracy: 0.80, baselineAccuracy: 0.75 });
    const warnings = detectWarnings(input);
    expect(warnings.find(w => w.type === 'accuracy_decline')).toBeUndefined();
  });

  it('session frequency ≤ 25% of baseline → critical', () => {
    // baseline weekly rate = 15/3 = 5; recent = 1; ratio = 1/5 = 0.20 ≤ 0.25
    const input = makeWarningInput({ sessionsLast7Days: 1, sessionsPrior21Days: 15 });
    const warnings = detectWarnings(input);
    const w = warnings.find(w => w.type === 'session_frequency_drop');
    expect(w).toBeDefined();
    expect(w!.severity).toBe('critical');
  });

  it('session frequency ≤ 50% of baseline → warning', () => {
    // baseline weekly rate = 15/3 = 5; recent = 2; ratio = 0.40 ≤ 0.50
    const input = makeWarningInput({ sessionsLast7Days: 2, sessionsPrior21Days: 15 });
    const warnings = detectWarnings(input);
    const w = warnings.find(w => w.type === 'session_frequency_drop');
    expect(w).toBeDefined();
    expect(w!.severity).toBe('warning');
  });

  it('burnoutRisk ≥ 0.8 → critical', () => {
    const input = makeWarningInput({ burnoutRisk: 0.85 });
    const warnings = detectWarnings(input);
    const w = warnings.find(w => w.type === 'burnout_trajectory');
    expect(w!.severity).toBe('critical');
  });

  it('burnoutRisk ≥ 0.6 but < 0.8 → warning', () => {
    const input = makeWarningInput({ burnoutRisk: 0.70 });
    const warnings = detectWarnings(input);
    const w = warnings.find(w => w.type === 'burnout_trajectory');
    expect(w!.severity).toBe('warning');
  });

  it('exam readiness gap ≥ 0.20 with exam date set → critical', () => {
    const input = makeWarningInput({
      daysUntilExam: 30,
      projectedReadiness: 0.55,
      requiredReadiness: 0.80,  // gap = 0.25 ≥ 0.20
    });
    const w = detectWarnings(input).find(w => w.type === 'exam_readiness_gap');
    expect(w!.severity).toBe('critical');
  });

  it('exam readiness gap with null daysUntilExam → no warning', () => {
    const input = makeWarningInput({
      daysUntilExam: null,
      projectedReadiness: 0.50,
      requiredReadiness: 0.85,
    });
    expect(detectWarnings(input).find(w => w.type === 'exam_readiness_gap')).toBeUndefined();
  });

  it('system neglect ≥ 14 days → warning', () => {
    const input = makeWarningInput({
      systemLastReviewed: { Cardiovascular: 15 },
      activeBlueprintSystems: ['Cardiovascular'],
    });
    const w = detectWarnings(input).find(w => w.type === 'system_neglect');
    expect(w).toBeDefined();
    expect(w!.severity).toBe('warning');
  });

  it('system neglect ≥ 28 days → critical', () => {
    const input = makeWarningInput({
      systemLastReviewed: { Pulmonary: 30 },
      activeBlueprintSystems: ['Pulmonary'],
    });
    const w = detectWarnings(input).find(w => w.type === 'system_neglect');
    expect(w!.severity).toBe('critical');
  });

  it('engagementTrend < -0.3 → engagement_cliff warning', () => {
    const input = makeWarningInput({ engagementTrend: -0.5 });
    const w = detectWarnings(input).find(w => w.type === 'engagement_cliff');
    expect(w).toBeDefined();
    expect(w!.severity).toBe('warning');
  });

  it('engagementTrend < -0.6 → engagement_cliff critical', () => {
    const input = makeWarningInput({ engagementTrend: -0.7 });
    const w = detectWarnings(input).find(w => w.type === 'engagement_cliff');
    expect(w!.severity).toBe('critical');
  });

  it('warnings sorted: critical before warning', () => {
    const input = makeWarningInput({
      burnoutRisk: 0.70,         // warning
      recentAccuracy: 0.60,      // critical (drop = 0.15)
      baselineAccuracy: 0.75,
    });
    const warnings = detectWarnings(input);
    if (warnings.length >= 2) {
      expect(warnings[0]!.severity).toBe('critical');
    }
  });
});

// ─── computeRiskScore ─────────────────────────────────────────────────────────

describe('computeRiskScore', () => {
  it('no warnings → 0', () => {
    expect(computeRiskScore([])).toBe(0);
  });

  it('1 critical warning → 0.4', () => {
    expect(computeRiskScore([makeWarning('critical')])).toBeCloseTo(0.4, 2);
  });

  it('1 warning-severity → 0.15', () => {
    expect(computeRiskScore([makeWarning('warning')])).toBeCloseTo(0.15, 2);
  });

  it('1 info-severity → 0.05', () => {
    expect(computeRiskScore([makeWarning('info')])).toBeCloseTo(0.05, 2);
  });

  it('3 critical warnings → capped at 1.0', () => {
    const warnings = [makeWarning('critical'), makeWarning('critical'), makeWarning('critical')];
    // 3 × 0.4 = 1.2 → capped at 1.0
    expect(computeRiskScore(warnings)).toBe(1.0);
  });

  it('mixed: 1 critical + 2 warnings = 0.4 + 0.30 = 0.70', () => {
    const warnings = [
      makeWarning('critical'),
      makeWarning('warning'),
      makeWarning('warning'),
    ];
    expect(computeRiskScore(warnings)).toBeCloseTo(0.70, 2);
  });

  it('result is always in [0, 1]', () => {
    const manyWarnings = Array.from({ length: 20 }, () => makeWarning('critical'));
    expect(computeRiskScore(manyWarnings)).toBeLessThanOrEqual(1.0);
  });
});

// ─── analyzeLearner ───────────────────────────────────────────────────────────

describe('analyzeLearner', () => {
  it('returns cluster, warnings, riskScore', () => {
    const result = analyzeLearner(makeFeatures(), makeWarningInput());
    expect(result).toHaveProperty('cluster');
    expect(result).toHaveProperty('warnings');
    expect(result).toHaveProperty('riskScore');
  });

  it('no concerning input → riskScore = 0', () => {
    expect(analyzeLearner(makeFeatures(), makeWarningInput()).riskScore).toBe(0);
  });

  it('concerning input → riskScore > 0', () => {
    const input = makeWarningInput({ burnoutRisk: 0.90 });
    expect(analyzeLearner(makeFeatures(), input).riskScore).toBeGreaterThan(0);
  });

  it('cluster matches assignArchetype output', () => {
    const f = makeFeatures();
    const directCluster = assignArchetype(f);
    const { cluster } = analyzeLearner(f, makeWarningInput());
    expect(cluster.archetype).toBe(directCluster.archetype);
  });
});
