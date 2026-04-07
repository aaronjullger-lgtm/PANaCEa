/**
 * Retrievability Calibration Service (Sprint 4)
 *
 * Tracks FSRS predicted retrievability vs actual recall outcomes to detect
 * systematic over/under-confidence in the scheduling model.
 *
 * Core idea: FSRS predicts P(recall) = retrievability. If the model is well-calibrated,
 * among all reviews where R ≈ 0.8, about 80% should be correct.
 *
 * This service:
 * 1. Buckets review outcomes by predicted retrievability (10 bins: 0-0.1, 0.1-0.2, ...)
 * 2. Computes per-bin actual recall rate
 * 3. Derives per-system correction factors for systems that deviate from calibration
 * 4. Exposes a correction multiplier that drillReviewService can apply to stability
 *
 * Data source: ReviewLog table (retrievability, wasCorrect, system)
 *
 * @see lib/services/drillReviewService.ts — Consumer of correction factors
 */

import type { PrismaClient } from '@prisma/client';

// ── Types ──

export interface CalibrationBin {
  /** Center of the bin (e.g., 0.85 for the 0.8-0.9 bin) */
  predictedCenter: number;
  /** Actual recall rate in this bin */
  actualRecallRate: number;
  /** Number of reviews in this bin */
  count: number;
  /** Ratio: actual / predicted. >1 = model underestimates, <1 = overestimates */
  calibrationRatio: number;
}
export interface CalibrationReport {
  /** Overall calibration bins across all systems */
  global: CalibrationBin[];
  /** Per-system calibration bins (only systems with 50+ reviews) */
  bySystem: Record<string, CalibrationBin[]>;
  /** Per-system correction factors for stability adjustment */
  systemCorrectionFactors: Record<string, number>;
  /** Global correction factor (weighted average deviation) */
  globalCorrectionFactor: number;
  /** Total reviews analyzed */
  totalReviews: number;
  /** When this report was generated */
  generatedAt: string;
}

// ── Constants ──

const NUM_BINS = 10;
const MIN_BIN_COUNT = 30; // Minimum reviews in a bin to be statistically meaningful
const MIN_SYSTEM_REVIEWS = 200; // Minimum reviews for per-system correction
const SHRINKAGE_N = 200; // Shrinkage toward 1.0: factor = 1 + (raw - 1) * min(1, n/SHRINKAGE_N)
const CORRECTION_CLAMP_MIN = 0.7; // Don't over-correct: max 30% reduction
const CORRECTION_CLAMP_MAX = 1.4; // Don't over-correct: max 40% increase
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ── In-memory cache ──

let cachedReport: CalibrationReport | null = null;
let cacheTimestamp = 0;
// ── Pure algorithm functions (exported for testing) ──

/**
 * Bucket reviews into calibration bins.
 * Each review has a predicted retrievability and a boolean outcome.
 */
export function bucketReviews(
  reviews: Array<{ retrievability: number; wasCorrect: boolean }>
): CalibrationBin[] {
  if (reviews.length === 0) return [];

  // Sort by retrievability for quantile binning (equal-count bins)
  const sorted = [...reviews].sort((a, b) => a.retrievability - b.retrievability);
  const binSize = Math.max(1, Math.floor(sorted.length / NUM_BINS));

  const result: CalibrationBin[] = [];

  for (let i = 0; i < NUM_BINS; i++) {
    const start = i * binSize;
    const end = i === NUM_BINS - 1 ? sorted.length : start + binSize;
    const binReviews = sorted.slice(start, end);

    if (binReviews.length === 0) continue;

    const correct = binReviews.filter(r => r.wasCorrect).length;
    const total = binReviews.length;
    const predictedCenter = binReviews.reduce((sum, r) => sum + r.retrievability, 0) / total;
    const actualRecallRate = total >= MIN_BIN_COUNT
      ? correct / total
      : predictedCenter; // Insufficient data → assume calibrated
    const rawRatio = predictedCenter > 0
      ? actualRecallRate / predictedCenter
      : 1;
    // Shrinkage toward 1.0 proportional to sample size
    const shrinkage = Math.min(1, total / SHRINKAGE_N);
    const calibrationRatio = 1.0 + (rawRatio - 1.0) * shrinkage;

    result.push({
      predictedCenter,
      actualRecallRate,
      count: total,
      calibrationRatio,
    });
  }

  return result;
}
/**
 * Compute a single correction factor from calibration bins.
 *
 * Uses weighted average of calibration ratios from bins with enough data,
 * focusing on the 0.6-0.9 range where FSRS predictions matter most
 * (that's where due cards typically fall).
 */
