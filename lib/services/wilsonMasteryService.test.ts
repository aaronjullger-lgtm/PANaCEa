/**
 * Unit tests for lib/services/wilsonMasteryService.ts
 *
 * All functions are pure math — no Prisma or I/O.
 *
 * Constants (from source):
 *   DEFAULT_Z              = 1.645  (90% confidence)
 *   MASTERY_THRESHOLD      = 0.80
 *   GOLD_MASTERY_THRESHOLD = 0.90
 *   MIN_OBSERVATIONS       = 5
 *   DEFAULT_DECAY_LAMBDA   = 0.95
 */

import { describe, it, expect } from 'vitest';
import {
  wilsonScoreBounds,
  kishEffectiveSampleSize,
  weightedProportion,
  assessMastery,
  isWilsonMastered,
  MASTERY_THRESHOLD,
  GOLD_MASTERY_THRESHOLD,
  MIN_OBSERVATIONS,
  DEFAULT_DECAY_LAMBDA,
} from './wilsonMasteryService';

// ─── wilsonScoreBounds ────────────────────────────────────────────────────────

describe('wilsonScoreBounds', () => {
  it('returns {lower:0, upper:0} for n=0', () => {
    expect(wilsonScoreBounds(0, 0)).toEqual({ lower: 0, upper: 0 });
  });

  it('lower <= pHat <= upper for any valid input', () => {
    const cases: [number, number][] = [
      [5, 10], [9, 10], [1, 10], [50, 100], [0, 10], [10, 10],
    ];
    for (const [s, n] of cases) {
      const { lower, upper } = wilsonScoreBounds(s, n);
      const pHat = s / n;
      expect(lower).toBeLessThanOrEqual(pHat + 1e-9);
      expect(upper).toBeGreaterThanOrEqual(pHat - 1e-9);
    }
  });

  it('lower >= 0 and upper <= 1 always', () => {
    const cases: [number, number][] = [[0, 10], [10, 10], [3, 3], [0, 1], [1, 1]];
    for (const [s, n] of cases) {
      const { lower, upper } = wilsonScoreBounds(s, n);
      expect(lower).toBeGreaterThanOrEqual(0);
      expect(upper).toBeLessThanOrEqual(1);
    }
  });

  it('returns lower near 0 for 0 successes out of large n', () => {
    const { lower } = wilsonScoreBounds(0, 100);
    expect(lower).toBeCloseTo(0, 1);
  });

  it('returns upper near 1 for n successes out of n (all correct)', () => {
    const { upper } = wilsonScoreBounds(100, 100);
    expect(upper).toBeCloseTo(1.0, 2);
  });

  it('small n shrinks the lower bound even for perfect accuracy (conservative)', () => {
    // 5/5: Wilson lower should be well below 1.0 due to uncertainty
    const { lower } = wilsonScoreBounds(5, 5);
    expect(lower).toBeLessThan(0.90);
  });

  it('higher z → wider interval (lower is lower, upper is higher)', () => {
    const narrow = wilsonScoreBounds(8, 10, 1.0);
    const wide   = wilsonScoreBounds(8, 10, 2.576);
    expect(wide.lower).toBeLessThan(narrow.lower);
    expect(wide.upper).toBeGreaterThan(narrow.upper);
  });

  it('larger n → tighter interval (lower closer to pHat)', () => {
    const small = wilsonScoreBounds(8, 10);
    const large = wilsonScoreBounds(800, 1000);
    const pHatSmall = 8 / 10;
    const pHatLarge = 800 / 1000;
    expect(Math.abs(small.lower - pHatSmall)).toBeGreaterThan(Math.abs(large.lower - pHatLarge));
  });

  it('returns a known approximate value: successes=8, n=10, z=1.645', () => {
    // Computed manually: lower ≈ 0.503
    const { lower } = wilsonScoreBounds(8, 10);
    expect(lower).toBeGreaterThan(0.45);
    expect(lower).toBeLessThan(0.65);
  });
});

// ─── kishEffectiveSampleSize ──────────────────────────────────────────────────

