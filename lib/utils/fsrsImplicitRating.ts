/**
 * Implicit FSRS Rating Mapping
 *
 * Derives FSRS rating (1–4) from binary Correct/Incorrect.
 * The user does NOT self-evaluate difficulty—the algorithm decides.
 * Product decision: Remove Hard/Easy ratings; only Again (incorrect) and Good (correct).
 *
 * Mapping:
 * - Incorrect → Rating 1 (Again)
 * - Correct → Rating 3 (Good)
 * Hard (2) and Easy (4) are deprecated and never produced.
 */

const RATING_AGAIN = 1;
const RATING_HARD = 2; // deprecated
const RATING_GOOD = 3;
const RATING_EASY = 4; // deprecated

// Time thresholds no longer used; kept for potential future use.
const FAST_SECONDS = 5;
const SLOW_SECONDS = 20;

export type FsrsRating = 1 | 2 | 3 | 4;

/**
 * Derive FSRS rating from binary correctness (time spent ignored).
 */
export function deriveFsrsRating(isCorrect: boolean, _timeSpentMs: number): FsrsRating {
  return isCorrect ? RATING_GOOD : RATING_AGAIN;
}
