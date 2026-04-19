import { describe, it, expect } from 'vitest';
import {
  applyHonestRating,
  applyHonestRatingWithDetail,
  GHOST_GRADER_CONSTANTS,
  type GhostGraderBaseline,
  type GhostGraderInput,
} from '../lib/srs/ghostGrader';
import { Rating } from '../lib/fsrs';

// ─── Fixtures ────────────────────────────────────────────────────────────────

/** A "clean" input: correct, Good rating, no indecision signals, fast response. */
const CLEAN_INPUT: GhostGraderInput = {
  userRating: Rating.Good,
  isCorrect: true,
  oscillations: 0,
  vignetteRegressions: 0,
  selectionDriftMs: 500,
  tremorScore: 0.1,
  latencyRatio: 0.6,
  hintViewed: false,
};

/** A user baseline with measurable variance. */
const BASELINE: GhostGraderBaseline = {
  oscillationMedian: 1.0,
  oscillationStdDev: 0.5,
  tremorMedian: 0.1,
  tremorStdDev: 0.1,
  driftMedianMs: 800,
  driftStdDevMs: 400,
};

// ─── Neutral / short-circuit cases ──────────────────────────────────────────

describe('applyHonestRatingWithDetail — neutral cases', () => {
  it('returns neutral on incorrect answers (FSRS already handles via Again)', () => {
    const result = applyHonestRatingWithDetail({
      ...CLEAN_INPUT,
      isCorrect: false,
      oscillations: 10, // even with massive indecision
    });
    expect(result.rule).toBe('none');
    expect(result.rating).toBe(Rating.Good);
    expect(result.gradeContinuousAdjustment).toBe(0);
  });

  it('returns neutral when userRating is already Again', () => {
    const result = applyHonestRatingWithDetail({
      ...CLEAN_INPUT,
      userRating: Rating.Again,
    });
    expect(result.rule).toBe('none');
    expect(result.rating).toBe(Rating.Again);
    expect(result.gradeContinuousAdjustment).toBe(0);
  });
});

// ─── Indecision path (absolute thresholds, no baseline) ─────────────────────

describe('applyHonestRatingWithDetail — indecision (absolute thresholds)', () => {
  it('fires on oscillations > 2 (strict)', () => {
    // oscillations=3 > 2 → fires
    const result = applyHonestRatingWithDetail({ ...CLEAN_INPUT, oscillations: 3 });
    expect(result.rating).toBe(Rating.Again);
    expect(result.rule).toBe('indecision');
    expect(result.indecisionSignalCount).toBe(1);
    expect(result.gradeContinuousAdjustment).toBe(-99); // signal to cap
  });

  it('does NOT fire on oscillations = 2 (strictly greater-than)', () => {
    // oscillations=2 NOT > 2 → does not fire
    const result = applyHonestRatingWithDetail({ ...CLEAN_INPUT, oscillations: 2 });
    expect(result.rule).not.toBe('indecision');
    expect(result.rating).toBe(Rating.Good);
  });

  it('fires on selectionDriftMs > 3000', () => {
    const result = applyHonestRatingWithDetail({ ...CLEAN_INPUT, selectionDriftMs: 3500 });
    expect(result.rating).toBe(Rating.Again);
    expect(result.rule).toBe('indecision');
  });

  it('does NOT fire on selectionDriftMs = 3000 (strict)', () => {
    const result = applyHonestRatingWithDetail({ ...CLEAN_INPUT, selectionDriftMs: 3000 });
    expect(result.rule).not.toBe('indecision');
  });

  it('fires on tremorScore >= 0.6', () => {
    const result = applyHonestRatingWithDetail({ ...CLEAN_INPUT, tremorScore: 0.7 });
    expect(result.rating).toBe(Rating.Again);
    expect(result.rule).toBe('indecision');
  });

  it('counts vignetteRegressions into effective oscillations (capped at +2)', () => {
    // oscillations=1, vignetteRegressions=2 → effective=3 > 2 → fires
    const result = applyHonestRatingWithDetail({
      ...CLEAN_INPUT,
      oscillations: 1,
      vignetteRegressions: 2,
    });
    expect(result.rule).toBe('indecision');
  });

  it('caps vignetteRegressions contribution at 2', () => {
    // oscillations=0, vignetteRegressions=100 → effective=0+2=2, NOT > 2 → does not fire
    const result = applyHonestRatingWithDetail({
      ...CLEAN_INPUT,
      oscillations: 0,
      vignetteRegressions: 100,
    });
    expect(result.rule).not.toBe('indecision');
  });

  it('counts multiple signals when multiple triggers fire', () => {
    const result = applyHonestRatingWithDetail({
      ...CLEAN_INPUT,
      oscillations: 5,
      selectionDriftMs: 5000,
      tremorScore: 0.8,
    });
    expect(result.rule).toBe('indecision');
    expect(result.indecisionSignalCount).toBe(3);
  });
});

// ─── Indecision path (z-score thresholds with baseline) ─────────────────────

