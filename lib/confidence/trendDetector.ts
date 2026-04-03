/**
 * Cross-Session Confidence Trend Detector
 *
 * Tracks confidence trajectories across multiple review sessions for the same card.
 * A card whose confidence is declining (0.85 → 0.72 → 0.58) signals an encoding
 * or interference problem that single-review snapshots miss.
 *
 * Research basis:
 * - Bjork (1999): Retrieval practice strengthens memory — declining retrieval success
 *   signals an encoding deficit that needs intervention
 * - Kornell et al. (2009): Spacing effects work across sessions — but only if
 *   each retrieval is successful. Declining confidence = failing spacing benefit
 * - Rawson & Dunlosky (2011): Criterion-level performance must be maintained
 *   across sessions for durability. Declining trajectory = sub-criterion
 *
 * Design:
 * - Examines the last 3-8 reviews of a card
 * - Computes a linear trend slope on confidence values
 * - Negative slope → declining confidence → stability penalty
 * - Positive slope → improving confidence → stability bonus
 * - Flat slope → stable → no adjustment
 * - Trend multiplier range: [0.8, 1.15]
 *
 * Integration:
 * - Fed into the Bayesian accumulator as a trend-aware signal
 * - Applied as a multiplier to stability in drillReviewService
 */

// ── Types ──

export interface ConfidenceTrendResult {
  /** Slope of the confidence trend (positive = improving, negative = declining) */
  slope: number;
  /** Whether the trend is concerning (significant decline) */
  isConcerning: boolean;
  /** Stability multiplier based on the trend [0.8, 1.15] */
  trendMultiplier: number;
  /** Number of data points used */
  dataPoints: number;
  /** R² of the linear fit (0-1, higher = more consistent trend) */
  rSquared: number;
  /** Trend category for logging */
  category: 'improving' | 'stable' | 'declining' | 'concerning';
}

export interface TrendConfig {
  /** Minimum reviews to detect a trend (default: 3) */
  minReviews: number;
  /** Maximum reviews to consider (default: 8) */
  maxReviews: number;
  /** Slope threshold for "concerning" classification (default: -0.08) */
  concerningSlope: number;
  /** Minimum R² to trust the trend (default: 0.3) */
  minRSquared: number;
  /** Maximum stability penalty for declining trend (default: 0.8) */
  maxPenalty: number;
  /** Maximum stability bonus for improving trend (default: 1.15) */
  maxBonus: number;
}

// ── Defaults ──

export const DEFAULT_TREND_CONFIG: TrendConfig = {
  minReviews: 3,
  maxReviews: 8,
  concerningSlope: -0.08,
  minRSquared: 0.3,
  maxPenalty: 0.8,
  maxBonus: 1.15,
};

// ── Core functions ──

/**
 * Simple linear regression on (index, confidence) pairs.
 * Returns slope, intercept, and R² goodness of fit.
 */
export function linearTrendFit(values: number[]): {
  slope: number;
  intercept: number;
  rSquared: number;
} {
  const n = values.length;
  if (n < 2) return { slope: 0, intercept: values[0] ?? 0, rSquared: 0 };

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumX2 += i * i;
  }

  const denom = n * sumX2 - sumX * sumX;
  if (Math.abs(denom) < 1e-10) return { slope: 0, intercept: values[0], rSquared: 0 };

  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  // R² calculation
  const meanY = sumY / n;
  let ssRes = 0, ssTot = 0;
  for (let i = 0; i < n; i++) {
    const predicted = intercept + slope * i;
    ssRes += (values[i] - predicted) ** 2;
    ssTot += (values[i] - meanY) ** 2;
  }
  const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  return { slope, intercept, rSquared };
}

/**
 * Detect confidence trend from a card's review history.
 *
 * @param confidenceHistory - Array of confidence values, oldest first
 * @param config - Optional configuration overrides
 * @returns Trend analysis result with stability multiplier
 */
export function detectConfidenceTrend(
  confidenceHistory: number[],
  config: TrendConfig = DEFAULT_TREND_CONFIG
): ConfidenceTrendResult {
  const neutralResult: ConfidenceTrendResult = {
    slope: 0,
    isConcerning: false,
    trendMultiplier: 1.0,
    dataPoints: confidenceHistory.length,
    rSquared: 0,
    category: 'stable',
  };

  if (confidenceHistory.length < config.minReviews) {
    return neutralResult;
  }

  // Use only the most recent N reviews
  const trimmed = confidenceHistory.slice(-config.maxReviews);
  const { slope, rSquared } = linearTrendFit(trimmed);

  // Don't trust weak trends (low R²)
  if (rSquared < config.minRSquared) {
    return {
      ...neutralResult,
      slope: Math.round(slope * 1000) / 1000,
      rSquared: Math.round(rSquared * 1000) / 1000,
      dataPoints: trimmed.length,
    };
  }

  // Classify the trend
  let category: ConfidenceTrendResult['category'];
  let trendMultiplier: number;
  let isConcerning = false;

  if (slope <= config.concerningSlope) {
    // Significant decline — strong stability penalty
    category = 'concerning';
    isConcerning = true;
    // Map slope to multiplier: concerningSlope → 0.9, 2×concerningSlope → maxPenalty
    const normalizedSlope = Math.min(1, Math.abs(slope) / Math.abs(config.concerningSlope * 2));
    trendMultiplier = 1.0 - normalizedSlope * (1.0 - config.maxPenalty);
  } else if (slope < -0.02) {
    // Mild decline — modest penalty
    category = 'declining';
    const normalizedSlope = Math.abs(slope) / Math.abs(config.concerningSlope);
    trendMultiplier = 1.0 - normalizedSlope * 0.1;
  } else if (slope > 0.04) {
    // Improving trend — stability bonus
    category = 'improving';
    const normalizedSlope = Math.min(1, slope / 0.15);
    trendMultiplier = 1.0 + normalizedSlope * (config.maxBonus - 1.0);
  } else {
    // Stable
    category = 'stable';
    trendMultiplier = 1.0;
  }

  trendMultiplier = Math.max(config.maxPenalty, Math.min(config.maxBonus, trendMultiplier));

  return {
    slope: Math.round(slope * 1000) / 1000,
    isConcerning,
    trendMultiplier: Math.round(trendMultiplier * 1000) / 1000,
    dataPoints: trimmed.length,
    rSquared: Math.round(rSquared * 1000) / 1000,
    category,
  };
}
