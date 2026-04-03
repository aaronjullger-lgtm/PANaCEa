/**
 * Lapse Severity Index
 *
 * A lapse after 8 consecutive correct reviews across months is qualitatively
 * different from a lapse after 2 reviews. The former signals "false stability"
 * (interference, not just decay) and should receive a harsher difficulty bump.
 *
 * Formula: severity = log2(1 + reps) × log2(1 + stability)
 * Difficulty multiplier: 1 + 0.15 × severity (capped at 1.6)
 *
 * Research: Bjork & Bjork (2011) — retrieval failures after apparent mastery
 * indicate fragile knowledge requiring aggressive rescheduling.
 */

/** Maximum difficulty multiplier to prevent runaway difficulty */
const MAX_SEVERITY_MULTIPLIER = 1.6;

/** Scaling factor for severity → difficulty multiplier */
const SEVERITY_SCALE = 0.15;

export interface LapseSeverityResult {
  /** Raw severity score (0 = first lapse, higher = more severe) */
  severity: number;
  /** Multiplier to apply to post-lapse difficulty increase (1.0–1.6) */
  difficultyMultiplier: number;
  /** Pre-lapse consecutive correct count */
  preLapseReps: number;
  /** Pre-lapse stability value */
  preLapseStability: number;
}

/**
 * Compute lapse severity based on pre-lapse card state.
 *
 * @param preLapseReps - Number of consecutive correct reviews before lapse
 * @param preLapseStability - FSRS stability value before lapse
 * @param preLapseState - FSRS card state (0=new, 1=learning, 2=review, 3=relearning)
 * @returns Severity score and difficulty multiplier
 */
export function computeLapseSeverity(
  preLapseReps: number,
  preLapseStability: number,
  preLapseState: number
): LapseSeverityResult {
  // Only applies to cards in review state (state ≥ 2) with history
  if (preLapseState < 2 || preLapseReps < 1) {
    return {
      severity: 0,
      difficultyMultiplier: 1.0,
      preLapseReps,
      preLapseStability,
    };
  }

  const severity =
    Math.log2(1 + preLapseReps) * Math.log2(1 + Math.max(0, preLapseStability));

  const multiplier = Math.min(
    MAX_SEVERITY_MULTIPLIER,
    1 + SEVERITY_SCALE * severity
  );

  return {
    severity: Math.round(severity * 1000) / 1000,
    difficultyMultiplier: Math.round(multiplier * 1000) / 1000,
    preLapseReps,
    preLapseStability,
  };
}
