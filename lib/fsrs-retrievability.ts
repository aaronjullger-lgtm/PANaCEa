/**
 * FSRS v6 Retrievability — shared pure-function helper
 *
 * Single source of truth for student-facing forgetting-curve math across the
 * app (retention.ts backend, RetentionForecastCard, DecayCurve, FSRSDecayVisualization).
 *
 * Formula (ts-fsrs v6 published defaults):
 *   R(t) = (1 + FACTOR * t / S) ^ DECAY
 *   FACTOR = 19 / 81
 *   DECAY  = -0.5
 *
 * This matches the defaults used by the ts-fsrs library when personalized
 * w[19]/w[20] weights aren't available. The PANaCEa `FSRS` class in
 * `lib/fsrs.ts` uses per-user personalized weights; for generic student-facing
 * charts (where per-user weights aren't wired to the frontend) we use the
 * published defaults so every chart in the app agrees on the same curve.
 *
 * DO NOT swap this for Ebbinghaus `exp(-t/S)` — that was the old bug.
 * See: docs/dashboard-trust-audit.md §2 P0 #2 (Sprint 1).
 */

export const FSRS_FACTOR_DEFAULT = 19 / 81;
export const FSRS_DECAY_DEFAULT = -0.5;

/**
 * FSRS v6 retrievability at `elapsedDays` given current `stability` (in days).
 *
 * @param elapsedDays — days since last review (must be ≥ 0)
 * @param stability   — FSRS stability in days (must be > 0)
 * @returns retrievability in [0, 1]; returns 0 if stability is non-positive
 */
export function retrievability(elapsedDays: number, stability: number): number {
  if (!Number.isFinite(elapsedDays) || elapsedDays < 0) return 1;
  if (!Number.isFinite(stability) || stability <= 0) return 0;
  const r = Math.pow(1 + (FSRS_FACTOR_DEFAULT * elapsedDays) / stability, FSRS_DECAY_DEFAULT);
  // Numerical floor/ceiling guards (R should already be in [0,1] for finite inputs)
  if (!Number.isFinite(r)) return 0;
  return Math.max(0, Math.min(1, r));
}

/**
 * Days from last review until retrievability crosses `targetR` (e.g. 0.9 for
 * the "critical" threshold in FSRS). Inverse of the retrievability formula.
 *
 *   R = (1 + F·t/S)^D
 *   t = S / F · (R^(1/D) - 1)
 *
 * @param stability — FSRS stability in days (must be > 0)
 * @param targetR   — retention threshold in (0, 1], typical 0.9 or 0.7
 * @returns days until R crosses targetR, or Infinity if stability ≤ 0
 */
export function daysUntilRetrievability(stability: number, targetR: number): number {
  if (!Number.isFinite(stability) || stability <= 0) return Infinity;
  if (!Number.isFinite(targetR) || targetR <= 0 || targetR > 1) return Infinity;
  // When target = 1, the only elapsed time that satisfies R = 1 is t = 0.
  if (targetR >= 1) return 0;
  const inv = Math.pow(targetR, 1 / FSRS_DECAY_DEFAULT) - 1;
  return (stability * inv) / FSRS_FACTOR_DEFAULT;
}

/**
 * Build a 0..maxDay retrievability curve for charting.
 *
 * @param stability — FSRS stability in days (must be > 0)
 * @param maxDay    — inclusive last day to sample (default 30 → 31 points)
 * @returns array of { day, retentionProb } where retentionProb is a percent [0, 100]
 */
export function buildRetrievabilityCurve(
  stability: number,
  maxDay = 30
): Array<{ day: number; retentionProb: number }> {
  if (!Number.isFinite(stability) || stability <= 0) return [];
  if (!Number.isFinite(maxDay) || maxDay < 0) return [];
  const days = Math.floor(maxDay) + 1;
  return Array.from({ length: days }, (_, day) => ({
    day,
    retentionProb: retrievability(day, stability) * 100,
  }));
}
