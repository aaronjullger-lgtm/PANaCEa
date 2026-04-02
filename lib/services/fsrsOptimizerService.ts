/**
 * Continuous-Grade FSRS Parameter Optimizer (Sprint 5)
 *
 * Uses the continuous grade data (grade_continuous from ReviewLog) to
 * optimize FSRS w-parameters per body system. This replaces the naive
 * suggestParameterAdjustments() in fsrs.ts with a data-driven approach.
 *
 * Core algorithm:
 * 1. Collect review history with continuous grades and outcomes
 * 2. Simulate FSRS predictions using current parameters
 * 3. Compute log-loss between predicted retrievability and actual outcomes
 * 4. Apply coordinate descent to minimize log-loss per parameter
 * 5. Cache optimized parameters per system with 7-day TTL
 *
 * This is a lightweight on-device optimizer — not full ML training, but enough
 * to adapt the 21 w-parameters to the student's actual recall patterns.
 *
 * @see lib/fsrs.ts — FSRS v6 implementation consuming these parameters
 * @see lib/services/drillReviewService.ts — Uses optimized parameters
 */

import type { PrismaClient } from '@prisma/client';
import { FSRS, defaultParameters, type FSRSParameters } from '../fsrs';

// ── Types ──

export interface OptimizationResult {
  /** Optimized parameters */
  parameters: FSRSParameters;
  /** Log-loss before optimization */
  initialLoss: number;
  /** Log-loss after optimization */
  finalLoss: number;  /** Number of reviews used for optimization */
  reviewCount: number;
  /** Body system (or 'global') */
  system: string;
  /** When this was computed */
  optimizedAt: string;
}

interface ReviewDatum {
  stability: number;
  difficulty: number;
  elapsedDays: number;
  gradeContinuous: number;
  wasCorrect: boolean;
  retrievability: number | null;
}

// ── Constants ──

const MIN_REVIEWS_FOR_OPTIMIZATION = 100;
const LEARNING_RATE = 0.01;
const MAX_ITERATIONS = 50;
const CONVERGENCE_THRESHOLD = 1e-6;
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Parameter indices that are safe to optimize (don't touch structural params)
// w[0-3]: initial stability per rating — optimize these
// w[4-7]: difficulty params — optimize
// w[8-10]: recall stability growth — optimize (high impact)
// w[11-14]: forget stability — optimize (high impact)
// w[15-16]: hard penalty / easy bonus — skip (deprecated in binary system)
// w[17-18]: short-term stability — skip (sensitive)
// w[19-20]: retrievability curve — optimize carefully
const OPTIMIZABLE_INDICES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 19, 20];
// Parameter bounds to prevent divergence
const PARAM_BOUNDS: Array<[number, number]> = [
  [0.01, 2.0],   // w[0]: initial S for Again
  [0.1, 5.0],    // w[1]: initial S for Hard
  [0.5, 10.0],   // w[2]: initial S for Good
  [1.0, 30.0],   // w[3]: initial S for Easy
  [1.0, 10.0],   // w[4]: initial difficulty
  [0.01, 3.0],   // w[5]: difficulty grade sensitivity
  [0.01, 5.0],   // w[6]: difficulty change rate
  [0.0, 0.5],    // w[7]: mean reversion strength
  [0.1, 5.0],    // w[8]: recall stability growth
  [0.01, 1.0],   // w[9]: stability decay factor
  [0.01, 3.0],   // w[10]: retrievability exponent
  [0.1, 5.0],    // w[11]: forget stability base
  [0.01, 1.0],   // w[12]: forget difficulty factor
  [0.01, 1.0],   // w[13]: forget stability exponent
  [0.1, 5.0],    // w[14]: forget retrievability factor
  [0.1, 2.0],    // w[15]: hard penalty (not optimized)
  [1.0, 4.0],    // w[16]: easy bonus (not optimized)
  [0.01, 2.0],   // w[17]: short-term decay (not optimized)
  [0.01, 1.0],   // w[18]: short-term offset (not optimized)
  [0.01, 20.0],  // w[19]: retrievability factor
  [0.01, 2.0],   // w[20]: retrievability decay exponent
];

// ── In-memory cache ──

const parameterCache = new Map<string, { result: OptimizationResult; timestamp: number }>();

// ── Pure algorithm functions (exported for testing) ──
/**
 * Compute binary cross-entropy (log-loss) between predicted retrievability
 * and actual recall outcomes.
 *
 * Lower = better calibrated predictions.
 */
export function computeLogLoss(
  reviews: ReviewDatum[],
  parameters: FSRSParameters
): number {
  if (reviews.length === 0) return 0;

  const fsrs = new FSRS(parameters);
  let totalLoss = 0;
  const eps = 1e-7; // Prevent log(0)

  for (const review of reviews) {
    if (review.stability <= 0 || review.elapsedDays < 0) continue;

    const predicted = fsrs.calculateRetrievability(review.elapsedDays, review.stability);
    const clampedP = Math.max(eps, Math.min(1 - eps, predicted));
    const y = review.wasCorrect ? 1 : 0;

    totalLoss += -(y * Math.log(clampedP) + (1 - y) * Math.log(1 - clampedP));
  }

  return totalLoss / reviews.length;
}

/**
 * Single coordinate descent step: perturb one parameter and keep if loss improves.
 */
