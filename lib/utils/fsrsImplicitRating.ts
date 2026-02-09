/**
 * Implicit FSRS Rating Mapping
 *
 * Derives FSRS rating (1–4) from binary Correct/Incorrect + time spent.
 * The user does NOT self-evaluate difficulty—the algorithm decides.
 *
 * Mapping:
 * - Incorrect → Rating 1 (Again)
 * - Correct + time < 5s → Rating 4 (Easy)
 * - Correct + time > 20s → Rating 2 (Hard)
 * - Correct otherwise → Rating 3 (Good)
 */

const RATING_AGAIN = 1;
const RATING_HARD = 2;
const RATING_GOOD = 3;
const RATING_EASY = 4;

const FAST_SECONDS = 5;
const SLOW_SECONDS = 20;

export type FsrsRating = 1 | 2 | 3 | 4;

/**
 * Derive FSRS rating from binary correctness and time spent (ms).
 */
export function deriveFsrsRating(isCorrect: boolean, timeSpentMs: number): FsrsRating {
  if (!isCorrect) return RATING_AGAIN as FsrsRating;

  const seconds = timeSpentMs / 1000;
  if (seconds < FAST_SECONDS) return RATING_EASY as FsrsRating;
  if (seconds > SLOW_SECONDS) return RATING_HARD as FsrsRating;
  return RATING_GOOD as FsrsRating;
}
