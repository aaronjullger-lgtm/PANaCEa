import { describe, it, expect } from 'vitest';
import {
  wilsonScore,
  hasMastery,
  masteryLevel,
  weightedWilsonScore,
} from '@/lib/statistics/wilsonScore';

describe('wilsonScore', () => {
  it('returns zeros for zero total', () => {
    const result = wilsonScore(0, 0, 0.95);
    expect(result.proportion).toBe(0);
    expect(result.lower).toBe(0);
    expect(result.upper).toBe(0);
  });

  it('3/3 is NOT 100% lower bound (small sample penalty)', () => {
    const result = wilsonScore(3, 3, 0.95);
    expect(result.proportion).toBe(1);
    expect(result.lower).toBeLessThan(1);
    expect(result.lower).toBeGreaterThan(0.3); // ~0.44 actual
  });

  it('10/10 has higher lower bound than 3/3', () => {
    const small = wilsonScore(3, 3, 0.95);
    const large = wilsonScore(10, 10, 0.95);
    expect(large.lower).toBeGreaterThan(small.lower);
  });

  it('lower bound is always ≤ proportion', () => {
    const cases = [[5, 10], [8, 10], [1, 5], [0, 10], [10, 10]];
    for (const [s, t] of cases) {
      const result = wilsonScore(s, t, 0.95);
      expect(result.lower).toBeLessThanOrEqual(result.proportion + 0.001);
    }
  });

  it('upper bound is always ≥ proportion', () => {
    const cases = [[5, 10], [8, 10], [1, 5], [0, 10]];
    for (const [s, t] of cases) {
      const result = wilsonScore(s, t, 0.95);
      expect(result.upper).toBeGreaterThanOrEqual(result.proportion - 0.001);
    }
  });

  it('0 successes gives proportion 0 and lower bound 0', () => {
    const result = wilsonScore(0, 10, 0.95);
    expect(result.proportion).toBe(0);
    expect(result.lower).toBe(0);
    expect(result.upper).toBeGreaterThan(0);
  });

  it('higher confidence → wider interval', () => {
    const c90 = wilsonScore(7, 10, 0.90);
    const c99 = wilsonScore(7, 10, 0.99);
    expect(c99.lower).toBeLessThan(c90.lower);
    expect(c99.upper).toBeGreaterThan(c90.upper);
  });

  it('default confidence is 0.95', () => {
    const explicit = wilsonScore(7, 10, 0.95);
    const implicit = wilsonScore(7, 10);
    expect(explicit.lower).toBeCloseTo(implicit.lower, 10);
  });

  it('interval is bounded [0, 1]', () => {
    for (const [s, t] of [[0, 1], [1, 1], [3, 3], [5, 10], [0, 100]]) {
      const result = wilsonScore(s, t, 0.95);
      expect(result.lower).toBeGreaterThanOrEqual(0);
      expect(result.upper).toBeLessThanOrEqual(1);
    }
  });
});

describe('hasMastery', () => {
  it('returns false for 3/3 with high threshold (small sample penalty)', () => {
    expect(hasMastery(3, 3, { threshold: 0.8 })).toBe(false);
  });

  it('returns false for 0 attempts', () => {
    expect(hasMastery(0, 0, { threshold: 0.8 })).toBe(false);
  });

  it('returns false when below threshold', () => {
    expect(hasMastery(5, 10, { threshold: 0.8 })).toBe(false);
  });

  it('returns true for strong performance with enough attempts', () => {
    // 18/20 Wilson lower ≈ 0.73 at 95% CI, passes 0.7 threshold
    expect(hasMastery(18, 20, { threshold: 0.65, minAttempts: 10 })).toBe(true);
  });

  it('respects minAttempts', () => {
    // 2/2 might pass threshold mathematically but fails minAttempts
    expect(hasMastery(2, 2, { threshold: 0.5, minAttempts: 5 })).toBe(false);
  });
});

describe('masteryLevel', () => {
  it('returns 0 for < 3 attempts', () => {
    expect(masteryLevel(2, 2, 0.8)).toBe(0);
  });

  it('returns 0 when below threshold', () => {
    expect(masteryLevel(5, 10, 0.8)).toBe(0);
  });

  it('returns value > 0 when above threshold', () => {
    // 15/15 Wilson lower ≈ 0.82 at 95% CI
    const level = masteryLevel(15, 15, 0.7);
    expect(level).toBeGreaterThan(0);
    expect(level).toBeLessThanOrEqual(1);
  });

  it('returns high mastery for perfect score', () => {
    const level = masteryLevel(20, 20, 0.4);
    expect(level).toBeGreaterThan(0.5); // 0.73 actual
  });
});

describe('weightedWilsonScore', () => {
  it('returns zeros for empty attempts', () => {
    const result = weightedWilsonScore([]);
    expect(result.lower).toBe(0);
    expect(result.upper).toBe(0);
  });

  it('computes interval for mixed attempts', () => {
    const attempts = [
      { isCorrect: true, reviewedAt: new Date() },
      { isCorrect: true, reviewedAt: new Date() },
      { isCorrect: false, reviewedAt: new Date() },
    ];
    const result = weightedWilsonScore(attempts);
    expect(result.lower).toBeGreaterThan(0);
    expect(result.upper).toBeLessThanOrEqual(1);
  });
});
