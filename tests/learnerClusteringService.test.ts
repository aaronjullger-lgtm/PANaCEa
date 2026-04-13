/**
 * Tests for Learner Clustering & Early Warning Service
 *
 * Validates archetype assignment, k-means, distance computations,
 * early warning detection, risk scoring, and edge cases.
 */
import { describe, it, expect } from 'vitest';
import {
  FEATURE_DIM,
  ALL_ARCHETYPES,
  ARCHETYPE_CENTROIDS,
  featuresToVector,
  euclideanDistance,
  coefficientOfVariation,
  computeSpacingRegularity,
  assignArchetype,
  kMeansClustering,
  detectWarnings,
  computeRiskScore,
  analyzeLearner,
  DEFAULT_WARNING_THRESHOLDS,
  type LearnerFeatures,
  type WarningInput,
  type EarlyWarning,
} from '@/lib/services/learnerClusteringService';

// ─── Test Fixtures ──────────────────────────────────────────────────────────

/** A learner matching the CONSISTENT_REVIEWER profile */
const CONSISTENT_LEARNER: LearnerFeatures = {
  dailyVolume: 0.5,
  volumeVariability: 0.2,
  accuracy: 0.72,
  relativeSpeed: 0.48,
  spacingRegularity: 0.85,
  systemBreadth: 0.70,
  systemDepth: 0.58,
  engagementTrend: 0.55,
  calibrationScore: 0.74,
  sessionCompletionRate: 0.90,
};

/** A learner matching the CRAMMER profile */
const CRAMMER_LEARNER: LearnerFeatures = {
  dailyVolume: 0.85,
  volumeVariability: 0.88,
  accuracy: 0.52,
  relativeSpeed: 0.30,
  spacingRegularity: 0.12,
  systemBreadth: 0.48,
  systemDepth: 0.38,
  engagementTrend: 0.42,
  calibrationScore: 0.43,
  sessionCompletionRate: 0.68,
};

/** A learner matching the DISENGAGING profile */
const DISENGAGING_LEARNER: LearnerFeatures = {
  dailyVolume: 0.15,
  volumeVariability: 0.65,
  accuracy: 0.48,
  relativeSpeed: 0.58,
  spacingRegularity: 0.25,
  systemBreadth: 0.28,
  systemDepth: 0.28,
  engagementTrend: 0.12,
  calibrationScore: 0.38,
  sessionCompletionRate: 0.48,
};

const HEALTHY_WARNING_INPUT: WarningInput = {
  recentAccuracy: 0.75,
  baselineAccuracy: 0.73,
  sessionsLast7Days: 5,
  sessionsPrior21Days: 15,
  burnoutRisk: 0.2,
  engagementTrend: 0.1,
  daysUntilExam: 60,
  projectedReadiness: 0.78,
  requiredReadiness: 0.80,
  systemLastReviewed: {
    Cardiovascular: 3,
    Pulmonary: 5,
    Renal: 7,
  },
  activeBlueprintSystems: ['Cardiovascular', 'Pulmonary', 'Renal'],
  responseTimeTrend: 0.0,
};

const AT_RISK_WARNING_INPUT: WarningInput = {
  recentAccuracy: 0.55,
  baselineAccuracy: 0.70,
  sessionsLast7Days: 1,
  sessionsPrior21Days: 18,
  burnoutRisk: 0.85,
  engagementTrend: -0.5,
  daysUntilExam: 14,
  projectedReadiness: 0.55,
  requiredReadiness: 0.80,
  systemLastReviewed: {
    Cardiovascular: 2,
    Pulmonary: 20,
    Renal: 30,
    Neurology: 5,
  },
  activeBlueprintSystems: ['Cardiovascular', 'Pulmonary', 'Renal', 'Neurology'],
  responseTimeTrend: 0.3,
};

// ─── Feature Vector Helpers ─────────────────────────────────────────────────

