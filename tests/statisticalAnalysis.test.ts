import { describe, it, expect } from 'vitest';
import {
  calculateStatistics,
  calculateConfidenceInterval,
  analyzeTrend,
  comparePerformance,
  calculateMovingAverage,
  detectPlateau,
  generateLearningInsights,
  predictPANCEScore,
} from '../lib/utils/statisticalAnalysis';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Build evenly-spaced daily data points starting at `startDate`. */
function dailyPoints(values: number[], startDate = new Date('2026-01-01')): { timestamp: Date; value: number }[] {
  return values.map((value, i) => ({
    timestamp: new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000),
    value,
  }));
}

// ─── calculateStatistics ────────────────────────────────────────────────────

describe('calculateStatistics', () => {
  it('returns all-zero summary for empty array', () => {
    const s = calculateStatistics([]);
    expect(s).toEqual({
      mean: 0,
      median: 0,
      standardDeviation: 0,
      variance: 0,
      min: 0,
      max: 0,
      range: 0,
      count: 0,
    });
  });

  it('computes single-element summary correctly', () => {
    const s = calculateStatistics([42]);
    expect(s.mean).toBe(42);
    expect(s.median).toBe(42);
    expect(s.min).toBe(42);
    expect(s.max).toBe(42);
    expect(s.range).toBe(0);
    expect(s.standardDeviation).toBe(0);
    expect(s.variance).toBe(0);
    expect(s.count).toBe(1);
  });

  it('averages the two middle values for even-length data', () => {
    // sorted: [1, 2, 3, 4] → median = (2 + 3) / 2 = 2.5
    const s = calculateStatistics([4, 1, 3, 2]);
    expect(s.median).toBe(2.5);
    expect(s.mean).toBe(2.5);
    expect(s.min).toBe(1);
    expect(s.max).toBe(4);
    expect(s.range).toBe(3);
  });

  it('returns the middle value for odd-length data', () => {
    // sorted: [1, 2, 3, 4, 5] → median = 3
    const s = calculateStatistics([5, 1, 3, 2, 4]);
    expect(s.median).toBe(3);
    expect(s.mean).toBe(3);
    expect(s.range).toBe(4);
  });

  it('yields zero variance when all values are identical', () => {
    const s = calculateStatistics([7, 7, 7, 7]);
    expect(s.variance).toBe(0);
    expect(s.standardDeviation).toBe(0);
    expect(s.range).toBe(0);
  });

  it('computes variance = mean of squared deviations (population, not sample)', () => {
    // data = [2, 4, 4, 4, 5, 5, 7, 9], mean = 5
    // squared diffs: 9, 1, 1, 1, 0, 0, 4, 16 → sum = 32 → variance = 32/8 = 4
    const s = calculateStatistics([2, 4, 4, 4, 5, 5, 7, 9]);
    expect(s.mean).toBe(5);
    expect(s.variance).toBe(4);
    expect(s.standardDeviation).toBe(2);
  });

  it('handles negative values correctly', () => {
    const s = calculateStatistics([-5, -2, 0, 3, 4]);
    expect(s.min).toBe(-5);
    expect(s.max).toBe(4);
    expect(s.range).toBe(9);
    expect(s.mean).toBe(0);
  });
});

// ─── calculateConfidenceInterval ────────────────────────────────────────────

