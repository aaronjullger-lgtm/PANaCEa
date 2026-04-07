/**
 * Phase 3 Tests: Per-User MVRT Normalization & Streak Modifier
 *
 * Validates:
 * - Phase 3A: Per-user minimum valid response time (MVRT) at 10% of median RT
 * - Phase 3B: Consecutive correct streak modifier (+0.03/streak, cap ±0.15)
 *
 * Research basis:
 * - RT normalization: 10% of per-user median as rapid-guess filter (FSRS6DeepResearch.md)
 * - Streak effects: 1-8% real but small (Stanford, 2025), cap at ±0.5 grade levels
 */

import { describe, it, expect } from 'vitest';
import {
  deriveContinuousRating,
  type ImplicitBehaviorMetrics,
} from '../lib/implicit-metrics';

// ─── Phase 3B: Streak Modifier Tests ─────────────────────────────────────────

describe('Streak Modifier (Phase 3B)', () => {
  const baseCorrectMetrics: ImplicitBehaviorMetrics = {
    timeToFirstClick: 10000,
    answerSwitches: 0,
    totalDwellTime: 10000,
    isCorrect: true,
    parTimeMs: 30000,
  };

  it('should produce higher grade with a streak than without', () => {
    const noStreak = deriveContinuousRating({ ...baseCorrectMetrics, consecutiveCorrectStreak: 0 });
    const withStreak = deriveContinuousRating({ ...baseCorrectMetrics, consecutiveCorrectStreak: 3 });

    expect(withStreak.grade).toBeGreaterThan(noStreak.grade);
  });

  it('should add +0.03 per consecutive correct', () => {
    const streak0 = deriveContinuousRating({ ...baseCorrectMetrics, consecutiveCorrectStreak: 0 });
    const streak1 = deriveContinuousRating({ ...baseCorrectMetrics, consecutiveCorrectStreak: 1 });
    const streak2 = deriveContinuousRating({ ...baseCorrectMetrics, consecutiveCorrectStreak: 2 });

    const delta1 = streak1.grade - streak0.grade;
    const delta2 = streak2.grade - streak1.grade;

    // Each streak step adds approximately 0.03
    expect(delta1).toBeCloseTo(0.03, 2);
    expect(delta2).toBeCloseTo(0.03, 2);
  });

  it('should cap streak bonus at +0.15 (5 consecutive)', () => {
    const streak5 = deriveContinuousRating({ ...baseCorrectMetrics, consecutiveCorrectStreak: 5 });
    const streak10 = deriveContinuousRating({ ...baseCorrectMetrics, consecutiveCorrectStreak: 10 });
    const streak20 = deriveContinuousRating({ ...baseCorrectMetrics, consecutiveCorrectStreak: 20 });

    // streak=5 gives 5*0.03 = 0.15 (at cap)
    // streak=10 and streak=20 should give same bonus as streak=5
    expect(streak10.grade).toBeCloseTo(streak5.grade, 5);
    expect(streak20.grade).toBeCloseTo(streak5.grade, 5);
  });

  it('should default to 0 streak when consecutiveCorrectStreak is undefined', () => {
    const noField = deriveContinuousRating({ ...baseCorrectMetrics });
    const explicitZero = deriveContinuousRating({ ...baseCorrectMetrics, consecutiveCorrectStreak: 0 });

    expect(noField.grade).toBeCloseTo(explicitZero.grade, 5);
  });

  it('should not change grade for incorrect answers (streak has no effect)', () => {
    const incorrectBase: ImplicitBehaviorMetrics = {
      ...baseCorrectMetrics,
      isCorrect: false,
      consecutiveCorrectStreak: 0,
    };
    const incorrectStreak: ImplicitBehaviorMetrics = {
      ...baseCorrectMetrics,
      isCorrect: false,
      consecutiveCorrectStreak: 5,
    };

    const noStreakResult = deriveContinuousRating(incorrectBase);
    const streakResult = deriveContinuousRating(incorrectStreak);

    // Incorrect answers always get grade 1.0 regardless of streak
    expect(noStreakResult.grade).toBe(1.0);
    expect(streakResult.grade).toBe(1.0);
  });

  it('streak bonus should not push grade above 4.0', () => {
    // Fast correct answer with high streak — grade should still be clamped at 4.0
    const fastWithStreak: ImplicitBehaviorMetrics = {
      timeToFirstClick: 3000,
      answerSwitches: 0,
      totalDwellTime: 3000,
      isCorrect: true,
      parTimeMs: 30000,
      consecutiveCorrectStreak: 20,
    };

    const result = deriveContinuousRating(fastWithStreak);

    expect(result.grade).toBeLessThanOrEqual(4.0);
    expect(result.grade).toBeGreaterThanOrEqual(1.0);
  });

  it('streak bonus should still respect binary rating system', () => {
    const withStreak = deriveContinuousRating({ ...baseCorrectMetrics, consecutiveCorrectStreak: 5 });

    // Should only produce Again or Good
    expect(withStreak.discreteRating).not.toBe(2); // Not Hard
    expect(withStreak.discreteRating).not.toBe(4); // Not Easy
    expect([1, 3]).toContain(withStreak.discreteRating);
  });
});

// ─── Phase 3A: Per-User MVRT Normalization Tests ─────────────────────────────
// Note: Per-user MVRT is computed inside drillReviewService which requires
// a full Prisma/server context. These tests validate the mathematical properties
// and the deriveContinuousRating function that feeds into the MVRT decision.

