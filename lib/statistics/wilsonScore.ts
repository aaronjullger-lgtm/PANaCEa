/**
 * Wilson Score Confidence Interval — Phase 4.4
 *
 * Computes the Wilson score interval for a binomial proportion.
 * Used to determine mastery confidence when a student has only a
 * small number of attempts in a given system.
 *
 * Why Wilson over naive p = correct/total?
 *   - Naive proportion is unreliable at small sample sizes (e.g., 3/3 = 100% "mastery")
 *   - Wilson CI gives a conservative lower bound that accounts for uncertainty
 *   - Show mastery badge only when Wilson lower bound > threshold (e.g., 0.8)
 *
 * Reference: Wilson, E. B. (1927). "Probable Inference, the Law of Succession,
 *   and Statistical Inference." JASA 22: 209–212.
 *
 * @module lib/statistics/wilsonScore
 */

// z-values for common confidence levels
const Z_VALUES: Record<number, number> = {
  0.90: 1.645,
  0.95: 1.96,
  0.99: 2.576,
};

export interface WilsonInterval {
  /** Observed proportion (correct / total) */
  proportion: number;
  /** Lower bound of the Wilson CI */
  lower: number;
  /** Upper bound of the Wilson CI */
  upper: number;
  /** Number of successes */
  successes: number;
  /** Total number of trials */
  total: number;
  /** Confidence level used (e.g., 0.95) */
  confidence: number;
}

/**
 * Compute Wilson score confidence interval.
 *
 * @param successes - Number of correct answers
 * @param total - Total number of attempts
 * @param confidence - Confidence level (default 0.95 for 95% CI)
 * @returns Wilson interval with lower and upper bounds
 *
 * @example
 *   const ci = wilsonScore(8, 10);
 *   // ci.lower ≈ 0.494 — despite 80% accuracy, lower bound is ~49% with only 10 trials
 *   // ci.upper ≈ 0.949
 *
 *   const ci2 = wilsonScore(80, 100);
 *   // ci2.lower ≈ 0.712 — with 100 trials, much tighter bound
 */
export function wilsonScore(
  successes: number,
  total: number,
  confidence: number = 0.95
): WilsonInterval {
  if (total === 0) {
    return {
      proportion: 0,
      lower: 0,
      upper: 0,
      successes: 0,
      total: 0,
      confidence,
    };
  }

  const z = Z_VALUES[confidence] ?? 1.96;
  const z2 = z * z;
  const p = successes / total;
  const n = total;

  // Wilson score formula
  const denominator = 1 + z2 / n;
  const centre = p + z2 / (2 * n);
  const spread = z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n);

  const lower = Math.max(0, (centre - spread) / denominator);
  const upper = Math.min(1, (centre + spread) / denominator);

  return {
    proportion: p,
    lower,
    upper,
    successes,
    total,
    confidence,
  };
}

/**
 * Check if a student has demonstrated mastery of a system.
 *
 * Mastery requires:
 *   1. Wilson lower bound > threshold (default 0.80)
 *   2. Minimum number of attempts (default 5)
 *
 * This replaces the old MIN_SYSTEM_REVIEWS = 5 hard cutoff with
 * a statistically grounded confidence check.
 *
 * @example
 *   hasMastery(9, 10)    // false — only 10 trials, lower bound ~0.56
 *   hasMastery(85, 100)  // true  — lower bound ~0.77... borderline
 *   hasMastery(90, 100)  // true  — lower bound ~0.83
 */
export function hasMastery(
  correct: number,
  total: number,
  options?: {
    threshold?: number;
    minAttempts?: number;
    confidence?: number;
  }
): boolean {
  const threshold = options?.threshold ?? 0.80;
  const minAttempts = options?.minAttempts ?? 5;
  const confidence = options?.confidence ?? 0.95;

  if (total < minAttempts) return false;

  const ci = wilsonScore(correct, total, confidence);
  return ci.lower >= threshold;
}

/**
 * Compute mastery level as a 0–1 score based on how far the
 * Wilson lower bound exceeds the threshold.
 *
 * Returns 0 if below threshold, 1 if lower bound >= 1.0.
 * Useful for gradient mastery displays (progress bars, heat maps).
 */
export function masteryLevel(
  correct: number,
  total: number,
  threshold: number = 0.80
): number {
  if (total < 3) return 0;

  const ci = wilsonScore(correct, total);
  if (ci.lower <= threshold) return 0;

  // Normalize: how far past the threshold (0 = at threshold, 1 = at 100%)
  return Math.min(1, (ci.lower - threshold) / (1 - threshold));
}