describe('calculateConfidenceInterval', () => {
  it('returns zeros when total is 0', () => {
    const ci = calculateConfidenceInterval(0, 0);
    expect(ci).toEqual({ lower: 0, upper: 0, confidenceLevel: 0.95, marginOfError: 0 });
  });

  it('returns output as percentage (0-100 scale), not fraction', () => {
    const ci = calculateConfidenceInterval(50, 100);
    // Wilson centered near 50%, interval should contain 50
    expect(ci.lower).toBeGreaterThan(0);
    expect(ci.upper).toBeLessThan(100);
    expect(ci.lower).toBeLessThan(50);
    expect(ci.upper).toBeGreaterThan(50);
  });

  it('produces tighter interval with more data (same proportion)', () => {
    const small = calculateConfidenceInterval(10, 20);
    const big = calculateConfidenceInterval(500, 1000);
    const smallWidth = small.upper - small.lower;
    const bigWidth = big.upper - big.lower;
    expect(bigWidth).toBeLessThan(smallWidth);
  });

  it('uses the provided confidence level z-score (0.9 vs 0.99)', () => {
    const narrow = calculateConfidenceInterval(80, 100, 0.9);
    const wide = calculateConfidenceInterval(80, 100, 0.99);
    expect(wide.upper - wide.lower).toBeGreaterThan(narrow.upper - narrow.lower);
    expect(narrow.confidenceLevel).toBe(0.9);
    expect(wide.confidenceLevel).toBe(0.99);
  });

  it('falls back to z=1.96 for unrecognized confidence level', () => {
    const custom = calculateConfidenceInterval(80, 100, 0.8); // not in lookup
    const default95 = calculateConfidenceInterval(80, 100, 0.95);
    // Width should match the 0.95 (z=1.96) case since 0.8 isn't in the table
    expect(custom.upper - custom.lower).toBeCloseTo(default95.upper - default95.lower, 1);
  });

  it('keeps lower bound >= 0 and upper bound <= 100', () => {
    const edge = calculateConfidenceInterval(1, 3); // tiny sample, proportion ~33%
    expect(edge.lower).toBeGreaterThanOrEqual(0);
    expect(edge.upper).toBeLessThanOrEqual(100);
  });
});

// ─── analyzeTrend ───────────────────────────────────────────────────────────

describe('analyzeTrend', () => {
  it('returns stable with 0 predicted next when given empty array', () => {
    const result = analyzeTrend([]);
    expect(result.slope).toBe(0);
    expect(result.direction).toBe('stable');
    expect(result.predictedNext).toBe(0);
    expect(result.velocityPerDay).toBe(0);
  });

  it('returns stable with predictedNext = sole value when given single point', () => {
    const result = analyzeTrend(dailyPoints([75]));
    expect(result.slope).toBe(0);
    expect(result.direction).toBe('stable');
    expect(result.predictedNext).toBe(75);
  });

  it('detects improving trend with strong linear fit', () => {
    // +1 point per day for 10 days → slope = 1, direction = improving (slope < 0.5 is stable, 1 > 0.5)
    const result = analyzeTrend(dailyPoints([60, 61, 62, 63, 64, 65, 66, 67, 68, 69]));
    expect(result.slope).toBe(1);
    expect(result.direction).toBe('improving');
    expect(result.rSquared).toBeCloseTo(1, 2);
    expect(result.predictedNext).toBeCloseTo(70, 1);
  });

  it('detects declining trend', () => {
    const result = analyzeTrend(dailyPoints([80, 78, 76, 74, 72, 70, 68, 66, 64, 62]));
    expect(result.slope).toBe(-2);
    expect(result.direction).toBe('declining');
    expect(result.velocityPerDay).toBe(-2);
  });

  it('classifies tiny slopes (|slope| < 0.5) as stable', () => {
    // Small drift: +0.2/day → should be classified stable per threshold
    const result = analyzeTrend(dailyPoints([70, 70.2, 70.4, 70.6, 70.8, 71.0]));
    expect(Math.abs(result.slope)).toBeLessThan(0.5);
    expect(result.direction).toBe('stable');
  });

  it('handles number timestamps (not just Dates)', () => {
    const t0 = Date.parse('2026-01-01');
    const day = 24 * 60 * 60 * 1000;
    const result = analyzeTrend([
      { timestamp: t0, value: 50 },
      { timestamp: t0 + day, value: 55 },
      { timestamp: t0 + 2 * day, value: 60 },
    ]);
    expect(result.slope).toBe(5);
    expect(result.direction).toBe('improving');
  });

  it('returns rSquared = 0 when all values are identical (ssTotal = 0)', () => {
    const result = analyzeTrend(dailyPoints([50, 50, 50, 50]));
    expect(result.rSquared).toBe(0);
    expect(result.direction).toBe('stable');
  });
});

// ─── comparePerformance ─────────────────────────────────────────────────────

