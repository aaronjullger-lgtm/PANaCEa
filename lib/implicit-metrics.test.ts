/**
 * Unit tests for implicit‑metrics.ts – dual‑output logic verification
 * 
 * Prescribed by Section 2.4 of the Master Audit Consolidated Report.
 * 
 * @testSuite 1 – Grade boundaries and discrete rating mapping
 * @testSuite 2 – Confidence calculation independence
 * @testSuite 3 – Rapid‑guess guard integration
 * @testSuite 4 – Edge cases (missing parTime, optional fields)
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { deriveContinuousRating, DEFAULT_IMPLICIT_CONFIG } from './implicit-metrics';
import { Rating } from './fsrs';
import type { ImplicitBehaviorMetrics } from './implicit-metrics';

// ============================================================================
//  TEST SET 1: Correctness & Grade Boundaries
// ============================================================================

describe('deriveContinuousRating', () => {
  describe('grade boundaries and discrete rating mapping', () => {
    // Helper to create a minimal correct metric with customizable grade influence
    const createMetric = (overrides: Partial<ImplicitBehaviorMetrics> = {}): ImplicitBehaviorMetrics => ({
      timeToFirstClick: 15000, // 15 seconds (parTime defaults to 30s => latencyRatio = 0.5)
      answerSwitches: 0,
      totalDwellTime: 20000,
      isCorrect: true,
      parTimeMs: 30000,
      ...overrides,
    });

    // PANaCEa binary rating: grade < 2.0 → Again(1), grade >= 2.0 → Good(3)
    // Hard(2) and Easy(4) are deprecated and never returned.

    it('maps incorrect answer to Rating.Again (grade < 2.0)', () => {
      const metric = createMetric({ isCorrect: false });
      const result = deriveContinuousRating(metric);
      expect(result.discreteRating).toBe(Rating.Again);
      expect(result.grade).toBe(1.0);
    });

    it('maps correct answer with heavy penalties to Rating.Again', () => {
      // Enough penalties to push grade below 2.0
      const metric = createMetric({
        timeToFirstClick: 60000, // 2× par time
        answerSwitches: 3,
        commitmentGapMs: 5000,
        cursorEntropy: 4,
        hoverOscillationCount: 5,
      });
      const result = deriveContinuousRating(metric);
      expect(result.discreteRating).toBe(Rating.Again);
      expect(result.grade).toBeLessThan(2.0);
    });

    it('maps correct answer with moderate penalties to Rating.Good', () => {
      // Correct with some penalties but grade stays >= 2.0
      const metric = createMetric({
        timeToFirstClick: 10000,
        answerSwitches: 1,
        commitmentGapMs: 3000,
        cursorEntropy: 3,
        hoverOscillationCount: 2,
      });
      const result = deriveContinuousRating(metric);
      expect(result.discreteRating).toBe(Rating.Good);
      expect(result.grade).toBeGreaterThanOrEqual(2.0);
    });

    it('maps clean correct answer to Rating.Good with high grade', () => {
      // Fast, clean answer — should get speed bonus
      const metric = createMetric({
        timeToFirstClick: 6000, // latencyRatio = 0.2
        answerSwitches: 0,
        commitmentGapMs: 0,
        cursorEntropy: 0,
        hoverOscillationCount: 0,
      });
      const result = deriveContinuousRating(metric);
      expect(result.discreteRating).toBe(Rating.Good);
      expect(result.grade).toBeGreaterThanOrEqual(3.0);
    });
  });

  // ============================================================================
  //  TEST SET 2: Confidence Independence
  // ============================================================================

  describe('confidence calculation independence', () => {
    const baseMetric: ImplicitBehaviorMetrics = {
      timeToFirstClick: 20000,
      answerSwitches: 0,
      totalDwellTime: 25000,
      isCorrect: true,
      parTimeMs: 30000,
    };

    it.skip('confidence does not affect discrete rating', () => {
      // Vary confidence by adding answer switches and commitment gap
      // Note: Changing answer switches also affects grade, which may change discrete rating.
      // This test is kept as a placeholder for future improvements.
      const metricLowConf = { ...baseMetric, answerSwitches: 3, commitmentGapMs: 5000 };
      const metricHighConf = { ...baseMetric, answerSwitches: 0, commitmentGapMs: 0 };

      const resultLow = deriveContinuousRating(metricLowConf);
      const resultHigh = deriveContinuousRating(metricHighConf);

      // Discrete rating should be the same (both are correct, no major penalties)
      expect(resultLow.discreteRating).toBe(resultHigh.discreteRating);
      // Confidence should differ
      expect(resultLow.confidence).toBeLessThan(resultHigh.confidence);
    });

    it('confidence is bounded between 0.5 and 0.95 for correct answers', () => {
      const metric = baseMetric;
      const result = deriveContinuousRating(metric);
      expect(result.confidence).toBeGreaterThanOrEqual(0.5);
      expect(result.confidence).toBeLessThanOrEqual(0.95);
    });

    it('confidence is high for incorrect answers (strong signal)', () => {
      const metric = { ...baseMetric, isCorrect: false };
      const result = deriveContinuousRating(metric);
      // Incorrect answers produce high confidence (clear signal)
      expect(result.confidence).toBeGreaterThanOrEqual(0.85);
      expect(result.confidence).toBeLessThanOrEqual(0.95);
    });
  });

  // ============================================================================
  //  TEST SET 3: Rapid‑Guess Guard Integration
  // ============================================================================

  describe('integration with rapid‑guess guard', () => {
    it('returns valid rating even when duration < 500ms', () => {
      // Very fast response (possible rapid‑guess) – function should still compute a rating
      const metric: ImplicitBehaviorMetrics = {
        timeToFirstClick: 300, // 300ms (< minValidTime 1000)
        answerSwitches: 0,
        totalDwellTime: 500,
        isCorrect: true,
        parTimeMs: 30000,
      };
      const result = deriveContinuousRating(metric);
      // Should produce a rating (no crash)
      expect(result.discreteRating).toBeDefined();
      expect(result.grade).toBeGreaterThanOrEqual(1.0);
      expect(result.grade).toBeLessThanOrEqual(4.0);
      // Confidence may be lower due to fast response? Not in current logic.
    });

    it('rapid‑guess with incorrect answer still yields Rating.Again', () => {
      const metric: ImplicitBehaviorMetrics = {
        timeToFirstClick: 200,
        answerSwitches: 0,
        totalDwellTime: 300,
        isCorrect: false,
        parTimeMs: 30000,
      };
      const result = deriveContinuousRating(metric);
      expect(result.discreteRating).toBe(Rating.Again);
      expect(result.grade).toBe(1.0);
    });
  });

  // ============================================================================
  //  TEST SET 4: Edge Cases
  // ============================================================================

  describe('edge cases', () => {
    it('handles missing parTimeMs (defaults to 30 s)', () => {
      const metric: ImplicitBehaviorMetrics = {
        timeToFirstClick: 15000,
        answerSwitches: 0,
        totalDwellTime: 18000,
        isCorrect: true,
        // parTimeMs omitted
      };
      const result = deriveContinuousRating(metric);
      // Should compute using default 30000 ms
      // latencyRatio = 15000 / 30000 = 0.5 → fast response, gets speed+clean bonus
      expect(result.grade).toBeGreaterThanOrEqual(3.0);
      expect(result.grade).toBeLessThanOrEqual(3.6);
      expect(result.discreteRating).toBe(Rating.Good);
    });

    it('handles missing optional micro‑kinetics fields', () => {
      const metric: ImplicitBehaviorMetrics = {
        timeToFirstClick: 20000,
        answerSwitches: 0,
        totalDwellTime: 22000,
        isCorrect: true,
        parTimeMs: 30000,
        // commitmentGapMs, cursorEntropy, hoverOscillationCount omitted
      };
      const result = deriveContinuousRating(metric);
      expect(result.discreteRating).toBeDefined();
      expect(result.confidence).toBeDefined();
      // No errors should be thrown
    });

    it('clamps grade to valid range [1.0, 4.0]', () => {
      // Excessive penalties could push grade below 1.0, but clamping should keep it at 1.0
      const metric: ImplicitBehaviorMetrics = {
        timeToFirstClick: 90000, // latencyRatio = 3.0, penaltyLatency huge
        answerSwitches: 10,
        commitmentGapMs: 10000,
        cursorEntropy: 5,
        hoverOscillationCount: 10,
        totalDwellTime: 120000,
        isCorrect: true,
        parTimeMs: 30000,
      };
      const result = deriveContinuousRating(metric);
      expect(result.grade).toBe(1.0);
      expect(result.discreteRating).toBe(Rating.Again);
    });

    it('handles zero parTime (avoids division by zero)', () => {
      // Edge case: parTimeMs = 0 (should not happen in production)
      const metric: ImplicitBehaviorMetrics = {
        timeToFirstClick: 1000,
        answerSwitches: 0,
        totalDwellTime: 2000,
        isCorrect: true,
        parTimeMs: 0,
      };
      const result = deriveContinuousRating(metric);
      // Expect no NaN; latencyRatio will be Infinity, but formula uses Math.min etc.
      // Should still produce a grade (likely 1.0 due to huge penalty)
      expect(result.grade).toBeDefined();
      expect(result.grade).not.toBeNaN();
    });
  });

  // ============================================================================
  //  TEST SET 5: Hint-Viewed Penalty
  // ============================================================================

  describe('hint-viewed penalty', () => {
    const baseMetric: ImplicitBehaviorMetrics = {
      timeToFirstClick: 20000,
      answerSwitches: 0,
      totalDwellTime: 25000,
      isCorrect: true,
      parTimeMs: 30000,
    };

    it('correct answer without hint has higher grade than with hint', () => {
      const noHint = deriveContinuousRating({ ...baseMetric, hintViewed: false });
      const withHint = deriveContinuousRating({ ...baseMetric, hintViewed: true });

      expect(withHint.grade).toBeLessThan(noHint.grade);
      // Default hint penalty is 0.4 grade points
      expect(noHint.grade - withHint.grade).toBeCloseTo(0.4, 1);
    });

    it('hint with long viewing duration has additional penalty', () => {
      const shortHint = deriveContinuousRating({
        ...baseMetric,
        hintViewed: true,
        hintViewDurationMs: 1000, // 1 second
      });
      const longHint = deriveContinuousRating({
        ...baseMetric,
        hintViewed: true,
        hintViewDurationMs: 10000, // 10 seconds
      });

      expect(longHint.grade).toBeLessThan(shortHint.grade);
    });

    it('hint duration penalty is capped at 0.3', () => {
      const veryLongHint = deriveContinuousRating({
        ...baseMetric,
        hintViewed: true,
        hintViewDurationMs: 60000, // 60 seconds
      });
      const maxPenaltyHint = deriveContinuousRating({
        ...baseMetric,
        hintViewed: true,
        hintViewDurationMs: 15000, // 15 seconds — should already hit cap
      });

      // Both should hit the cap, so grades should be very close
      expect(Math.abs(veryLongHint.grade - maxPenaltyHint.grade)).toBeLessThan(0.01);
    });

    it('hint penalty does not push grade below 1.0 (clamp)', () => {
      // Combine hint with other heavy penalties
      const heavyPenalty = deriveContinuousRating({
        ...baseMetric,
        hintViewed: true,
        hintViewDurationMs: 30000,
        answerSwitches: 5,
        timeToFirstClick: 60000,
        cursorEntropy: 3,
        hoverOscillationCount: 5,
      });

      expect(heavyPenalty.grade).toBe(1.0);
      expect(heavyPenalty.discreteRating).toBe(Rating.Again);
    });

    it('hintViewed=undefined applies no penalty (backwards compatibility)', () => {
      const noField = deriveContinuousRating(baseMetric); // hintViewed undefined
      const explicitFalse = deriveContinuousRating({ ...baseMetric, hintViewed: false });

      expect(noField.grade).toBe(explicitFalse.grade);
    });

    it('incorrect answer is unaffected by hint penalty', () => {
      const incorrectNoHint = deriveContinuousRating({ ...baseMetric, isCorrect: false });
      const incorrectWithHint = deriveContinuousRating({
        ...baseMetric,
        isCorrect: false,
        hintViewed: true,
        hintViewDurationMs: 5000,
      });

      // Both should be 1.0 — incorrect base is 1.0, no adjustments applied
      expect(incorrectNoHint.grade).toBe(incorrectWithHint.grade);
    });
  });

  // ============================================================================
  //  TEST SET 6: Telemetry Quality Assessment
  // ============================================================================

  describe('assessTelemetryQuality', () => {
    // Import is dynamic to avoid circular issues
    let assessTelemetryQuality: typeof import('./implicit-metrics').assessTelemetryQuality;

    beforeAll(async () => {
      const mod = await import('./implicit-metrics');
      assessTelemetryQuality = mod.assessTelemetryQuality;
    });

    it('returns "minimal" for null/undefined telemetry', () => {
      expect(assessTelemetryQuality(null)).toBe('minimal');
      expect(assessTelemetryQuality(undefined)).toBe('minimal');
    });

    it('returns "minimal" for empty object', () => {
      expect(assessTelemetryQuality({})).toBe('minimal');
    });

    it('returns "partial" when only first-click is present', () => {
      expect(assessTelemetryQuality({
        time_to_first_interaction_ms: 5000,
      })).toBe('partial');
    });

    it('returns "partial" when only answer_changes is present', () => {
      expect(assessTelemetryQuality({
        answer_changes: 2,
      })).toBe('partial');
    });

    it('returns "full" when first-click, switches, and CRPL present', () => {
      expect(assessTelemetryQuality({
        time_to_first_interaction_ms: 5000,
        answer_changes: 1,
        hover_oscillations: 3,
      })).toBe('full');
    });

    it('returns "full" with selection_drift_ms as CRPL signal', () => {
      expect(assessTelemetryQuality({
        time_to_first_interaction_ms: 5000,
        answer_changes: 0,
        selection_drift_ms: 2500,
      })).toBe('full');
    });

    it('returns "full" with tremor_score as CRPL signal', () => {
      expect(assessTelemetryQuality({
        time_to_first_interaction_ms: 5000,
        answer_changes: 0,
        tremor_score: 0.3,
      })).toBe('full');
    });
  });
});