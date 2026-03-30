/**
 * Anti-Gaming Distribution Enforcement
 *
 * Prevents users from skewing their FSRS data by over-studying a narrow
 * topic area. Enforces blueprint-adherent study at three levels:
 *
 * 1. SESSION LEVEL: No single system can exceed 40% of a session
 * 2. ROLLING WINDOW LEVEL: Tracks last 100 reviews vs blueprint targets
 * 3. FSRS WEIGHT DAMPENING: Over-represented systems contribute less to optimization
 */

import type { PrismaClient } from '@prisma/client';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DistributionAnalysis {
  actual: Record<string, number>;
  target: Record<string, number>;
  overRepresented: string[];
  underRepresented: string[];
  skewScore: number;
  windowSize: number;
  isBalanced: boolean;
  systemSuppressionFactors: Record<string, number>;
}

export interface SessionConstraints {
  perSystemCaps: Record<string, number>;
  boostSystems: string[];
  suppressSystems: string[];
  strictInterleaving: boolean;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ROLLING_WINDOW = 100;
const SKEW_THRESHOLD = 2.0;
const DEFICIT_THRESHOLD = 0.4;
const DEFAULT_SESSION_SIZE = 20;
const MAX_SYSTEM_FRACTION = 0.4;
const MIN_REVIEWS_FOR_ENFORCEMENT = 30;

// ─── Core Analysis ───────────────────────────────────────────────────────────

export async function analyzeDistribution(
  prisma: PrismaClient,
  userId: string,
  targetWeights: Record<string, number>
): Promise<DistributionAnalysis> {
  const recentReviews = await prisma.reviewLog.findMany({
    where: {
      userId,
      review_type: 'real',
      sessionType: 'MAIN',
    },
    orderBy: { reviewedAt: 'desc' },
    take: ROLLING_WINDOW,
    select: { system: true },
  });

  const windowSize = recentReviews.length;

  const systemCounts: Record<string, number> = {};
  for (const review of recentReviews) {
    const sys = review.system ?? 'Unknown';
    systemCounts[sys] = (systemCounts[sys] ?? 0) + 1;
  }

  const actual: Record<string, number> = {};
  for (const [sys, count] of Object.entries(systemCounts)) {
    actual[sys] = windowSize > 0 ? count / windowSize : 0;
  }

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

  const overRepresented: string[] = [];
  const underRepresented: string[] = [];
  let totalDeviation = 0;

  for (const [sys, targetW] of Object.entries(targetWeights)) {
    const actualW = actual[sys] ?? 0;
    const ratio = targetW > 0 ? actualW / targetW : 0;

    if (ratio > SKEW_THRESHOLD) {
      overRepresented.push(sys);
    } else if (ratio < DEFICIT_THRESHOLD && targetW >= 0.03) {
      underRepresented.push(sys);
    }

    totalDeviation += Math.abs(actualW - targetW);
  }

  const skewScore = Math.min(1.0, totalDeviation / 1.0);

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

export function buildSessionConstraints(
  analysis: DistributionAnalysis,
  sessionSize: number = DEFAULT_SESSION_SIZE
): SessionConstraints {
  const perSystemCaps: Record<string, number> = {};
  const absoluteMax = Math.ceil(sessionSize * MAX_SYSTEM_FRACTION);

  for (const [sys, targetW] of Object.entries(analysis.target)) {
    const baseCap = Math.max(1, Math.ceil(sessionSize * targetW * 1.5));
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

export function getOptimizationWeight(
  system: string,
  analysis: DistributionAnalysis
): number {
  if (analysis.windowSize < MIN_REVIEWS_FOR_ENFORCEMENT) return 1.0;

  const actualW = analysis.actual[system] ?? 0;
  const targetW = analysis.target[system] ?? 0;

  if (targetW === 0) return 0.3;

  const ratio = actualW / targetW;
  if (ratio <= 1.5) return 1.0;
  return Math.max(0.3, 1.0 - (ratio - 1.5) * 0.4);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildSuppressionFactors(
  actual: Record<string, number>,
  target: Record<string, number>,
  windowSize: number
): Record<string, number> {
  const factors: Record<string, number> = {};

  for (const [sys, targetW] of Object.entries(target)) {
    const actualW = actual[sys] ?? 0;

    if (targetW === 0) {
      factors[sys] = 0.5;
      continue;
    }

    const ratio = actualW / targetW;

    if (ratio > SKEW_THRESHOLD) {
      factors[sys] = Math.max(0.15, 1.0 / ratio);
    } else if (ratio > 1.5) {
      factors[sys] = 0.7;
    } else if (ratio < DEFICIT_THRESHOLD && windowSize >= MIN_REVIEWS_FOR_ENFORCEMENT) {
      factors[sys] = 1.5;
    } else {
      factors[sys] = 1.0;
    }
  }

  return factors;
}

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