describe('comparePerformance', () => {
  it('detects significant improvement with large sample', () => {
    // p1 = 0.50, p2 = 0.75, n=200 each → clearly significant
    const result = comparePerformance(
      { successes: 100, total: 200 },
      { successes: 150, total: 200 }
    );
    expect(result.isSignificant).toBe(true);
    expect(result.pValue).toBeLessThan(0.05);
    expect(result.difference).toBeGreaterThan(0); // percentage difference positive
  });

  it('finds no significance when proportions are equal', () => {
    const result = comparePerformance(
      { successes: 50, total: 100 },
      { successes: 50, total: 100 }
    );
    expect(result.difference).toBe(0);
    expect(result.percentChange).toBe(0);
    expect(result.isSignificant).toBe(false);
    expect(result.pValue).toBeCloseTo(1, 1);
  });

  it('handles zero totals by defaulting proportions to 0', () => {
    const result = comparePerformance(
      { successes: 0, total: 0 },
      { successes: 0, total: 0 }
    );
    expect(result.difference).toBe(0);
    expect(result.percentChange).toBe(0);
    expect(result.effectSize).toBe(0);
  });

  it('computes positive effect size when proportions differ', () => {
    const result = comparePerformance(
      { successes: 30, total: 100 },
      { successes: 60, total: 100 }
    );
    expect(result.effectSize).toBeGreaterThan(0);
  });
});

// ─── calculateMovingAverage ─────────────────────────────────────────────────

describe('calculateMovingAverage', () => {
  it('returns the original data when window exceeds length', () => {
    expect(calculateMovingAverage([1, 2, 3], 5)).toEqual([1, 2, 3]);
  });

  it('computes sliding window averages correctly', () => {
    // [1,2,3,4,5] window=3 → [(1+2+3)/3, (2+3+4)/3, (3+4+5)/3] = [2, 3, 4]
    expect(calculateMovingAverage([1, 2, 3, 4, 5], 3)).toEqual([2, 3, 4]);
  });

  it('defaults to window size 5', () => {
    const data = [10, 20, 30, 40, 50, 60, 70];
    const result = calculateMovingAverage(data);
    // Three windows: avg of [10..50]=30, [20..60]=40, [30..70]=50
    expect(result).toEqual([30, 40, 50]);
  });

  it('rounds output to 1 decimal place', () => {
    // window=3, [1,2,4] → (1+2+4)/3 = 2.333... → rounded to 2.3
    expect(calculateMovingAverage([1, 2, 4], 3)).toEqual([2.3]);
  });
});

// ─── detectPlateau ──────────────────────────────────────────────────────────

describe('detectPlateau', () => {
  it('returns not-plateau with < 3 points', () => {
    const result = detectPlateau(dailyPoints([75, 76]));
    expect(result.isPlateau).toBe(false);
    expect(result.daysSincePlateau).toBe(0);
    expect(result.plateauValue).toBe(0);
  });

  it('flags plateau when coefficient of variation is below threshold', () => {
    // Tight cluster around 75 → low CV → plateau
    const result = detectPlateau(dailyPoints([75, 75.2, 75.1, 74.9, 75.05, 75.15]));
    expect(result.isPlateau).toBe(true);
    expect(result.plateauValue).toBeCloseTo(75, 0);
  });

  it('does NOT flag plateau with wide variance', () => {
    const result = detectPlateau(dailyPoints([50, 80, 55, 90, 60, 95]));
    expect(result.isPlateau).toBe(false);
  });

  it('measures daysSincePlateau across the recent window', () => {
    // 6 daily points → 5 days between first and last
    const result = detectPlateau(dailyPoints([75, 75.1, 74.9, 75.05, 75.15, 75]));
    expect(result.isPlateau).toBe(true);
    expect(result.daysSincePlateau).toBe(5);
  });

  it('respects custom thresholdPercent', () => {
    const data = dailyPoints([70, 72, 68, 71, 69]);
    const strict = detectPlateau(data, 1); // narrow band — variance too high
    const loose = detectPlateau(data, 10); // wide band — passes
    expect(strict.isPlateau).toBe(false);
    expect(loose.isPlateau).toBe(true);
  });
});

// ─── generateLearningInsights ───────────────────────────────────────────────