describe('featuresToVector', () => {
  it('produces correct dimensionality', () => {
    const v = featuresToVector(CONSISTENT_LEARNER);
    expect(v).toHaveLength(FEATURE_DIM);
  });

  it('preserves field order', () => {
    const v = featuresToVector(CONSISTENT_LEARNER);
    expect(v[0]).toBe(CONSISTENT_LEARNER.dailyVolume);
    expect(v[1]).toBe(CONSISTENT_LEARNER.volumeVariability);
    expect(v[2]).toBe(CONSISTENT_LEARNER.accuracy);
    expect(v[9]).toBe(CONSISTENT_LEARNER.sessionCompletionRate);
  });
});

describe('euclideanDistance', () => {
  it('returns 0 for identical vectors', () => {
    expect(euclideanDistance([1, 2, 3], [1, 2, 3])).toBe(0);
  });

  it('computes correctly for simple case', () => {
    // distance([0,0], [3,4]) = 5
    expect(euclideanDistance([0, 0], [3, 4])).toBe(5);
  });

  it('is symmetric', () => {
    const a = [0.1, 0.5, 0.9];
    const b = [0.4, 0.2, 0.6];
    expect(euclideanDistance(a, b)).toBeCloseTo(euclideanDistance(b, a), 10);
  });
});

describe('coefficientOfVariation', () => {
  it('returns 0 for constant values', () => {
    expect(coefficientOfVariation([5, 5, 5, 5])).toBe(0);
  });

  it('returns 0 for single value', () => {
    expect(coefficientOfVariation([42])).toBe(0);
  });

  it('returns 0 for empty array', () => {
    expect(coefficientOfVariation([])).toBe(0);
  });

  it('computes correctly for known data', () => {
    // [2, 4, 6]: mean=4, std=√(8/3)≈1.633, CV≈0.408
    const cv = coefficientOfVariation([2, 4, 6]);
    expect(cv).toBeCloseTo(0.408, 2);
  });
});

describe('computeSpacingRegularity', () => {
  it('returns high regularity for consistent gaps', () => {
    const gaps = [24, 24, 24, 24, 24]; // every 24 hours
    expect(computeSpacingRegularity(gaps)).toBeCloseTo(1.0, 1);
  });

  it('returns low regularity for variable gaps', () => {
    const gaps = [2, 72, 4, 48, 1, 96]; // very irregular
    expect(computeSpacingRegularity(gaps)).toBeLessThan(0.5);
  });

  it('returns 0.5 for insufficient data', () => {
    expect(computeSpacingRegularity([24])).toBe(0.5);
    expect(computeSpacingRegularity([])).toBe(0.5);
  });
});

// ─── Archetype Assignment ───────────────────────────────────────────────────

