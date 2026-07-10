/**
 * CODE-004 — additional implicit-metrics coverage for previously-untested exports:
 * per-card RT z-score (+ maturity-aware dampening), question-type weights,
 * session latency stats (Welford), latency percentile, and answer-switch penalty.
 * All implicit/behavioral — no explicit rating UI.
 */
import { describe, it, expect } from 'vitest';
import {
  perCardRtZScore,
  QUESTION_TYPE_WEIGHTS,
  updateLatencyStats,
  initLatencyStats,
  calculateLatencyPercentile,
  deriveContinuousRating,
  type CardBaseline,
  type ImplicitBehaviorMetrics,
} from './implicit-metrics';

const baseline = (o: Partial<CardBaseline> = {}): CardBaseline => ({
  meanRtMs: 10000,
  stdDevRtMs: 2000,
  reviewCount: 10,
  ...o,
});

describe('perCardRtZScore (per-card z-score + fallback)', () => {
  it('returns -1 (fallback) when fewer than 3 reviews', () => {
    expect(perCardRtZScore(10000, baseline({ reviewCount: 2 }))).toBe(-1);
  });

  it('returns -1 (fallback) when stdDev is zero', () => {
    expect(perCardRtZScore(10000, baseline({ stdDevRtMs: 0 }))).toBe(-1);
  });

  it('returns a high signal for a fast response (negative z)', () => {
    const s = perCardRtZScore(6000, baseline()); // 2σ faster than mean
    expect(s).toBeGreaterThan(0.9);
    expect(s).toBeLessThanOrEqual(1);
  });

  it('returns a low signal for a slow response (positive z)', () => {
    const s = perCardRtZScore(16000, baseline()); // 3σ slower
    expect(s).toBeLessThan(0.5);
    expect(s).toBeGreaterThanOrEqual(0);
  });

  it('maturity dampener reduces slow-response penalty on high-stability cards', () => {
    const slow = 16000; // +3σ
    const newCard = perCardRtZScore(slow, baseline({ fsrsStability: 0 }));
    const matureCard = perCardRtZScore(slow, baseline({ fsrsStability: 90 }));
    // Mature card is penalized less for the same slow response → higher signal.
    expect(matureCard).toBeGreaterThan(newCard);
  });

  it('does NOT dampen fast responses regardless of stability', () => {
    const fast = 6000; // -2σ
    const newCard = perCardRtZScore(fast, baseline({ fsrsStability: 0 }));
    const matureCard = perCardRtZScore(fast, baseline({ fsrsStability: 365 }));
    expect(matureCard).toBeCloseTo(newCard, 5);
  });
});

describe('QUESTION_TYPE_WEIGHTS', () => {
  it('defines all expected question-type keys', () => {
    for (const k of ['vignette', 'recall', 'image', 'rapid_recall', 'unknown'] as const) {
      expect(QUESTION_TYPE_WEIGHTS[k]).toBeDefined();
    }
  });

  it('each weight profile is finite and sums to ~1.0', () => {
    for (const [key, w] of Object.entries(QUESTION_TYPE_WEIGHTS)) {
      const sum = w.rtWeight + w.switchWeight + w.trajectoryWeight + w.hesitationWeight;
      expect(Number.isFinite(sum), key).toBe(true);
      expect(sum).toBeCloseTo(1.0, 5);
    }
  });

  it('recall weights emphasize answer switches more than vignette', () => {
    expect(QUESTION_TYPE_WEIGHTS.recall.switchWeight).toBeGreaterThan(
      QUESTION_TYPE_WEIGHTS.vignette.switchWeight
    );
  });
});

describe('session latency stats (Welford)', () => {
  it('initLatencyStats returns zeroed stats', () => {
    expect(initLatencyStats()).toEqual({ count: 0, meanLatency: 0, variance: 0, stdDev: 0 });
  });

  it('computes correct running mean and sample stddev', () => {
    let s = initLatencyStats();
    for (const x of [10, 20, 30, 40]) s = updateLatencyStats(s, x);
    expect(s.count).toBe(4);
    expect(s.meanLatency).toBeCloseTo(25, 6);
    // sample stddev of [10,20,30,40] ≈ 12.909944
    expect(s.stdDev).toBeCloseTo(12.909944, 4);
  });

  it('percentile falls back to 0.5 with <3 samples and rises with latency', () => {
    let s = initLatencyStats();
    for (const x of [100, 200]) s = updateLatencyStats(s, x);
    expect(calculateLatencyPercentile(150, s)).toBe(0.5);

    let s2 = initLatencyStats();
    for (const x of [100, 200, 300, 400, 500]) s2 = updateLatencyStats(s2, x);
    const low = calculateLatencyPercentile(120, s2);
    const high = calculateLatencyPercentile(480, s2);
    expect(high).toBeGreaterThan(low);
    expect(low).toBeGreaterThanOrEqual(0);
    expect(high).toBeLessThanOrEqual(1);
  });
});

describe('answer-switch penalty (implicit)', () => {
  const base: ImplicitBehaviorMetrics = {
    timeToFirstClick: 15000,
    answerSwitches: 0,
    totalDwellTime: 18000,
    isCorrect: true,
    parTimeMs: 30000,
  };

  it('more answer switches lowers the derived grade', () => {
    const none = deriveContinuousRating({ ...base, answerSwitches: 0 }).grade;
    const some = deriveContinuousRating({ ...base, answerSwitches: 2 }).grade;
    const many = deriveContinuousRating({ ...base, answerSwitches: 5 }).grade;
    expect(some).toBeLessThan(none);
    expect(many).toBeLessThanOrEqual(some);
  });
});