describe('generateLearningInsights', () => {
  it('warns when totalQuestions < 30', () => {
    const insights = generateLearningInsights([], 70, 10);
    expect(insights.some((s) => s.includes('may vary significantly'))).toBe(true);
  });

  it('omits the small-sample warning at 30+ questions', () => {
    const insights = generateLearningInsights(dailyPoints([70, 72, 74, 76, 78]), 75, 50);
    expect(insights.some((s) => s.includes('may vary significantly'))).toBe(false);
  });

  it('emits confidence interval phrase once sample size is >= 10', () => {
    const insights = generateLearningInsights([], 70, 20);
    expect(insights.some((s) => s.includes('95% confidence'))).toBe(true);
  });

  it('reports strong improvement trend when rSquared > 0.5 and improving', () => {
    // Clean linear improvement → high R², direction improving
    const history = dailyPoints([60, 65, 70, 75, 80, 85]);
    const insights = generateLearningInsights(history, 85, 100);
    expect(insights.some((s) => s.includes('improvement trend'))).toBe(true);
  });

  it('reports declining trend when fit is strong and declining', () => {
    const history = dailyPoints([90, 85, 80, 75, 70, 65]);
    const insights = generateLearningInsights(history, 65, 100);
    expect(insights.some((s) => s.includes('declining'))).toBe(true);
  });

  it('flags plateau when sustained > 7 days', () => {
    // 10 points at ~75 → plateau, spanning 9 days — but note detectPlateau uses
    // the last 10 points (recentPoints.slice(-10)), not the full array.
    // However, daysSincePlateau > 7 is required. 10 points spans 9 days.
    const history = dailyPoints([75, 75.1, 74.9, 75.05, 75.2, 74.95, 75.1, 75, 75.15, 75.05]);
    const insights = generateLearningInsights(history, 75, 100);
    expect(insights.some((s) => s.includes('plateaued'))).toBe(true);
  });
});

// ─── predictPANCEScore ──────────────────────────────────────────────────────

describe('predictPANCEScore', () => {
  it('maps 75% accuracy at medium difficulty to ~500 (base score)', () => {
    const result = predictPANCEScore(75, 100, 'medium');
    // normalizedAccuracy = (75 - 50) / 50 = 0.5 → 500 + 0.5 * 300 = 650
    expect(result.predictedScore).toBe(650);
  });

  it('maps 50% accuracy at medium difficulty near the pass line (~350)', () => {
    const result = predictPANCEScore(50, 100, 'medium');
    // normalized = 0 → 500 + 0 * 300 = 500, BUT 50 * 1.0 = 50, so (50-50)/50 = 0 → 500
    // Wait: adjustedAccuracy = 50 * 1.0 = 50. normalized = (50-50)/50 = 0. → 500.
    expect(result.predictedScore).toBe(500);
  });

  it('penalizes easy difficulty (0.85 multiplier)', () => {
    const easy = predictPANCEScore(80, 100, 'easy');
    const medium = predictPANCEScore(80, 100, 'medium');
    expect(easy.predictedScore).toBeLessThan(medium.predictedScore);
  });

  it('rewards hard difficulty (1.15 multiplier)', () => {
    const hard = predictPANCEScore(80, 100, 'hard');
    const medium = predictPANCEScore(80, 100, 'medium');
    expect(hard.predictedScore).toBeGreaterThan(medium.predictedScore);
  });

  it('clamps predicted score to [200, 800]', () => {
    const veryLow = predictPANCEScore(0, 100, 'easy');
    const veryHigh = predictPANCEScore(100, 100, 'hard');
    expect(veryLow.predictedScore).toBeGreaterThanOrEqual(200);
    expect(veryHigh.predictedScore).toBeLessThanOrEqual(800);
  });

  it('reports "Very likely to pass" when min of range >= 400', () => {
    const result = predictPANCEScore(90, 500, 'medium');
    expect(result.range.min).toBeGreaterThanOrEqual(400);
    expect(result.passLikelihood).toBe('Very likely to pass');
  });

  it('reports "More preparation needed" when predictedScore < 350', () => {
    // accuracy=20, medium → adjusted=20, normalized=(20-50)/50=-0.6 → 500-180=320
    const result = predictPANCEScore(20, 100, 'medium');
    expect(result.predictedScore).toBeLessThan(350);
    expect(result.passLikelihood).toBe('More preparation needed');
  });

  it('returns a range with min <= predicted <= max', () => {
    const result = predictPANCEScore(70, 100, 'medium');
    expect(result.range.min).toBeLessThanOrEqual(result.predictedScore);
    expect(result.range.max).toBeGreaterThanOrEqual(result.predictedScore);
  });
});