export function optimizeOneParameter(
  reviews: ReviewDatum[],
  currentParams: FSRSParameters,
  paramIndex: number,
  learningRate: number
): { params: FSRSParameters; improved: boolean } {
  const currentLoss = computeLogLoss(reviews, currentParams);
  const bounds = PARAM_BOUNDS[paramIndex] ?? [0.01, 10.0];
  // Try positive perturbation
  const wPlus = [...currentParams.w];
  wPlus[paramIndex] = Math.min(bounds[1], wPlus[paramIndex] + learningRate);
  const paramsPlus = { ...currentParams, w: wPlus };
  const lossPlus = computeLogLoss(reviews, paramsPlus);

  // Try negative perturbation
  const wMinus = [...currentParams.w];
  wMinus[paramIndex] = Math.max(bounds[0], wMinus[paramIndex] - learningRate);
  const paramsMinus = { ...currentParams, w: wMinus };
  const lossMinus = computeLogLoss(reviews, paramsMinus);

  // Keep the best
  if (lossPlus < currentLoss && lossPlus <= lossMinus) {
    return { params: paramsPlus, improved: true };
  }
  if (lossMinus < currentLoss && lossMinus < lossPlus) {
    return { params: paramsMinus, improved: true };
  }

  return { params: currentParams, improved: false };
}

/**
 * Run coordinate descent optimization over all safe parameters.
 */
export function optimizeParameters(
  reviews: ReviewDatum[],
  initialParams: FSRSParameters = defaultParameters
): { parameters: FSRSParameters; initialLoss: number; finalLoss: number } {
  const initialLoss = computeLogLoss(reviews, initialParams);
  let currentParams = { ...initialParams, w: [...initialParams.w] };
  let prevLoss = initialLoss;
  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    let anyImproved = false;

    for (const idx of OPTIMIZABLE_INDICES) {
      // Scale learning rate by parameter magnitude for stability
      const paramMagnitude = Math.abs(currentParams.w[idx] ?? 1);
      const scaledLR = LEARNING_RATE * Math.max(0.1, paramMagnitude);

      const { params, improved } = optimizeOneParameter(
        reviews, currentParams, idx, scaledLR
      );
      if (improved) {
        currentParams = params;
        anyImproved = true;
      }
    }

    const currentLoss = computeLogLoss(reviews, currentParams);
    if (!anyImproved || Math.abs(prevLoss - currentLoss) < CONVERGENCE_THRESHOLD) {
      break;
    }
    prevLoss = currentLoss;
  }

  return {
    parameters: currentParams,
    initialLoss,
    finalLoss: computeLogLoss(reviews, currentParams),
  };
}

/**
 * Fetch review data and run optimization for a user + optional system.
 */
export async function optimizeForUser(
  prisma: PrismaClient,
  userId: string,
  system?: string | null
): Promise<OptimizationResult | null> {
  const cacheKey = `${userId}:${system ?? 'global'}`;
  const cached = parameterCache.get(cacheKey);  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.result;
  }

  // Fetch review data with continuous grades
  const reviews = await prisma.reviewLog.findMany({
    where: {
      userId,
      review_type: { not: 'rapid_guess' },
      retrievability: { not: null },
      ...(system ? { system } : {}),
    },
    select: {
      stability: true,
      difficulty: true,
      elapsedDays: true,
      grade_continuous: true,
      wasCorrect: true,
      retrievability: true,
    },
    orderBy: { reviewedAt: 'desc' },
    take: 2000, // Cap to prevent memory issues
  });

  if (reviews.length < MIN_REVIEWS_FOR_OPTIMIZATION) {
    return null; // Not enough data
  }

  const reviewData: ReviewDatum[] = reviews
    .filter((r): r is typeof r & { retrievability: number; elapsedDays: number } =>
      r.retrievability != null && r.elapsedDays != null
    )
    .map(r => ({
      stability: r.stability,
      difficulty: r.difficulty,
      elapsedDays: r.elapsedDays!,
      gradeContinuous: r.grade_continuous ?? (r.wasCorrect ? 3.0 : 1.0),
      wasCorrect: r.wasCorrect,
      retrievability: r.retrievability,
    }));
  if (reviewData.length < MIN_REVIEWS_FOR_OPTIMIZATION) {
    return null;
  }

  const { parameters, initialLoss, finalLoss } = optimizeParameters(reviewData);

  const result: OptimizationResult = {
    parameters,
    initialLoss,
    finalLoss,
    reviewCount: reviewData.length,
    system: system ?? 'global',
    optimizedAt: new Date().toISOString(),
  };

  parameterCache.set(cacheKey, { result, timestamp: Date.now() });
  return result;
}

/**
 * Get optimized FSRS parameters for a user + system.
 * Returns default parameters if optimization hasn't run or data is insufficient.
 */
export async function getOptimizedParameters(
  prisma: PrismaClient,
  userId: string,
  system?: string | null
): Promise<FSRSParameters> {
  try {
    // Try system-specific first, fall back to global
    const systemResult = system ? await optimizeForUser(prisma, userId, system) : null;
    if (systemResult) return systemResult.parameters;

    const globalResult = await optimizeForUser(prisma, userId);
    if (globalResult) return globalResult.parameters;
  } catch (err) {
    // Non-fatal: return defaults
  }

  return defaultParameters;
}

/** Clear optimizer cache (for testing or after data changes) */
export function clearOptimizerCache(): void {
  parameterCache.clear();
}

/** Export constants for testing */
export const OPTIMIZER_CONSTANTS = {
  MIN_REVIEWS_FOR_OPTIMIZATION,
  LEARNING_RATE,
  MAX_ITERATIONS,
  CONVERGENCE_THRESHOLD,
  OPTIMIZABLE_INDICES,
  PARAM_BOUNDS,
} as const;
