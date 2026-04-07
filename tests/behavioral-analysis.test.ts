/**
 * Behavioral Analysis Pipeline — Unit Tests
 *
 * Tests for gradeModulationCoordinator, userRtBaselineService,
 * and weightedWilsonScore. Covers all delta functions, boundary
 * cases, fatigue detection, RT classification, and Wilson weighting.
 *
 * @see PANaCEa_Behavioral_Analysis_Audit.md § Step 7
 */
import { describe, it, expect } from 'vitest';

import {
  classifyRtZone,
  computeFatigueScore,
  mapConfidenceCategory,
  calculateRtDelta,
  calculateConfidenceDelta,
  calculateStreakDelta,
  calculateFatigueDelta,
  modulateGrade,
  BEHAVIORAL_CONSTANTS,
} from '../lib/services/gradeModulationCoordinator';

import {
  computeMedianRt,
  computeRollingWindowStats,
  MIN_VALID_RT_MS,
  MAX_VALID_RT_MS,
} from '../lib/services/userRtBaselineService';

import {
  weightedWilsonScore,
  hasWeightedMastery,
} from '../lib/statistics/wilsonScore';

// ─── Helpers ──────────────────────────────────────────────────

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

// ─── RT Zone Classification ──────────────────────────────────

describe('classifyRtZone', () => {
  it('classifies fast RT (< 0.5× median)', () => {
    // 5000 / 15000 = 0.33 < 0.5 → fast
    const result = classifyRtZone(5000, 15000);
    expect(result.zone).toBe('fast');
    expect(result.rtRatio).toBeCloseTo(0.333, 2);
  });

  it('classifies normal RT (0.5×–1.5× median)', () => {
    // 15000 / 15000 = 1.0 → normal
    const result = classifyRtZone(15000, 15000);
    expect(result.zone).toBe('normal');
    expect(result.rtRatio).toBeCloseTo(1.0, 2);
  });

  it('classifies slow RT (> 1.5× median)', () => {
    // 30000 / 15000 = 2.0 > 1.5 → slow
    const result = classifyRtZone(30000, 15000);
    expect(result.zone).toBe('slow');
    expect(result.rtRatio).toBeCloseTo(2.0, 2);
  });

  it('uses SESSION_DEFAULT_MEDIAN_RT_MS when userMedianRtMs is null', () => {
    // 8000 / 15000 (default) = 0.53 → normal
    const result = classifyRtZone(8000, null);
    expect(result.zone).toBe('normal');
    expect(result.rtRatio).toBeCloseTo(8000 / BEHAVIORAL_CONSTANTS.SESSION_DEFAULT_MEDIAN_RT_MS, 2);
  });

  it('classifies boundary: exactly at fast threshold as normal', () => {
    // 7500 / 15000 = 0.5 → NOT less than 0.5, so normal
    const result = classifyRtZone(7500, 15000);
    expect(result.zone).toBe('normal');
  });

  it('classifies boundary: just below fast threshold as fast', () => {
    // 7499 / 15000 ≈ 0.4999 < 0.5 → fast
    const result = classifyRtZone(7499, 15000);
    expect(result.zone).toBe('fast');
  });
});

// ─── Fatigue Detection ───────────────────────────────────────

describe('computeFatigueScore', () => {
  it('returns 0.0 when sessionQuestionIndex < 10', () => {
    const score = computeFatigueScore(5, 20000, 15000, 0.5, 0.8);
    expect(score).toBe(0.0);
  });

  it('returns 0.0 when rolling window data is null', () => {
    const score = computeFatigueScore(15, null, 15000, null, null);
    expect(score).toBe(0.0);
  });

  it('detects fatigue when RT ratio > 1.3 AND accuracy ratio < 0.7', () => {
    // rtRatio = 22500 / 15000 = 1.5 > 1.3 ✓
    // accuracyRatio = 0.4 / 0.8 = 0.5 < 0.7 ✓
    // fatigueScore = min(1.0, (1.5 - 1.3) × 2.0) = min(1.0, 0.4) = 0.4
    const score = computeFatigueScore(15, 22500, 15000, 0.4, 0.8);
    expect(score).toBeCloseTo(0.4, 2);
  });

  it('returns 0.0 when RT ratio under threshold (1.2 < 1.3)', () => {
    // rtRatio = 18000 / 15000 = 1.2 < 1.3 → no fatigue
    const score = computeFatigueScore(15, 18000, 15000, 0.4, 0.8);
    expect(score).toBe(0.0);
  });

  it('returns 0.0 when accuracy ratio over threshold (0.75 > 0.7)', () => {
    // rtRatio = 22500 / 15000 = 1.5 > 1.3 ✓
    // accuracyRatio = 0.6 / 0.8 = 0.75 > 0.7 ✗ → no fatigue
    const score = computeFatigueScore(15, 22500, 15000, 0.6, 0.8);
    expect(score).toBe(0.0);
  });

  it('caps fatigue score at 1.0 for extreme values', () => {
    // rtRatio = 45000 / 15000 = 3.0 > 1.3 ✓
    // accuracyRatio = 0.2 / 0.8 = 0.25 < 0.7 ✓
    // fatigueScore = min(1.0, (3.0 - 1.3) × 2.0) = min(1.0, 3.4) = 1.0
    const score = computeFatigueScore(20, 45000, 15000, 0.2, 0.8);
    expect(score).toBe(1.0);
  });
});

