/**
 * Wilson Score Mastery Detection Tests
 *
 * Validates the Wilson score lower bound implementation against
 * known mathematical properties and research-validated thresholds.
 *
 * Research: Wilson (1927), Kish (1965), Bloom (1968)
 * @see FSRS6DeepResearch.md
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
} from '../lib/services/wilsonMasteryService';

describe('Wilson Score Mastery Service', () => {

  describe('wilsonScoreBounds', () => {
    it('should return [0, 0] for n=0', () => {
      const { lower, upper } = wilsonScoreBounds(0, 0);
      expect(lower).toBe(0);
      expect(upper).toBe(0);
    });

    it('should return bounds in [0, 1]', () => {
      const cases = [
        { successes: 0, n: 10 },
        { successes: 5, n: 10 },
        { successes: 10, n: 10 },
        { successes: 1, n: 1 },
        { successes: 0, n: 1 },
      ];
      for (const { successes, n } of cases) {
        const { lower, upper } = wilsonScoreBounds(successes, n);
        expect(lower).toBeGreaterThanOrEqual(0);
        expect(lower).toBeLessThanOrEqual(1);
        expect(upper).toBeGreaterThanOrEqual(0);
        expect(upper).toBeLessThanOrEqual(1);
        expect(lower).toBeLessThanOrEqual(upper);
      }
    });

    it('should have lower bound significantly below point estimate for small n', () => {
      // 5/5 correct → raw 100%, but Wilson lower should be much less
      const { lower } = wilsonScoreBounds(5, 5, 1.645);
      expect(lower).toBeLessThan(0.85); // Certainly not 100%
      expect(lower).toBeGreaterThan(0.55); // But still shows positive signal
    });

    it('should converge toward point estimate as n increases', () => {
      // 90/100 correct → Wilson lower should be close to 0.90
      const { lower: small } = wilsonScoreBounds(9, 10, 1.645);
      const { lower: large } = wilsonScoreBounds(900, 1000, 1.645);
      // Large n should have tighter bounds (closer to point estimate)
      expect(large).toBeGreaterThan(small);
      expect(large).toBeGreaterThan(0.87);
    });

    it('should handle 0% success rate', () => {
      const { lower, upper } = wilsonScoreBounds(0, 20, 1.645);
      expect(lower).toBe(0);
      expect(upper).toBeGreaterThan(0);
    });

    it('should handle 100% success rate', () => {
      const { lower, upper } = wilsonScoreBounds(20, 20, 1.645);
      expect(lower).toBeGreaterThan(0);
      expect(upper).toBeLessThanOrEqual(1);
    });

    it('higher confidence (z=1.96) should give wider intervals than z=1.645', () => {
      const bounds90 = wilsonScoreBounds(8, 10, 1.645);
      const bounds95 = wilsonScoreBounds(8, 10, 1.96);
      expect(bounds95.lower).toBeLessThan(bounds90.lower);
      expect(bounds95.upper).toBeGreaterThan(bounds90.upper);
    });
  });

  describe('kishEffectiveSampleSize', () => {
    it('should return n when lambda=1 (no decay)', () => {
      expect(kishEffectiveSampleSize(20, 1)).toBe(20);
    });

    it('should return 1 when lambda=0 (complete decay)', () => {
      expect(kishEffectiveSampleSize(20, 0)).toBe(1);
    });

    it('should return 0 when n=0', () => {
      expect(kishEffectiveSampleSize(0, 0.95)).toBe(0);
    });

    it('should return value between 1 and n for 0 < lambda < 1', () => {
      const nEff = kishEffectiveSampleSize(20, 0.95);
      expect(nEff).toBeGreaterThan(1);
      expect(nEff).toBeLessThan(20);
    });

    it('higher lambda should give larger effective n', () => {
      const nEffHigh = kishEffectiveSampleSize(20, 0.98);
      const nEffLow = kishEffectiveSampleSize(20, 0.85);
      expect(nEffHigh).toBeGreaterThan(nEffLow);
    });

    it('default lambda=0.95 with n=20 should give reasonable n_eff', () => {
      const nEff = kishEffectiveSampleSize(20, DEFAULT_DECAY_LAMBDA);
      // With λ=0.95, n=20: n_eff ≈ 18.4 (mild decay preserves most of the sample)
      expect(nEff).toBeGreaterThan(16);
      expect(nEff).toBeLessThan(20);
    });
  });

  describe('weightedProportion', () => {
    it('should return 0 for empty outcomes', () => {
      expect(weightedProportion([], 0.95)).toBe(0);
    });

    it('should return 1 for all-true outcomes', () => {
      expect(weightedProportion([true, true, true], 0.95)).toBeCloseTo(1.0, 5);
    });

    it('should return 0 for all-false outcomes', () => {
      expect(weightedProportion([false, false, false], 0.95)).toBeCloseTo(0, 5);
    });

    it('should weight recent outcomes more heavily', () => {
      // Recent failures should lower the proportion more than old failures
      const recentFailure = weightedProportion(
        [true, true, true, true, false], // recent failure
        0.8
      );
      const oldFailure = weightedProportion(
        [false, true, true, true, true], // old failure
        0.8
      );
      expect(recentFailure).toBeLessThan(oldFailure);
    });

    it('with lambda=1 should equal unweighted proportion', () => {
      const outcomes = [true, false, true, true, false];
      const weighted = weightedProportion(outcomes, 1.0);
      const unweighted = 3 / 5;
      expect(weighted).toBeCloseTo(unweighted, 5);
    });
  });

  describe('assessMastery', () => {
    it('should not declare mastery with fewer than MIN_OBSERVATIONS', () => {
      const result = assessMastery({
        outcomes: [true, true, true, true], // 4/4 but below minimum
      });
      expect(result.isMastered).toBe(false);
      expect(result.correctNeededForMastery).toBe(1); // Need 1 more observation
    });

    it('should not declare mastery for 5/5 at 80% threshold (small sample)', () => {
      // Research: "a student needs approximately 8/9 correct or 12/13 correct"
      const result = assessMastery({
        outcomes: [true, true, true, true, true], // 5/5 = 100% raw
      });
      // Wilson lower at n=5, p=1.0, z=1.645 is ~0.72 — below 0.80
      expect(result.isMastered).toBe(false);
      expect(result.pointEstimate).toBeCloseTo(1.0, 2);
      expect(result.wilsonLower).toBeLessThan(MASTERY_THRESHOLD);
    });

    it('should declare mastery for strong performance with adequate sample', () => {
      // Wilson lower at z=1.645: 28/30 → 0.817, 47/50 → 0.859
      // These cross the 0.80 mastery threshold
      const result = assessMastery({
        outcomes: Array(28).fill(true).concat([false, false]), // 28/30
      });
      expect(result.isMastered).toBe(true);
      expect(result.wilsonLower).toBeGreaterThanOrEqual(MASTERY_THRESHOLD);
    });

    it('should apply recency weighting when decayLambda provided', () => {
      // Recent failures should prevent mastery even if overall accuracy is high
      const oldSuccesses = Array(15).fill(true);
      const recentFailures = [false, false, false, false, false];
      const outcomes = [...oldSuccesses, ...recentFailures]; // 15/20 raw but recent trend is bad

      const withRecency = assessMastery({
        outcomes,
        decayLambda: 0.9, // Aggressive decay
      });
      const withoutRecency = assessMastery({ outcomes });

      // Recency-weighted should give lower mastery due to recent failures
      expect(withRecency.wilsonLower).toBeLessThan(withoutRecency.wilsonLower);
    });

    it('should compute correctNeededForMastery', () => {
      const result = assessMastery({
        outcomes: [true, true, true, false, false], // 3/5
      });
      expect(result.isMastered).toBe(false);
      expect(result.correctNeededForMastery).toBeGreaterThan(0);
    });

    it('should report 0 correctNeededForMastery when already mastered', () => {
      const outcomes = Array(50).fill(true); // overwhelming evidence
      const result = assessMastery({ outcomes });
      expect(result.isMastered).toBe(true);
      expect(result.correctNeededForMastery).toBe(0);
    });

    it('should detect gold mastery at 90% threshold', () => {
      // Wilson lower at z=1.645: 95/100 → 0.9008, 49/50 → 0.9152
      const outcomes = Array(95).fill(true).concat(Array(5).fill(false)); // 95/100
      const result = assessMastery({ outcomes });
      expect(result.isMastered).toBe(true);
      expect(result.isGoldMastery).toBe(true);
    });
  });

  describe('isWilsonMastered (convenience)', () => {
    it('should return false below MIN_OBSERVATIONS', () => {
      expect(isWilsonMastered(4, 4)).toBe(false);
    });

    it('should return false for 5/5 at 80% threshold', () => {
      expect(isWilsonMastered(5, 5)).toBe(false);
    });

    it('should return true for overwhelming evidence', () => {
      expect(isWilsonMastered(50, 50)).toBe(true);
    });

    it('should respect custom threshold', () => {
      // Lower threshold should be easier to meet
      const strict = isWilsonMastered(8, 10, 0.90);
      const lenient = isWilsonMastered(8, 10, 0.50);
      expect(lenient).toBe(true);
      // 8/10 at 90% threshold with z=1.645 → Wilson lower ~0.54, so strict should fail
      expect(strict).toBe(false);
    });
  });

  describe('Research validation: key properties', () => {
    it('5/5 should NOT equal 50/50 in mastery assessment', () => {
      const small = assessMastery({ outcomes: Array(5).fill(true) });
      const large = assessMastery({ outcomes: Array(50).fill(true) });
      expect(large.wilsonLower).toBeGreaterThan(small.wilsonLower);
    });

    it('Wilson lower bound naturally penalizes small samples', () => {
      // Same proportion (80%), different sample sizes
      const n10 = wilsonScoreBounds(8, 10, 1.645);
      const n50 = wilsonScoreBounds(40, 50, 1.645);
      const n100 = wilsonScoreBounds(80, 100, 1.645);
      expect(n50.lower).toBeGreaterThan(n10.lower);
      expect(n100.lower).toBeGreaterThan(n50.lower);
    });

    it('constants match research recommendations', () => {
      expect(MASTERY_THRESHOLD).toBe(0.80); // Bloom (1968): 80-90%
      expect(GOLD_MASTERY_THRESHOLD).toBe(0.90);
      expect(MIN_OBSERVATIONS).toBe(5);
    });
  });
});
