/**
 * Shared Calibration Math — Edge-compatible pure functions
 *
 * Extracted from the inline hotfix in `calibration-insights.ts` and the canonical
 * `retrievabilityCalibrationService.ts` to create a single source of truth for
 * calibration binning, correction factors, drift detection, and circadian phases.
 *
 * These functions are PURE (no Prisma, no Node APIs) and safe to import in
 * Cloudflare Edge Functions.
 *
 * The canonical `retrievabilityCalibrationService.ts` should import from here
 * for its own binning/correction logic; the Edge endpoints already do.
 *
 * @see functions/api/study/calibration-insights.ts
 * @see functions/api/user/calibration.ts
 * @see lib/services/retrievabilityCalibrationService.ts
 */

// ── Constants ──

export const CALIBRATION_CONSTANTS = {
  /** Number of uniform bins for edge endpoints (quantile binning lives in the full service) */
  BIN_COUNT: 10,
  /** Minimum reviews for a system to have its own calibration factor */
  MIN_SYSTEM_REVIEWS: 20,
  /** Minimum total reviews before drift detection is meaningful */
  MIN_DRIFT_REVIEWS: 100,
  /** Drift threshold: absolute difference in correction factors */
  DRIFT_THRESHOLD: 0.1,
  /** Fraction of reviews used for the "short window" in drift detection */
  SHORT_WINDOW_FRACTION: 1 / 3,
} as const;

// ── Types ──

export interface CalibrationBin {
  /** Mean predicted retrievability in this bin */
  predictedCenter: number;
  /** Actual recall rate (correct / total) */
  actualRecallRate: number;
  /** Number of reviews in this bin */
  count: number;
  /** actual / predicted — >1 means model underestimates recall */
  calibrationRatio: number;
}

export interface CalibrationReview {
  retrievability: number;
  wasCorrect: boolean;
  system?: string;
  hourOfDay: number;
}

export type DriftDirection = 'improving' | 'declining' | 'stable';

export interface DriftResult {
  longWindowFactor: number;
  shortWindowFactor: number;
  drift: number;
  isDrifting: boolean;
  direction: DriftDirection;
}

export type CircadianPhase = 'morning' | 'afternoon' | 'evening' | 'night';

// ── Pure Functions ──

/**
 * Bin reviews by predicted retrievability into uniform-width bins.
 *
 * This is a simplified version suitable for dashboard display. The full
 * service uses quantile (equal-count) binning with shrinkage — use
 * `retrievabilityCalibrationService.bucketReviews` for FSRS correction.
 */
export function bucketReviews(reviews: CalibrationReview[]): CalibrationBin[] {
  if (reviews.length === 0) return [];

  const bins: { predicted: number[]; correct: number; total: number }[] = [];
  for (let i = 0; i < CALIBRATION_CONSTANTS.BIN_COUNT; i++) {
    bins.push({ predicted: [], correct: 0, total: 0 });
  }

  for (const r of reviews) {
    const idx = Math.min(
      Math.floor(r.retrievability * CALIBRATION_CONSTANTS.BIN_COUNT),
      CALIBRATION_CONSTANTS.BIN_COUNT - 1
    );
    bins[idx].predicted.push(r.retrievability);
    bins[idx].total++;
    if (r.wasCorrect) bins[idx].correct++;
  }

  return bins
    .filter((b) => b.total > 0)
    .map((b) => {
      const predictedCenter = b.predicted.reduce((a, c) => a + c, 0) / b.predicted.length;
      const actualRecallRate = b.correct / b.total;
      return {
        predictedCenter,
        actualRecallRate,
        count: b.total,
        calibrationRatio: actualRecallRate / Math.max(predictedCenter, 0.01),
      };
    });
}

/**
 * Compute a single correction factor from calibration bins.
 * Weighted average of calibration ratios, using bin count as weight.
 */
export function computeCorrectionFactor(bins: CalibrationBin[]): number {
  if (bins.length === 0) return 1.0;
  const totalWeight = bins.reduce((s, b) => s + b.count, 0);
  const weightedSum = bins.reduce((s, b) => s + b.calibrationRatio * b.count, 0);
  return totalWeight > 0 ? weightedSum / totalWeight : 1.0;
}

/**
 * Detect calibration drift by comparing long-window vs short-window factors.
 *
 * Requires at least MIN_DRIFT_REVIEWS reviews to produce a meaningful signal.
 * The short window is the most recent 1/3 of reviews.
 */
export function detectDrift(reviews: CalibrationReview[]): DriftResult {
  if (reviews.length < CALIBRATION_CONSTANTS.MIN_DRIFT_REVIEWS) {
    return {
      longWindowFactor: 1.0,
      shortWindowFactor: 1.0,
      drift: 0,
      isDrifting: false,
      direction: 'stable',
    };
  }

  const longBins = bucketReviews(reviews);
  const shortWindow = reviews.slice(
    -Math.floor(reviews.length * CALIBRATION_CONSTANTS.SHORT_WINDOW_FRACTION)
  );
  const shortBins = bucketReviews(shortWindow);

  const longFactor = computeCorrectionFactor(longBins);
  const shortFactor = computeCorrectionFactor(shortBins);

  const drift = shortFactor - longFactor;
  const isDrifting = Math.abs(drift) > CALIBRATION_CONSTANTS.DRIFT_THRESHOLD;
  const direction: DriftDirection =
    drift > CALIBRATION_CONSTANTS.DRIFT_THRESHOLD
      ? 'improving'
      : drift < -CALIBRATION_CONSTANTS.DRIFT_THRESHOLD
        ? 'declining'
        : 'stable';

  return { longWindowFactor: longFactor, shortWindowFactor: shortFactor, drift, isDrifting, direction };
}

/**
 * Map hour-of-day (0–23) to a circadian phase label.
 */
export function getCircadianPhase(hour: number): CircadianPhase {
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}