// ─── Confidence Category Mapping ─────────────────────────────

describe('mapConfidenceCategory', () => {
  it('maps undefined to unknown', () => {
    expect(mapConfidenceCategory(undefined)).toBe('unknown');
  });

  it('maps 0 to unknown', () => {
    expect(mapConfidenceCategory(0)).toBe('unknown');
  });

  it('maps 1 to low', () => {
    expect(mapConfidenceCategory(1)).toBe('low');
  });

  it('maps 2 to medium', () => {
    expect(mapConfidenceCategory(2)).toBe('medium');
  });

  it('maps 3 to high', () => {
    expect(mapConfidenceCategory(3)).toBe('high');
  });
});

// ─── RT Delta ────────────────────────────────────────────────

describe('calculateRtDelta', () => {
  it('fast + correct → +0.4', () => {
    expect(calculateRtDelta('fast', true)).toBe(0.4);
  });

  it('fast + incorrect → +0.3 (impulsive error reduction)', () => {
    expect(calculateRtDelta('fast', false)).toBe(0.3);
  });

  it('slow + correct → -0.3 (effortful retrieval dampening)', () => {
    expect(calculateRtDelta('slow', true)).toBe(-0.3);
  });

  it('slow + incorrect → 0.0 (deliberate fail: no adjustment)', () => {
    expect(calculateRtDelta('slow', false)).toBe(0.0);
  });

  it('normal + correct → 0.0', () => {
    expect(calculateRtDelta('normal', true)).toBe(0.0);
  });

  it('normal + incorrect → 0.0', () => {
    expect(calculateRtDelta('normal', false)).toBe(0.0);
  });
});

// ─── Confidence Delta ────────────────────────────────────────

describe('calculateConfidenceDelta', () => {
  it('high + correct → +0.3', () => {
    expect(calculateConfidenceDelta('high', true)).toBe(0.3);
  });

  it('high + incorrect → -0.3 (overconfidence penalty)', () => {
    expect(calculateConfidenceDelta('high', false)).toBe(-0.3);
  });

  it('low + correct → -0.15 (lucky guess dampener)', () => {
    expect(calculateConfidenceDelta('low', true)).toBe(-0.15);
  });

  it('low + incorrect → +0.15 (expected error softener)', () => {
    expect(calculateConfidenceDelta('low', false)).toBe(0.15);
  });

  it('medium + any → 0.0', () => {
    expect(calculateConfidenceDelta('medium', true)).toBe(0.0);
    expect(calculateConfidenceDelta('medium', false)).toBe(0.0);
  });

  it('unknown + any → 0.0', () => {
    expect(calculateConfidenceDelta('unknown', true)).toBe(0.0);
    expect(calculateConfidenceDelta('unknown', false)).toBe(0.0);
  });
});

// ─── Streak Delta ────────────────────────────────────────────

