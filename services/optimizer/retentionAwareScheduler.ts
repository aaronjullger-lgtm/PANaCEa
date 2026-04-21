/**
 * Retention‑Aware Scheduler Service
 * Phase 6.1: Core Analysis Engine
 *
 * Determines the optimal inter‑study interval for each performance gap item,
 * respecting FSRS stability and retrievability.
 *
 * Algorithm:
 * 1. For each taxonomy (system), compute current stability (S) from the most recent review.
 * 2. Using FSRS parameters (w[19], w[20]) and target retention (R_target), solve for t where
 *    R(t) ≈ R_target (with tolerance).
 * 3. Recommend reviewing when R falls below R_target - tolerance.
 * 4. Output urgency score based on gap magnitude and time‑to‑threshold.
 *
 * Output: Array of { taxonomyCode, recommendedReviewDate, urgencyScore }
 *
 * Integration: Uses lib/fsrs/retrievability for retrievability calculations.
 */

import { PrismaClient } from '@prisma/client/edge';

export interface ScheduledReview {
  taxonomyCode: string;            // e.g., "Cardiovascular"
  subcategory: string | null;      // optional subcategory
  currentStability: number | null; // stability (S) in days, null if insufficient data
  currentRetrievability: number | null; // R(now) as decimal (0‑1)
  targetRetention: number;         // R_target (desired retention)
  recommendedReviewDate: Date | null; // date when R ≈ R_target (or null if unknown)
  urgencyScore: number;            // 0‑1, higher = more urgent
  daysUntilReview: number | null;  // days from now until recommended review
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'; // confidence in the recommendation
}

export interface RetentionAwareSchedulerOptions {
  /** Target retention rate (default 0.90) */
  targetRetention?: number;
  /** Tolerance for R deviation (default 0.05) */
  tolerance?: number;
  /** FSRS parameter w[19] (retrievability factor); if not provided, fetch from UserProgress */
  w19?: number;
  /** FSRS parameter w[20] (retrievability decay exponent); if not provided, fetch from UserProgress */
  w20?: number;
  /** Minimum stability required to compute a schedule (default 0.1) */
  minStability?: number;
  /** Maximum horizon for recommendation (days, default 365) */
  maxHorizonDays?: number;
}

/**
 * Schedule reviews for a user's performance gaps.
 *
 * @param prisma – Prisma client
 * @param userId – User ID
 * @param gaps – Output from Performance Gap Analyzer (must include taxonomyCode, subcategory)
 * @param options – Configuration options
 * @returns Array of scheduled reviews, sorted by urgency (highest first)
 */
