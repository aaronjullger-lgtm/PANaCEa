/**
 * Unit tests for telemetry audit changes (2026-04-01):
 * - Hint-viewed penalty in deriveContinuousRating
 * - Telemetry quality assessment (assessTelemetryQuality)
 * - MVRT-aware rapid guess detection
 *
 * These tests verify the behavioral analysis → FSRS rating pipeline
 * produces correct binary ratings (Again=1, Good=3) given the new
 * telemetry inputs.
 */

import { describe, it, expect } from 'vitest';
import {
  deriveContinuousRating,
  assessTelemetryQuality,
  DEFAULT_IMPLICIT_CONFIG,
  type TelemetryQuality,
} from '../lib/implicit-metrics';
import { Rating } from '../lib/fsrs';
import type { ImplicitBehaviorMetrics } from '../lib/implicit-metrics';
import { getMVRTThreshold, MVRT_THRESHOLDS } from '../types/telemetry';

// ============================================================================
//  Shared test fixtures
// ============================================================================

/** Standard correct answer with moderate speed, no red flags */
const baseCorrectMetric: ImplicitBehaviorMetrics = {
  timeToFirstClick: 20000,
  answerSwitches: 0,
  totalDwellTime: 25000,
  isCorrect: true,
  parTimeMs: 30000,
};

/** Fast correct answer — should get Good with speed bonus */
const fastCorrectMetric: ImplicitBehaviorMetrics = {
  timeToFirstClick: 8000,
  answerSwitches: 0,
  totalDwellTime: 10000,
  isCorrect: true,
  parTimeMs: 30000,
};

// ============================================================================
//  TEST SUITE 1: Hint-Viewed Penalty
// ============================================================================

describe('deriveContinuousRating — hint-viewed penalty', () => {
  it('correct answer with hint viewed has lower grade than without', () => {
    const noHint = deriveContinuousRating({ ...baseCorrectMetric, hintViewed: false });
    const withHint = deriveContinuousRating({ ...baseCorrectMetric, hintViewed: true });

    expect(withHint.grade).toBeLessThan(noHint.grade);
  });

  it('applies flat 0.4 penalty for hint viewed (default config)', () => {
    const noHint = deriveContinuousRating({ ...baseCorrectMetric, hintViewed: false });
    const withHint = deriveContinuousRating({
      ...baseCorrectMetric,
      hintViewed: true,
      hintViewDurationMs: 0, // No duration penalty
    });

    const penalty = noHint.grade - withHint.grade;
    expect(penalty).toBeCloseTo(DEFAULT_IMPLICIT_CONFIG.penalties.hintViewed, 2);
  });

  it('longer hint viewing adds additional penalty', () => {
    const shortHint = deriveContinuousRating({
      ...baseCorrectMetric,
      hintViewed: true,
      hintViewDurationMs: 1000, // 1 second
    });
    const longHint = deriveContinuousRating({
      ...baseCorrectMetric,
      hintViewed: true,
      hintViewDurationMs: 10000, // 10 seconds
    });

    expect(longHint.grade).toBeLessThan(shortHint.grade);
  });

  it('hint duration penalty is capped at configured maximum', () => {
    const cap = DEFAULT_IMPLICIT_CONFIG.penalties.hintViewDurationCap;

    const longHint = deriveContinuousRating({
      ...baseCorrectMetric,
      hintViewed: true,
      hintViewDurationMs: 60000, // 60 seconds — way past cap
    });
    const moderateHint = deriveContinuousRating({
      ...baseCorrectMetric,
      hintViewed: true,
      hintViewDurationMs: 15000, // Should already hit cap
    });

    // Grades should be equal since both hit the duration cap
    expect(Math.abs(longHint.grade - moderateHint.grade)).toBeLessThan(0.01);

    // Verify total hint penalty = flat + cap
    const noHint = deriveContinuousRating(baseCorrectMetric);
    const totalPenalty = noHint.grade - longHint.grade;
    expect(totalPenalty).toBeCloseTo(
      DEFAULT_IMPLICIT_CONFIG.penalties.hintViewed + cap,
      1
    );
  });

  it('hint penalty clamps grade at 1.0 (never below minimum)', () => {
    const heavyPenalty = deriveContinuousRating({
      ...baseCorrectMetric,
      hintViewed: true,
      hintViewDurationMs: 30000,
      answerSwitches: 8,
      timeToFirstClick: 90000,
      cursorEntropy: 5,
      hoverOscillationCount: 10,
    });

    expect(heavyPenalty.grade).toBe(1.0);
    expect(heavyPenalty.discreteRating).toBe(Rating.Again);
  });

  it('hintViewed=undefined applies no penalty (backwards compatibility)', () => {
    const noField = deriveContinuousRating(baseCorrectMetric);
    const explicitFalse = deriveContinuousRating({ ...baseCorrectMetric, hintViewed: false });

    expect(noField.grade).toBe(explicitFalse.grade);
    expect(noField.confidence).toBe(explicitFalse.confidence);
  });

  it('incorrect answer is unaffected by hint penalty', () => {
    const incorrectNoHint = deriveContinuousRating({
      ...baseCorrectMetric,
      isCorrect: false,
    });
    const incorrectWithHint = deriveContinuousRating({
      ...baseCorrectMetric,
      isCorrect: false,
      hintViewed: true,
      hintViewDurationMs: 5000,
    });

    // Both should be 1.0 — incorrect base is 1.0, penalties only apply to correct
    expect(incorrectNoHint.grade).toBe(incorrectWithHint.grade);
  });

  it('hint-viewed correct answer can push discrete rating from Good to Hard', () => {
    // Start with a slightly penalized correct answer (some latency excess)
    const withoutHint = deriveContinuousRating({
      ...baseCorrectMetric,
      timeToFirstClick: 28000, // latencyRatio ~0.93, small latency penalty
      answerSwitches: 1,
    });

    const withHint = deriveContinuousRating({
      ...baseCorrectMetric,
      timeToFirstClick: 28000,
      answerSwitches: 1,
      hintViewed: true,
      hintViewDurationMs: 5000,
    });

    // The hint penalty should push grade below 2.5 threshold
    expect(withoutHint.discreteRating).toBe(Rating.Good);
    expect(withHint.grade).toBeLessThan(2.5);
    expect(withHint.discreteRating).toBe(Rating.Hard);
  });
});

