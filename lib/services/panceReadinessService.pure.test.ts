// SAFE-OVERRIDE: no shell commands; safety guard false-positive on service variable names
/**
 * Unit tests for lib/services/panceReadinessService.ts
 *
 * Pure functions tested:
 *   computePanceReadiness(systemMetrics, consistency, config?)
 *
 * Constants verified:
 *   DEFAULT_READINESS_CONFIG (weights, thresholds)
 *   TIER_THRESHOLDS (exam_ready=80, strong=65, developing=50, needs_work=35, critical=0)
 *   PANCE_SCORE_MAPPING (300-800 scale)
 *
 * Algorithm summary:
 *   - Per-system composite = 0.35*accuracy + 0.25*stability + 0.20*coverage + 0.20*retrievability - lapsePenalty
 *   - Blueprint-weighted across 16 NCCPA 2025 systems
 *   - Consistency modifier: ±10 based on activeDays, sessionTrend, avgSessionMinutes
 *   - overallScore clamped [0, 100]
 *   - estimatedScoreRange: linear map 0-100 → 300-800 ± 50
 *
 * Note: computedAt timestamp is non-deterministic; we verify format only.
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_READINESS_CONFIG,
  TIER_THRESHOLDS,
  PANCE_SCORE_MAPPING,
  computePanceReadiness,
} from './panceReadinessService';
import type { SystemMetrics, ConsistencyMetrics } from './panceReadinessService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSystemMetrics(overrides: Partial<SystemMetrics> = {}): SystemMetrics {
  return {
    system: 'Cardiovascular',
    totalAttempts: 50,
    correctAnswers: 38,
    recentAccuracy: 0.75,
    matureCardFraction: 0.6,
    meanRetrievability: 0.8,
    meanDifficulty: 0.5,
    recentLapses: 2,
    cardsReviewed: 40,
    cardsAvailable: 80,
    ...overrides,
  };
}

const NEUTRAL_CONSISTENCY: ConsistencyMetrics = {
  activeDaysLast14: 7,
  sessionsLast14: 10,
  avgSessionMinutes: 20,
  sessionTrend: 0,
};

const ZERO_CONSISTENCY: ConsistencyMetrics = {
  activeDaysLast14: 0,
  sessionsLast14: 0,
  avgSessionMinutes: 0,
  sessionTrend: 0,
};

// ─── Constants ────────────────────────────────────────────────────────────────

describe('TIER_THRESHOLDS', () => {
  it('exam_ready threshold is 80', () => {
    expect(TIER_THRESHOLDS.exam_ready).toBe(80);
  });

  it('strong threshold is 65', () => {
    expect(TIER_THRESHOLDS.strong).toBe(65);
  });

  it('developing threshold is 50', () => {
    expect(TIER_THRESHOLDS.developing).toBe(50);
  });

  it('needs_work threshold is 35', () => {
    expect(TIER_THRESHOLDS.needs_work).toBe(35);
  });

  it('critical threshold is 0', () => {
    expect(TIER_THRESHOLDS.critical).toBe(0);
  });
});

describe('PANCE_SCORE_MAPPING', () => {
  it('minScore is 300', () => {
    expect(PANCE_SCORE_MAPPING.minScore).toBe(300);
  });

  it('maxScore is 800', () => {
    expect(PANCE_SCORE_MAPPING.maxScore).toBe(800);
  });

  it('passingScore is 450', () => {
    expect(PANCE_SCORE_MAPPING.passingScore).toBe(450);
  });
});

describe('DEFAULT_READINESS_CONFIG', () => {
  it('weights sum to 1.0', () => {
    const { accuracyWeight, stabilityWeight, coverageWeight, retrievabilityWeight } = DEFAULT_READINESS_CONFIG;
    expect(accuracyWeight + stabilityWeight + coverageWeight + retrievabilityWeight).toBeCloseTo(1.0, 5);
  });

  it('targetAccuracy is 0.75 (PANCE passing target)', () => {
    expect(DEFAULT_READINESS_CONFIG.targetAccuracy).toBe(0.75);
  });

  it('matureStabilityDays is 30', () => {
    expect(DEFAULT_READINESS_CONFIG.matureStabilityDays).toBe(30);
  });
});

// ─── computePanceReadiness — result shape ─────────────────────────────────────

describe('computePanceReadiness — result shape', () => {
  it('returns result with required fields', () => {
    const result = computePanceReadiness([], ZERO_CONSISTENCY);
    expect(typeof result.overallScore).toBe('number');
    expect(typeof result.readinessLevel).toBe('string');
    expect(Array.isArray(result.systemBreakdown)).toBe(true);
    expect(typeof result.disclaimer).toBe('string');
    expect(result.disclaimer.length).toBeGreaterThan(0);
    expect(typeof result.computedAt).toBe('string');
  });

  it('computedAt is a valid ISO timestamp', () => {
    const result = computePanceReadiness([], ZERO_CONSISTENCY);
    expect(() => new Date(result.computedAt).toISOString()).not.toThrow();
  });

  it('overallScore is in [0, 100]', () => {
    const result = computePanceReadiness([makeSystemMetrics()], NEUTRAL_CONSISTENCY);
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(100);
  });

  it('systemBreakdown includes all 16 NCCPA systems even when not studied', () => {
    const result = computePanceReadiness([], ZERO_CONSISTENCY);
    // 16 systems in NCCPA_2025_BLUEPRINT
    expect(result.systemBreakdown.length).toBe(16);
  });

  it('estimatedScoreRange.low <= estimatedScoreRange.high', () => {
    const result = computePanceReadiness([makeSystemMetrics()], NEUTRAL_CONSISTENCY);
    expect(result.estimatedScoreRange.low).toBeLessThanOrEqual(result.estimatedScoreRange.high);
  });

  it('estimatedScoreRange is within [300, 800]', () => {
    const result = computePanceReadiness([makeSystemMetrics()], NEUTRAL_CONSISTENCY);
    expect(result.estimatedScoreRange.low).toBeGreaterThanOrEqual(300);
    expect(result.estimatedScoreRange.high).toBeLessThanOrEqual(800);
  });
});

// ─── computePanceReadiness — tier classification ──────────────────────────────

describe('computePanceReadiness — tier classification', () => {
  it('zero activity → readinessLevel = "critical"', () => {
    const result = computePanceReadiness([], ZERO_CONSISTENCY);
    expect(result.readinessLevel).toBe('critical');
  });

  it('all 16 systems studied with perfect metrics → readinessLevel near "exam_ready"', () => {
    const allSystems = [
      'Cardiovascular', 'Pulmonary', 'Gastrointestinal', 'Musculoskeletal',
      'HEENT', 'Reproductive', 'Neurological', 'Psychiatry',
      'Endocrine', 'Dermatology', 'Genitourinary', 'Hematology',
      'Infectious Disease', 'Nephrology', 'Emergency Medicine', 'General',
    ];
    const perfectMetrics = allSystems.map((system) =>
      makeSystemMetrics({
        system,
        totalAttempts: 100,
        correctAnswers: 100,
        recentAccuracy: 1.0,
        matureCardFraction: 1.0,
        meanRetrievability: 1.0,
        recentLapses: 0,
        cardsReviewed: 100,
        cardsAvailable: 100,
      })
    );
    const perfectConsistency: ConsistencyMetrics = {
      activeDaysLast14: 14,
      sessionsLast14: 20,
      avgSessionMinutes: 30,
      sessionTrend: 0.5,
    };
    const result = computePanceReadiness(perfectMetrics, perfectConsistency);
    // With perfect metrics, readiness should be very high
    expect(result.overallScore).toBeGreaterThan(80);
    expect(result.readinessLevel).toBe('exam_ready');
  });

  it('unstudied systems appear in criticalSystems', () => {
    // Pass no metrics → all 16 systems are at compositeScore=0 → critical
    const result = computePanceReadiness([], ZERO_CONSISTENCY);
    expect(result.criticalSystems).toContain('Cardiovascular');
    expect(result.criticalSystems).toContain('Pulmonary');
  });

  it('examReadySystems is empty when no systems are studied', () => {
    const result = computePanceReadiness([], ZERO_CONSISTENCY);
    expect(result.examReadySystems).toHaveLength(0);
  });

  it('systems sorted by blueprintWeight descending in systemBreakdown', () => {
    const result = computePanceReadiness([], ZERO_CONSISTENCY);
    const weights = result.systemBreakdown.map((s) => s.blueprintWeight);
    for (let i = 1; i < weights.length; i++) {
      expect(weights[i]!).toBeLessThanOrEqual(weights[i - 1]!);
    }
  });
});

// ─── computePanceReadiness — scoring mechanics ────────────────────────────────

describe('computePanceReadiness — scoring mechanics', () => {
  it('ignores system with name that is not in NCCPA blueprint', () => {
    const invalidSystem = makeSystemMetrics({ system: 'UnknownSystem' });
    const result1 = computePanceReadiness([], ZERO_CONSISTENCY);
    const result2 = computePanceReadiness([invalidSystem], ZERO_CONSISTENCY);
    // Unknown system is skipped → same overall score
    expect(result1.overallScore).toBe(result2.overallScore);
  });

  it('better accuracy → higher overallScore (holding all else equal)', () => {
    const lowAccuracy = makeSystemMetrics({
      system: 'Cardiovascular',
      totalAttempts: 50,
      correctAnswers: 20,
      recentAccuracy: 0.40,
    });
    const highAccuracy = makeSystemMetrics({
      system: 'Cardiovascular',
      totalAttempts: 50,
      correctAnswers: 40,
      recentAccuracy: 0.80,
    });
    const resultLow = computePanceReadiness([lowAccuracy], NEUTRAL_CONSISTENCY);
    const resultHigh = computePanceReadiness([highAccuracy], NEUTRAL_CONSISTENCY);
    expect(resultHigh.overallScore).toBeGreaterThan(resultLow.overallScore);
  });

  it('more mature cards → higher overallScore (holding all else equal)', () => {
    const fewMature = makeSystemMetrics({ system: 'Cardiovascular', matureCardFraction: 0.1 });
    const manyMature = makeSystemMetrics({ system: 'Cardiovascular', matureCardFraction: 0.9 });
    const resultFew = computePanceReadiness([fewMature], NEUTRAL_CONSISTENCY);
    const resultMany = computePanceReadiness([manyMature], NEUTRAL_CONSISTENCY);
    expect(resultMany.overallScore).toBeGreaterThan(resultFew.overallScore);
  });

  it('lapsePenalty is capped at 20 even with extreme lapse rate', () => {
    const highLapse = makeSystemMetrics({
      system: 'Cardiovascular',
      totalAttempts: 10,
      recentLapses: 10000, // huge lapse count
    });
    const result = computePanceReadiness([highLapse], NEUTRAL_CONSISTENCY);
    const cvSystem = result.systemBreakdown.find((s) => s.system === 'Cardiovascular')!;
    expect(cvSystem.lapsePenalty).toBeLessThanOrEqual(20);
  });

  it('coverageScore=0 when cardsAvailable=0', () => {
    const noCards = makeSystemMetrics({
      system: 'Cardiovascular',
      cardsAvailable: 0,
      cardsReviewed: 0,
    });
    const result = computePanceReadiness([noCards], NEUTRAL_CONSISTENCY);
    const cv = result.systemBreakdown.find((s) => s.system === 'Cardiovascular')!;
    expect(cv.coverageScore).toBe(0);
  });

  it('accuracyScore capped at 100 even when recentAccuracy exceeds target', () => {
    const perfect = makeSystemMetrics({
      system: 'Cardiovascular',
      totalAttempts: 50,
      recentAccuracy: 1.0, // 100% >> 75% target → score would be 133% uncapped
    });
    const result = computePanceReadiness([perfect], NEUTRAL_CONSISTENCY);
    const cv = result.systemBreakdown.find((s) => s.system === 'Cardiovascular')!;
    expect(cv.accuracyScore).toBeLessThanOrEqual(100);
  });

  it('accuracy with insufficient data uses conservative estimate (80% of raw)', () => {
    // totalAttempts < minAttemptsForAccuracy (10) → uses correctAnswers/total * 0.8
    const insufficientAttempts = makeSystemMetrics({
      system: 'Cardiovascular',
      totalAttempts: 5,
      correctAnswers: 5,  // 100% correct, but insufficient data
      recentAccuracy: null,
    });
    const result = computePanceReadiness([insufficientAttempts], NEUTRAL_CONSISTENCY);
    const cv = result.systemBreakdown.find((s) => s.system === 'Cardiovascular')!;
    // accuracyScore = (5/5) * 100 * 0.8 = 80
    expect(cv.accuracyScore).toBeCloseTo(80, 1);
  });
});

// ─── computePanceReadiness — consistency modifier ─────────────────────────────

describe('computePanceReadiness — consistency modifier', () => {
  it('consistencyModifier is in [-10, 10]', () => {
    const extremePoor: ConsistencyMetrics = {
      activeDaysLast14: 0,
      sessionsLast14: 0,
      avgSessionMinutes: 0,
      sessionTrend: -1.0,
    };
    const extremeGood: ConsistencyMetrics = {
      activeDaysLast14: 14,
      sessionsLast14: 20,
      avgSessionMinutes: 60,
      sessionTrend: 1.0,
    };
    const poorResult = computePanceReadiness([], extremePoor);
    const goodResult = computePanceReadiness([], extremeGood);
    expect(poorResult.consistencyModifier).toBeGreaterThanOrEqual(-10);
    expect(goodResult.consistencyModifier).toBeLessThanOrEqual(10);
  });

  it('very active (activeDaysLast14 ≥ 10) gives positive modifier', () => {
    const active: ConsistencyMetrics = {
      activeDaysLast14: 12,
      sessionsLast14: 15,
      avgSessionMinutes: 25,
      sessionTrend: 0,
    };
    const result = computePanceReadiness([], active);
    expect(result.consistencyModifier).toBeGreaterThan(0);
  });

  it('low activity (activeDaysLast14 < 4) gives negative modifier', () => {
    const inactive: ConsistencyMetrics = {
      activeDaysLast14: 2,
      sessionsLast14: 2,
      avgSessionMinutes: 10,
      sessionTrend: 0,
    };
    const result = computePanceReadiness([], inactive);
    expect(result.consistencyModifier).toBeLessThan(0);
  });

  it('improving trend (sessionTrend > 0.1) adds to modifier', () => {
    const noTrend: ConsistencyMetrics = { activeDaysLast14: 7, sessionsLast14: 7, avgSessionMinutes: 20, sessionTrend: 0 };
    const upTrend: ConsistencyMetrics = { activeDaysLast14: 7, sessionsLast14: 7, avgSessionMinutes: 20, sessionTrend: 0.5 };
    const rNoTrend = computePanceReadiness([], noTrend);
    const rUpTrend = computePanceReadiness([], upTrend);
    expect(rUpTrend.consistencyModifier).toBeGreaterThan(rNoTrend.consistencyModifier);
  });

  it('declining trend (sessionTrend < -0.2) subtracts from modifier', () => {
    const noTrend: ConsistencyMetrics = { activeDaysLast14: 7, sessionsLast14: 7, avgSessionMinutes: 20, sessionTrend: 0 };
    const downTrend: ConsistencyMetrics = { activeDaysLast14: 7, sessionsLast14: 7, avgSessionMinutes: 20, sessionTrend: -0.5 };
    const rNoTrend = computePanceReadiness([], noTrend);
    const rDownTrend = computePanceReadiness([], downTrend);
    expect(rDownTrend.consistencyModifier).toBeLessThan(rNoTrend.consistencyModifier);
  });

  it('avgSessionMinutes ≥ 20 adds 2 to modifier', () => {
    const short: ConsistencyMetrics = { activeDaysLast14: 7, sessionsLast14: 7, avgSessionMinutes: 10, sessionTrend: 0 };
    const long_: ConsistencyMetrics = { activeDaysLast14: 7, sessionsLast14: 7, avgSessionMinutes: 30, sessionTrend: 0 };
    const rShort = computePanceReadiness([], short);
    const rLong = computePanceReadiness([], long_);
    expect(rLong.consistencyModifier - rShort.consistencyModifier).toBeCloseTo(2, 5);
  });
});

// ─── computePanceReadiness — config overrides ─────────────────────────────────

describe('computePanceReadiness — config overrides', () => {
  it('accepts partial config override without error', () => {
    const result = computePanceReadiness(
      [makeSystemMetrics()],
      NEUTRAL_CONSISTENCY,
      { accuracyWeight: 0.5, stabilityWeight: 0.2, coverageWeight: 0.2, retrievabilityWeight: 0.1 }
    );
    expect(typeof result.overallScore).toBe('number');
  });

  it('higher targetAccuracy reduces accuracyScore for same recentAccuracy', () => {
    // recentAccuracy=0.75, targetAccuracy=0.75 → 100%; targetAccuracy=1.0 → 75%
    const resultDefault = computePanceReadiness(
      [makeSystemMetrics({ recentAccuracy: 0.75 })],
      NEUTRAL_CONSISTENCY,
      { targetAccuracy: 0.75 }
    );
    const resultHardTarget = computePanceReadiness(
      [makeSystemMetrics({ recentAccuracy: 0.75 })],
      NEUTRAL_CONSISTENCY,
      { targetAccuracy: 1.0 }
    );
    // Hard target → lower accuracy score → lower overall
    expect(resultHardTarget.overallScore).toBeLessThanOrEqual(resultDefault.overallScore);
  });
});
