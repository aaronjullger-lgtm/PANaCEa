/**
 * Wilson Score Mastery Detection Service
 *
 * Provides statistically principled mastery thresholds that handle small sample sizes.
 * Uses Wilson score lower bound (Wilson, 1927) with optional recency weighting
 * via Kish effective sample size.
 *
 * Research basis:
 * - Wilson (1927): Score confidence interval for binomial proportion
 * - Kish (1965): Effective sample size for weighted observations
 * - Bloom (1968): 80-90% correct for competency-based advancement
 * - Olivier & May (2006), Nawa (2022): Design-effect adjustment for weighted CIs
 *
 * Key properties:
 * - Always in [0, 1]
 * - Naturally penalizes small samples (5/5 ≠ 50/50)
 * - Handles extreme proportions gracefully (0% and 100%)
 * - Recency weighting via exponential decay + Kish n_eff
 *
 * @see FSRS6DeepResearch.md — "Wilson score lower bound enables conservative mastery detection"
 */

// ── Constants ──

/** Default z-score for 90% confidence (conservative, per research recommendation) */
const DEFAULT_Z = 1.645;

/** z-score for 95% confidence (use for non-recency-weighted calculations) */
const Z_95 = 1.96;

/** Default mastery threshold: Wilson lower bound must exceed this */
export const MASTERY_THRESHOLD = 0.80;

/** Gold mastery threshold: strong, confident mastery */
export const GOLD_MASTERY_THRESHOLD = 0.90;

/** Minimum observations required before mastery can be assessed */
export const MIN_OBSERVATIONS = 5;

/** Default exponential decay factor for recency weighting (λ).
 *  λ=0.95 means each older observation is worth 95% of the next newer one.
 *  With n=20, the oldest observation carries ~36% of the newest's weight.
 *  With n=50, the oldest carries ~8%. */
export const DEFAULT_DECAY_LAMBDA = 0.95;

// ── Types ──

export interface WilsonMasteryInput {
  /** Array of binary outcomes, ordered oldest-first: true = correct, false = incorrect */
  outcomes: boolean[];
  /** Optional exponential decay factor (0 < λ < 1). If provided, recency weighting is applied. */
  decayLambda?: number;
  /** Optional z-score override (default: 1.645 for 90% confidence) */
  zScore?: number;
  /** Optional mastery threshold override (default: 0.80) */
  masteryThreshold?: number;
}

export interface WilsonMasteryResult {
  /** Wilson score lower bound (0-1). The conservative estimate of true accuracy. */
  wilsonLower: number;
  /** Wilson score upper bound (0-1). */
  wilsonUpper: number;
  /** Point estimate of accuracy (possibly recency-weighted). */
  pointEstimate: number;
  /** Effective sample size (Kish n_eff if recency-weighted, else n). */
  effectiveN: number;
  /** Total observations. */
  totalN: number;
  /** Whether the student meets the mastery threshold. */
  isMastered: boolean;
  /** Whether the student meets the gold mastery threshold. */
  isGoldMastery: boolean;
  /** Confidence level used (z-score). */
  zScore: number;
  /** How many more correct answers are needed to reach mastery (0 if already mastered). */
  correctNeededForMastery: number;
}

// ── Core Functions ──

/**
 * Compute the Wilson score lower bound for a binomial proportion.
 *
 * Formula (Wilson, 1927):
 *   w⁻ = (1/(1 + z²/n)) · (p̂ + z²/(2n) − z·√(p̂(1−p̂)/n + z²/(4n²)))
 *
 * @param successes - Number of successes (correct answers)
 * @param n - Total trials
 * @param z - z-score for desired confidence level (default 1.645 for 90%)
 * @returns { lower, upper } Wilson score bounds
 */
export function wilsonScoreBounds(
  successes: number,
  n: number,
  z: number = DEFAULT_Z
): { lower: number; upper: number } {
  if (n <= 0) return { lower: 0, upper: 0 };

  const pHat = successes / n;
  const z2 = z * z;
  const denominator = 1 + z2 / n;
  const center = pHat + z2 / (2 * n);
  const spread = z * Math.sqrt(pHat * (1 - pHat) / n + z2 / (4 * n * n));

  const lower = Math.max(0, (center - spread) / denominator);
  const upper = Math.min(1, (center + spread) / denominator);

  return { lower, upper };
}

/**
 * Compute Kish effective sample size for exponentially decayed weights.
 *
 * n_eff = (Σwᵢ)² / Σwᵢ²
 *
 * With exponential decay weights wᵢ = λ^(n-i) where i is 0-indexed from oldest,
 * this simplifies to a geometric series ratio.
 *
 * @param n - Total observations
 * @param lambda - Decay factor (0 < λ < 1)
 * @returns Effective sample size
 */