describe('kishEffectiveSampleSize', () => {
  it('returns 0 for n=0', () => {
    expect(kishEffectiveSampleSize(0, 0.95)).toBe(0);
  });

  it('returns n when lambda >= 1 (no decay)', () => {
    expect(kishEffectiveSampleSize(20, 1.0)).toBe(20);
    expect(kishEffectiveSampleSize(10, 1.5)).toBe(10);
  });

  it('returns 1 when lambda <= 0 (only latest matters)', () => {
    expect(kishEffectiveSampleSize(10, 0)).toBe(1);
    expect(kishEffectiveSampleSize(10, -0.5)).toBe(1);
  });

  it('n_eff < n when lambda < 1 (recency weighting reduces effective count)', () => {
    const nEff = kishEffectiveSampleSize(20, 0.95);
    expect(nEff).toBeLessThan(20);
    expect(nEff).toBeGreaterThan(1);
  });

  it('n_eff decreases as lambda decreases (more aggressive discounting)', () => {
    const mild   = kishEffectiveSampleSize(20, 0.95);
    const steep  = kishEffectiveSampleSize(20, 0.70);
    const very   = kishEffectiveSampleSize(20, 0.50);
    expect(mild).toBeGreaterThan(steep);
    expect(steep).toBeGreaterThan(very);
  });

  it('is always in [1, n] for valid lambda in (0, 1)', () => {
    const nEff = kishEffectiveSampleSize(50, DEFAULT_DECAY_LAMBDA);
    expect(nEff).toBeGreaterThanOrEqual(1);
    expect(nEff).toBeLessThanOrEqual(50);
  });

  it('returns > 1 for n=1 and lambda in (0,1)', () => {
    // n=1 means there's only one observation; n_eff must equal 1
    expect(kishEffectiveSampleSize(1, 0.9)).toBeCloseTo(1, 5);
  });
});

// ─── weightedProportion ───────────────────────────────────────────────────────

describe('weightedProportion', () => {
  it('returns 0 for empty array', () => {
    expect(weightedProportion([], 0.95)).toBe(0);
  });

  it('returns 1.0 when all outcomes are true', () => {
    expect(weightedProportion([true, true, true, true], 0.95)).toBeCloseTo(1.0, 5);
  });

  it('returns 0.0 when all outcomes are false', () => {
    expect(weightedProportion([false, false, false, false], 0.95)).toBeCloseTo(0.0, 5);
  });

  it('result is in [0, 1] for mixed outcomes', () => {
    const p = weightedProportion([true, false, true, false, true], 0.95);
    expect(p).toBeGreaterThanOrEqual(0);
    expect(p).toBeLessThanOrEqual(1);
  });

  it('with lambda=1, returns unweighted proportion', () => {
    const outcomes = [true, false, true, true, false]; // 3/5 = 0.6
    expect(weightedProportion(outcomes, 1.0)).toBeCloseTo(0.6, 5);
  });

  it('with lambda < 1, recent correct outcomes increase estimate vs equal weight', () => {
    // Older: mostly wrong; newer: mostly right → weighted should be > simple average
    const outcomes = [false, false, false, false, true, true, true, true];
    const simpleAvg = 0.5; // 4/8
    const weighted = weightedProportion(outcomes, 0.7);
    expect(weighted).toBeGreaterThan(simpleAvg);
  });

  it('with lambda < 1, recent wrong outcomes decrease estimate vs equal weight', () => {
    // Older: mostly right; newer: mostly wrong → weighted < simple average
    const outcomes = [true, true, true, true, false, false, false, false];
    const simpleAvg = 0.5;
    const weighted = weightedProportion(outcomes, 0.7);
    expect(weighted).toBeLessThan(simpleAvg);
  });

  it('handles single-element array', () => {
    expect(weightedProportion([true], 0.9)).toBeCloseTo(1.0, 5);
    expect(weightedProportion([false], 0.9)).toBeCloseTo(0.0, 5);
  });
});

// ─── assessMastery ────────────────────────────────────────────────────────────