describe('applyHonestRatingWithDetail — indecision (z-score with baseline)', () => {
  it('fires when oscillation z-score > 2.0', () => {
    // oscillations=3, median=1.0, stdDev=0.5 → z=(3-1)/0.5=4.0 > 2.0 ✓
    const result = applyHonestRatingWithDetail({
      ...CLEAN_INPUT,
      oscillations: 3,
      baseline: BASELINE,
    });
    expect(result.rating).toBe(Rating.Again);
    expect(result.rule).toBe('indecision');
  });

  it('does NOT fire when oscillation z-score = 2.0 (strict)', () => {
    // oscillations=2, median=1.0, stdDev=0.5 → z=(2-1)/0.5=2.0 NOT > 2.0
    const result = applyHonestRatingWithDetail({
      ...CLEAN_INPUT,
      oscillations: 2,
      baseline: BASELINE,
    });
    expect(result.rule).not.toBe('indecision');
  });

  it('fires when drift z-score > 2.0', () => {
    // drift=2000, median=800, stdDev=400 → z=(2000-800)/400=3.0 > 2.0 ✓
    const result = applyHonestRatingWithDetail({
      ...CLEAN_INPUT,
      selectionDriftMs: 2000,
      baseline: BASELINE,
    });
    expect(result.rule).toBe('indecision');
  });

  it('fires when tremor z-score > 2.0', () => {
    // tremor=0.4, median=0.1, stdDev=0.1 → z=(0.4-0.1)/0.1=3.0 > 2.0 ✓
    const result = applyHonestRatingWithDetail({
      ...CLEAN_INPUT,
      tremorScore: 0.4,
      baseline: BASELINE,
    });
    expect(result.rule).toBe('indecision');
  });

  it('falls back to absolute threshold when baseline stdDev is 0', () => {
    const zeroVarBaseline: GhostGraderBaseline = {
      ...BASELINE,
      oscillationStdDev: 0,
    };
    // oscillations=3 > absolute threshold 2 → fires via fallback
    const result = applyHonestRatingWithDetail({
      ...CLEAN_INPUT,
      oscillations: 3,
      baseline: zeroVarBaseline,
    });
    expect(result.rule).toBe('indecision');
  });
});

// ─── Hint-assisted path ─────────────────────────────────────────────────────

describe('applyHonestRatingWithDetail — hint-assisted', () => {
  it('keeps rating but penalizes grade_continuous when hint viewed', () => {
    const result = applyHonestRatingWithDetail({
      ...CLEAN_INPUT,
      hintViewed: true,
      hintDurationMs: 3000,
    });
    expect(result.rule).toBe('hint_assisted');
    expect(result.rating).toBe(Rating.Good); // NOT forced to Again
    expect(result.gradeContinuousAdjustment).toBeCloseTo(-0.20, 5);
  });

  it('applies heavier penalty (-0.30) for long hint views (>= 10s)', () => {
    const result = applyHonestRatingWithDetail({
      ...CLEAN_INPUT,
      hintViewed: true,
      hintDurationMs: 12_000,
    });
    expect(result.rule).toBe('hint_assisted');
    // HINT_PENALTY_AMOUNT * 1.5 = 0.20 * 1.5 = 0.30
    expect(result.gradeContinuousAdjustment).toBeCloseTo(-0.30, 5);
  });

  it('blocks confidence boost even when all other signals are clean', () => {
    const result = applyHonestRatingWithDetail({
      ...CLEAN_INPUT,
      hintViewed: true,
      hintDurationMs: 2000,
    });
    expect(result.confidenceBoostEligible).toBe(false);
    expect(result.rule).not.toBe('confidence_boost');
  });

  it('indecision overrides hint-assisted (checked first)', () => {
    const result = applyHonestRatingWithDetail({
      ...CLEAN_INPUT,
      oscillations: 5,
      hintViewed: true,
    });
    expect(result.rule).toBe('indecision');
    expect(result.rating).toBe(Rating.Again);
  });
});

// ─── Confidence boost path ──────────────────────────────────────────────────

describe('applyHonestRatingWithDetail — confidence boost', () => {
  it('lifts grade by +0.25 when all signals clean + fast response', () => {
    const result = applyHonestRatingWithDetail(CLEAN_INPUT);
    expect(result.rule).toBe('confidence_boost');
    expect(result.confidenceBoostEligible).toBe(true);
    expect(result.gradeContinuousAdjustment).toBeCloseTo(0.25, 5);
  });

  it('does NOT boost when latency ratio is missing', () => {
    const result = applyHonestRatingWithDetail({
      ...CLEAN_INPUT,
      latencyRatio: undefined,
    });
    expect(result.rule).not.toBe('confidence_boost');
    expect(result.confidenceBoostEligible).toBe(false);
  });

  it('does NOT boost when latency ratio >= 0.8', () => {
    const result = applyHonestRatingWithDetail({ ...CLEAN_INPUT, latencyRatio: 0.9 });
    expect(result.confidenceBoostEligible).toBe(false);
  });

  it('does NOT boost when oscillations > 0', () => {
    const result = applyHonestRatingWithDetail({ ...CLEAN_INPUT, oscillations: 1 });
    expect(result.confidenceBoostEligible).toBe(false);
  });

  it('does NOT boost when tremor >= 0.2 (calm ceiling)', () => {
    const result = applyHonestRatingWithDetail({ ...CLEAN_INPUT, tremorScore: 0.25 });
    expect(result.confidenceBoostEligible).toBe(false);
  });

  it('allows boost when selectionDriftMs is null (immediate submit)', () => {
    const result = applyHonestRatingWithDetail({ ...CLEAN_INPUT, selectionDriftMs: null });
    expect(result.confidenceBoostEligible).toBe(true);
  });

  it('does NOT boost when selectionDriftMs >= 1000', () => {
    const result = applyHonestRatingWithDetail({ ...CLEAN_INPUT, selectionDriftMs: 1500 });
    expect(result.confidenceBoostEligible).toBe(false);
  });
});

