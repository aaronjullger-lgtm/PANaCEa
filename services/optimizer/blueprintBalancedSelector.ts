/**
 * Blueprint‑Balanced Selector Service
 * Phase 6.1: Core Analysis Engine
 *
 * Ensures the recommended study mix respects NCCPA blueprint weights
 * (e.g., Cardiovascular 11%, Pulmonary 9%).
 *
 * Algorithm:
 * 1. Compute current distribution of upcoming reviews (or recent reviews) per system.
 * 2. Compare against NCCPA target weights.
 * 3. Apply "zipper sort" that interleaves high‑gap topics with under‑represented blueprint categories.
 * 4. Produce weight‑adjusted priority ordering.
 *
 * Output: Weight‑adjusted priority ordering (list of taxonomy codes with scores).
 *
 * Integration: Uses NCCPA_2025_BLUEPRINT from lib/constants/blueprint.ts.
 */

import { NCCPA_2025_BLUEPRINT } from '@/lib/constants/blueprint';

export interface BlueprintWeightedItem {
  taxonomyCode: string;           // e.g., "Cardiovascular"
  subcategory?: string | null;    // optional subcategory
  gap?: number;                   // performance gap (positive = under‑performance)
  urgencyScore?: number;          // urgency from scheduler (0‑1)
  priorityScore: number;          // final balanced priority (higher = more important)
  weightDeviation: number;        // target weight - current weight (positive = underrepresented)
}

export interface BlueprintBalancedSelectorOptions {
  /** Source of current distribution: 'upcoming' (scheduled reviews) or 'recent' (last N reviews) */
  distributionSource?: 'upcoming' | 'recent';
  /** Number of recent reviews to consider if source = 'recent' (default 100) */
  recentReviewWindow?: number;
  /** Whether to include subcategory‑level balancing (default false) */
  includeSubcategories?: boolean;
  /** Strength of blueprint balancing (0‑1, default 0.5) where 0 = ignore weights, 1 = strict adherence */
  balanceStrength?: number;
}

/**
 * Generate a blueprint‑balanced priority ordering for a set of performance gaps.
 *
 * @param gaps – Array of performance gaps (must include taxonomyCode, subcategory, gap)
 * @param scheduledReviews – Optional scheduled reviews (for upcoming distribution)
 * @param prisma – Prisma client (required if distributionSource = 'recent')
 * @param userId – User ID (required if distributionSource = 'recent')
 * @param options – Configuration options
 * @returns Sorted list of BlueprintWeightedItem (highest priority first)
 */
export async function balanceBlueprintPriorities(
  gaps: Array<{
    taxonomyCode: string;
    subcategory?: string | null;
    gap?: number;
    urgencyScore?: number;
  }>,
  scheduledReviews: Array<{ taxonomyCode: string; subcategory?: string | null }> = [],
  prisma?: any, // optional Prisma client
  userId?: string,
  options: BlueprintBalancedSelectorOptions = {}
): Promise<BlueprintWeightedItem[]> {
  const {
    distributionSource = 'upcoming',
    recentReviewWindow = 100,
    includeSubcategories = false,
    balanceStrength = 0.5,
  } = options;

  // Step 1: Compute current distribution of reviews per system
  const currentDistribution = await computeCurrentDistribution(
    distributionSource,
    scheduledReviews,
    prisma,
    userId,
    recentReviewWindow,
    includeSubcategories
  );

  // Step 2: Compute target distribution from NCCPA blueprint
  const targetDistribution = computeTargetDistribution(includeSubcategories);

  // Step 3: Compute weight deviation per system (target - current)
  const weightDeviations = computeWeightDeviations(
    currentDistribution,
    targetDistribution,
    includeSubcategories
  );

  // Step 4: Combine gap, urgency, and weight deviation into a priority score
  const weightedItems: BlueprintWeightedItem[] = gaps.map((gap) => {
    const key = includeSubcategories
      ? `${gap.taxonomyCode}|${gap.subcategory ?? ''}`
      : gap.taxonomyCode;
    const deviation = weightDeviations.get(key) ?? 0;
    // Normalize gap to 0‑1 range (assuming max gap = 0.9)
    const normalizedGap = gap.gap !== undefined ? Math.min(gap.gap / 0.9, 1) : 0;
    const urgency = gap.urgencyScore ?? 0;
    // Priority formula: weighted average of gap/urgency and deviation
    const performanceScore = (normalizedGap + urgency) / 2;
    const priorityScore = (1 - balanceStrength) * performanceScore + balanceStrength * deviation;
    return {
      taxonomyCode: gap.taxonomyCode,
      subcategory: gap.subcategory ?? null,
      gap: gap.gap,
      urgencyScore: gap.urgencyScore,
      priorityScore,
      weightDeviation: deviation,
    };
  });

  // Step 5: Sort by priority score descending
  weightedItems.sort((a, b) => b.priorityScore - a.priorityScore);
  return weightedItems;
}

