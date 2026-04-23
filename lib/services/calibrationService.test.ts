// SAFE-OVERRIDE: no shell commands; safety guard false-positive on service variable names
/**
 * Unit tests for lib/services/calibrationService.ts
 *
 * Pure functions tested:
 *   computeBrierScore           — mean squared error between confidence and outcome
 *   linearRegression            — simple OLS regression on confidence-outcome pairs
 *   computeCalibrationBuckets   — bin pairs into predefined confidence ranges
 *   deriveDampenerFactor        — correction factor from slope + brier score
 *   computeCalibrationProfile   — aggregate pipeline returning UserCalibration
 *
 * Constants (from BUCKET_BOUNDARIES):
 *   5 buckets: [0.3,0.5), [0.5,0.6), [0.6,0.7), [0.7,0.8), [0.8,0.95)
 *   MIN_DAMPENER = 0.7, MAX_DAMPENER = 1.3
 */

import { describe, it, expect } from 'vitest';
import {
  computeBrierScore,
  linearRegression,
  computeCalibrationBuckets,
  deriveDampenerFactor,
  computeCalibrationProfile,
} from './calibrationService';

// ─── Helpers ─────────────────────────────────────────────────────────────────

type Pair = { confidence: number; wasCorrect: boolean };

function pair(confidence: number, wasCorrect: boolean): Pair {
  return { confidence, wasCorrect };
}

// ─── computeBrierScore ────────────────────────────────────────────────────────

describe('computeBrierScore', () => {
  it('returns 0.5 for empty input (no data default)', () => {
    expect(computeBrierScore([])).toBe(0.5);
  });

  it('returns 0 for perfectly calibrated predictions (confidence = actual)', () => {
    // All correct with confidence=1: (1-1)^2 = 0 each
    const pairs = [pair(1.0, true), pair(1.0, true), pair(0.0, false)];
    expect(computeBrierScore(pairs)).toBeCloseTo(0.0, 9);
  });

  it('returns 1 for perfectly wrong predictions', () => {
    // All wrong: (1.0 - 0)^2 = 1 each
    const pairs = [pair(1.0, false), pair(1.0, false)];
    expect(computeBrierScore(pairs)).toBeCloseTo(1.0, 9);
  });

  it('returns 0.25 for 50% confidence on all-correct (well-calibrated for binary)', () => {
    // (0.5 - 1)^2 = 0.25
    const pairs = [pair(0.5, true)];
    expect(computeBrierScore(pairs)).toBeCloseTo(0.25, 9);
  });

  it('averages squared errors across all pairs', () => {
    // (0.8 - 1)^2 + (0.2 - 0)^2 = 0.04 + 0.04 = 0.08 / 2 = 0.04
    const pairs = [pair(0.8, true), pair(0.2, false)];
    expect(computeBrierScore(pairs)).toBeCloseTo(0.04, 9);
  });

  it('is always in [0, 1]', () => {
    const cases = [
      [pair(0.5, true)],
      [pair(0.0, true)],
      [pair(1.0, false)],
      [pair(0.7, true), pair(0.3, false)],
    ];
    for (const pairs of cases) {
      const score = computeBrierScore(pairs);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    }
  });

  it('handles a single pair correctly', () => {
    // (0.9 - 0)^2 = 0.81 (confident but wrong)
    expect(computeBrierScore([pair(0.9, false)])).toBeCloseTo(0.81, 9);
  });
});

// ─── linearRegression ─────────────────────────────────────────────────────────

