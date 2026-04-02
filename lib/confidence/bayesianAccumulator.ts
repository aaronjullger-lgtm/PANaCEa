/**
 * Bayesian Confidence Accumulator
 *
 * Blends current-session confidence with historical review confidence for the
 * same card, providing more stable confidence estimates over time.
 *
 * Research basis:
 * - Mozer et al. (2009): Bayesian models of memory — accumulating evidence across
 *   study events improves prediction of long-term retention
 * - Benjamin et al. (1998): Delayed JOLs more accurate than immediate — historical
 *   context improves metacognitive accuracy
 *
 * Design principles:
 * - Current session always dominates (≥60% weight)
 * - Prior weight capped at 0.4 to prevent stale history from overriding improvement
 * - Exponential decay weights older reviews less
 * - Quality-aware: full-telemetry reviews weighted more than minimal
 * - Correctness alignment: consistent signals weighted more than contradictory
 */

import type { TelemetryQuality } from '../implicit-metrics';

// ── Types ──

export interface HistoricalReview {
  confidence: number;
  wasCorrect: boolean;
  telemetryQuality: TelemetryQuality;
}

export interface AccumulatedConfidence {
  /** Bayesian-updated confidence (blend of current + history) */
  posterior: number;
  /** How much the prior influenced the result (0 = all current, up to 0.4 = max history) */
  priorWeight: number;
  /** Number of historical reviews considered */
  historyLength: number;
}

export interface AccumulatorConfig {
  /** Exponential decay factor for older reviews (default: 0.7) */
  decayFactor: number;
  /** Minimum history length before prior is applied (default: 3) */
  minHistoryForPrior: number;
  /** Maximum history entries to consider (default: 10) */
  maxHistory: number;
  /** Weight multipliers by telemetry quality */
  qualityWeights: Record<TelemetryQuality, number>;
  /** Maximum prior influence (default: 0.4) */
  maxPriorWeight: number;
}

// ── Defaults ──

export const DEFAULT_ACCUMULATOR_CONFIG: AccumulatorConfig = {
  decayFactor: 0.7,
  minHistoryForPrior: 3,
  maxHistory: 10,
  qualityWeights: {
    full: 1.0,
    partial: 0.6,
    minimal: 0.3,
  },
  maxPriorWeight: 0.4,
};

// ── Core function ──

/**
 * Accumulate confidence by blending current-session confidence with
 * historical reviews of the same card.
 *
 * @param currentConfidence - Confidence from the current review's deriveContinuousRating
 * @param currentIsCorrect - Whether the current answer was correct
 * @param history - Array of past reviews for this card (newest first)
 * @param config - Optional configuration overrides
 * @returns Posterior confidence and metadata
 */
export function accumulateConfidence(
  currentConfidence: number,
  currentIsCorrect: boolean,
  history: HistoricalReview[],
  config: AccumulatorConfig = DEFAULT_ACCUMULATOR_CONFIG
): AccumulatedConfidence {
  // Not enough history → return current confidence unchanged
  if (history.length < config.minHistoryForPrior) {
    return {
      posterior: currentConfidence,
      priorWeight: 0,
      historyLength: history.length,
    };
  }

  // Trim to maxHistory (most recent)
  const trimmed = history.slice(0, config.maxHistory);

  // Compute weighted historical mean
  let weightedSum = 0;
  let totalWeight = 0;

  for (let i = 0; i < trimmed.length; i++) {
    const review = trimmed[i];

    // Exponential decay: newest = 1.0, older = decay^i
    const ageWeight = Math.pow(config.decayFactor, i);

    // Quality weight: full telemetry reviews are more trustworthy
    const qualWeight = config.qualityWeights[review.telemetryQuality] ?? 0.3;

    // Correctness alignment: if past review correctness matches current,
    // that's a consistent signal (weight more). If they disagree,
    // the card's difficulty may have changed (weight less).
    const alignmentWeight = (review.wasCorrect === currentIsCorrect) ? 1.0 : 0.5;

    const w = ageWeight * qualWeight * alignmentWeight;
    weightedSum += review.confidence * w;
    totalWeight += w;
  }

  if (totalWeight === 0) {
    return {
      posterior: currentConfidence,
      priorWeight: 0,
      historyLength: trimmed.length,
    };
  }

  const historicalMean = weightedSum / totalWeight;

  // Shrinkage prior: history influence grows with data but caps at maxPriorWeight
  // priorWeight = min(maxPriorWeight, n / (n + 5))
  // At n=3: 0.375 → capped at 0.375
  // At n=5: 0.5 → capped at 0.4
  // At n=10: 0.667 → capped at 0.4
  const rawPrior = trimmed.length / (trimmed.length + 5);
  const priorWeight = Math.min(config.maxPriorWeight, rawPrior);

  // Bayesian blend
  const posterior = priorWeight * historicalMean + (1 - priorWeight) * currentConfidence;

  return {
    posterior,
    priorWeight: Math.round(priorWeight * 1000) / 1000,
    historyLength: trimmed.length,
  };
}
