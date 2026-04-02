/**
 * Ghost Grader v2 — Unit Tests (Sprint 6)
 *
 * Tests the bidirectional Ghost Grader:
 * - Indecision downgrade pathway (existing behavior preserved)
 * - Confidence boost pathway (new)
 * - Elimination velocity signal (new)
 */

import { describe, it, expect } from 'vitest';
import {
  applyHonestRating,
  applyHonestRatingWithDetail,
  GHOST_GRADER_CONSTANTS,
} from '../lib/srs/ghostGrader';
import { Rating } from '../lib/fsrs';

const {
  CONFIDENCE_BOOST_AMOUNT,
  ELIM_BOOST_AMOUNT,
  ELIM_PENALTY_AMOUNT,
  INDECISION_GRADE_CAP,
} = GHOST_GRADER_CONSTANTS;

describe('Ghost Grader — Indecision Downgrade (existing behavior)', () => {
  it('downgrades to Again when oscillations exceed threshold', () => {
    const result = applyHonestRatingWithDetail({
      userRating: Rating.Good,
      isCorrect: true,
      oscillations: 3,
    });
    expect(result.rating).toBe(Rating.Again);
    expect(result.rule).toBe('indecision');
  });
  it('downgrades to Again on high selection drift', () => {
    const result = applyHonestRatingWithDetail({
      userRating: Rating.Good,
      isCorrect: true,
      selectionDriftMs: 5000,
    });
    expect(result.rating).toBe(Rating.Again);
    expect(result.rule).toBe('indecision');
  });

  it('downgrades to Again on high tremor', () => {
    const result = applyHonestRatingWithDetail({
      userRating: Rating.Good,
      isCorrect: true,
      tremorScore: 0.8,
    });
    expect(result.rating).toBe(Rating.Again);
  });

  it('does not downgrade incorrect answers', () => {
    const result = applyHonestRatingWithDetail({
      userRating: Rating.Again,
      isCorrect: false,
      oscillations: 5,
      tremorScore: 0.9,
    });
    expect(result.rating).toBe(Rating.Again);
    expect(result.rule).toBe('none');
  });

  it('backwards-compatible: applyHonestRating returns just the rating', () => {
    const rating = applyHonestRating({
      userRating: Rating.Good,
      isCorrect: true,
      oscillations: 3,
    });
    expect(rating).toBe(Rating.Again);
  });

  it('indecision grade adjustment signals cap', () => {
    const result = applyHonestRatingWithDetail({
      userRating: Rating.Good,
      isCorrect: true,
      oscillations: 3,
    });
    expect(result.gradeContinuousAdjustment).toBe(-99);
  });
});
describe('Ghost Grader — Confidence Boost (new)', () => {
  const cleanInput = {
    userRating: Rating.Good as Rating,
    isCorrect: true,
    oscillations: 0,
    vignetteRegressions: 0,
    selectionDriftMs: 500,
    tremorScore: 0.1,
    latencyRatio: 0.5,
  };

  it('boosts grade_continuous when all signals clean + fast', () => {
    const result = applyHonestRatingWithDetail(cleanInput);
    expect(result.rating).toBe(Rating.Good); // No downgrade
    expect(result.gradeContinuousAdjustment).toBeGreaterThanOrEqual(CONFIDENCE_BOOST_AMOUNT);
    expect(result.confidenceBoostEligible).toBe(true);
    expect(result.rule).toBe('confidence_boost');
  });

  it('does NOT boost when latency ratio is too high', () => {
    const result = applyHonestRatingWithDetail({
      ...cleanInput,
      latencyRatio: 1.2, // Over par
    });
    expect(result.confidenceBoostEligible).toBe(false);
    expect(result.gradeContinuousAdjustment).toBe(0);
  });

  it('does NOT boost when oscillations are present', () => {
    const result = applyHonestRatingWithDetail({
      ...cleanInput,
      oscillations: 1, // Not zero
    });
    expect(result.confidenceBoostEligible).toBe(false);
  });

  it('does NOT boost when tremor is moderate', () => {
    const result = applyHonestRatingWithDetail({
      ...cleanInput,
      tremorScore: 0.3, // Above calm ceiling
    });
    expect(result.confidenceBoostEligible).toBe(false);
  });

  it('does NOT boost when drift is high', () => {
    const result = applyHonestRatingWithDetail({
      ...cleanInput,
      selectionDriftMs: 2000, // Over confident threshold
    });
    expect(result.confidenceBoostEligible).toBe(false);
  });
});
describe('Ghost Grader — Elimination Velocity (new)', () => {
  it('boosts for fast systematic elimination', () => {
    const result = applyHonestRatingWithDetail({
      userRating: Rating.Good,
      isCorrect: true,
      oscillations: 0,
      tremorScore: 0.1,
      latencyRatio: 1.0, // Not fast enough for confidence boost
      eliminationVelocity: 1.2, // Fast elimination
      optionCount: 4,
    });
    expect(result.gradeContinuousAdjustment).toBe(ELIM_BOOST_AMOUNT);
    expect(result.rule).toBe('elimination_boost');
  });

  it('penalizes for absent elimination on MCQ', () => {
    const result = applyHonestRatingWithDetail({
      userRating: Rating.Good,
      isCorrect: true,
      oscillations: 0,
      tremorScore: 0.1,
      latencyRatio: 1.0,
      eliminationVelocity: 0.05, // Very slow
      optionCount: 4,
    });
    expect(result.gradeContinuousAdjustment).toBe(-ELIM_PENALTY_AMOUNT);
    expect(result.rule).toBe('elimination_penalty');
  });

  it('stacks elimination boost with confidence boost', () => {
    const result = applyHonestRatingWithDetail({
      userRating: Rating.Good,
      isCorrect: true,
      oscillations: 0,
      vignetteRegressions: 0,
      selectionDriftMs: 400,
      tremorScore: 0.05,
      latencyRatio: 0.5,
      eliminationVelocity: 1.5,
      optionCount: 4,
    });
    expect(result.gradeContinuousAdjustment).toBeCloseTo(
      CONFIDENCE_BOOST_AMOUNT + ELIM_BOOST_AMOUNT, 5
    );
    expect(result.confidenceBoostEligible).toBe(true);
  });

  it('skips elimination signal for 2-option questions', () => {
    const result = applyHonestRatingWithDetail({
      userRating: Rating.Good,
      isCorrect: true,
      eliminationVelocity: 0.01,
      optionCount: 2,
    });
    // No elimination penalty for binary questions
    expect(result.gradeContinuousAdjustment).toBe(0);
  });

  it('does NOT apply elimination penalty when confidence boost is active', () => {
    const result = applyHonestRatingWithDetail({
      userRating: Rating.Good,
      isCorrect: true,
      oscillations: 0,
      vignetteRegressions: 0,
      selectionDriftMs: null,
      tremorScore: 0.05,
      latencyRatio: 0.4,
      eliminationVelocity: 0.1, // Slow, but boost eligible
      optionCount: 4,
    });
    // Should get confidence boost but NOT elimination penalty
    expect(result.gradeContinuousAdjustment).toBe(CONFIDENCE_BOOST_AMOUNT);
  });
});
