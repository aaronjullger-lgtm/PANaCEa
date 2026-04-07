/**
 * User RT Baseline Service — Per-User Median Response Time Materialization
 *
 * Maintains a rolling median response time per user in UserSRSConfig.
 * This value is consumed by the grade modulation coordinator for RT zone
 * classification (fast/normal/slow thresholds are relative to user median).
 *
 * Called at session completion to avoid per-question DB writes.
 *
 * @module lib/services/userRtBaselineService
 * @see PANaCEa_Behavioral_Analysis_Audit.md § 2.1, Gap 3
 */

// ─── Types ──────────────────────────────────────────────────

/** Input for the pure median calculation (no Prisma dependency). */
export interface RtSample {
  responseTimeMs: number;
}

/** Result of median calculation. */
export interface MedianRtResult {
  /** Computed median RT in ms */
  medianMs: number;
  /** Number of valid samples used */
  sampleCount: number;
}

// ─── Constants ──────────────────────────────────────────────

/** Minimum number of reviews before we compute a meaningful median. */
export const MIN_RT_SAMPLES = 5;

/** Maximum number of recent reviews to sample for median calculation. */
export const MAX_RT_SAMPLE_WINDOW = 50;

/** RT values below this are likely rapid-guess artifacts and should be excluded. */
export const MIN_VALID_RT_MS = 1000;

/** RT values above this are likely AFK/distracted and should be excluded. */
export const MAX_VALID_RT_MS = 180_000;

// ─── Pure Functions (Testable) ──────────────────────────────

/**
 * Compute median from an array of RT samples, filtering outliers.
 *
 * Excludes values below MIN_VALID_RT_MS (rapid-guess) and above
 * MAX_VALID_RT_MS (AFK). Returns null if fewer than MIN_RT_SAMPLES
 * valid values remain after filtering.
 *
 * @param samples - Array of response time samples
 * @returns Median result, or null if insufficient valid data
 *
 * @example
 *   computeMedianRt([
 *     { responseTimeMs: 500 },    // excluded: below MIN_VALID_RT_MS
 *     { responseTimeMs: 8000 },
 *     { responseTimeMs: 12000 },
 *     { responseTimeMs: 15000 },
 *     { responseTimeMs: 10000 },
 *     { responseTimeMs: 200000 },  // excluded: above MAX_VALID_RT_MS
 *   ])
 *   // → { medianMs: 11000, sampleCount: 4 }
 */
export function computeMedianRt(samples: RtSample[]): MedianRtResult | null {
  // Filter to valid range
  const validRts = samples
    .map(s => s.responseTimeMs)
    .filter(rt => rt >= MIN_VALID_RT_MS && rt <= MAX_VALID_RT_MS);

  if (validRts.length < MIN_RT_SAMPLES) {
    return null;
  }

  // Sort ascending for median selection
  const sorted = [...validRts].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  // For even-length arrays, use the lower-middle element (floor median)
  // This is simpler and consistent with the audit spec
  const medianMs = sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];

  return {
    medianMs,
    sampleCount: sorted.length,
  };
}

/**
 * Compute incremental rolling window statistics for fatigue detection.
 *
 * Given the current rolling window (last N items) and a new data point,
 * returns updated rolling accuracy and mean RT. Window size defaults to 10.
 *
 * @param currentWindow - Array of recent {isCorrect, responseTimeMs} entries
 * @param windowSize - Maximum items in the rolling window (default 10)
 * @returns Updated rolling stats
 *
 * @example
 *   computeRollingWindowStats([
 *     { isCorrect: true, responseTimeMs: 10000 },
 *     { isCorrect: false, responseTimeMs: 15000 },
 *     { isCorrect: true, responseTimeMs: 12000 },
 *   ])
 *   // → { rollingAccuracy: 0.667, rollingMeanRtMs: 12333, windowSize: 3 }
 */
export function computeRollingWindowStats(
  currentWindow: Array<{ isCorrect: boolean; responseTimeMs: number }>,
  windowSize: number = 10
): { rollingAccuracy: number; rollingMeanRtMs: number; windowSize: number } {
  // Take only the last windowSize entries
  const window = currentWindow.slice(-windowSize);

  if (window.length === 0) {
    return { rollingAccuracy: 0, rollingMeanRtMs: 0, windowSize: 0 };
  }

  const correctCount = window.filter(w => w.isCorrect).length;
  const totalRt = window.reduce((sum, w) => sum + w.responseTimeMs, 0);

  return {
    rollingAccuracy: correctCount / window.length,
    rollingMeanRtMs: Math.round(totalRt / window.length),
    windowSize: window.length,
  };
}
