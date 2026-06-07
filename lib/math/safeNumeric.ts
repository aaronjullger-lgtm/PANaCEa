/**
 * Numeric guardrails for analytics/scoring pipelines.
 */

/**
 * Safely divide two finite numbers.
 * Returns fallback when denominator is <= 0 or values are not finite.
 */
export function safeDivide(numerator: number, denominator: number, fallback = 0): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    return fallback;
  }
  return numerator / denominator;
}
