/**
 * Inter-Review Interval Deviation
 *
 * A correct answer at 95% retrievability is much less informative than one
 * at 50% retrievability. This service computes the information value of a
 * review based on how early/late it occurred relative to schedule.
 *
 * Early + correct → less informative (high R, expected correct) → dampen stability gain
 * Late + correct → very informative (low R, surprising correct) → amplify stability gain
 * Early + incorrect → surprising interference signal → slightly amplify
 * Late + incorrect → expected failure → standard treatment
 *
 * Research: Bayesian surprise — observations at extreme retrievability carry
 * less information (ceiling/floor effects). Mozer et al. (2009).
 */

export interface IntervalDeviationResult {
  /** actualDays / scheduledDays — <1 = early, >1 = late */
  deviationRatio: number | null;
  /** Multiplier for stability update magnitude (0.85–1.15) */
  informationMultiplier: number;
  /** Classification: 'early' | 'on_time' | 'late' | 'unknown' */
  classification: 'early' | 'on_time' | 'late' | 'unknown';
}

const EARLY_THRESHOLD = 0.5;      // Reviewed at >2× expected retrievability
const LATE_THRESHOLD = 1.5;       // Reviewed much later than scheduled
const ON_TIME_LOW = 0.7;
const ON_TIME_HIGH = 1.3;
const EARLY_MULTIPLIER = 0.85;    // Correct at high R = less informative
const LATE_CORRECT_MULTIPLIER = 1.15; // Correct at low R = very informative
const LATE_INCORRECT_MULTIPLIER = 1.0; // Incorrect at low R = expected, standard
const EARLY_INCORRECT_MULTIPLIER = 1.10; // Incorrect at high R = surprising interference

/**
 * Compute interval deviation and its information-value multiplier.
 *
 * @param elapsedDays - Actual days since last review
 * @param scheduledDays - FSRS-scheduled interval in days
 * @param isCorrect - Whether the answer was correct
 * @returns Deviation ratio, information multiplier, and classification
 */
export function computeIntervalDeviation(
  elapsedDays: number,
  scheduledDays: number,
  isCorrect: boolean
): IntervalDeviationResult {
  // Need meaningful scheduled interval (skip new/learning cards)
  if (scheduledDays <= 0 || elapsedDays < 0) {
    return { deviationRatio: null, informationMultiplier: 1.0, classification: 'unknown' };
  }

  const ratio = elapsedDays / scheduledDays;

  let multiplier = 1.0;
  let classification: IntervalDeviationResult['classification'] = 'on_time';

  if (ratio < EARLY_THRESHOLD) {
    classification = 'early';
    multiplier = isCorrect ? EARLY_MULTIPLIER : EARLY_INCORRECT_MULTIPLIER;
  } else if (ratio < ON_TIME_LOW) {
    classification = 'early';
    // Interpolate between early multiplier and 1.0
    const t = (ratio - EARLY_THRESHOLD) / (ON_TIME_LOW - EARLY_THRESHOLD);
    multiplier = isCorrect
      ? EARLY_MULTIPLIER + t * (1.0 - EARLY_MULTIPLIER)
      : EARLY_INCORRECT_MULTIPLIER + t * (1.0 - EARLY_INCORRECT_MULTIPLIER);
  } else if (ratio > LATE_THRESHOLD) {
    classification = 'late';
    multiplier = isCorrect ? LATE_CORRECT_MULTIPLIER : LATE_INCORRECT_MULTIPLIER;
  } else if (ratio > ON_TIME_HIGH) {
    classification = 'late';
    // Interpolate between 1.0 and late multiplier
    const t = (ratio - ON_TIME_HIGH) / (LATE_THRESHOLD - ON_TIME_HIGH);
    multiplier = isCorrect
      ? 1.0 + t * (LATE_CORRECT_MULTIPLIER - 1.0)
      : 1.0;
  }

  return {
    deviationRatio: Math.round(ratio * 1000) / 1000,
    informationMultiplier: Math.round(multiplier * 1000) / 1000,
    classification,
  };
}