export function computeCorrectionFactor(bins: CalibrationBin[]): number {
  let weightedSum = 0;
  let totalWeight = 0;

  for (const bin of bins) {
    if (bin.count < MIN_BIN_COUNT) continue;
    // Weight bins in the 0.5-0.95 range more heavily — that's where scheduling decisions matter
    const relevanceWeight = bin.predictedCenter >= 0.5 && bin.predictedCenter <= 0.95
      ? bin.count * 2
      : bin.count;
    weightedSum += bin.calibrationRatio * relevanceWeight;
    totalWeight += relevanceWeight;
  }

  if (totalWeight === 0) return 1.0; // No data → no correction

  const rawFactor = weightedSum / totalWeight;
  return Math.max(CORRECTION_CLAMP_MIN, Math.min(CORRECTION_CLAMP_MAX, rawFactor));
}

/**
 * Generate a full calibration report for a user.
 * Queries ReviewLog for all reviews with retrievability data.
 */
export async function generateCalibrationReport(
  prisma: PrismaClient,
  userId: string
): Promise<CalibrationReport> {  // Fetch all reviews with retrievability data (non-null, real reviews only)
  const reviews = await prisma.reviewLog.findMany({
    where: {
      userId,
      retrievability: { not: null },
      review_type: { not: 'rapid_guess' }, // Exclude rapid guesses — no meaningful prediction
    },
    select: {
      retrievability: true,
      wasCorrect: true,
      system: true,
    },
  });

  const validReviews = reviews
    .filter((r): r is typeof r & { retrievability: number } => r.retrievability != null)
    .map(r => ({
      retrievability: r.retrievability,
      wasCorrect: r.wasCorrect,
      system: r.system ?? 'unknown',
    }));

  // Global calibration
  const globalBins = bucketReviews(validReviews);
  const globalCorrectionFactor = computeCorrectionFactor(globalBins);

  // Per-system calibration
  const systemGroups = new Map<string, Array<{ retrievability: number; wasCorrect: boolean }>>();
  for (const review of validReviews) {
    const group = systemGroups.get(review.system) ?? [];
    group.push(review);
    systemGroups.set(review.system, group);
  }
  const bySystem: Record<string, CalibrationBin[]> = {};
  const systemCorrectionFactors: Record<string, number> = {};

  for (const [system, systemReviews] of systemGroups) {
    if (systemReviews.length < MIN_SYSTEM_REVIEWS) continue;
    const bins = bucketReviews(systemReviews);
    bySystem[system] = bins;
    systemCorrectionFactors[system] = computeCorrectionFactor(bins);
  }

  const report: CalibrationReport = {
    global: globalBins,
    bySystem,
    systemCorrectionFactors,
    globalCorrectionFactor,
    totalReviews: validReviews.length,
    generatedAt: new Date().toISOString(),
  };

  // Cache the report
  cachedReport = report;
  cacheTimestamp = Date.now();

  return report;
}

/**
 * Get the stability correction factor for a given body system.
 * Falls back to global correction if system-specific data is insufficient.
 *
 * Returns a multiplier for FSRS stability:
 * - > 1.0: model underestimates retention → increase stability (longer intervals)
 * - < 1.0: model overestimates retention → decrease stability (shorter intervals)
 * - = 1.0: model is well-calibrated → no change
 */
export async function getStabilityCorrectionFactor(
  prisma: PrismaClient,
  userId: string,
  system?: string | null
): Promise<number> {  // Use cached report if fresh enough
  let report = cachedReport;
  if (!report || Date.now() - cacheTimestamp > CACHE_TTL_MS) {
    report = await generateCalibrationReport(prisma, userId);
  }

  // Prefer system-specific correction if available
  if (system && report.systemCorrectionFactors[system] !== undefined) {
    return report.systemCorrectionFactors[system];
  }

  return report.globalCorrectionFactor;
}

/** Clear the cached report (for testing or after significant data changes) */
export function clearCalibrationCache(): void {
  cachedReport = null;
  cacheTimestamp = 0;
}

