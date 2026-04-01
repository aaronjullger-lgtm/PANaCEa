/**
 * Anti-Gaming Distribution Enforcement
 *
 * Prevents users from skewing their FSRS data by over-studying a narrow
 * topic area. This is the "you can't just go ham on one thing" guardrail.
 *
 * The system enforces blueprint-adherent study at three levels:
 *
 * 1. SESSION LEVEL: No single system can exceed 40% of a session (existing
 *    MAX_SINGLE_SYSTEM_CAP in mainSessionQuestionSelector.ts)
 *
 * 2. ROLLING WINDOW LEVEL: Tracks the last 100 reviews and compares
 *    actual system distribution to blueprint targets. If any system is
 *    over-represented by > 2x its target weight, the selector is instructed
 *    to deprioritize that system until the distribution normalizes.
 *
 * 3. FSRS WEIGHT DAMPENING: Reviews from over-represented systems
 *    contribute less to personalized FSRS parameter optimization. This
 *    prevents a user's FSRS weights from being biased by narrow practice.
 */

import type { PrismaClient } from '@prisma/client';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DistributionAnalysis {
  /** System distribution in the rolling window (system → fraction 0-1) */
  actual: Record<string, number>;
  /** Target distribution from the active blueprint */
  target: Record<string, number>;
  /** Systems that are over-represented (> SKEW_THRESHOLD × target) */
  overRepresented: string[];
  /** Systems that are under-represented (< DEFICIT_THRESHOLD × target) */
  underRepresented: string[];
  /** How skewed the distribution is (0 = perfect, 1 = completely skewed) */
  skewScore: number;
  /** Total reviews in the analysis window */
  windowSize: number;
  /** Whether the user is in a healthy study pattern */
  isBalanced: boolean;
  /** Per-system suppression factors (0.0 = fully suppressed, 1.0 = normal) */
  systemSuppressionFactors: Record<string, number>;
}