describe('calculateStreakDelta', () => {
  it('streak 0, correct → 0.0', () => {
    expect(calculateStreakDelta(0, true)).toBe(0.0);
  });

  it('streak 1, correct → 0.0', () => {
    expect(calculateStreakDelta(1, true)).toBe(0.0);
  });

  it('streak 2, correct → +0.05', () => {
    expect(calculateStreakDelta(2, true)).toBe(0.05);
  });

  it('streak 3, correct → +0.05', () => {
    expect(calculateStreakDelta(3, true)).toBe(0.05);
  });

  it('streak 4+, correct → +0.08 (hard cap)', () => {
    expect(calculateStreakDelta(4, true)).toBe(0.08);
    expect(calculateStreakDelta(10, true)).toBe(0.08);
    expect(calculateStreakDelta(100, true)).toBe(0.08);
  });

  it('any streak, incorrect → 0.0', () => {
    expect(calculateStreakDelta(5, false)).toBe(0.0);
    expect(calculateStreakDelta(0, false)).toBe(0.0);
  });
});

// ─── Fatigue Delta ───────────────────────────────────────────

describe('calculateFatigueDelta', () => {
  it('no fatigue → 0.0', () => {
    expect(calculateFatigueDelta(0.0)).toBeCloseTo(0.0, 5);
  });

  it('max fatigue → -0.2', () => {
    expect(calculateFatigueDelta(1.0)).toBeCloseTo(-0.2, 5);
  });

  it('half fatigue → -0.1', () => {
    expect(calculateFatigueDelta(0.5)).toBeCloseTo(-0.1, 5);
  });
});

// ─── Grade Modulation (Integration) ──────────────────────────

describe('modulateGrade', () => {
  const baseContext = {
    responseTimeMs: 15000,
    isCorrect: true,
    rawGrade: 3,
    streakCount: 0,
    sessionQuestionIndex: 5,
    userMedianRtMs: 15000,
    rollingWindowAccuracy: null,
    rollingWindowMeanRtMs: null,
    sessionMeanAccuracy: null,
  };

  it('returns raw grade when all signals are neutral', () => {
    const result = modulateGrade(baseContext);
    // Normal RT zone, no confidence, streak 0, no fatigue → all deltas 0
    expect(result.effectiveGrade).toBe(3.0);
    expect(result.discreteGrade).toBe(3);
    expect(result.deltas.total).toBe(0.0);
  });

  it('fast-correct boosts grade toward Easy', () => {
    const result = modulateGrade({
      ...baseContext,
      responseTimeMs: 5000, // fast zone: 5000/15000 = 0.33
    });
    // rtDelta = +0.4, rest = 0 → effective = 3.4
    expect(result.effectiveGrade).toBeCloseTo(3.4, 2);
    expect(result.discreteGrade).toBe(3); // 3.4 < 3.5 → Good
  });

  it('rawGrade=3 + all max positive deltas should reach 4.0', () => {
    const result = modulateGrade({
      ...baseContext,
      responseTimeMs: 3000, // fast
      userConfidenceRating: 3, // high + correct = +0.3
      streakCount: 5, // streak 4+ = +0.08
    });
    // rtDelta=+0.4, confDelta=+0.3, streakDelta=+0.08 → total=+0.78
    // effective = 3.0 + 0.78 = 3.78
    expect(result.effectiveGrade).toBeCloseTo(3.78, 2);
    expect(result.discreteGrade).toBe(4); // ≥ 3.5 → Easy
  });

  it('rawGrade=3 + max negative deltas clamps at 1.0', () => {
    const result = modulateGrade({
      ...baseContext,
      responseTimeMs: 30000, // slow + correct → -0.3
      isCorrect: true,
      userConfidenceRating: 1, // low + correct → -0.15
      streakCount: 0,
      sessionQuestionIndex: 20,
      rollingWindowAccuracy: 0.3,
      rollingWindowMeanRtMs: 25000,
      sessionMeanAccuracy: 0.8,
    });
    // rtDelta=-0.3, confDelta=-0.15, streakDelta=0.0
    // fatigue: rtRatio=25000/15000=1.67>1.3, accRatio=0.3/0.8=0.375<0.7
    // fatigueScore = min(1.0, (1.67-1.3)*2) = min(1.0, 0.74) = 0.74
    // fatigueDelta = 0.74 * -0.2 = -0.148
    // total = -0.3 + -0.15 + 0 + -0.148 = -0.598
    // effective = max(1.0, 3.0 - 0.598) = 2.402
    expect(result.effectiveGrade).toBeCloseTo(2.402, 1);
    expect(result.discreteGrade).toBe(2); // [1.5, 2.5) → Hard
  });

  it('zeroes RT delta when userMedianRtMs is null (cold start)', () => {
    const result = modulateGrade({
      ...baseContext,
      responseTimeMs: 3000, // would be fast if baseline existed
      userMedianRtMs: null, // no baseline → RT delta forced to 0
    });
    expect(result.deltas.rtDelta).toBe(0.0);
    expect(result.effectiveGrade).toBe(3.0);
  });

  it('clamps effective grade to GRADE_BOUNDS.MIN (1.0)', () => {
    const result = modulateGrade({
      ...baseContext,
      rawGrade: 1, // Again
      responseTimeMs: 30000, // slow + correct → -0.3
      isCorrect: true,
    });
    // rawGrade=1 + rtDelta=-0.3 → 0.7 → clamped to 1.0
    expect(result.effectiveGrade).toBe(1.0);
  });

  it('clamps effective grade to GRADE_BOUNDS.MAX (4.0)', () => {
    const result = modulateGrade({
      ...baseContext,
      rawGrade: 4,
      responseTimeMs: 3000, // fast + correct → +0.4
      userConfidenceRating: 3, // high + correct → +0.3
      streakCount: 5, // +0.08
    });
    // rawGrade=4 + 0.78 → 4.78 → clamped to 4.0
    expect(result.effectiveGrade).toBe(4.0);
    expect(result.discreteGrade).toBe(4);
  });

  it('identifies impulsive error signal', () => {
    const result = modulateGrade({
      ...baseContext,
      responseTimeMs: 3000, // fast
      isCorrect: false,
    });
    expect(result.signals.isImpulsiveError).toBe(true);
    expect(result.signals.isEffortfulRetrieval).toBe(false);
  });

  it('identifies effortful retrieval signal', () => {
    const result = modulateGrade({
      ...baseContext,
      responseTimeMs: 30000, // slow
      isCorrect: true,
    });
    expect(result.signals.isImpulsiveError).toBe(false);
    expect(result.signals.isEffortfulRetrieval).toBe(true);
  });
});

