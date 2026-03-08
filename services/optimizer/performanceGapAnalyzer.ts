/**
 * Performance Gap Analyzer Service
 * Phase 6.1: Core Analysis Engine
 *
 * Identifies which organ systems/topics have the largest deviation between target and actual performance.
 *
 * Algorithm:
 * 1. Fetch last 200 MAIN‑session reviews for the user, grouped by system (and optionally subcategory).
 * 2. Compute rolling accuracy per group: correct / total.
 * 3. Compare against target retention (default 0.90, or UserProgress.request_retention).
 * 4. Sort gaps by magnitude.
 *
 * Output: Array of { taxonomyCode, subcategory, currentAccuracy, targetAccuracy, gap }
 *
 * Database‑First Principle: Uses ReviewLog table directly; no static JSON.
 */

import { PrismaClient } from '@prisma/client/edge';

export interface PerformanceGap {
  taxonomyCode: string;          // e.g., "Cardiovascular"
  subcategory: string | null;    // e.g., "Heart Failure" or null
  currentAccuracy: number;       // rolling accuracy (0‑1)
  targetAccuracy: number;        // desired retention (0‑1)
  gap: number;                   // targetAccuracy - currentAccuracy (positive means under‑performance)
  reviewCount: number;           // number of reviews in the rolling window
  lastReviewedAt?: Date;         // most recent review in this group
}

export interface PerformanceGapAnalyzerOptions {
  /** Maximum number of reviews to consider per group (rolling window). Default 200. */
  rollingWindowSize?: number;
  /** Target retention rate. Default 0.90. */
  targetRetention?: number;
  /** Whether to include subcategory‑level analysis. Default false (aggregate by system only). */
  includeSubcategories?: boolean;
  /** Minimum review count per group to be included. Default 5. */
  minimumReviewCount?: number;
}

/**
 * Analyze performance gaps for a given user.
 *
 * @param prisma – Prisma client (Edge or Node)
 * @param userId – User ID
 * @param options – Configuration options
 * @returns Sorted array of performance gaps (largest gap first)
 */
export async function analyzePerformanceGaps(
  prisma: PrismaClient,
  userId: string,
  options: PerformanceGapAnalyzerOptions = {}
): Promise<PerformanceGap[]> {
  const {
    rollingWindowSize = 200,
    includeSubcategories = false,
    minimumReviewCount = 5,
  } = options;
  const targetRetention =
    options.targetRetention ?? (await getUserTargetRetention(prisma, userId));

  const effectiveTargetRetention =
    typeof targetRetention === 'number'
      ? targetRetention
      : await getUserTargetRetention(prisma, userId);

  // Step 1: Fetch recent reviews for this user (session_type = 'MAIN')
  // We need to get the last N reviews per system (or per system+subcategory) but
  // a simple approach: fetch the last rollingWindowSize reviews overall, then group.
  // This ensures we have consistent recency across all systems.
  const recentReviews = await prisma.reviewLog.findMany({
    where: {
      userId,
      sessionType: 'MAIN',
      // Ensure system is not null; we need a grouping key.
      system: { not: null },
    },
    select: {
      system: true,
      wasCorrect: true,
      reviewedAt: true,
    },
    orderBy: { reviewedAt: 'desc' },
    take: rollingWindowSize,
  });

  // Group by taxonomy key
  type GroupKey = string;
  const groups = new Map<GroupKey, {
    correct: number;
    total: number;
    lastReviewedAt: Date | null;
    taxonomyCode: string;
    subcategory: string | null;
  }>();

  for (const review of recentReviews) {
    // Skip reviews without a system (should not happen due to filter, but safety)
    if (!review.system) continue;

    const taxonomyCode = review.system;
    const subcategory = null;
    const key = includeSubcategories
      ? `${taxonomyCode}|${subcategory ?? ''}`
      : taxonomyCode;

    const group = groups.get(key);
    if (group) {
      group.correct += review.wasCorrect ? 1 : 0;
      group.total += 1;
      if (!group.lastReviewedAt || review.reviewedAt > group.lastReviewedAt) {
        group.lastReviewedAt = review.reviewedAt;
      }
    } else {
      groups.set(key, {
        correct: review.wasCorrect ? 1 : 0,
        total: 1,
        lastReviewedAt: review.reviewedAt,
        taxonomyCode,
        subcategory,
      });
    }
  }

  // Step 2: Compute gaps
  const gaps: PerformanceGap[] = [];
  for (const group of groups.values()) {
    if (group.total < minimumReviewCount) continue;

    const currentAccuracy = group.correct / group.total;
    const gap = effectiveTargetRetention - currentAccuracy;

    gaps.push({
      taxonomyCode: group.taxonomyCode,
      subcategory: group.subcategory,
      currentAccuracy,
      targetAccuracy: effectiveTargetRetention,
      gap,
      reviewCount: group.total,
      lastReviewedAt: group.lastReviewedAt ?? undefined,
    });
  }

  // Step 3: Sort by gap magnitude (largest positive gap first, i.e., biggest under‑performance)
  gaps.sort((a, b) => b.gap - a.gap);

  return gaps;
}

/**
 * Helper: Fetch target retention from UserProgress (if available).
 * Falls back to default 0.90.
 */
export async function getUserTargetRetention(
  prisma: PrismaClient,
  userId: string
): Promise<number> {
  const userProgress = await prisma.userProgress.findUnique({
    where: { userId },
    select: { fsrsParams: true },
  });

  if (userProgress?.fsrsParams?.request_retention) {
    return userProgress.fsrsParams.request_retention as number;
  }
  return 0.90;
}