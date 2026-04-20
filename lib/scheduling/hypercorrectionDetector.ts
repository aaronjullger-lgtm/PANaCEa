// SAFE-OVERRIDE: false positive on grep-E alternation -- space+sh in TypeScript identifiers
/**
 * Hypercorrection Detection (Sprint 3.5 -- pure-function extraction)
 *
 * Metcalfe (2017): High-confidence errors are MORE correctable than
 * low-confidence errors. A learner who answered confidently wrong on the
 * prior review and is now correct exhibits disproportionately durable
 * retention of the correction (the hypercorrection effect).
 *
 * READ-ONLY signal: NEVER modifies FSRS scheduling. Stored in
 * CalibrationLog.hypercorrectionEligible for offline retention analysis.
 */

/**
 * Minimum implicit confidence on the prior (incorrect) review for the
 * hypercorrection effect to activate.
 *
 * Value 0.7 sits at the upper third of PANaCEa's confidence range
 * [0.3, 0.95], distinguishing "fairly confident" from "highly confident".
 * The CalibrationLog can be re-filtered at different thresholds offline.
 */
export const HYPERCORRECTION_CONFIDENCE_THRESHOLD = 0.7;

/** Minimal prior-review fields needed by detectHypercorrection. */
export interface PriorReviewForHypercorrection {
  wasCorrect: boolean | null;
  implicit_confidence: number | null;
}

/**
 * Detect whether the current review qualifies as a hypercorrection event.
 *
 * Fires when ALL of:
 *   1. Student is CORRECT on THIS review.
 *   2. At least one prior review exists.
 *   3. The most recent prior review was INCORRECT.
 *   4. Implicit confidence on that prior wrong answer is >= threshold.
 *
 * Only priorReviews[0] (newest) is examined.
 *
 * @param isCurrentlyCorrect - Correct on THIS review.
 * @param priorReviews - Real reviews, newest-first (index 0 = most recent).
 * @param threshold - Confidence floor on the prior error (default 0.7).
 */
export function detectHypercorrection(
  isCurrentlyCorrect: boolean,
  priorReviews: PriorReviewForHypercorrection[],
  threshold: number = HYPERCORRECTION_CONFIDENCE_THRESHOLD
): boolean {
  if (!isCurrentlyCorrect) return false;
  if (priorReviews.length === 0) return false;

  const mostRecentPrior = priorReviews[0];
  if (!mostRecentPrior) return false;

  const priorConfidence =
    typeof mostRecentPrior.implicit_confidence === 'number'
      ? mostRecentPrior.implicit_confidence
      : 0;

  return mostRecentPrior.wasCorrect === false && priorConfidence >= threshold;
}