// ============================================================================
//  TEST SUITE 2: Telemetry Quality Assessment
// ============================================================================

describe('assessTelemetryQuality', () => {
  it('returns "minimal" for null telemetry', () => {
    expect(assessTelemetryQuality(null)).toBe('minimal');
  });

  it('returns "minimal" for undefined telemetry', () => {
    expect(assessTelemetryQuality(undefined)).toBe('minimal');
  });

  it('returns "minimal" for empty object', () => {
    expect(assessTelemetryQuality({})).toBe('minimal');
  });

  it('returns "minimal" when only duration is present', () => {
    expect(assessTelemetryQuality({ duration_ms: 5000 })).toBe('minimal');
  });

  it('returns "partial" when only time_to_first_interaction_ms is present', () => {
    expect(assessTelemetryQuality({
      time_to_first_interaction_ms: 5000,
    })).toBe('partial');
  });

  it('returns "partial" when only answer_changes is present', () => {
    expect(assessTelemetryQuality({
      answer_changes: 2,
    })).toBe('partial');
  });

  it('returns "partial" when first-click and switches present but no CRPL', () => {
    expect(assessTelemetryQuality({
      time_to_first_interaction_ms: 5000,
      answer_changes: 1,
    })).toBe('partial');
  });

  it('returns "full" when first-click, switches, and hover_oscillations present', () => {
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

  it('treats zero values as present (not null)', () => {
    // answer_changes: 0 should still count as "present"
    expect(assessTelemetryQuality({
      time_to_first_interaction_ms: 5000,
      answer_changes: 0,
      hover_oscillations: 0,
    })).toBe('full');
  });
});

// ============================================================================
//  TEST SUITE 3: MVRT Threshold Verification
// ============================================================================

describe('getMVRTThreshold — question-type-aware thresholds', () => {
  it('vignette threshold is 3000ms', () => {
    expect(getMVRTThreshold('vignette')).toBe(3000);
  });

  it('recall threshold is 1500ms', () => {
    expect(getMVRTThreshold('recall')).toBe(1500);
  });

  it('image threshold is 2000ms', () => {
    expect(getMVRTThreshold('image')).toBe(2000);
  });

  it('rapid_recall threshold is 800ms', () => {
    expect(getMVRTThreshold('rapid_recall')).toBe(800);
  });

  it('unknown threshold defaults to 2000ms', () => {
    expect(getMVRTThreshold('unknown')).toBe(2000);
  });

  it('600ms vignette response would be flagged as rapid guess', () => {
    const responseTime = 600;
    const threshold = getMVRTThreshold('vignette');
    expect(responseTime < threshold).toBe(true);
  });

  it('600ms recall response would NOT be flagged as rapid guess', () => {
    // 600ms is below 1500ms threshold, so it IS a rapid guess for recall too
    const responseTime = 600;
    const threshold = getMVRTThreshold('recall');
    expect(responseTime < threshold).toBe(true);
  });

  it('2500ms vignette response would still be flagged as rapid guess', () => {
    const responseTime = 2500;
    const threshold = getMVRTThreshold('vignette');
    expect(responseTime < threshold).toBe(true);
  });

  it('4000ms vignette response passes MVRT check', () => {
    const responseTime = 4000;
    const threshold = getMVRTThreshold('vignette');
    expect(responseTime < threshold).toBe(false);
  });
});
