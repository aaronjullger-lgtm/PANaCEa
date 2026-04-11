import { describe, it, expect } from 'vitest';
import {
  deriveContinuousRating,
  initLatencyStats,
  calculateLatencyPercentile,
  fluencyIllusionDampener,
  confidenceStabilityMultiplier,
  type ImplicitBehaviorMetrics,
} from '@/lib/implicit-metrics';

describe('deriveContinuousRating', () => {
  const parTime = 60000;

  const cleanCorrect: ImplicitBehaviorMetrics = {
    isCorrect: true,
    timeToFirstClick: 15000,
    totalDwellTime: 20000,
    parTimeMs: parTime,
    answerSwitches: 0,
  };

  it('produces a grade ≥ 2.5 for clean correct answers', () => {
    const result = deriveContinuousRating(cleanCorrect);
    expect(result.grade).toBeGreaterThanOrEqual(2.5);
    expect(result.discreteRating).toBeGreaterThanOrEqual(3);
  });

  it('gives rating 1 for incorrect answers', () => {
    const result = deriveContinuousRating({
      ...cleanCorrect,
      isCorrect: false,
    });
    expect(result.discreteRating).toBe(1);
  });

  it('applies speed bonus for fast answers', () => {
    const fast = deriveContinuousRating({
      ...cleanCorrect,
      timeToFirstClick: 8000,
    });
    const slow = deriveContinuousRating({
      ...cleanCorrect,
      timeToFirstClick: 55000,
    });
    expect(fast.grade).toBeGreaterThan(slow.grade);
  });

  it('applies penalty for answer switches', () => {
    const noSwitches = deriveContinuousRating(cleanCorrect);
    const withSwitches = deriveContinuousRating({
      ...cleanCorrect,
      answerSwitches: 3,
    });
    expect(withSwitches.grade).toBeLessThan(noSwitches.grade);
  });

  it('applies penalty for high cursor entropy', () => {
    const low = deriveContinuousRating({
      ...cleanCorrect,
      cursorEntropy: 1.0,
    });
    const high = deriveContinuousRating({
      ...cleanCorrect,
      cursorEntropy: 2.5,
    });
    expect(high.grade).toBeLessThan(low.grade);
  });

  it('applies penalty for hover oscillations', () => {
    const none = deriveContinuousRating(cleanCorrect);
    const many = deriveContinuousRating({
      ...cleanCorrect,
      hoverOscillationCount: 5,
    });
    expect(many.grade).toBeLessThan(none.grade);
  });

  it('applies penalty for commitment gap', () => {
    const quick = deriveContinuousRating({
      ...cleanCorrect,
      commitmentGapMs: 500,
    });
    const slow = deriveContinuousRating({
      ...cleanCorrect,
      commitmentGapMs: 8000,
    });
    expect(slow.grade).toBeLessThan(quick.grade);
  });

  it('handles NaN/Infinity inputs gracefully', () => {
    const result = deriveContinuousRating({
      ...cleanCorrect,
      timeToFirstClick: NaN,
      parTimeMs: Infinity,
      answerSwitches: -1,
    });
    expect(Number.isFinite(result.grade)).toBe(true);
    expect(result.discreteRating).toBeGreaterThanOrEqual(1);
    expect(result.discreteRating).toBeLessThanOrEqual(4);
  });

  it('handles zero parTime (defaults to 30s)', () => {
    const result = deriveContinuousRating({
      ...cleanCorrect,
      parTimeMs: 0,
    });
    expect(Number.isFinite(result.grade)).toBe(true);
  });

  it('discrete rating is clamped to 1-4', () => {
    const extreme = deriveContinuousRating({
      isCorrect: true,
      timeToFirstClick: 1000,
      totalDwellTime: 2000,
      parTimeMs: 60000,
      answerSwitches: 0,
      cursorEntropy: 0.5,
    });
    expect(extreme.discreteRating).toBeLessThanOrEqual(4);
  });

  it('hint-viewed applies additional penalty', () => {
    const noHint = deriveContinuousRating(cleanCorrect);
    const withHint = deriveContinuousRating({
      ...cleanCorrect,
      hintViewed: true,
      hintViewDurationMs: 5000,
    });
    expect(withHint.grade).toBeLessThan(noHint.grade);
  });

  it('returns confidence and rtClassification', () => {
    const result = deriveContinuousRating(cleanCorrect);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
    expect(result.rtSignalQuality).toBeDefined();
  });
});

describe('latency utilities', () => {
  it('initLatencyStats returns empty stats', () => {
    const stats = initLatencyStats();
    expect(stats.count).toBe(0);
    expect(stats.meanLatency).toBe(0);
  });

  it('calculateLatencyPercentile returns 0.5 for empty stats (median)', () => {
    expect(calculateLatencyPercentile(30000, initLatencyStats())).toBe(0.5);
  });
});

describe('fluencyIllusionDampener', () => {
  it('dampens same-day reviews (not 1.0 — same-day is risky)', () => {
    const d0 = fluencyIllusionDampener(0);
    expect(d0).toBeGreaterThan(0);
    expect(d0).toBeLessThanOrEqual(1);
  });

  it('increases from day 0 to day 7', () => {
    const d0 = fluencyIllusionDampener(0);
    const d7 = fluencyIllusionDampener(7);
    expect(d7).toBeGreaterThan(d0);
  });

  it('is always positive', () => {
    expect(fluencyIllusionDampener(365)).toBeGreaterThan(0);
  });
});

describe('confidenceStabilityMultiplier', () => {
  it('is > 1 for high confidence', () => {
    expect(confidenceStabilityMultiplier(0.95)).toBeGreaterThan(1);
  });

  it('is < 1 for low confidence', () => {
    expect(confidenceStabilityMultiplier(0.3)).toBeLessThan(1);
  });

  it('is always positive', () => {
    expect(confidenceStabilityMultiplier(0)).toBeGreaterThan(0);
  });
});