/** Export constants for testing */
export const CALIBRATION_CONSTANTS = {
  NUM_BINS,
  MIN_BIN_COUNT,
  MIN_SYSTEM_REVIEWS,
  CORRECTION_CLAMP_MIN,
  CORRECTION_CLAMP_MAX,
  CACHE_TTL_MS,
} as const;


// ══════════════════════════════════════════════════════════════════════════
// Sprint 8: Rolling-Window Calibration Drift Detection
// ══════════════════════════════════════════════════════════════════════════
//
// Compares the last 200 reviews (long window) against the last 50 reviews
// (short window) to detect if the learner's retention is shifting.
// If the short-window correction diverges significantly from the long-window,
// it signals FSRS parameters need re-optimization.

const LONG_WINDOW = 200;
const SHORT_WINDOW = 50;
const DRIFT_THRESHOLD = 0.15;

export interface DriftReport {
  /** Long-window (last 200 reviews) correction factor */
  longWindowFactor: number;
  /** Short-window (last 50 reviews) correction factor */
  shortWindowFactor: number;
  /** Absolute difference between short and long factors */
  drift: number;
  /** Whether drift exceeds the threshold */
  isDrifting: boolean;
  /** Direction of change: improving, degrading, or stable */
  direction: 'improving' | 'degrading' | 'stable';
  /** Per-system drift breakdown */
  systemDrift: Record<string, {
    longFactor: number;
    shortFactor: number;
    drift: number;
    isDrifting: boolean;
  }>;
}

/**
 * Detect calibration drift from an ordered array of review records.
 * Pure function — no DB access. Exported for testing.
 */
export function detectDrift(
  reviews: Array<{ retrievability: number; wasCorrect: boolean; system?: string }>
): DriftReport {
  const longWindow = reviews.slice(-LONG_WINDOW);
  const shortWindow = reviews.slice(-SHORT_WINDOW);

  const longFactor = computeCorrectionFactor(bucketReviews(longWindow));
  const shortFactor = computeCorrectionFactor(bucketReviews(shortWindow));

  const driftVal = Math.abs(shortFactor - longFactor);
  const isDrifting = driftVal > DRIFT_THRESHOLD;

  let direction: 'improving' | 'degrading' | 'stable' = 'stable';
  if (isDrifting) {
    direction = shortFactor > longFactor ? 'improving' : 'degrading';
  }

  // Per-system drift
  const systems = new Set(
    reviews.map(r => r.system).filter((s): s is string => !!s)
  );
  const systemDrift: DriftReport['systemDrift'] = {};

  for (const system of systems) {
    const sysReviews = reviews.filter(r => r.system === system);
    if (sysReviews.length < MIN_SYSTEM_REVIEWS) continue;

    const sysLong = sysReviews.slice(-LONG_WINDOW);
    const sysShort = sysReviews.slice(-SHORT_WINDOW);
    const sysLongFactor = computeCorrectionFactor(bucketReviews(sysLong));
    const sysShortFactor = computeCorrectionFactor(bucketReviews(sysShort));
    const sysDrift = Math.abs(sysShortFactor - sysLongFactor);

    systemDrift[system] = {
      longFactor: sysLongFactor,
      shortFactor: sysShortFactor,
      drift: sysDrift,
      isDrifting: sysDrift > DRIFT_THRESHOLD,
    };
  }

  return {
    longWindowFactor: longFactor,
    shortWindowFactor: shortFactor,
    drift: driftVal,
    isDrifting,
    direction,
    systemDrift,
  };
}

/**
 * Generate a drift report from ReviewLog for a user.
 * DB-integrated version of detectDrift.
 */
export async function generateDriftReport(
  prisma: PrismaClient,
  userId: string
): Promise<DriftReport> {
  const reviews = await prisma.reviewLog.findMany({
    where: {
      userId,
      retrievability: { not: null },
      review_type: { not: 'rapid_guess' },
    },
    select: {
      retrievability: true,
      wasCorrect: true,
      system: true,
    },
    orderBy: { reviewedAt: 'asc' },
  });

  const validReviews = reviews
    .filter((r): r is typeof r & { retrievability: number } =>
      r.retrievability != null
    )
    .map(r => ({
      retrievability: r.retrievability,
      wasCorrect: r.wasCorrect,
      system: r.system ?? undefined,
    }));

  return detectDrift(validReviews);
}

/** Export drift constants for testing */
export const DRIFT_CONSTANTS = {
  LONG_WINDOW,
  SHORT_WINDOW,
  DRIFT_THRESHOLD,
} as const;
