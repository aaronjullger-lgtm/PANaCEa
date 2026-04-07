/**
 * Confusion-Pair Weighted Drill Selection
 *
 * Phase 2.5 — Optimization Strategy Rank #10
 *
 * Boosts reservoir priority for questions that target a user's active
 * confusion pairs. When a user repeatedly confuses condition A with B,
 * questions about both A and B should appear more frequently in drills.
 *
 * Integration: Called during reservoir refill to adjust priority scores
 * before items are inserted into the reservoir.
 *
 * Fully deterministic — no AI calls. Uses the existing ConfusionPair
 * records in the database.
 *
 * Priority boost tiers (added on top of base RESERVOIR_POLICY.PRIORITY):
 *   - Severe (count ≥ 5): +4 priority boost
 *   - Moderate (count ≥ 3): +2 priority boost
 *   - Mild (count ≥ 2): +1 priority boost
 *
 * This ensures confusion-pair items interleave with overdue reviews
 * (priority 9) and due reviews (priority 7) rather than dominating.
 */

// ── Types ──────────────────────────────────────────────────────────────────

export interface ConfusionPairData {
  /** The condition the user gets wrong (correct answer) */
  realConditionId: string;
  /** The condition the user mistakenly selects */
  mistakenConditionId: string;
  /** How many times this confusion has occurred */
  count: number;
  /** Severity tier */
  severity: 'high' | 'medium' | 'low';
}

export interface PriorityBoostResult {
  /** Original priority before boost */
  originalPriority: number;
  /** Boost amount applied */
  boost: number;
  /** Final priority after boost */
  finalPriority: number;
  /** Which confusion pair triggered the boost (null if none) */
  triggeredBy: string | null;
}

// ── Configuration ──────────────────────────────────────────────────────────

const BOOST_TIERS = {
  /** count ≥ 5: severe confusion — high priority boost */
  HIGH: { minCount: 5, boost: 4 },
  /** count ≥ 3: moderate confusion */
  MEDIUM: { minCount: 3, boost: 2 },
  /** count ≥ 2: mild confusion */
  LOW: { minCount: 2, boost: 1 },
} as const;

/** Maximum boost to prevent confusion pairs from always dominating the queue */
const MAX_BOOST = 4;

// ── Core Logic ─────────────────────────────────────────────────────────────

/**
 * Load active confusion pairs for a user from the database.
 *
 * Returns pairs sorted by count descending (most confused first).
 * Only includes pairs with count ≥ 2 (minimum threshold for actionable data).
 */
export async function loadUserConfusionPairs(
  prisma: any,
  userId: string
): Promise<ConfusionPairData[]> {
  try {
    const pairs = await prisma.confusionPair.findMany({
      where: {
        userId,
        count: { gte: 2 }, // Minimum threshold
      },
      select: {
        realConditionId: true,
        mistakenForId: true,
        count: true,
      },
      orderBy: { count: 'desc' },
      take: 50, // Cap to prevent excessive processing
    });

    return pairs.map((p: any) => ({
      realConditionId: p.realConditionId,
      mistakenConditionId: p.mistakenForId,
      count: p.count,
      severity: p.count >= BOOST_TIERS.HIGH.minCount
        ? 'high' as const
        : p.count >= BOOST_TIERS.MEDIUM.minCount
          ? 'medium' as const
          : 'low' as const,
    }));
  } catch (error) {
    // If ConfusionPair table doesn't exist yet or query fails, return empty
    console.error('[confusionPairBoost] Failed to load pairs:', error instanceof Error ? error.message : error);
    return [];
  }
}

/**
 * Build a set of condition IDs that are involved in active confusion pairs.
 * Both sides of the pair are included (the real condition AND the mistaken one).
 */
export function buildConfusionConditionSet(
  pairs: ConfusionPairData[]
): Map<string, { boost: number; pairKey: string }> {
  const conditionBoosts = new Map<string, { boost: number; pairKey: string }>();

  for (const pair of pairs) {
    const boost = pair.count >= BOOST_TIERS.HIGH.minCount
      ? BOOST_TIERS.HIGH.boost
      : pair.count >= BOOST_TIERS.MEDIUM.minCount
        ? BOOST_TIERS.MEDIUM.boost
        : BOOST_TIERS.LOW.boost;

    const pairKey = `${pair.realConditionId}↔${pair.mistakenConditionId}`;

    // Apply boost to both conditions in the pair
    for (const conditionId of [pair.realConditionId, pair.mistakenConditionId]) {
      const existing = conditionBoosts.get(conditionId);
      if (!existing || boost > existing.boost) {
        conditionBoosts.set(conditionId, { boost: Math.min(boost, MAX_BOOST), pairKey });
      }
    }
  }

  return conditionBoosts;
}

/**
 * Apply confusion-pair priority boost to a reservoir item.
 *
 * Call this for each item during reservoir refill before insertion.
 * If the item's conditionId matches an active confusion pair, its
 * priority is boosted.
 *
 * @param basePriority - The item's original priority from RESERVOIR_POLICY
 * @param conditionId - The condition this question is about (may be null)
 * @param confusionBoosts - Map from buildConfusionConditionSet()
 * @returns Boosted priority and metadata
 */
export function applyConfusionBoost(
  basePriority: number,
  conditionId: string | null,
  confusionBoosts: Map<string, { boost: number; pairKey: string }>
): PriorityBoostResult {
  if (!conditionId || confusionBoosts.size === 0) {
    return {
      originalPriority: basePriority,
      boost: 0,
      finalPriority: basePriority,
      triggeredBy: null,
    };
  }

  const match = confusionBoosts.get(conditionId);
  if (!match) {
    return {
      originalPriority: basePriority,
      boost: 0,
      finalPriority: basePriority,
      triggeredBy: null,
    };
  }

  return {
    originalPriority: basePriority,
    boost: match.boost,
    finalPriority: basePriority + match.boost,
    triggeredBy: match.pairKey,
  };
}

/**
 * Convenience: compute confusion boosts for a batch of reservoir items.
 *
 * Usage during reservoir refill:
 * ```typescript
 * const pairs = await loadUserConfusionPairs(prisma, userId);
 * const boosts = buildConfusionConditionSet(pairs);
 * for (const item of itemsToInsert) {
 *   const { finalPriority } = applyConfusionBoost(item.priority, item.conditionId, boosts);
 *   item.priority = finalPriority;
 * }
 * ```
 */
export async function boostReservoirItems(
  prisma: any,
  userId: string,
  items: Array<{ priority: number; conditionId: string | null }>
): Promise<{
  boostedCount: number;
  totalBoostApplied: number;
  pairsUsed: number;
}> {
  const pairs = await loadUserConfusionPairs(prisma, userId);
  if (pairs.length === 0) {
    return { boostedCount: 0, totalBoostApplied: 0, pairsUsed: 0 };
  }

  const boosts = buildConfusionConditionSet(pairs);
  let boostedCount = 0;
  let totalBoostApplied = 0;

  for (const item of items) {
    const result = applyConfusionBoost(item.priority, item.conditionId, boosts);
    if (result.boost > 0) {
      item.priority = result.finalPriority;
      boostedCount++;
      totalBoostApplied += result.boost;
    }
  }

  return {
    boostedCount,
    totalBoostApplied,
    pairsUsed: pairs.length,
  };
}