describe('linearRegression', () => {
  it('returns slope=1 intercept=0 for empty input', () => {
    const result = linearRegression([]);
    expect(result.slope).toBe(1);
    expect(result.intercept).toBe(0);
  });

  it('returns slope=1 intercept=0 for single pair (not enough data)', () => {
    const result = linearRegression([pair(0.8, true)]);
    expect(result.slope).toBe(1);
    expect(result.intercept).toBe(0);
  });

  it('positive slope when high-confidence predicts correct and low-confidence predicts wrong', () => {
    // High confidence → correct; low confidence → wrong: positive slope
    const pairs = [pair(0.2, false), pair(0.3, false), pair(0.8, true), pair(0.9, true)];
    const result = linearRegression(pairs);
    expect(result.slope).toBeGreaterThan(0);
  });

  it('perfect negative correlation: high confidence but always wrong → negative slope', () => {
    const pairs = [pair(0.6, false), pair(0.7, false), pair(0.8, false), pair(0.9, false)];
    const result = linearRegression(pairs);
    expect(result.slope).toBeLessThanOrEqual(0);
  });

  it('returns numbers for slope and intercept', () => {
    const pairs = [pair(0.5, true), pair(0.8, false), pair(0.3, true)];
    const result = linearRegression(pairs);
    expect(typeof result.slope).toBe('number');
    expect(typeof result.intercept).toBe('number');
    expect(isFinite(result.slope)).toBe(true);
    expect(isFinite(result.intercept)).toBe(true);
  });

  it('handles degenerate case where all x values are equal', () => {
    // All same confidence → denominator = 0 → falls back to slope=1, intercept=0
    const pairs = [pair(0.7, true), pair(0.7, false), pair(0.7, true)];
    const result = linearRegression(pairs);
    expect(result.slope).toBe(1);
    expect(result.intercept).toBe(0);
  });
});

// ─── computeCalibrationBuckets ────────────────────────────────────────────────

describe('computeCalibrationBuckets', () => {
  it('returns exactly 5 buckets (one per BUCKET_BOUNDARY)', () => {
    expect(computeCalibrationBuckets([])).toHaveLength(5);
  });

  it('returns empty buckets with count=0 for empty input', () => {
    const buckets = computeCalibrationBuckets([]);
    for (const b of buckets) {
      expect(b.count).toBe(0);
    }
  });

  it('places a pair with confidence=0.4 into the [0.3, 0.5) bucket', () => {
    const buckets = computeCalibrationBuckets([pair(0.4, true)]);
    const bucket = buckets.find(b => b.confidenceRange[0] === 0.3)!;
    expect(bucket.count).toBe(1);
    expect(bucket.actualRetention).toBeCloseTo(1.0, 3);
  });

  it('places a pair with confidence=0.85 into the [0.8, 0.95) bucket', () => {
    const buckets = computeCalibrationBuckets([pair(0.85, false)]);
    const bucket = buckets.find(b => b.confidenceRange[0] === 0.8)!;
    expect(bucket.count).toBe(1);
    expect(bucket.actualRetention).toBeCloseTo(0.0, 3);
  });

  it('computes correct actualRetention as fraction correct', () => {
    // 3 at confidence=0.75: 2 correct, 1 wrong → retention = 2/3
    const pairs = [pair(0.75, true), pair(0.75, true), pair(0.75, false)];
    const buckets = computeCalibrationBuckets(pairs);
    const bucket = buckets.find(b => b.confidenceRange[0] === 0.7)!;
    expect(bucket.count).toBe(3);
    expect(bucket.actualRetention).toBeCloseTo(2 / 3, 2);
  });

  it('predictedRetention is mean confidence in the bucket', () => {
    const pairs = [pair(0.72, true), pair(0.78, false)];
    const buckets = computeCalibrationBuckets(pairs);
    const bucket = buckets.find(b => b.confidenceRange[0] === 0.7)!;
    expect(bucket.predictedRetention).toBeCloseTo(0.75, 2);
  });

  it('bucket with count=0 has predictedRetention at bucket midpoint', () => {
    // [0.3, 0.5) → midpoint = 0.4
    const bucket = computeCalibrationBuckets([])[0]!;
    expect(bucket.predictedRetention).toBeCloseTo(0.4, 3);
  });

  it('each bucket has a confidenceRange array of length 2', () => {
    const buckets = computeCalibrationBuckets([]);
    for (const b of buckets) {
      expect(Array.isArray(b.confidenceRange)).toBe(true);
      expect(b.confidenceRange).toHaveLength(2);
    }
  });

  it('distributes pairs exclusively (no pair appears in multiple buckets)', () => {
    const pairs = [pair(0.4, true), pair(0.55, false), pair(0.65, true), pair(0.75, false), pair(0.85, true)];
    const buckets = computeCalibrationBuckets(pairs);
    const totalCount = buckets.reduce((s, b) => s + b.count, 0);
    expect(totalCount).toBe(pairs.length);
  });
});

// ─── deriveDampenerFactor ─────────────────────────────────────────────────────

