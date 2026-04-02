/**
 * Calibration Service
 *
 * Computes a per-user metacognitive calibration score by comparing
 * implicit confidence from past reviews to actual retention on subsequent reviews.
 *
 * Research basis:
 * - Dunlosky & Nelson (1992): JOL calibration varies by individual
 * - Koriat (1997): Cue utilization theory — some learners attend to non-diagnostic cues
 * - Brier (1950): Brier score = mean((predicted - actual)²) for probability calibration
 *
 * Architecture:
 * - Pulls ReviewLog pairs (review_i → review_i+1) for same conditionId
 * - Computes Brier score, calibration slope, and per-bucket accuracy
 * - Derives a dampener factor: overconfident → dampen, underconfident → boost
 * - Cached in UserStatistics, refreshed every 50 reviews or 7 days
 */

import type { PrismaClient } from '@prisma/client';

// ── Types ──

export interface CalibrationBucket {
  /** Confidence range for this bucket */
  confidenceRange: [number, number];
  /** Mean confidence of reviews in this bucket */
  predictedRetention: number;
  /** Fraction of next-reviews that were correct */
  actualRetention: number;
  /** Number of review pairs in this bucket */
  count: number;
}

export interface UserCalibration {
  /** Brier score: 0 = perfect calibration, 1 = worst */
  brierScore: number;
  /** Linear regression slope of predicted vs actual: >1 = underconfident, <1 = overconfident */
  calibrationSlope: number;
  /** Intercept of calibration regression */
  calibrationIntercept: number;
  /** Per-confidence-range breakdown */
  buckets: CalibrationBucket[];
  /** Derived correction factor for confidence: 1.0 = well-calibrated */
  dampenerFactor: number;
  /** Number of review pairs used */
  n: number;
  /** When this calibration was computed */
  computedAt: string;
}

// ── Constants ──

/** Minimum review pairs needed for calibration */
const MIN_PAIRS_FOR_CALIBRATION = 30;

/** How often to recompute (reviews) */
const RECOMPUTE_EVERY_N_REVIEWS = 50;

/** Max staleness before recompute */
const MAX_STALENESS_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/** Calibration bucket boundaries */
const BUCKET_BOUNDARIES: Array<[number, number]> = [
  [0.3, 0.5],
  [0.5, 0.6],
  [0.6, 0.7],
  [0.7, 0.8],
  [0.8, 0.95],
];

/** Dampener factor bounds */
const MIN_DAMPENER = 0.7;
const MAX_DAMPENER = 1.3;

// ── Pure computation functions (exported for testing) ──

/**
 * Compute Brier score from prediction-outcome pairs.
 * Brier = mean((confidence_i - wasCorrect_i)²)
 */
export function computeBrierScore(
  pairs: Array<{ confidence: number; wasCorrect: boolean }>
): number {
  if (pairs.length === 0) return 0.5; // No data → assume moderate
  const sum = pairs.reduce((acc, p) => {
    const actual = p.wasCorrect ? 1 : 0;
    return acc + (p.confidence - actual) ** 2;
  }, 0);
  return sum / pairs.length;
}

/**
 * Simple linear regression: y = slope * x + intercept
 * x = predicted confidence, y = actual outcome (0 or 1)
 */