export interface SessionConstraints {
  /** Maximum questions per system in the next session */
  perSystemCaps: Record<string, number>;
  /** Systems to prioritize (under-represented) */
  boostSystems: string[];
  /** Systems to deprioritize (over-represented) */
  suppressSystems: string[];
  /** Whether interleaving should be strictly enforced */
  strictInterleaving: boolean;
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** Rolling window size for distribution analysis */
const ROLLING_WINDOW = 100;

/**
 * A system is considered "over-represented" if its share of the rolling window
 * exceeds its target weight by this factor.
 *
 * Example: If Cardio target = 11% and threshold = 2.0, flag if Cardio > 22%.
 */
const SKEW_THRESHOLD = 2.0;
/**
 * A system is "under-represented" if its share is below this fraction of target.
 * Example: If Pulm target = 9% and threshold = 0.4, flag if Pulm < 3.6%.
 */
const DEFICIT_THRESHOLD = 0.4;

import { DEFAULT_SESSION_SIZE } from '../constants/sessionDefaults';

/**
 * Maximum fraction of a session any single system can occupy.
 * Matches existing MAX_SINGLE_SYSTEM_CAP in mainSessionQuestionSelector.ts.
 */
const MAX_SYSTEM_FRACTION = 0.4;

/**
 * Minimum reviews needed before applying anti-gaming constraints.
 * Cold-start users get free study until they have enough data.
 */
const MIN_REVIEWS_FOR_ENFORCEMENT = 30;

// ─── Core Analysis ───────────────────────────────────────────────────────────

/**
 * Analyze the user's recent study distribution against their active blueprint.
 *
 * This is the primary entry point. Call before building a session queue
 * to get suppression/boost guidance.
 */
export async function analyzeDistribution(
  prisma: PrismaClient,
  userId: string,
  targetWeights: Record<string, number>
): Promise<DistributionAnalysis> {
  // Fetch the last ROLLING_WINDOW reviews for this user (main sessions only)
  const recentReviews = await prisma.reviewLog.findMany({
    where: {
      userId,
      review_type: 'real',
      // Only count reviews from main study sessions
      sessionType: 'MAIN',
    },
    orderBy: { reviewedAt: 'desc' },
    take: ROLLING_WINDOW,
    select: { system: true },
  });

  const windowSize = recentReviews.length;

  // Count reviews per system
  const systemCounts: Record<string, number> = {};
  for (const review of recentReviews) {
    const sys = review.system ?? 'Unknown';
    systemCounts[sys] = (systemCounts[sys] ?? 0) + 1;
  }

  // Convert to fractions
  const actual: Record<string, number> = {};
  for (const [sys, count] of Object.entries(systemCounts)) {
    actual[sys] = windowSize > 0 ? count / windowSize : 0;
  }

  // Skip enforcement for cold-start users
  if (windowSize < MIN_REVIEWS_FOR_ENFORCEMENT) {
    return {
      actual,
      target: targetWeights,
      overRepresented: [],
      underRepresented: [],
      skewScore: 0,
      windowSize,
      isBalanced: true,
      systemSuppressionFactors: buildUniformFactors(targetWeights, 1.0),
    };
  }
  // Identify over- and under-represented systems
  const overRepresented: string[] = [];
  const underRepresented: string[] = [];
  let totalDeviation = 0;

  for (const [sys, targetW] of Object.entries(targetWeights)) {
    const actualW = actual[sys] ?? 0;
    const ratio = targetW > 0 ? actualW / targetW : 0;

    if (ratio > SKEW_THRESHOLD) {
      overRepresented.push(sys);
    } else if (ratio < DEFICIT_THRESHOLD && targetW >= 0.03) {
      // Only flag deficit for systems with meaningful weight (>= 3%)
      underRepresented.push(sys);
    }

    totalDeviation += Math.abs(actualW - targetW);
  }

  // Skew score: 0-1 normalized total deviation
  // Max possible deviation ≈ 2.0 (all in one system vs spread)
  const skewScore = Math.min(1.0, totalDeviation / 1.0);

  // Build suppression factors
  const systemSuppressionFactors = buildSuppressionFactors(
    actual,
    targetWeights,
    windowSize
  );

  return {
    actual,
    target: targetWeights,
    overRepresented,
    underRepresented,
    skewScore,
    windowSize,
    isBalanced: overRepresented.length === 0 && skewScore < 0.3,
    systemSuppressionFactors,
  };
}
/**
 * Build session constraints based on distribution analysis.
 *
 * Returns per-system caps and boost/suppress lists for the question selector.
 * Integrates with mainSessionQuestionSelector's existing deficit system.
 */
export function buildSessionConstraints(
  analysis: DistributionAnalysis,
  sessionSize: number = DEFAULT_SESSION_SIZE
): SessionConstraints {
  const perSystemCaps: Record<string, number> = {};
  const absoluteMax = Math.ceil(sessionSize * MAX_SYSTEM_FRACTION);

  for (const [sys, targetW] of Object.entries(analysis.target)) {
    // Base cap from blueprint target (minimum 1 if target > 0)
    const baseCap = Math.max(1, Math.ceil(sessionSize * targetW * 1.5));

    // Reduce cap for over-represented systems
    const suppressionFactor = analysis.systemSuppressionFactors[sys] ?? 1.0;
    const adjustedCap = Math.max(1, Math.round(baseCap * suppressionFactor));

    perSystemCaps[sys] = Math.min(adjustedCap, absoluteMax);
  }

  return {
    perSystemCaps,
    boostSystems: analysis.underRepresented,
    suppressSystems: analysis.overRepresented,
    strictInterleaving: analysis.skewScore > 0.2,
  };
}
/**
 * Calculate how much a review from a given system should contribute
 * to FSRS parameter optimization.
 *
 * Over-represented systems get dampened contribution (0.3-1.0),
 * under-represented systems get full contribution (1.0).
 *
 * This prevents a user who does 80% Cardio from having FSRS weights
 * that are tuned primarily for Cardio difficulty patterns.
 */
export function getOptimizationWeight(
  system: string,
  analysis: DistributionAnalysis
): number {
  if (analysis.windowSize < MIN_REVIEWS_FOR_ENFORCEMENT) return 1.0;

  const actualW = analysis.actual[system] ?? 0;
  const targetW = analysis.target[system] ?? 0;

  if (targetW === 0) return 0.3; // System not in blueprint

  const ratio = actualW / targetW;

  // Under-represented or at target: full weight
  if (ratio <= 1.5) return 1.0;

  // Over-represented: dampen proportionally
  // ratio=2.0 → weight=0.6, ratio=3.0 → weight=0.3
  return Math.max(0.3, 1.0 - (ratio - 1.5) * 0.4);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build suppression factors based on over/under representation */
function buildSuppressionFactors(
  actual: Record<string, number>,
  target: Record<string, number>,
  windowSize: number
): Record<string, number> {
  const factors: Record<string, number> = {};

  for (const [sys, targetW] of Object.entries(target)) {
    const actualW = actual[sys] ?? 0;

    if (targetW === 0) {
      factors[sys] = 0.5; // System not in blueprint but user studied it
      continue;
    }

    const ratio = actualW / targetW;

    if (ratio > SKEW_THRESHOLD) {
      // Heavily suppress: the more over-represented, the more suppressed
      // ratio=2.0 → factor=0.4, ratio=3.0 → factor=0.2
      factors[sys] = Math.max(0.15, 1.0 / ratio);
    } else if (ratio > 1.5) {
      // Mild suppression
      factors[sys] = 0.7;
    } else if (ratio < DEFICIT_THRESHOLD && windowSize >= MIN_REVIEWS_FOR_ENFORCEMENT) {
      // Boost under-represented: factor > 1.0 signals the selector to add more
      factors[sys] = 1.5;
    } else {
      factors[sys] = 1.0;
    }
  }

  return factors;
}

/** Build uniform factor map (for cold-start users) */
function buildUniformFactors(
  target: Record<string, number>,
  factor: number
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const sys of Object.keys(target)) {
    result[sys] = factor;
  }
  return result;
}

export default {
  analyzeDistribution,
  buildSessionConstraints,
  getOptimizationWeight,
  ROLLING_WINDOW,
  SKEW_THRESHOLD,
  DEFICIT_THRESHOLD,
  MIN_REVIEWS_FOR_ENFORCEMENT,
};
