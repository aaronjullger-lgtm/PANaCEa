/**
 * RT Trajectory Service — Implicit Delayed JOL
 *
 * Compares response time across spaced reviews of the same card.
 * Decreasing RT at increasing intervals = consolidation → stability bonus.
 * Increasing RT = decay despite correct answer → stability penalty.
 *
 * Research: Nelson & Dunlosky (1991) — delayed JOLs predict retention
 * better than immediate JOLs. RT change is the behavioral analog.
 */

export interface RtTrajectoryResult {
  /** Current RT / Previous RT (< 1 = faster, > 1 = slower) */
  rtChangeRatio: number | null;
  /** Stability multiplier: 0.90–1.10 */
  stabilityMultiplier: number;
  /** Previous RT used for comparison (ms) */
  previousRtMs: number | null;
  /** Current RT (ms) */
  currentRtMs: number;
  /** Whether enough history exists for comparison */
  hasHistory: boolean;
}

/** Minimum elapsed days for the comparison to be meaningful (avoid same-day) */
const MIN_ELAPSED_DAYS = 0.5;

/** Thresholds for stability adjustment */
const CONSOLIDATION_THRESHOLD = 0.8; // 20%+ faster → consolidating
const DECAY_THRESHOLD = 1.3;         // 30%+ slower → decaying
const MAX_BONUS = 1.10;              // 10% stability bonus
const MAX_PENALTY = 0.90;            // 10% stability penalty

/**
 * Compute RT trajectory stability modifier.
 *
 * @param currentRtMs - Current review response time in milliseconds
 * @param previousRtMs - Most recent prior review response time in milliseconds
 * @param elapsedDays - Days since last review (from FSRS card state)
 * @returns RT change ratio and stability multiplier
 */
export function computeRtTrajectory(
  currentRtMs: number,
  previousRtMs: number | null,
  elapsedDays: number
): RtTrajectoryResult {
  if (
    previousRtMs == null ||
    previousRtMs <= 0 ||
    currentRtMs <= 0 ||
    elapsedDays < MIN_ELAPSED_DAYS
  ) {
    return {
      rtChangeRatio: null,
      stabilityMultiplier: 1.0,
      previousRtMs,
      currentRtMs,
      hasHistory: false,
    };
  }

  const ratio = currentRtMs / previousRtMs;

  let multiplier = 1.0;
  if (ratio < CONSOLIDATION_THRESHOLD) {
    // Consolidating: scale linearly from 1.0 at threshold to MAX_BONUS at ratio=0.5
    const scale = (CONSOLIDATION_THRESHOLD - Math.max(ratio, 0.5)) /
                  (CONSOLIDATION_THRESHOLD - 0.5);
    multiplier = 1.0 + (MAX_BONUS - 1.0) * scale;
  } else if (ratio > DECAY_THRESHOLD) {
    // Decaying: scale linearly from 1.0 at threshold to MAX_PENALTY at ratio=2.0
    const scale = Math.min((ratio - DECAY_THRESHOLD) / (2.0 - DECAY_THRESHOLD), 1.0);
    multiplier = 1.0 - (1.0 - MAX_PENALTY) * scale;
  }

  return {
    rtChangeRatio: Math.round(ratio * 1000) / 1000,
    stabilityMultiplier: Math.round(multiplier * 1000) / 1000,
    previousRtMs,
    currentRtMs,
    hasHistory: true,
  };
}