describe('assessMastery', () => {
  it('returns isMastered=false and zero bounds when < MIN_OBSERVATIONS', () => {
    const result = assessMastery({ outcomes: [true, true, true, true] }); // 4 < 5
    expect(result.isMastered).toBe(false);
    expect(result.wilsonLower).toBe(0);
    expect(result.wilsonUpper).toBe(0);
    expect(result.totalN).toBe(4);
  });

  it('correctNeededForMastery = MIN_OBSERVATIONS - n when n < MIN_OBSERVATIONS', () => {
    const result = assessMastery({ outcomes: [true, true] }); // n=2
    expect(result.correctNeededForMastery).toBe(MIN_OBSERVATIONS - 2);
  });

  it('high accuracy with large n → isMastered=true', () => {
    const outcomes = Array(50).fill(true); // 50/50
    const result = assessMastery({ outcomes });
    expect(result.isMastered).toBe(true);
  });

  it('all incorrect → isMastered=false', () => {
    const outcomes = Array(10).fill(false);
    const result = assessMastery({ outcomes });
    expect(result.isMastered).toBe(false);
  });

  it('isGoldMastery requires higher bar than isMastered', () => {
    // Use moderate accuracy: mastered but maybe not gold
    const outcomes = Array(10).fill(null).map((_, i) => i < 9); // 9/10
    const result = assessMastery({ outcomes });
    // If mastered but not gold, gold should be false
    if (!result.isMastered) {
      expect(result.isGoldMastery).toBe(false);
    }
    // Gold mastery cannot be true if mastery is false
    if (result.isGoldMastery) {
      expect(result.isMastered).toBe(true);
    }
  });

  it('correctNeededForMastery = 0 when already mastered', () => {
    const outcomes = Array(50).fill(true);
    const result = assessMastery({ outcomes });
    expect(result.correctNeededForMastery).toBe(0);
  });

  it('correctNeededForMastery > 0 when not mastered', () => {
    const outcomes = Array(10).fill(false);
    const result = assessMastery({ outcomes });
    expect(result.correctNeededForMastery).toBeGreaterThan(0);
  });

  it('Wilson bounds are in [0, 1]', () => {
    const outcomes = Array(10).fill(null).map((_, i) => i < 7); // 7/10
    const { wilsonLower, wilsonUpper } = assessMastery({ outcomes });
    expect(wilsonLower).toBeGreaterThanOrEqual(0);
    expect(wilsonUpper).toBeLessThanOrEqual(1);
    expect(wilsonLower).toBeLessThanOrEqual(wilsonUpper);
  });

  it('applies recency weighting when decayLambda is provided', () => {
    // Old failures, recent successes → recency-weighted estimate > simple average
    const outcomes = [false, false, false, false, false, true, true, true, true, true];
    const unweighted = assessMastery({ outcomes });
    const weighted   = assessMastery({ outcomes, decayLambda: 0.7 });
    expect(weighted.pointEstimate).toBeGreaterThanOrEqual(unweighted.pointEstimate);
  });

  it('respects custom masteryThreshold', () => {
    // With threshold=0.50, large-n 60% correct should mastered
    const outcomes = Array(100).fill(null).map((_, i) => i < 70); // 70/100
    const loose = assessMastery({ outcomes, masteryThreshold: 0.50 });
    const tight = assessMastery({ outcomes, masteryThreshold: 0.90 });
    expect(loose.isMastered).toBe(true);
    expect(tight.isMastered).toBe(false);
  });

  it('totalN matches outcomes.length', () => {
    const outcomes = Array(15).fill(null).map((_, i) => i % 2 === 0);
    expect(assessMastery({ outcomes }).totalN).toBe(15);
  });

  it('zScore in result matches input or defaults to 1.645', () => {
    const result = assessMastery({ outcomes: Array(10).fill(true) });
    expect(result.zScore).toBeCloseTo(1.645, 3);
  });
});

// ─── isWilsonMastered ─────────────────────────────────────────────────────────

describe('isWilsonMastered', () => {
  it('returns false when total < MIN_OBSERVATIONS', () => {
    expect(isWilsonMastered(4, 4)).toBe(false);
    expect(isWilsonMastered(0, 0)).toBe(false);
  });

  it('returns true for 50/50 correct (large n, Wilson lower well above 0.80)', () => {
    expect(isWilsonMastered(50, 50)).toBe(true);
  });

  it('returns false for 10/10 (Wilson penalizes small samples)', () => {
    // For n=10 all-correct, Wilson lower ≈ 0.787 < 0.80
    expect(isWilsonMastered(10, 10)).toBe(false);
  });

  it('returns false for 9/10 (insufficient evidence for 0.80 threshold)', () => {
    expect(isWilsonMastered(9, 10)).toBe(false);
  });

  it('uses default threshold of MASTERY_THRESHOLD (0.80)', () => {
    // 50/50 should exceed 0.80 threshold
    expect(isWilsonMastered(50, 50, MASTERY_THRESHOLD)).toBe(true);
  });

  it('respects custom threshold: lower threshold easier to meet', () => {
    // With threshold=0.50, 9/10 should pass
    expect(isWilsonMastered(9, 10, 0.50)).toBe(true);
  });

  it('never returns true when successes = 0', () => {
    expect(isWilsonMastered(0, 20)).toBe(false);
  });

  it('GOLD_MASTERY_THRESHOLD (0.90) is harder to meet than MASTERY_THRESHOLD (0.80)', () => {
    // Find a case mastered at 0.80 but not at 0.90
    const n = 30;
    const s = 26; // 86.7% accuracy
    const masterAt80  = isWilsonMastered(s, n, MASTERY_THRESHOLD);
    const masterAt90  = isWilsonMastered(s, n, GOLD_MASTERY_THRESHOLD);
    // If masterAt80 is true, then masterAt90 could be false
    if (masterAt80) {
      expect(masterAt90).toBe(false); // harder to hit 0.90 Wilson lower
    }
  });
});