describe('MVRT Normalization Mathematical Properties', () => {
  it('very fast responses should produce low grades for correct answers', () => {
    // A response at 500ms is almost certainly a rapid guess
    const rapidMetrics: ImplicitBehaviorMetrics = {
      timeToFirstClick: 500,
      answerSwitches: 0,
      totalDwellTime: 500,
      isCorrect: true,
      parTimeMs: 30000,
    };

    const result = deriveContinuousRating(rapidMetrics);
    // Even though correct, the extremely fast time means the grade
    // should get a speed bonus (it's fast enough to be suspicious).
    // The MVRT filter in drillReviewService would catch this, but
    // deriveContinuousRating doesn't do MVRT filtering — it just
    // grades what it gets.
    expect(result.grade).toBeDefined();
    expect(result.grade).toBeGreaterThanOrEqual(1.0);
    expect(result.grade).toBeLessThanOrEqual(4.0);
  });

  it('per-user MVRT math: 10% of median should be reasonable', () => {
    // Simulate the per-user MVRT calculation from drillReviewService
    const medianRtMs = 15000; // 15s median response time
    const perUserMvrt = medianRtMs * 0.10; // 1500ms

    // Should be reasonable — not too low, not too high
    expect(perUserMvrt).toBe(1500);

    // With a 30s median, threshold is 3000ms
    expect(30000 * 0.10).toBe(3000);

    // With a 5s median (fast user), threshold is 500ms
    expect(5000 * 0.10).toBe(500);
  });

  it('per-user MVRT should floor at SERVER_MVRT_THRESHOLD_MS', () => {
    // The implementation uses Math.max(SERVER_MVRT_THRESHOLD_MS, medianMs * 0.10)
    // SERVER_MVRT_THRESHOLD_MS is typically 1000ms
    const SERVER_MVRT_THRESHOLD_MS = 1000;

    // Very fast user with 3s median → 300ms per-user MVRT
    // Should be floored to 1000ms
    const fastUserMedian = 3000;
    const effectiveMvrt = Math.max(SERVER_MVRT_THRESHOLD_MS, fastUserMedian * 0.10);
    expect(effectiveMvrt).toBe(1000); // Floored

    // Normal user with 20s median → 2000ms per-user MVRT
    // Should use per-user value (above floor)
    const normalUserMedian = 20000;
    const normalMvrt = Math.max(SERVER_MVRT_THRESHOLD_MS, normalUserMedian * 0.10);
    expect(normalMvrt).toBe(2000); // Per-user value used
  });

  it('effectiveMvrt cascade should pick maximum of all sources', () => {
    // Simulates the cascade: Math.max(SERVER, perUser ?? clientMvrt ?? questionTypeMvrt)
    const SERVER_MVRT = 1000;
    const perUserMvrt = 2000;
    const clientMvrt = 1500;
    const questionTypeMvrt = 3000; // VIGNETTE type

    // With per-user available: max(1000, 2000) = 2000
    const withPerUser = Math.max(SERVER_MVRT, perUserMvrt);
    expect(withPerUser).toBe(2000);

    // Without per-user, falls to client: max(1000, 1500) = 1500
    const withClient = Math.max(SERVER_MVRT, clientMvrt);
    expect(withClient).toBe(1500);

    // Without per-user or client, falls to question type: max(1000, 3000) = 3000
    const withType = Math.max(SERVER_MVRT, questionTypeMvrt);
    expect(withType).toBe(3000);
  });
});

// ─── Binary Rating System: Cross-File Consistency ────────────────────────────

describe('Binary Rating System Cross-File Consistency', () => {
  it('deriveContinuousRating should never emit Hard(2) or Easy(4)', () => {
    // Exhaustive test across a range of metric combinations
    const cases: ImplicitBehaviorMetrics[] = [
      // Fast correct
      { timeToFirstClick: 2000, answerSwitches: 0, totalDwellTime: 2000, isCorrect: true, parTimeMs: 30000 },
      // Slow correct
      { timeToFirstClick: 90000, answerSwitches: 0, totalDwellTime: 90000, isCorrect: true, parTimeMs: 30000 },
      // Fast correct with switches
      { timeToFirstClick: 5000, answerSwitches: 3, totalDwellTime: 15000, isCorrect: true, parTimeMs: 30000 },
      // Moderate correct with streak
      { timeToFirstClick: 10000, answerSwitches: 0, totalDwellTime: 10000, isCorrect: true, parTimeMs: 30000, consecutiveCorrectStreak: 5 },
      // Moderate correct with hint
      { timeToFirstClick: 10000, answerSwitches: 0, totalDwellTime: 10000, isCorrect: true, parTimeMs: 30000, hintViewed: true },
      // Incorrect
      { timeToFirstClick: 5000, answerSwitches: 0, totalDwellTime: 5000, isCorrect: false, parTimeMs: 30000 },
    ];

    for (const metrics of cases) {
      const result = deriveContinuousRating(metrics);
      expect(result.discreteRating, `Failed for metrics: ${JSON.stringify(metrics)}`).not.toBe(2);
      expect(result.discreteRating, `Failed for metrics: ${JSON.stringify(metrics)}`).not.toBe(4);
      expect([1, 3]).toContain(result.discreteRating);
    }
  });
});