// ─── Elimination velocity ───────────────────────────────────────────────────

describe('applyHonestRatingWithDetail — elimination velocity', () => {
  it('adds +0.15 elimination boost for fast elimination (>= 0.8/s)', () => {
    // Use a non-boost-eligible input so elimination_boost becomes primary rule
    const result = applyHonestRatingWithDetail({
      ...CLEAN_INPUT,
      latencyRatio: 1.0, // blocks confidence boost
      eliminationVelocity: 1.0,
      optionCount: 4,
    });
    expect(result.rule).toBe('elimination_boost');
    expect(result.gradeContinuousAdjustment).toBeCloseTo(0.15, 5);
  });

  it('stacks elimination boost on top of confidence boost (+0.25 + +0.15)', () => {
    const result = applyHonestRatingWithDetail({
      ...CLEAN_INPUT,
      eliminationVelocity: 1.0,
      optionCount: 4,
    });
    // Rule stays as confidence_boost (first-set wins); adjustment stacks
    expect(result.rule).toBe('confidence_boost');
    expect(result.gradeContinuousAdjustment).toBeCloseTo(0.40, 5);
  });

  it('applies -0.10 penalty for absent elimination (< 0.2/s) when not boost-eligible', () => {
    const result = applyHonestRatingWithDetail({
      ...CLEAN_INPUT,
      latencyRatio: 1.0, // blocks confidence boost
      eliminationVelocity: 0.1,
      optionCount: 4,
    });
    expect(result.rule).toBe('elimination_penalty');
    expect(result.gradeContinuousAdjustment).toBeCloseTo(-0.10, 5);
  });

  it('does NOT penalize slow elimination when boost-eligible', () => {
    // Boost eligible + slow elimination → boost wins, no elimination penalty applied
    const result = applyHonestRatingWithDetail({
      ...CLEAN_INPUT,
      eliminationVelocity: 0.05,
      optionCount: 4,
    });
    expect(result.gradeContinuousAdjustment).toBeCloseTo(0.25, 5);
    expect(result.rule).toBe('confidence_boost');
  });

  it('ignores elimination signal when optionCount < 3', () => {
    const result = applyHonestRatingWithDetail({
      ...CLEAN_INPUT,
      latencyRatio: 1.0,
      eliminationVelocity: 1.0,
      optionCount: 2,
    });
    expect(result.gradeContinuousAdjustment).toBe(0);
    expect(result.rule).toBe('none');
  });

  it('ignores elimination signal when velocity is undefined', () => {
    const result = applyHonestRatingWithDetail({
      ...CLEAN_INPUT,
      latencyRatio: 1.0,
      eliminationVelocity: undefined,
      optionCount: 4,
    });
    expect(result.gradeContinuousAdjustment).toBe(0);
  });
});

// ─── applyHonestRating convenience wrapper ──────────────────────────────────

describe('applyHonestRating (convenience wrapper)', () => {
  it('returns the rating from the detailed result', () => {
    const rating = applyHonestRating({ ...CLEAN_INPUT, oscillations: 10 });
    expect(rating).toBe(Rating.Again);
  });

  it('preserves Good for clean input', () => {
    expect(applyHonestRating(CLEAN_INPUT)).toBe(Rating.Good);
  });
});

// ─── Exported constants ─────────────────────────────────────────────────────

describe('GHOST_GRADER_CONSTANTS', () => {
  it('exports all expected thresholds with documented values', () => {
    expect(GHOST_GRADER_CONSTANTS.SELECTION_DRIFT_THRESHOLD_MS).toBe(3000);
    expect(GHOST_GRADER_CONSTANTS.OSCILLATION_THRESHOLD).toBe(2);
    expect(GHOST_GRADER_CONSTANTS.TREMOR_THRESHOLD).toBe(0.6);
    expect(GHOST_GRADER_CONSTANTS.Z_SCORE_THRESHOLD).toBe(2.0);
    expect(GHOST_GRADER_CONSTANTS.BOOST_LATENCY_RATIO_MAX).toBe(0.8);
    expect(GHOST_GRADER_CONSTANTS.CONFIDENCE_BOOST_AMOUNT).toBe(0.25);
    expect(GHOST_GRADER_CONSTANTS.HINT_PENALTY_AMOUNT).toBe(0.20);
    expect(GHOST_GRADER_CONSTANTS.HINT_LONG_VIEW_MS).toBe(10_000);
  });
});