export function kishEffectiveSampleSize(n: number, lambda: number): number {
  if (n <= 0) return 0;
  if (lambda >= 1) return n; // No decay = full sample
  if (lambda <= 0) return 1; // Complete decay = only latest matters

  // Geometric series: Σλ^i for i=0..n-1 = (1 - λ^n) / (1 - λ)
  const sumW = (1 - Math.pow(lambda, n)) / (1 - lambda);
  // Σ(λ^i)² = Σλ^(2i) = (1 - λ^(2n)) / (1 - λ²)
  const sumW2 = (1 - Math.pow(lambda, 2 * n)) / (1 - lambda * lambda);

  return (sumW * sumW) / sumW2;
}

/**
 * Compute recency-weighted proportion using exponential decay.
 *
 * p̂_w = Σ(wᵢ · xᵢ) / Σwᵢ
 *
 * @param outcomes - Array of binary outcomes, oldest first
 * @param lambda - Decay factor
 * @returns Weighted proportion
 */
export function weightedProportion(outcomes: boolean[], lambda: number): number {
  if (outcomes.length === 0) return 0;

  let sumWX = 0;
  let sumW = 0;
  const n = outcomes.length;

  for (let i = 0; i < n; i++) {
    // Weight: newest (i = n-1) gets weight 1, oldest (i = 0) gets λ^(n-1)
    const weight = Math.pow(lambda, n - 1 - i);
    sumW += weight;
    if (outcomes[i]) sumWX += weight;
  }

  return sumW > 0 ? sumWX / sumW : 0;
}

/**
 * Assess mastery using Wilson score lower bound with optional recency weighting.
 *
 * When recency weighting is applied (decayLambda < 1), uses Kish effective
 * sample size to adjust the Wilson bounds. A conservative z-value (90%
 * rather than 95%) is used per research recommendation when combining
 * with exponential recency weighting.
 *
 * @param input - Outcomes and configuration
 * @returns Mastery assessment with Wilson bounds and diagnostics
 */
export function assessMastery(input: WilsonMasteryInput): WilsonMasteryResult {
  const {
    outcomes,
    decayLambda,
    zScore = DEFAULT_Z,
    masteryThreshold = MASTERY_THRESHOLD,
  } = input;

  const totalN = outcomes.length;

  if (totalN < MIN_OBSERVATIONS) {
    return {
      wilsonLower: 0,
      wilsonUpper: 0,
      pointEstimate: totalN > 0 ? outcomes.filter(Boolean).length / totalN : 0,
      effectiveN: totalN,
      totalN,
      isMastered: false,
      isGoldMastery: false,
      zScore,
      correctNeededForMastery: MIN_OBSERVATIONS - totalN,
    };
  }

  const useRecencyWeighting = decayLambda != null && decayLambda < 1;

  let pHat: number;
  let effectiveN: number;

  if (useRecencyWeighting) {
    pHat = weightedProportion(outcomes, decayLambda);
    effectiveN = kishEffectiveSampleSize(totalN, decayLambda);
  } else {
    const successes = outcomes.filter(Boolean).length;
    pHat = successes / totalN;
    effectiveN = totalN;
  }

  // Wilson score using effective sample size
  const { lower, upper } = wilsonScoreBounds(
    Math.round(pHat * effectiveN), // weighted successes
    effectiveN,
    zScore
  );

  const isMastered = lower >= masteryThreshold;
  const isGoldMastery = lower >= GOLD_MASTERY_THRESHOLD;

  // Estimate how many more correct answers needed to reach mastery
  let correctNeeded = 0;
  if (!isMastered) {
    // Binary search: how many additional correct answers to push Wilson lower ≥ threshold?
    const currentSuccesses = outcomes.filter(Boolean).length;
    for (let extra = 1; extra <= 50; extra++) {
      const newN = totalN + extra;
      const newSuccesses = currentSuccesses + extra;
      const { lower: newLower } = wilsonScoreBounds(newSuccesses, newN, zScore);
      if (newLower >= masteryThreshold) {
        correctNeeded = extra;
        break;
      }
    }
    if (correctNeeded === 0) correctNeeded = 50; // More than 50 needed
  }

  return {
    wilsonLower: Math.round(lower * 10000) / 10000, // 4 decimal precision
    wilsonUpper: Math.round(upper * 10000) / 10000,
    pointEstimate: Math.round(pHat * 10000) / 10000,
    effectiveN: Math.round(effectiveN * 100) / 100,
    totalN,
    isMastered,
    isGoldMastery,
    zScore,
    correctNeededForMastery: correctNeeded,
  };
}

/**
 * Quick mastery check for a given success count and total.
 * Convenience wrapper when you don't have the full outcome array.
 *
 * @param successes - Number of correct answers
 * @param total - Total attempts
 * @param threshold - Mastery threshold (default 0.80)
 * @returns Whether the Wilson lower bound meets the threshold
 */
export function isWilsonMastered(
  successes: number,
  total: number,
  threshold: number = MASTERY_THRESHOLD
): boolean {
  if (total < MIN_OBSERVATIONS) return false;
  const { lower } = wilsonScoreBounds(successes, total, DEFAULT_Z);
  return lower >= threshold;
}
