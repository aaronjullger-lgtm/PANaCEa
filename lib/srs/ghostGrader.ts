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
 * Apply honest-history override: downgrade rating to Again when correct but
 * behavioral signals indicate indecision, low confidence, or high cognitive load.
 *
 * Binary rating system: Again(1) / Good(3). Hard(2) and Easy(4) are deprecated.
 * When the Ghost Grader detects indecision on a correct answer, it downgrades
 * to Again — "you got it right but you didn't really know it" — which triggers
 * a shorter FSRS interval (relearning) rather than the ambiguous Hard scheduling.
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
  // Already Again — can't downgrade further
  if (userRating <= Rating.Again) return userRating;

  // Count indecision signals that fired
  let signalCount = 0;

  const effectiveOscillations = oscillations + Math.min(vignetteRegressions, 2);
  if (effectiveOscillations > OSCILLATION_THRESHOLD) signalCount++;

  if (selectionDriftMs != null && selectionDriftMs > SELECTION_DRIFT_THRESHOLD_MS) signalCount++;

  if (tremorScore >= TREMOR_THRESHOLD) signalCount++;

  // Any indecision signal → Again. Binary system: no middle ground.
  if (signalCount > 0) return Rating.Again;

  return userRating;
}