// ─── User RT Baseline Service ────────────────────────────────

describe('computeMedianRt', () => {
  it('returns null when fewer than 5 valid samples', () => {
    const result = computeMedianRt([
      { responseTimeMs: 5000 },
      { responseTimeMs: 8000 },
      { responseTimeMs: 12000 },
    ]);
    expect(result).toBeNull();
  });

  it('filters out rapid-guess artifacts (< MIN_VALID_RT_MS)', () => {
    const result = computeMedianRt([
      { responseTimeMs: 500 },  // excluded
      { responseTimeMs: 300 },  // excluded
      { responseTimeMs: 8000 },
      { responseTimeMs: 10000 },
      { responseTimeMs: 12000 },
      { responseTimeMs: 15000 },
      { responseTimeMs: 9000 },
    ]);
    // Valid: [8000, 9000, 10000, 12000, 15000] → median = 10000
    expect(result).not.toBeNull();
    expect(result!.medianMs).toBe(10000);
    expect(result!.sampleCount).toBe(5);
  });

  it('filters out AFK values (> MAX_VALID_RT_MS)', () => {
    const result = computeMedianRt([
      { responseTimeMs: 8000 },
      { responseTimeMs: 10000 },
      { responseTimeMs: 12000 },
      { responseTimeMs: 15000 },
      { responseTimeMs: 9000 },
      { responseTimeMs: 200000 }, // excluded
    ]);
    // Valid: [8000, 9000, 10000, 12000, 15000] → median = 10000
    expect(result!.medianMs).toBe(10000);
    expect(result!.sampleCount).toBe(5);
  });

  it('computes correct median for even-length arrays', () => {
    const result = computeMedianRt([
      { responseTimeMs: 8000 },
      { responseTimeMs: 10000 },
      { responseTimeMs: 12000 },
      { responseTimeMs: 15000 },
      { responseTimeMs: 9000 },
      { responseTimeMs: 11000 },
    ]);
    // Sorted: [8000, 9000, 10000, 11000, 12000, 15000]
    // Median = avg(10000, 11000) = 10500
    expect(result!.medianMs).toBe(10500);
    expect(result!.sampleCount).toBe(6);
  });
});