export function linearRegression(
  pairs: Array<{ confidence: number; wasCorrect: boolean }>
): { slope: number; intercept: number } {
  if (pairs.length < 2) return { slope: 1, intercept: 0 };

  const n = pairs.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (const p of pairs) {
    const x = p.confidence;
    const y = p.wasCorrect ? 1 : 0;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
  }

  const denom = n * sumX2 - sumX * sumX;
  if (Math.abs(denom) < 1e-10) return { slope: 1, intercept: 0 };

  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

/**
 * Bin pairs into calibration buckets and compute per-bucket accuracy.
 */
export function computeCalibrationBuckets(
  pairs: Array<{ confidence: number; wasCorrect: boolean }>
): CalibrationBucket[] {
  return BUCKET_BOUNDARIES.map(([lo, hi]) => {
    const inBucket = pairs.filter(p => p.confidence >= lo && p.confidence < hi);
    if (inBucket.length === 0) {
      return {
        confidenceRange: [lo, hi],
        predictedRetention: (lo + hi) / 2,
        actualRetention: 0,
        count: 0,
      };
    }
    const meanConf = inBucket.reduce((s, p) => s + p.confidence, 0) / inBucket.length;
    const actualCorrect = inBucket.filter(p => p.wasCorrect).length / inBucket.length;
    return {
      confidenceRange: [lo, hi],
      predictedRetention: Math.round(meanConf * 1000) / 1000,
      actualRetention: Math.round(actualCorrect * 1000) / 1000,
      count: inBucket.length,
    };
  });
}

/**
 * Derive dampener factor from calibration slope.
 * - Well-calibrated (slope 0.8–1.2): factor = 1.0
 * - Overconfident (slope < 0.8): factor < 1.0 (dampen high confidence)
 * - Underconfident (slope > 1.2): factor > 1.0 (boost confidence)
 *
 * Formula: factor = clamp(0.7 + 0.3 × slope, MIN_DAMPENER, MAX_DAMPENER)
 */
export function deriveDampenerFactor(slope: number, brierScore: number): number {
  // Well-calibrated: no adjustment needed
  if (slope >= 0.8 && slope <= 1.2 && brierScore < 0.25) {
    return 1.0;
  }
  const raw = 0.7 + 0.3 * slope;
  return Math.max(MIN_DAMPENER, Math.min(MAX_DAMPENER, raw));
}

/**
 * Compute full calibration profile from prediction-outcome pairs.
 */
export function computeCalibrationProfile(
  pairs: Array<{ confidence: number; wasCorrect: boolean }>
): UserCalibration {
  const brierScore = computeBrierScore(pairs);
  const { slope, intercept } = linearRegression(pairs);
  const buckets = computeCalibrationBuckets(pairs);
  const dampenerFactor = deriveDampenerFactor(slope, brierScore);

  return {
    brierScore: Math.round(brierScore * 10000) / 10000,
    calibrationSlope: Math.round(slope * 1000) / 1000,
    calibrationIntercept: Math.round(intercept * 1000) / 1000,
    buckets,
    dampenerFactor: Math.round(dampenerFactor * 1000) / 1000,
    n: pairs.length,
    computedAt: new Date().toISOString(),
  };
}

// ── Database functions ──

/**
 * Build prediction-outcome pairs from ReviewLog history.
 * For each conditionId, pairs consecutive reviews: confidence from review_i
 * compared to wasCorrect from review_i+1.
 */
export async function buildCalibrationPairs(
  prisma: PrismaClient,
  userId: string,
  lookbackDays: number = 90
): Promise<Array<{ confidence: number; wasCorrect: boolean }>> {
  const cutoff = new Date(Date.now() - lookbackDays * 86400000);

  // Fetch reviews with confidence, grouped by condition
  const reviews = await (prisma as any).reviewLog.findMany({
    where: {
      userId,
      implicit_confidence: { not: null },
      review_type: 'real',
      reviewedAt: { gte: cutoff },
    },
    select: {
      conditionId: true,
      implicit_confidence: true,
      wasCorrect: true,
      reviewedAt: true,
    },
    orderBy: [
      { conditionId: 'asc' },
      { reviewedAt: 'asc' },
    ],
  });

  // Group by conditionId
  const byCondition = new Map<string, Array<{ confidence: number; wasCorrect: boolean }>>();
  for (const r of reviews) {
    if (!r.conditionId || r.implicit_confidence == null) continue;
    if (!byCondition.has(r.conditionId)) {
      byCondition.set(r.conditionId, []);
    }
    byCondition.get(r.conditionId)!.push({
      confidence: r.implicit_confidence as number,
      wasCorrect: r.wasCorrect as boolean,
    });
  }

  // Build pairs: confidence from review_i predicting wasCorrect of review_i+1
  const pairs: Array<{ confidence: number; wasCorrect: boolean }> = [];
  for (const [, conditionReviews] of byCondition) {
    for (let i = 0; i < conditionReviews.length - 1; i++) {
      pairs.push({
        confidence: conditionReviews[i].confidence,
        wasCorrect: conditionReviews[i + 1].wasCorrect,
      });
    }
  }

  return pairs;
}

/**
 * Get user's calibration profile, recomputing if stale.
 * Returns a neutral profile (dampenerFactor=1.0) if insufficient data.
 */
export async function getUserCalibration(
  prisma: PrismaClient,
  userId: string
): Promise<UserCalibration> {
  const neutralCalibration: UserCalibration = {
    brierScore: 0.25,
    calibrationSlope: 1,
    calibrationIntercept: 0,
    buckets: [],
    dampenerFactor: 1.0,
    n: 0,
    computedAt: new Date().toISOString(),
  };

  try {
    // Check cache
    const stats = await (prisma as any).userStatistics.findUnique({
      where: { userId },
      select: { timingProfile: true, totalQuestions: true },
    });

    const cached = (stats?.timingProfile as Record<string, unknown> | null)
      ?.calibrationProfile as UserCalibration | undefined;

    if (cached?.computedAt) {
      const age = Date.now() - new Date(cached.computedAt).getTime();
      const reviewsSinceLast = (stats?.totalQuestions ?? 0) - (cached.n ?? 0);
      // Return cached if fresh enough
      if (age < MAX_STALENESS_MS && reviewsSinceLast < RECOMPUTE_EVERY_N_REVIEWS) {
        return cached;
      }
    }

    // Recompute
    const pairs = await buildCalibrationPairs(prisma, userId);
    if (pairs.length < MIN_PAIRS_FOR_CALIBRATION) {
      return neutralCalibration;
    }

    const calibration = computeCalibrationProfile(pairs);

    // Cache (non-blocking)
    const existingProfile = (stats?.timingProfile as Record<string, unknown>) ?? {};
    (prisma as any).userStatistics.upsert({
      where: { userId },
      update: { timingProfile: { ...existingProfile, calibrationProfile: calibration } as any },
      create: {
        userId,
        totalQuestions: 0,
        correctAnswers: 0,
        systemStats: {},
        timingProfile: { calibrationProfile: calibration } as any,
      },
    }).catch(() => { /* non-fatal */ });

    return calibration;
  } catch {
    return neutralCalibration;
  }
}