// ─── Weighted Wilson Score (Recency-Weighted) ───────────────

/** Result of the weighted Wilson score calculation. */
export interface WeightedWilsonResult {
  /** Lower bound of the Wilson CI (conservative estimate) */
  lower: number;
  /** Upper bound of the Wilson CI */
  upper: number;
  /** Weighted proportion (weighted successes / weighted total) */
  point: number;
  /** Effective sample size after weighting */
  n_effective: number;
}

/**
 * Compute a recency-weighted Wilson score confidence interval.
 *
 * Recent attempts (within `recentDaysCutoff`) receive 2× weight,
 * preventing stale mastery from inflating the lower bound.
 * This addresses Audit Gap 7: standard Wilson treats all attempts
 * equally regardless of when they occurred.
 *
 * @param attempts - Array of attempts with correctness and timestamp
 * @param confidenceLevel - Confidence level (0.90, 0.95, or 0.99). Default 0.95.
 * @param recentDaysCutoff - Attempts within this many days get 2× weight. Default 30.
 * @returns Weighted Wilson interval with effective sample size
 *
 * @example
 *   // 8 recent correct + 2 old incorrect out of 10 total
 *   weightedWilsonScore([
 *     ...Array(8).fill({ isCorrect: true, reviewedAt: new Date() }),         // recent: weight 2×
 *     ...Array(2).fill({ isCorrect: false, reviewedAt: daysBefore(60) }),    // old: weight 1×
 *   ])
 *   // n_effective = 8×2 + 2×1 = 18
 *   // weighted_p = 16/18 = 0.889
 *   // lower ≈ 0.674
 *
 * @see PANaCEa_Behavioral_Analysis_Audit.md § 2.7
 */
export function weightedWilsonScore(
  attempts: Array<{ isCorrect: boolean; reviewedAt: Date }>,
  confidenceLevel: 0.90 | 0.95 | 0.99 = 0.95,
  recentDaysCutoff: number = 30
): WeightedWilsonResult {
  if (attempts.length === 0) {
    return { lower: 0, upper: 0, point: 0, n_effective: 0 };
  }

  const now = Date.now();
  const cutoffMs = recentDaysCutoff * 24 * 60 * 60 * 1000;
  const RECENT_WEIGHT = 2.0;
  const OLD_WEIGHT = 1.0;

  let weightedSuccesses = 0;
  let weightedTotal = 0;

  for (const attempt of attempts) {
    const ageMs = now - attempt.reviewedAt.getTime();
    const weight = ageMs <= cutoffMs ? RECENT_WEIGHT : OLD_WEIGHT;

    weightedTotal += weight;
    if (attempt.isCorrect) {
      weightedSuccesses += weight;
    }
  }

  if (weightedTotal === 0) {
    return { lower: 0, upper: 0, point: 0, n_effective: 0 };
  }

  const z = Z_VALUES[confidenceLevel] ?? 1.96;
  const z2 = z * z;
  const p = weightedSuccesses / weightedTotal;
  const n = weightedTotal; // effective n

  // Wilson score formula applied to weighted counts
  const denominator = 1 + z2 / n;
  const centre = p + z2 / (2 * n);
  const spread = z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n);

  const lower = Math.max(0, (centre - spread) / denominator);
  const upper = Math.min(1, (centre + spread) / denominator);

  return {
    lower,
    upper,
    point: p,
    n_effective: weightedTotal,
  };
}

/**
 * Check mastery using recency-weighted Wilson score.
 *
 * Wrapper around weightedWilsonScore for backward compatibility with
 * the hasMastery() API. Use when `weighted: true` is passed.
 *
 * @param attempts - Array of attempts with correctness and timestamp
 * @param options - Threshold, min attempts, confidence level, recency cutoff
 * @returns Whether the weighted Wilson lower bound exceeds the threshold
 */
export function hasWeightedMastery(
  attempts: Array<{ isCorrect: boolean; reviewedAt: Date }>,
  options?: {
    threshold?: number;
    minAttempts?: number;
    confidence?: 0.90 | 0.95 | 0.99;
    recentDaysCutoff?: number;
  }
): boolean {
  const threshold = options?.threshold ?? 0.80;
  const minAttempts = options?.minAttempts ?? 5;
  const confidence = options?.confidence ?? 0.95;
  const recentDaysCutoff = options?.recentDaysCutoff ?? 30;

  if (attempts.length < minAttempts) return false;

  const result = weightedWilsonScore(attempts, confidence, recentDaysCutoff);
  return result.lower >= threshold;
}