export async function scheduleReviews(
  prisma: PrismaClient,
  userId: string,
  gaps: Array<{ taxonomyCode: string; subcategory?: string | null }>,
  options: RetentionAwareSchedulerOptions = {}
): Promise<ScheduledReview[]> {
  const {
    targetRetention = 0.90,
    tolerance = 0.05,
    w19: providedW19,
    w20: providedW20,
    minStability = 0.1,
    maxHorizonDays = 365,
  } = options;

  // Step 1: Fetch FSRS parameters for the user (if not provided)
  let w19 = providedW19;
  let w20 = providedW20;
  if (providedW19 === undefined || providedW20 === undefined) {
    const params = await getUserFSRSParameters(prisma, userId);
    w19 = params.w19;
    w20 = params.w20;
  }
  // Fallback to defaults if still missing
  const factor = w19 ?? 0.1597;
  const decay = -(w20 ?? 2.2700); // note: decay = -w20 (ts-fsrs v6 default w20=2.2700)

  // Step 2: For each gap, retrieve current stability and last review date
  const scheduled: ScheduledReview[] = [];
  for (const gap of gaps) {
    const { taxonomyCode, subcategory = null } = gap;

    // Get latest stability for this system (and subcategory if specified)
    const latestReview = await getLatestStabilityForSystem(
      prisma,
      userId,
      taxonomyCode,
      subcategory ?? undefined
    );

    if (!latestReview) {
      // No review data → cannot schedule; mark as low confidence
      scheduled.push({
        taxonomyCode,
        subcategory,
        currentStability: null,
        currentRetrievability: null,
        targetRetention,
        recommendedReviewDate: null,
        urgencyScore: 0.0,
        daysUntilReview: null,
        confidence: 'LOW',
      });
      continue;
    }

    const { stability, lastReviewedAt } = latestReview;
    if (stability < minStability) {
      // Stability too low (new cards) – recommend immediate review
      scheduled.push({
        taxonomyCode,
        subcategory,
        currentStability: stability,
        currentRetrievability: 1.0, // fresh card
        targetRetention,
        recommendedReviewDate: new Date(), // now
        urgencyScore: 1.0,
        daysUntilReview: 0,
        confidence: 'HIGH',
      });
      continue;
    }

    // Compute elapsed days since last review
    const elapsedDays = computeElapsedDays(lastReviewedAt);
    // Compute current retrievability
    const currentR = computeRetrievability(stability, elapsedDays, factor, -decay);
    // Compute days until R drops below targetRetention - tolerance
    const daysUntilThreshold = solveForDaysUntilRetrievability(
      stability,
      factor,
      decay,
      targetRetention - tolerance,
      elapsedDays,
      maxHorizonDays
    );

    let recommendedReviewDate: Date | null = null;
    let urgencyScore = 0.0;
    let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';

    if (daysUntilThreshold === null) {
      // R already below threshold → recommend immediate review
      recommendedReviewDate = new Date();
      urgencyScore = 1.0;
      confidence = 'HIGH';
    } else if (daysUntilThreshold <= 0) {
      // Should not happen (threshold already passed) – immediate
      recommendedReviewDate = new Date();
      urgencyScore = 1.0;
      confidence = 'HIGH';
    } else {
      // Schedule for future date
      recommendedReviewDate = new Date(Date.now() + daysUntilThreshold * 86400000);
      // Urgency score: inverse of days until review, scaled by gap magnitude (if available)
      // For now, we use a simple 1 / (days + 1) mapping
      urgencyScore = 1 / (daysUntilThreshold + 1);
      confidence = daysUntilThreshold > 30 ? 'LOW' : 'MEDIUM';
    }

    scheduled.push({
      taxonomyCode,
      subcategory,
      currentStability: stability,
      currentRetrievability: currentR,
      targetRetention,
      recommendedReviewDate,
      urgencyScore,
      daysUntilReview: daysUntilThreshold,
      confidence,
    });
  }

  // Sort by urgency descending
  scheduled.sort((a, b) => b.urgencyScore - a.urgencyScore);
  return scheduled;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Retrieve FSRS parameters (w[19], w[20]) from UserProgress.
 *
 * Uses loadParametersSafely() to reject any stored params that are off-scale
 * (e.g. poisoned by the pre-2026-04 L-BFGS optimizer that wrote w[19]≈9 on
 * the FSRS-4/5 scale). Off-scale params → canonical defaults, logged for
 * observability. See lib/fsrs.ts isParamsOnCurrentScale().
 */
async function getUserFSRSParameters(
  prisma: PrismaClient,
  userId: string
): Promise<{ w19: number; w20: number }> {
  const userProgress = await prisma.userProgress.findFirst({
    where: { userId },
    select: { fsrsParams: true },
  });

  const { loadParametersSafely } = await import('@/lib/fsrs');
  const params = loadParametersSafely(userProgress?.fsrsParams);
  return { w19: params.w[19]!, w20: params.w[20]! };
}

/**
 * Fetch the most recent stability and review date for a given system (and optional subcategory).
 */
async function getLatestStabilityForSystem(
  prisma: PrismaClient,
  userId: string,
  system: string,
  subcategory?: string
): Promise<{ stability: number; lastReviewedAt: Date } | null> {
  const where: any = {
    userId,
    system,
    sessionType: 'MAIN',
    stability: { not: null },
  };
  // subcategory column not present in ReviewLog; ignoring subcategory filter

  const latest = await prisma.reviewLog.findFirst({
    where,
    select: {
      stability: true,
      reviewedAt: true,
    },
    orderBy: { reviewedAt: 'desc' },
  });

  if (!latest || latest.stability === null) return null;
  return { stability: latest.stability, lastReviewedAt: latest.reviewedAt };
}

/**
 * Compute elapsed days since a given date.
 */
function computeElapsedDays(lastReviewedAt: Date): number {
  const now = new Date();
  const diffMs = now.getTime() - lastReviewedAt.getTime();
  return diffMs / (1000 * 60 * 60 * 24);
}

/**
 * Solve for days until retrievability drops to target R.
 *
 * Given R(t) = (1 + factor * t / S) ^ decay, solve for t where R(t) = targetR.
 * Rearranged formula: t = S * (targetR^(1/decay) - 1) / factor.
 *
 * @param stability S
 * @param factor w[19]
 * @param decay -w[20] (negative)
 * @param targetR target retrievability (0‑1)
 * @param elapsedDays already elapsed days (t0)
 * @param maxHorizonDays maximum t to return (null if beyond horizon)
 * @returns days from now until threshold, or null if threshold already passed
 */
function solveForDaysUntilRetrievability(
  stability: number,
  factor: number,
  decay: number,
  targetR: number,
  elapsedDays: number,
  maxHorizonDays: number
): number | null {
  // Guard against invalid inputs
  if (stability <= 0 || factor <= 0 || decay >= 0) {
    // decay should be negative; if not, formula invalid
    return null;
  }
  if (targetR <= 0 || targetR >= 1) {
    return null;
  }

  // Compute total time t_total where R(t_total) = targetR
  const exponent = 1 / decay; // negative
  const targetRPowered = Math.pow(targetR, exponent);
  if (!Number.isFinite(targetRPowered)) {
    return null;
  }
  const tTotal = (stability * (targetRPowered - 1)) / factor;

  // If tTotal is negative (should not happen), treat as immediate
  if (tTotal < 0) {
    return 0;
  }

  // Days remaining from current elapsed days
  const daysRemaining = tTotal - elapsedDays;
  if (daysRemaining <= 0) {
    return 0; // threshold already passed
  }
  if (daysRemaining > maxHorizonDays) {
    return null; // beyond horizon
  }
  return daysRemaining;
}

/**
 * Compute retrievability using the same formula as lib/fsrs/retrievability.
 * (We could import that module, but to avoid circular dependencies we reimplement.)
 */
function computeRetrievability(
  stability: number,
  elapsedDays: number,
  factor: number,
  decay: number
): number {
  if (stability <= 0 || elapsedDays <= 0) {
    return 1.0; // fresh card
  }
  const ratio = (factor * elapsedDays) / stability;
  if (ratio <= 0 || !Number.isFinite(ratio)) {
    return 1.0;
  }
  const r = Math.pow(1 + ratio, decay);
  if (r > 1) return 1;
  if (r < 0) return 0;
  return r;
}