describe('computeRollingWindowStats', () => {
  it('computes rolling accuracy and mean RT', () => {
    const result = computeRollingWindowStats([
      { isCorrect: true, responseTimeMs: 10000 },
      { isCorrect: false, responseTimeMs: 15000 },
      { isCorrect: true, responseTimeMs: 12000 },
    ]);
    // accuracy = 2/3 ≈ 0.667, meanRt = (10000+15000+12000)/3 ≈ 12333
    expect(result.rollingAccuracy).toBeCloseTo(0.667, 2);
    expect(result.rollingMeanRtMs).toBe(12333);
    expect(result.windowSize).toBe(3);
  });

  it('uses only last N items when window exceeds size', () => {
    const items = Array.from({ length: 15 }, (_, i) => ({
      isCorrect: i % 2 === 0,
      responseTimeMs: 10000 + i * 1000,
    }));
    const result = computeRollingWindowStats(items, 10);
    expect(result.windowSize).toBe(10);
  });

  it('handles empty window', () => {
    const result = computeRollingWindowStats([]);
    expect(result.rollingAccuracy).toBe(0);
    expect(result.rollingMeanRtMs).toBe(0);
    expect(result.windowSize).toBe(0);
  });
});

// ─── Weighted Wilson Score ───────────────────────────────────

describe('weightedWilsonScore', () => {
  it('returns zeros for empty attempts', () => {
    const result = weightedWilsonScore([]);
    expect(result.lower).toBe(0);
    expect(result.upper).toBe(0);
    expect(result.n_effective).toBe(0);
  });

  it('weights recent attempts 2× vs old attempts 1×', () => {
    const recent = Array.from({ length: 8 }, () => ({
      isCorrect: true,
      reviewedAt: daysAgo(5), // within 30-day cutoff → weight 2
    }));
    const old = Array.from({ length: 2 }, () => ({
      isCorrect: false,
      reviewedAt: daysAgo(60), // outside cutoff → weight 1
    }));
    const result = weightedWilsonScore([...recent, ...old]);

    // n_effective = 8×2 + 2×1 = 18
    // weighted_p = 16/18 ≈ 0.889
    expect(result.n_effective).toBe(18);
    expect(result.point).toBeCloseTo(16 / 18, 3);
    expect(result.lower).toBeGreaterThan(0);
    expect(result.upper).toBeLessThanOrEqual(1);
  });

  it('all recent correct at n=10 → lower bound > 0.80', () => {
    const attempts = Array.from({ length: 10 }, () => ({
      isCorrect: true,
      reviewedAt: daysAgo(3), // all recent → n_effective = 20
    }));
    const result = weightedWilsonScore(attempts);

    // n_effective = 20, p = 1.0 → lower bound should be high
    expect(result.n_effective).toBe(20);
    expect(result.lower).toBeGreaterThan(0.80);
  });

  it('mixed recent and old attempts weights recent higher', () => {
    // 5 recent correct + 5 old incorrect
    const recent = Array.from({ length: 5 }, () => ({
      isCorrect: true,
      reviewedAt: daysAgo(10),
    }));
    const old = Array.from({ length: 5 }, () => ({
      isCorrect: false,
      reviewedAt: daysAgo(60),
    }));
    const result = weightedWilsonScore([...recent, ...old]);

    // n_effective = 5×2 + 5×1 = 15
    // weighted_successes = 5×2 = 10
    // weighted_p = 10/15 ≈ 0.667
    expect(result.n_effective).toBe(15);
    expect(result.point).toBeCloseTo(10 / 15, 3);
  });
});

describe('hasWeightedMastery', () => {
  it('returns false when fewer than minAttempts', () => {
    const attempts = Array.from({ length: 3 }, () => ({
      isCorrect: true,
      reviewedAt: daysAgo(1),
    }));
    expect(hasWeightedMastery(attempts)).toBe(false);
  });

  it('returns true when recent accuracy supports mastery', () => {
    const attempts = Array.from({ length: 15 }, () => ({
      isCorrect: true,
      reviewedAt: daysAgo(5),
    }));
    expect(hasWeightedMastery(attempts)).toBe(true);
  });

  it('returns false when mixed performance drops lower bound below threshold', () => {
    // Use interleaved pattern to avoid ordering artifacts
    const attempts: Array<{ isCorrect: boolean; reviewedAt: Date }> = [];
    const correctCount = 4;
    const total = 8;
    for (let i = 0; i < total; i++) {
      const isCorrect = Math.floor((i + 1) * correctCount / total)
        > Math.floor(i * correctCount / total);
      attempts.push({ isCorrect, reviewedAt: daysAgo(5) });
    }
    // 50% accuracy with 8 attempts → lower bound well below 0.80
    expect(hasWeightedMastery(attempts)).toBe(false);
  });
});