// ============================================================================
// Helper Functions
// ============================================================================

type DistributionMap = Map<string, number>; // key -> proportion (0‑1)

/**
 * Compute current distribution of reviews per system.
 */
async function computeCurrentDistribution(
  source: 'upcoming' | 'recent',
  scheduledReviews: Array<{ taxonomyCode: string; subcategory?: string | null }>,
  prisma: any,
  userId?: string,
  recentReviewWindow: number = 100,
  includeSubcategories: boolean = false
): Promise<DistributionMap> {
  const distribution = new Map<string, number>();

  if (source === 'upcoming') {
    // Use scheduled reviews count as upcoming distribution
    const total = scheduledReviews.length || 1; // avoid division by zero
    for (const review of scheduledReviews) {
      const key = includeSubcategories
        ? `${review.taxonomyCode}|${review.subcategory ?? ''}`
        : review.taxonomyCode;
      distribution.set(key, (distribution.get(key) || 0) + 1);
    }
    // Convert counts to proportions
    for (const [key, count] of distribution) {
      distribution.set(key, count / total);
    }
    return distribution;
  }

  // source === 'recent': fetch last N reviews from ReviewLog
  if (!prisma || !userId) {
    throw new Error('Prisma client and userId required for recent distribution');
  }

  const recentReviews = await prisma.reviewLog.findMany({
    where: {
      userId,
      sessionType: 'MAIN',
      system: { not: null },
    },
    select: {
      system: true,
    },
    orderBy: { reviewedAt: 'desc' },
    take: recentReviewWindow,
  });

  const total = recentReviews.length || 1;
  for (const review of recentReviews) {
    const key = includeSubcategories
      ? `${review.system}|${review.subcategory ?? ''}`
      : review.system;
    distribution.set(key, (distribution.get(key) || 0) + 1);
  }
  for (const [key, count] of distribution) {
    distribution.set(key, count / total);
  }
  return distribution;
}

/**
 * Compute target distribution from NCCPA blueprint.
 * If includeSubcategories is true, we cannot know subcategory weights; fall back to system‑level.
 */
function computeTargetDistribution(includeSubcategories: boolean): DistributionMap {
  const target = new Map<string, number>();
  if (includeSubcategories) {
    // Currently no blueprint weight at subcategory level; use uniform distribution within system.
    // This is a placeholder – in a real implementation you'd need subcategory weights.
    // For now, we'll just return system‑level weights.
    console.warn('Subcategory‑level blueprint balancing not yet implemented; falling back to system level.');
  }
  // System‑level weights from NCCPA_2025_BLUEPRINT
  const totalWeight = Object.values(NCCPA_2025_BLUEPRINT).reduce((sum, w) => sum + w, 0);
  for (const [system, weight] of Object.entries(NCCPA_2025_BLUEPRINT)) {
    target.set(system, weight / totalWeight);
  }
  return target;
}

/**
 * Compute weight deviation (target - current) for each key.
 * Positive deviation means the system is underrepresented.
 */
function computeWeightDeviations(
  current: DistributionMap,
  target: DistributionMap,
  includeSubcategories: boolean
): Map<string, number> {
  const deviations = new Map<string, number>();

  // For each target entry, compute deviation
  for (const [key, targetProportion] of target) {
    const currentProportion = current.get(key) ?? 0;
    deviations.set(key, targetProportion - currentProportion);
  }

  // For keys present in current but not in target (e.g., "General"), assign zero deviation
  for (const [key] of current) {
    if (!deviations.has(key)) {
      deviations.set(key, 0);
    }
  }

  return deviations;
}

/**
 * Zipper‑sort algorithm: interleave high‑gap topics with underrepresented blueprint categories.
 * Not yet implemented; currently using linear priority score.
 * This function is a placeholder for future refinement.
 */
export function zipperSort<T>(
  items: T[],
  gapKey: (item: T) => number,
  deviationKey: (item: T) => number
): T[] {
  // Simple implementation: sort by weighted sum
  return [...items].sort((a, b) => {
    const scoreA = gapKey(a) + deviationKey(a);
    const scoreB = gapKey(b) + deviationKey(b);
    return scoreB - scoreA;
  });
}