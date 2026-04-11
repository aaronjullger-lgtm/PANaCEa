import { describe, it, expect } from 'vitest';
import {
  applyHonestRating,
  applyHonestRatingWithDetail,
  GHOST_GRADER_CONSTANTS,
  type GhostGraderInput,
  type GhostGraderBaseline,
} from '@/lib/srs/ghostGrader';
import { Rating } from '@/lib/fsrs';

const C = GHOST_GRADER_CONSTANTS;

/**
 * Ghost Grader tests — PANaCEa's implicit rating competitive moat.
 *
 * Tests cover all 4 paths:
 * 1. DOWNGRADE: indecision signals → Again
 * 2. HINT-ASSISTED: hint viewed → penalize grade_continuous
 * 3. BOOST: all clean signals → lift grade_continuous
 * 4. NEUTRAL: no signals fire → pass through
 * Plus edge cases, z-score normalization, and elimination velocity.
 */

describe('Ghost Grader — applyHonestRating', () => {
  const cleanInput: GhostGraderInput = {
    userRating: Rating.Good,
    isCorrect: true,
    oscillations: 0,
    vignetteRegressions: 0,
    selectionDriftMs: 500,
    tremorScore: 0.1,
    latencyRatio: 0.5,
  };

  it('passes through rating for incorrect answers (no adjustment)', () => {
    expect(applyHonestRating({ ...cleanInput, isCorrect: false })).toBe(Rating.Good);
  });

  it('passes through rating when already Again', () => {
    expect(applyHonestRating({ ...cleanInput, userRating: Rating.Again })).toBe(Rating.Again);
  });

  it('passes through rating with all clean signals', () => {
    expect(applyHonestRating(cleanInput)).toBe(Rating.Good);
  });

  // ── DOWNGRADE PATH ──

  it('downgrades to Again when oscillations exceed threshold', () => {
    expect(
      applyHonestRating({
        ...cleanInput,
        oscillations: C.OSCILLATION_THRESHOLD + 1, // 3
      })
    ).toBe(Rating.Again);
  });

  it('downgrades to Again when selection drift exceeds threshold', () => {
    expect(
      applyHonestRating({
        ...cleanInput,
        selectionDriftMs: C.SELECTION_DRIFT_THRESHOLD_MS + 1, // 3001ms
      })
    ).toBe(Rating.Again);
  });

  it('downgrades to Again when tremor score exceeds threshold', () => {
    expect(
      applyHonestRating({
        ...cleanInput,
        tremorScore: C.TREMOR_THRESHOLD, // 0.6
      })
    ).toBe(Rating.Again);
  });

  it('downgrades to Again when vignette regressions add up with oscillations', () => {
    // oscillations=1 + vignetteRegressions=2 = effectiveOscillations=3 > threshold(2)
    expect(
      applyHonestRating({
        ...cleanInput,
        oscillations: 1,
        vignetteRegressions: 2,
      })
    ).toBe(Rating.Again);
  });

  // ── HINT-ASSISTED PATH ──

  it('keeps rating but applies hint penalty when hint was viewed', () => {
    const result = applyHonestRatingWithDetail({
      ...cleanInput,
      hintViewed: true,
      hintDurationMs: 3000,
    });
    expect(result.rating).toBe(Rating.Good); // not downgraded to Again
    expect(result.rule).toBe('hint_assisted');
    expect(result.gradeContinuousAdjustment).toBe(-C.HINT_PENALTY_AMOUNT);
  });

  it('applies heavier hint penalty for long hint views', () => {
    const result = applyHonestRatingWithDetail({
      ...cleanInput,
      hintViewed: true,
      hintDurationMs: C.HINT_LONG_VIEW_MS + 1000, // 11s
    });
    expect(result.rating).toBe(Rating.Good);
    expect(result.gradeContinuousAdjustment).toBe(-C.HINT_PENALTY_AMOUNT * 1.5);
  });

  // ── BOOST PATH ──

  it('applies confidence boost when all signals are clean and fast', () => {
    const result = applyHonestRatingWithDetail({
      ...cleanInput,
      oscillations: 0,
      vignetteRegressions: 0,
      selectionDriftMs: 500, // < 1000ms
      tremorScore: 0.1, // < 0.2
      latencyRatio: 0.5, // < 0.8
    });
    expect(result.rating).toBe(Rating.Good);
    expect(result.confidenceBoostEligible).toBe(true);
    expect(result.gradeContinuousAdjustment).toBe(C.CONFIDENCE_BOOST_AMOUNT);
    expect(result.rule).toBe('confidence_boost');
  });

  it('does NOT boost when latency ratio is too high', () => {
    const result = applyHonestRatingWithDetail({
      ...cleanInput,
      latencyRatio: 0.9, // > 0.8
    });
    expect(result.confidenceBoostEligible).toBe(false);
  });

  it('does NOT boost when drift is too slow', () => {
    const result = applyHonestRatingWithDetail({
      ...cleanInput,
      selectionDriftMs: 2000, // > 1000ms
    });
    expect(result.confidenceBoostEligible).toBe(false);
  });

  // ── ELIMINATION VELOCITY ──

  it('applies elimination boost for fast elimination', () => {
    const result = applyHonestRatingWithDetail({
      ...cleanInput,
      eliminationVelocity: C.ELIM_VELOCITY_STRONG + 0.1, // 0.9
      optionCount: 4,
      latencyRatio: 0.9, // no confidence boost (too slow)
    });
    expect(result.rule).toBe('elimination_boost');
    expect(result.gradeContinuousAdjustment).toBe(C.ELIM_BOOST_AMOUNT);
  });

  it('applies elimination penalty for absent elimination', () => {
    const result = applyHonestRatingWithDetail({
      ...cleanInput,
      eliminationVelocity: C.ELIM_VELOCITY_WEAK - 0.1, // 0.1
      optionCount: 4,
      latencyRatio: 0.9, // no confidence boost
    });
    expect(result.rule).toBe('elimination_penalty');
    expect(result.gradeContinuousAdjustment).toBe(-C.ELIM_PENALTY_AMOUNT);
  });

  // ── Z-SCORE NORMALIZATION ──

  it('uses z-score when baseline is provided', () => {
    const baseline: GhostGraderBaseline = {
      oscillationMedian: 1,
      oscillationStdDev: 0.5,
      tremorMedian: 0.3,
      tremorStdDev: 0.1,
      driftMedianMs: 2000,
      driftStdDevMs: 500,
    };
    // oscillations=2 → z-score = (2-1)/0.5 = 2.0 — at threshold, NOT above
    expect(
      applyHonestRating({
        ...cleanInput,
        oscillations: 2,
        baseline,
      })
    ).toBe(Rating.Good);

    // oscillations=3 → z-score = (3-1)/0.5 = 4.0 — well above threshold
    expect(
      applyHonestRating({
        ...cleanInput,
        oscillations: 3,
        baseline,
      })
    ).toBe(Rating.Again);
  });

  // ── EDGE CASES ──

  it('handles null selection drift (immediate submit)', () => {
    expect(
      applyHonestRating({
        ...cleanInput,
        selectionDriftMs: null,
      })
    ).toBe(Rating.Good);
  });

  it('indecision overrides hint-assisted', () => {
    // Both oscillations > threshold AND hint viewed
    // Indecision should win (harder rule)
    const result = applyHonestRatingWithDetail({
      ...cleanInput,
      oscillations: 5,
      hintViewed: true,
      hintDurationMs: 5000,
    });
    expect(result.rating).toBe(Rating.Again);
    expect(result.rule).toBe('indecision');
  });

  it('hint blocks confidence boost even with clean signals', () => {
    const result = applyHonestRatingWithDetail({
      ...cleanInput,
      hintViewed: true,
      hintDurationMs: 2000,
    });
    expect(result.confidenceBoostEligible).toBe(false);
    expect(result.rule).toBe('hint_assisted');
  });
});
