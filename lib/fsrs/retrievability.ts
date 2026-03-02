/**
 * Retrievability calculation utilities for FSRS v6.
 * Provides functions to compute retrievability (R) given stability, elapsed time, and FSRS parameters.
 */

import { computeDecayFactor } from '../fsrs';

/**
 * Compute retrievability (R) using FSRS v6 power-law formula:
 * R = (1 + factor * t / S) ^ decay
 * where factor = w[19], decay = -w[20]
 *
 * @param stability - Current stability value (S)
 * @param elapsedDays - Days since last review (t)
 * @param w19 - FSRS parameter w[19] (retrievability factor)
 * @param w20 - FSRS parameter w[20] (retrievability decay exponent)
 * @returns Retrievability as a decimal between 0 and 1 (0% to 100%)
 */
export function computeRetrievability(
  stability: number,
  elapsedDays: number,
  w19: number,
  w20: number
): number {
  if (stability <= 0 || elapsedDays <= 0) {
    return 0;
  }
  const { factor, decay } = computeDecayFactor(w19, w20);
  // Ensure factor and decay are finite numbers
  if (!Number.isFinite(factor) || !Number.isFinite(decay)) {
    return 0;
  }
  const ratio = (factor * elapsedDays) / stability;
  // Guard against overflow or negative ratio
  if (ratio <= 0 || !Number.isFinite(ratio)) {
    return 1; // Should not happen, but fallback
  }
  const r = Math.pow(1 + ratio, decay);
  // Clamp to [0, 1] due to floating point errors
  if (r > 1) return 1;
  if (r < 0) return 0;
  return r;
}

/**
 * Compute retrievability percentage (0-100) with default FSRS v6 parameters.
 * Uses default w[19] = 0.0658, w[20] = 0.1542 from lib/fsrs defaultParameters.
 *
 * @param stability - Current stability value (S)
 * @param elapsedDays - Days since last review (t)
 * @returns Retrievability as a percentage (0-100)
 */
export function computeRetrievabilityWithDefaults(
  stability: number,
  elapsedDays: number
): number {
  const defaultW19 = 0.0658;
  const defaultW20 = 0.1542;
  return computeRetrievability(stability, elapsedDays, defaultW19, defaultW20);
}

/**
 * Compute elapsed days since last review date.
 * @param lastReviewAt - Date of last review (string, Date, or null/undefined)
 * @param referenceDate - Optional reference date (defaults to now)
 * @returns Elapsed days as a floating point number, or null if no last review date
 */
export function computeElapsedDays(
  lastReviewAt: string | Date | null | undefined,
  referenceDate: Date = new Date()
): number | null {
  if (!lastReviewAt) return null;
  const last = typeof lastReviewAt === 'string' ? new Date(lastReviewAt) : lastReviewAt;
  if (isNaN(last.getTime())) return null;
  const diffMs = referenceDate.getTime() - last.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return Math.max(0, diffDays);
}

/**
 * Compute retrievability for a condition given its UserProgress data.
 * Handles missing stability or lastReviewAt gracefully.
 *
 * @param stability - Stability from UserProgress.fsrsStability (may be null)
 * @param lastReviewAt - Last review date from UserProgress.lastReviewAt (may be null)
 * @param w19 - FSRS parameter w[19] (optional, defaults to default)
 * @param w20 - FSRS parameter w[20] (optional, defaults to default)
 * @returns Retrievability percentage (0-100) or null if insufficient data
 */
export function computeConditionRetrievability(
  stability: number | null | undefined,
  lastReviewAt: string | Date | null | undefined,
  w19: number = 0.0658,
  w20: number = 0.1542
): number | null {
  if (!stability || stability <= 0) {
    return null;
  }
  const elapsedDays = computeElapsedDays(lastReviewAt);
  if (elapsedDays === null || elapsedDays <= 0) {
    // No review yet, cannot compute retrievability
    return null;
  }
  const r = computeRetrievability(stability, elapsedDays, w19, w20);
  return r * 100; // convert to percentage
}