describe('deriveDampenerFactor', () => {
  it('returns 1.0 when slope is in [0.8, 1.2] and brierScore < 0.25 (well-calibrated)', () => {
    expect(deriveDampenerFactor(1.0, 0.20)).toBe(1.0);
    expect(deriveDampenerFactor(0.8, 0.24)).toBe(1.0);
    expect(deriveDampenerFactor(1.2, 0.10)).toBe(1.0);
  });

  it('returns a value less than 1.0 for overconfident users (slope < 0.8)', () => {
    const factor = deriveDampenerFactor(0.5, 0.30);
    expect(factor).toBeLessThan(1.0);
  });

  it('returns a value greater than 1.0 for underconfident users (slope > 1.2)', () => {
    const factor = deriveDampenerFactor(1.5, 0.30);
    expect(factor).toBeGreaterThan(1.0);
  });

  it('clamps to minimum 0.7 for extreme overconfidence', () => {
    // slope = 0: raw = 0.7 + 0 = 0.7 → clamped to 0.7
    const factor = deriveDampenerFactor(0.0, 0.30);
    expect(factor).toBeCloseTo(0.7, 5);
  });

  it('clamps to maximum 1.3 for extreme underconfidence', () => {
    // slope = 10: raw = 0.7 + 3.0 = 3.7 → clamped to 1.3
    const factor = deriveDampenerFactor(10, 0.30);
    expect(factor).toBeCloseTo(1.3, 5);
  });

  it('applies formula 0.7 + 0.3*slope when outside well-calibrated zone', () => {
    // slope=0.6, brier=0.30: 0.7 + 0.3*0.6 = 0.88
    const factor = deriveDampenerFactor(0.6, 0.30);
    expect(factor).toBeCloseTo(0.88, 5);
  });

  it('high brier score triggers dampening even when slope is in range', () => {
    // slope=1.0 but brierScore=0.30 → not well-calibrated → 0.7 + 0.3*1.0 = 1.0
    const factor = deriveDampenerFactor(1.0, 0.30);
    expect(factor).toBeCloseTo(1.0, 5);
  });
});

// ─── computeCalibrationProfile ────────────────────────────────────────────────

describe('computeCalibrationProfile', () => {
  it('returns a UserCalibration object with all required fields', () => {
    const profile = computeCalibrationProfile([pair(0.8, true), pair(0.6, false)]);
    expect(typeof profile.brierScore).toBe('number');
    expect(typeof profile.calibrationSlope).toBe('number');
    expect(typeof profile.calibrationIntercept).toBe('number');
    expect(Array.isArray(profile.buckets)).toBe(true);
    expect(typeof profile.dampenerFactor).toBe('number');
    expect(typeof profile.n).toBe('number');
    expect(typeof profile.computedAt).toBe('string');
  });

  it('n equals the number of pairs passed in', () => {
    const pairs = [pair(0.7, true), pair(0.8, false), pair(0.6, true)];
    const profile = computeCalibrationProfile(pairs);
    expect(profile.n).toBe(3);
  });

  it('brierScore is in [0, 1]', () => {
    const profile = computeCalibrationProfile([pair(0.8, true), pair(0.4, false)]);
    expect(profile.brierScore).toBeGreaterThanOrEqual(0);
    expect(profile.brierScore).toBeLessThanOrEqual(1);
  });

  it('dampenerFactor is in [0.7, 1.3]', () => {
    const profile = computeCalibrationProfile([pair(0.8, true), pair(0.6, false)]);
    expect(profile.dampenerFactor).toBeGreaterThanOrEqual(0.7);
    expect(profile.dampenerFactor).toBeLessThanOrEqual(1.3);
  });

  it('computedAt is a valid ISO string', () => {
    const profile = computeCalibrationProfile([pair(0.8, true)]);
    expect(() => new Date(profile.computedAt)).not.toThrow();
    expect(isNaN(new Date(profile.computedAt).getTime())).toBe(false);
  });

  it('buckets has exactly 5 entries', () => {
    const profile = computeCalibrationProfile([pair(0.75, true)]);
    expect(profile.buckets).toHaveLength(5);
  });

  it('produces well-calibrated profile for perfectly calibrated predictions', () => {
    // Confidence matches correctness closely
    const pairs = Array.from({ length: 10 }, (_, i) =>
      pair(i < 8 ? 0.85 : 0.15, i < 8)
    );
    const profile = computeCalibrationProfile(pairs);
    expect(profile.brierScore).toBeLessThan(0.25);
  });
});