describe('assignArchetype', () => {
  it('assigns CONSISTENT_REVIEWER to matching profile', () => {
    const result = assignArchetype(CONSISTENT_LEARNER);
    expect(result.archetype).toBe('CONSISTENT_REVIEWER');
  });

  it('assigns CRAMMER to matching profile', () => {
    const result = assignArchetype(CRAMMER_LEARNER);
    expect(result.archetype).toBe('CRAMMER');
  });

  it('assigns DISENGAGING to matching profile', () => {
    const result = assignArchetype(DISENGAGING_LEARNER);
    expect(result.archetype).toBe('DISENGAGING');
  });

  it('returns distances to all archetypes', () => {
    const result = assignArchetype(CONSISTENT_LEARNER);
    for (const archetype of ALL_ARCHETYPES) {
      expect(result.distances[archetype]).toBeDefined();
      expect(result.distances[archetype]).toBeGreaterThanOrEqual(0);
    }
  });

  it('nearest archetype has smallest distance', () => {
    const result = assignArchetype(CONSISTENT_LEARNER);
    const bestDist = result.distances[result.archetype];
    for (const archetype of ALL_ARCHETYPES) {
      expect(result.distances[archetype]).toBeGreaterThanOrEqual(bestDist - 0.001);
    }
  });

  it('confidence is between 0 and 1', () => {
    const result = assignArchetype(CONSISTENT_LEARNER);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it('assigns correct archetype for exact centroid match', () => {
    // Build a LearnerFeatures that exactly matches PERFECTIONIST centroid
    const centroid = ARCHETYPE_CENTROIDS['PERFECTIONIST'];
    const features: LearnerFeatures = {
      dailyVolume: centroid[0]!,
      volumeVariability: centroid[1]!,
      accuracy: centroid[2]!,
      relativeSpeed: centroid[3]!,
      spacingRegularity: centroid[4]!,
      systemBreadth: centroid[5]!,
      systemDepth: centroid[6]!,
      engagementTrend: centroid[7]!,
      calibrationScore: centroid[8]!,
      sessionCompletionRate: centroid[9]!,
    };
    expect(assignArchetype(features).archetype).toBe('PERFECTIONIST');
  });
});

// ─── K-Means ────────────────────────────────────────────────────────────────

describe('kMeansClustering', () => {
  it('handles empty input', () => {
    const result = kMeansClustering([], 3);
    expect(result.centroids).toHaveLength(0);
    expect(result.assignments).toHaveLength(0);
  });

  it('assigns all learners to a cluster', () => {
    const learners = [CONSISTENT_LEARNER, CRAMMER_LEARNER, DISENGAGING_LEARNER];
    const result = kMeansClustering(learners, 3);
    expect(result.assignments).toHaveLength(3);
    for (const a of result.assignments) {
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThan(3);
    }
  });

  it('produces k centroids', () => {
    const learners = Array.from({ length: 20 }, () => ({
      ...CONSISTENT_LEARNER,
      dailyVolume: Math.random(),
      accuracy: Math.random(),
    }));
    const result = kMeansClustering(learners, 4, 10);
    expect(result.centroids).toHaveLength(4);
  });

  it('converges in bounded iterations', () => {
    const learners = [CONSISTENT_LEARNER, CRAMMER_LEARNER, DISENGAGING_LEARNER];
    const result = kMeansClustering(learners, 2, 50);
    expect(result.iterations).toBeLessThanOrEqual(50);
    expect(result.iterations).toBeGreaterThan(0);
  });

  it('respects provided initial centroids', () => {
    const learners = [CONSISTENT_LEARNER, CRAMMER_LEARNER];
    const initial = [
      featuresToVector(CONSISTENT_LEARNER),
      featuresToVector(CRAMMER_LEARNER),
    ];
    const result = kMeansClustering(learners, 2, 10, initial);
    // With 2 learners and centroids exactly at each, converges in ≤2 iterations
    // (1 assignment + 1 convergence check)
    expect(result.iterations).toBeLessThanOrEqual(2);
  });
});

// ─── Early Warning Detection ────────────────────────────────────────────────

describe('detectWarnings', () => {
  it('returns no warnings for healthy learner', () => {
    const warnings = detectWarnings(HEALTHY_WARNING_INPUT);
    // Healthy input has small readiness gap (0.02) — below warning threshold
    expect(warnings.every((w) => w.type !== 'accuracy_decline')).toBe(true);
    expect(warnings.every((w) => w.type !== 'burnout_trajectory')).toBe(true);
    expect(warnings.every((w) => w.type !== 'session_frequency_drop')).toBe(true);
  });

  it('detects critical accuracy decline', () => {
    const input: WarningInput = {
      ...HEALTHY_WARNING_INPUT,
      recentAccuracy: 0.55,
      baselineAccuracy: 0.70,
    };
    const warnings = detectWarnings(input);
    const accuracyWarning = warnings.find((w) => w.type === 'accuracy_decline');
    expect(accuracyWarning).toBeDefined();
    expect(accuracyWarning!.severity).toBe('critical'); // 15% drop > 10% threshold
  });

  it('detects moderate accuracy decline as warning', () => {
    const input: WarningInput = {
      ...HEALTHY_WARNING_INPUT,
      recentAccuracy: 0.67,
      baselineAccuracy: 0.73,
    };
    const warnings = detectWarnings(input);
    const accuracyWarning = warnings.find((w) => w.type === 'accuracy_decline');
    expect(accuracyWarning).toBeDefined();
    expect(accuracyWarning!.severity).toBe('warning'); // 6% drop, between 5-10%
  });

  it('detects session frequency drop', () => {
    const input: WarningInput = {
      ...HEALTHY_WARNING_INPUT,
      sessionsLast7Days: 1,
      sessionsPrior21Days: 15, // baseline ≈ 5/week
    };
    const warnings = detectWarnings(input);
    const freqWarning = warnings.find((w) => w.type === 'session_frequency_drop');
    expect(freqWarning).toBeDefined();
    expect(freqWarning!.severity).toBe('critical'); // 1/5 = 20% < 25% threshold
  });

  it('detects burnout risk', () => {
    const input: WarningInput = {
      ...HEALTHY_WARNING_INPUT,
      burnoutRisk: 0.85,
    };
    const warnings = detectWarnings(input);
    const burnout = warnings.find((w) => w.type === 'burnout_trajectory');
    expect(burnout).toBeDefined();
    expect(burnout!.severity).toBe('critical');
  });

  it('detects exam readiness gap', () => {
    const input: WarningInput = {
      ...HEALTHY_WARNING_INPUT,
      daysUntilExam: 14,
      projectedReadiness: 0.55,
      requiredReadiness: 0.80,
    };
    const warnings = detectWarnings(input);
    const readiness = warnings.find((w) => w.type === 'exam_readiness_gap');
    expect(readiness).toBeDefined();
    expect(readiness!.severity).toBe('critical'); // 25% gap > 20% threshold
  });

  it('detects system neglect', () => {
    const input: WarningInput = {
      ...HEALTHY_WARNING_INPUT,
      systemLastReviewed: {
        Cardiovascular: 3,
        Pulmonary: 20,
        Renal: 7,
      },
    };
    const warnings = detectWarnings(input);
    const neglect = warnings.find(
      (w) => w.type === 'system_neglect' && w.message.includes('Pulmonary')
    );
    expect(neglect).toBeDefined();
    expect(neglect!.value).toBe(20);
  });

  it('detects engagement cliff', () => {
    const input: WarningInput = {
      ...HEALTHY_WARNING_INPUT,
      engagementTrend: -0.5,
    };
    const warnings = detectWarnings(input);
    const cliff = warnings.find((w) => w.type === 'engagement_cliff');
    expect(cliff).toBeDefined();
  });

  it('sorts warnings by severity (critical first)', () => {
    const warnings = detectWarnings(AT_RISK_WARNING_INPUT);
    expect(warnings.length).toBeGreaterThan(0);

    const severityOrder = { critical: 0, warning: 1, info: 2 };
    for (let i = 1; i < warnings.length; i++) {
      expect(severityOrder[warnings[i - 1]!.severity]).toBeLessThanOrEqual(
        severityOrder[warnings[i]!.severity]
      );
    }
  });

  it('skips exam readiness when no exam date set', () => {
    const input: WarningInput = {
      ...HEALTHY_WARNING_INPUT,
      daysUntilExam: null,
      projectedReadiness: 0.3,
      requiredReadiness: 0.8,
    };
    const warnings = detectWarnings(input);
    expect(warnings.find((w) => w.type === 'exam_readiness_gap')).toBeUndefined();
  });
});

// ─── Risk Score ─────────────────────────────────────────────────────────────

describe('computeRiskScore', () => {
  it('returns 0 for no warnings', () => {
    expect(computeRiskScore([])).toBe(0);
  });

  it('returns 0.4 for one critical warning', () => {
    const warnings: EarlyWarning[] = [
      {
        type: 'accuracy_decline',
        message: 'test',
        severity: 'critical',
        value: 0.15,
        threshold: 0.10,
        recommendation: 'test',
      },
    ];
    expect(computeRiskScore(warnings)).toBe(0.4);
  });

  it('caps at 1.0', () => {
    const warnings: EarlyWarning[] = Array.from({ length: 5 }, () => ({
      type: 'accuracy_decline' as const,
      message: 'test',
      severity: 'critical' as const,
      value: 0.15,
      threshold: 0.10,
      recommendation: 'test',
    }));
    expect(computeRiskScore(warnings)).toBe(1);
  });

  it('weights warning levels correctly', () => {
    const mixed: EarlyWarning[] = [
      {
        type: 'accuracy_decline',
        message: '',
        severity: 'critical',
        value: 0,
        threshold: 0,
        recommendation: '',
      },
      {
        type: 'session_frequency_drop',
        message: '',
        severity: 'warning',
        value: 0,
        threshold: 0,
        recommendation: '',
      },
    ];
    // 0.4 + 0.15 = 0.55
    expect(computeRiskScore(mixed)).toBe(0.55);
  });
});

// ─── analyzeLearner ─────────────────────────────────────────────────────────

describe('analyzeLearner', () => {
  it('returns cluster + warnings + risk for healthy learner', () => {
    const result = analyzeLearner(CONSISTENT_LEARNER, HEALTHY_WARNING_INPUT);
    expect(result.cluster.archetype).toBe('CONSISTENT_REVIEWER');
    expect(result.riskScore).toBeLessThan(0.5);
  });

  it('returns high risk for at-risk learner', () => {
    const result = analyzeLearner(DISENGAGING_LEARNER, AT_RISK_WARNING_INPUT);
    expect(result.cluster.archetype).toBe('DISENGAGING');
    expect(result.riskScore).toBeGreaterThan(0.5);
    expect(result.warnings.length).toBeGreaterThan(3);
  });
});

// ─── Constants Validation ───────────────────────────────────────────────────

describe('Constants', () => {
  it('FEATURE_DIM matches vector length', () => {
    expect(FEATURE_DIM).toBe(10);
    expect(featuresToVector(CONSISTENT_LEARNER)).toHaveLength(FEATURE_DIM);
  });

  it('all archetype centroids have correct dimensionality', () => {
    for (const archetype of ALL_ARCHETYPES) {
      expect(ARCHETYPE_CENTROIDS[archetype]).toHaveLength(FEATURE_DIM);
    }
  });

  it('all centroid values are in [0,1]', () => {
    for (const archetype of ALL_ARCHETYPES) {
      for (const val of ARCHETYPE_CENTROIDS[archetype]) {
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThanOrEqual(1);
      }
    }
  });

  it('has 6 archetypes', () => {
    expect(ALL_ARCHETYPES).toHaveLength(6);
  });
});

// ─── Edge Cases ─────────────────────────────────────────────────────────────

describe('Edge cases', () => {
  it('handles all-zero features', () => {
    const zero: LearnerFeatures = {
      dailyVolume: 0,
      volumeVariability: 0,
      accuracy: 0,
      relativeSpeed: 0,
      spacingRegularity: 0,
      systemBreadth: 0,
      systemDepth: 0,
      engagementTrend: 0,
      calibrationScore: 0,
      sessionCompletionRate: 0,
    };
    const result = assignArchetype(zero);
    expect(ALL_ARCHETYPES).toContain(result.archetype);
  });

  it('handles all-one features', () => {
    const ones: LearnerFeatures = {
      dailyVolume: 1,
      volumeVariability: 1,
      accuracy: 1,
      relativeSpeed: 1,
      spacingRegularity: 1,
      systemBreadth: 1,
      systemDepth: 1,
      engagementTrend: 1,
      calibrationScore: 1,
      sessionCompletionRate: 1,
    };
    const result = assignArchetype(ones);
    expect(ALL_ARCHETYPES).toContain(result.archetype);
  });

  it('handles empty blueprint systems in warning detection', () => {
    const input: WarningInput = {
      ...HEALTHY_WARNING_INPUT,
      activeBlueprintSystems: [],
    };
    const warnings = detectWarnings(input);
    expect(warnings.filter((w) => w.type === 'system_neglect')).toHaveLength(0);
  });
});
