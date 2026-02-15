/**
 * Ghost Grader - Behavioral Biometrics for Honest FSRS History
 *
 * Overrides user-derived ratings using implicit confidence signals to preserve
 * an "Honest History" of reviews. Prevents gaming where users click "Good"
 * after hesitating or re-reading the vignette post-reveal.
 *
 * Rules (any triggers cap at Hard when correct):
 * 1. Oscillations > 2: Hover indecision (A→B→A revisits)
 * 2. Selection drift > 3s: Time between selecting answer and Submit (low confidence)
 * 3. Tremor score > 0.6: Erratic mouse movement (high cognitive load, frustration)
 *
 * @see hooks/useMicroKinetics.ts - Provides all micro-kinetic metrics
 * @see lib/implicit-metrics.ts - deriveImplicitRating (base rating before override)
 */

import { Rating } from '../fsrs';

/** Drift threshold (ms): selection-to-submit delay indicating lack of confidence */
export const SELECTION_DRIFT_THRESHOLD_MS = 3000;

export interface GhostGraderInput {
  /** FSRS rating from implicit or explicit input (1-4) */
  userRating: Rating;
  /** Whether the answer was correct */
  isCorrect: boolean;
  /** Hover oscillations (A→B→A revisits) from useMicroKinetics */
  oscillations?: number;
  /** Scroll direction reversals after answer reveal (vignette regression) */
  vignetteRegressions?: number;
  /** Time from answer selection to submit (ms). High = lack of confidence. */
  selectionDriftMs?: number | null;
  /** Mouse tremor score 0-1. High = cognitive load, frustration. */
  tremorScore?: number;
}

const OSCILLATION_THRESHOLD = 2;
const TREMOR_THRESHOLD = 0.6;

/**
 * Apply honest-history override: cap rating at Hard when correct but behavioral
 * signals indicate indecision, low confidence, or high cognitive load.
 *
 * @param input - Current rating, correctness, and micro-kinetic metrics
 * @returns Adjusted rating (1-4) for FSRS scheduling
 */
export function applyHonestRating(input: GhostGraderInput): Rating {
  const {
    userRating,
    isCorrect,
    oscillations = 0,
    vignetteRegressions = 0,
    selectionDriftMs = null,
    tremorScore = 0,
  } = input;

  if (!isCorrect) return userRating;
  if (userRating <= Rating.Hard) return userRating;

  const effectiveOscillations = oscillations + Math.min(vignetteRegressions, 2);
  if (effectiveOscillations > OSCILLATION_THRESHOLD) return Rating.Hard;

  if (selectionDriftMs != null && selectionDriftMs > SELECTION_DRIFT_THRESHOLD_MS) {
    return Rating.Hard;
  }

  if (tremorScore >= TREMOR_THRESHOLD) return Rating.Hard;

  return userRating;
}
