/**
 * Confusion-Driven Adaptive Drill Router
 *
 * Turns passive confusion-pair data into active, spaced remediation.
 *
 * When a user repeatedly confuses condition A with B, this router:
 *   1. Ranks the user's confusion pairs by frequency + recency
 *   2. Resolves each pair to available drill content
 *   3. Schedules a 3-step remediation plan:
 *      - Step 1 (immediate): Contrastive drill comparing the pair
 *      - Step 2 (10 min):   Recall question on the correct condition
 *      - Step 3 (24 h):     Similar-but-different vignette
 *   4. Returns a structured queue the frontend can consume
 *
 * @module services/core/confusionRouter
 */

import { loadUserConfusionPairs, type ConfusionPairData } from '../../lib/services/reservoir/confusionPairBoost';
import { RESERVOIR_POLICY } from '../../lib/services/reservoir/reservoirPolicy';
export { bulkInsertReservoirItems } from '../../lib/services/reservoir/reservoirService';

// ─── Types ────────────────────────────────────────────────────────────────────

export type RemediationStep = 'contrastive' | 'recall' | 'similar_vignette';

export type DrillType = 'contrastive' | 'ddx' | 'recall' | 'similar_vignette';

export interface ConfusionRemediationItem {
  /** Canonical pair key (alphabetically sorted condition IDs) */
  pairKey: string;
  /** The correct answer condition (what the user got wrong) */
  correctConditionId: string | null;
  /** The mistaken condition (what the user selected) */
  mistakenConditionId: string | null;
  /** Readable names (fetched from DB or derived) */
  correctConditionName: string | null;
  mistakenConditionName: string | null;
  /** Total times this pair has been confused */
  confusionCount: number;
  /** Severity tier from confusionPairBoost */
  severity: 'high' | 'medium' | 'low';
  /** Days since last occurrence (0 = today) */
  daysSinceLastOccurrence: number;
  /** Composite score: higher = should be remediated first */
  routingScore: number;
  /** Which drill type the system recommends */
  suggestedDrillType: DrillType;
  /** FSRS scheduling info for this pair's conditions */
  schedulingInfo: ConfusionSchedulingInfo;
}

export interface ConfusionSchedulingInfo {
  correctConditionProgress: {
    conditionId: string;
    nextReviewAt: string | null;
    stability: number | null;
    difficulty: number | null;
    retrievability: number | null;
  } | null;
  mistakenConditionProgress: {
    conditionId: string;
    nextReviewAt: string | null;
    stability: number | null;
    difficulty: number | null;
    retrievability: number | null;
  } | null;
  /** Whether either condition has an overdue review */
  hasOverdueReview: boolean;
}

export interface ConfusionDrillQueue {
  userId: string;
  /** Total active confusion pairs for this user */
  totalPairs: number;
  /** Remediation items sorted by routingScore descending */
  items: ConfusionRemediationItem[];
  /** When this queue was generated */
  generatedAt: string;
  /** Reservoir scope for pre-warming */
  reservoirScope: string;
}

export interface ConfusionRouterOptions {
  /** Maximum number of items to return (default 10) */
  limit?: number;
  /** Minimum confusion count to include (default 2) */
  minCount?: number;
  /** Include FSRS scheduling data (default true) */
  includeScheduling?: boolean;
  /** Override userId (for testing) */
  userIdOverride?: string;
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

const REMEDIATION_SCHEDULE: Record<RemediationStep, { label: string; delayMs: number }> = {
  contrastive:       { label: 'Immediate contrastive drill', delayMs: 0 },
  recall:            { label: 'Recall reinforcement',       delayMs: 10 * 60_000 },
  similar_vignette:  { label: 'Similar-but-different',      delayMs: 24 * 3600_000 },
};

/**
 * Compute a routing score for a confusion pair.
 *
 * Higher score = higher priority for remediation.
 *
 * Factors:
 *   - Frequency weight: log-scaled confusion count (diminishing returns)
 *   - Recency penalty:  days since last occurrence (fresher = higher score)
 *   - Severity bonus:   tier from confusionPairBoost
 */
function computeRoutingScore(
  count: number,
  daysSinceLast: number,
  severity: 'high' | 'medium' | 'low'
): number {
  // Log-scaled frequency (diminishing returns for repeated confusion)
  const frequencyWeight = Math.log2(count + 1) * 10;

  // Exponential decay: 1.0 if today, ~0.5 after 3 days, ~0.25 after 7 days
  const recencyWeight = Math.exp(-daysSinceLast * 0.15);

  // Severity bonus
  const severityBonus = severity === 'high' ? 5 : severity === 'medium' ? 3 : 1;

  // If overdue review exists, boost further
  return (frequencyWeight * recencyWeight) + severityBonus;
}

/**
 * Determine the best drill type for a confusion pair.
 *
 * - high severity + recent → contrastive drill (direct comparison)
 * - medium severity        → ddx drill (differential diagnosis ranking)
 * - low severity           → recall question on the correct condition
 */
function suggestDrillType(
  severity: 'high' | 'medium' | 'low',
  daysSinceLast: number,
  hasOverdueReview: boolean
): DrillType {
  if (severity === 'high' && daysSinceLast <= 3) return 'contrastive';
  if (severity === 'high' || hasOverdueReview) return 'contrastive';
  if (severity === 'medium') return 'ddx';
  return 'recall';
}

// ─── Core Router ──────────────────────────────────────────────────────────────

type PrismaClientLike = {
  confusionPair: any;
  userProgress: any;
  medicalContent: any;
  condition: any;
  [key: string]: any;
};

/**
 * Build a confusion-based drill queue for a user.
 *
 * This is the main entry point. It:
 *   1. Loads the user's confusion pairs from the DB
 *   2. Fetches FSRS scheduling data for the involved conditions
 *   3. Scores and ranks each pair
 *   4. Returns a structured remediation plan
 */
export async function getConfusionBasedDrillQueue(
  prisma: PrismaClientLike,
  userId: string,
  options: ConfusionRouterOptions = {}
): Promise<ConfusionDrillQueue> {
  const {
    limit = 10,
    minCount = 2,
    includeScheduling = true,
  } = options;

  // ── Step 1: Load confusion pairs ──
  const pairs = await loadUserConfusionPairs(prisma, userId);
  const activePairs = pairs.filter((p) => p.count >= minCount);

  if (activePairs.length === 0) {
    return {
      userId,
      totalPairs: 0,
      items: [],
      generatedAt: new Date().toISOString(),
      reservoirScope: buildReservoirScope(userId),
    };
  }

  // ── Step 2: Enrich with names and scheduling ──
  const now = new Date();
  const conditionIds = new Set<string>();
  for (const pair of activePairs) {
    if (pair.realConditionId) conditionIds.add(pair.realConditionId);
    if (pair.mistakenConditionId) conditionIds.add(pair.mistakenConditionId);
  }

  // Batch-fetch condition names
  const conditionNames = await fetchConditionNames(prisma, Array.from(conditionIds));

  // Batch-fetch FSRS progress for all involved conditions
  const progressMap = includeScheduling
    ? await fetchProgressMap(prisma, userId, Array.from(conditionIds))
    : new Map<string, any>();

  // Load lastOccurrence dates from ConfusionPair table (loadUserConfusionPairs
  // doesn't return this field, so we fetch it separately)
  const lastOccurrenceMap = await fetchLastOccurrences(prisma, userId, activePairs);

  // ── Step 3: Score and build remediation items ──
  const items: ConfusionRemediationItem[] = [];

  for (const pair of activePairs) {
    const realId = pair.realConditionId;
    const mistakenId = pair.mistakenConditionId;

    const lastOcc = lastOccurrenceMap.get(`${realId}|${mistakenId}`);
    const daysSinceLast = lastOcc
      ? Math.floor((now.getTime() - lastOcc.getTime()) / 86400_000)
      : 999;

    const correctProgress = realId ? progressMap.get(realId) ?? null : null;
    const mistakenProgress = mistakenId ? progressMap.get(mistakenId) ?? null : null;

    const hasOverdueReview = [correctProgress, mistakenProgress].some(
      (p) => p?.nextReviewAt && new Date(p.nextReviewAt) < now
    );

    const routingScore = computeRoutingScore(pair.count, daysSinceLast, pair.severity);
    const suggestedDrillType = suggestDrillType(pair.severity, daysSinceLast, hasOverdueReview);

    // Build canonical pair key (alphabetically sorted)
    const sortedIds = [realId, mistakenId].filter(Boolean).sort();
    const pairKey = sortedIds.join('|');

    items.push({
      pairKey,
      correctConditionId: realId,
      mistakenConditionId: mistakenId,
      correctConditionName: realId ? (conditionNames.get(realId) ?? realId) : null,
      mistakenConditionName: mistakenId ? (conditionNames.get(mistakenId) ?? mistakenId) : null,
      confusionCount: pair.count,
      severity: pair.severity,
      daysSinceLastOccurrence: daysSinceLast,
      routingScore,
      suggestedDrillType,
      schedulingInfo: {
        correctConditionProgress: correctProgress ? {
          conditionId: realId!,
          nextReviewAt: correctProgress.nextReviewAt,
          stability: correctProgress.fsrsStability,
          difficulty: correctProgress.fsrsDifficulty,
          retrievability: correctProgress.retrievability,
        } : null,
        mistakenConditionProgress: mistakenProgress ? {
          conditionId: mistakenId!,
          nextReviewAt: mistakenProgress.nextReviewAt,
          stability: mistakenProgress.fsrsStability,
          difficulty: mistakenProgress.fsrsDifficulty,
          retrievability: mistakenProgress.retrievability,
        } : null,
        hasOverdueReview,
      },
    });
  }

  // Sort by routing score descending
  items.sort((a, b) => b.routingScore - a.routingScore);

  return {
    userId,
    totalPairs: activePairs.length,
    items: items.slice(0, limit),
    generatedAt: now.toISOString(),
    reservoirScope: buildReservoirScope(userId),
  };
}

// ─── Reservoir Scope ──────────────────────────────────────────────────────────

/**
 * Build the confusion-remediation reservoir scope for pre-warming.
 * Format: `confusion-remediation:{userId}`
 */
export function buildReservoirScope(userId: string): string {
  return `confusion-remediation:${userId}`;
}

/**
 * Derive reservoir items for confusion-pair pre-warming.
 *
 * Returns items that can be inserted into the reservoir via `bulkInsertReservoirItems`.
 * Uses CONFUSION_REMEDIATION priority (8) — between OVERDUE_REVIEW (9) and DUE_REVIEW (7).
 */
export async function buildConfusionReservoirItems(
  prisma: PrismaClientLike,
  userId: string,
  queue: ConfusionDrillQueue
): Promise<Array<{
  userId: string;
  questionId: string;
  questionSource: 'pool' | 'review';
  scope: string;
  priority: number;
  system: string | null;
  difficulty: string | null;
  questionOrder: string | null;
  taskCategory: string | null;
  isReview: boolean;
}>> {
  const scope = queue.reservoirScope;
  const items: Array<any> = [];

  for (const remediationItem of queue.items) {
    if (remediationItem.correctConditionId) {
      // Try to find an existing question for the correct condition
      const question = await findConfusionQuestion(
        prisma,
        remediationItem.correctConditionId,
        userId
      );
      if (question) {
        items.push({
          userId,
          questionId: question.id,
          questionSource: 'pool',
          scope,
          priority: RESERVOIR_POLICY.PRIORITY.OVERDUE_REVIEW, // 9 — high urgency
          system: question.system,
          difficulty: question.difficulty,
          questionOrder: question.questionOrder ?? null,
          taskCategory: question.taskCategory ?? null,
          isReview: false,
        });
      }
    }

    // Also find a question for the mistaken condition (for contrastive drill)
    if (remediationItem.mistakenConditionId) {
      const question = await findConfusionQuestion(
        prisma,
        remediationItem.mistakenConditionId,
        userId
      );
      if (question) {
        items.push({
          userId,
          questionId: question.id,
          questionSource: 'pool',
          scope,
          priority: RESERVOIR_POLICY.PRIORITY.DUE_REVIEW, // 7
          system: question.system,
          difficulty: question.difficulty,
          questionOrder: question.questionOrder ?? null,
          taskCategory: question.taskCategory ?? null,
          isReview: false,
        });
      }
    }
  }

  return items;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Fetch readable names for a batch of condition IDs.
 * Checks both Condition and MedicalContent tables.
 */
async function fetchConditionNames(
  prisma: PrismaClientLike,
  conditionIds: string[]
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  if (conditionIds.length === 0) return names;

  try {
    // Try MedicalContent first (primary source for question-linked conditions)
    const contents = await prisma.medicalContent.findMany({
      where: { id: { in: conditionIds } },
      select: { id: true, name: true },
      take: 100,
    });
    for (const c of contents) {
      names.set(c.id, c.name);
    }

    // Fill gaps from Condition table
    const missingIds = conditionIds.filter((id) => !names.has(id));
    if (missingIds.length > 0) {
      const conditions = await prisma.condition.findMany({
        where: { id: { in: missingIds } },
        select: { id: true, name: true },
        take: 100,
      });
      for (const c of conditions) {
        names.set(c.id, c.name);
      }
    }
  } catch {
    // Non-fatal — names are enrichment, not required
  }

  return names;
}

/**
 * Fetch FSRS progress records for the given user + condition IDs.
 */
async function fetchProgressMap(
  prisma: PrismaClientLike,
  userId: string,
  conditionIds: string[]
): Promise<Map<string, any>> {
  const map = new Map<string, any>();
  if (conditionIds.length === 0) return map;

  try {
    const progress = await prisma.userProgress.findMany({
      where: {
        userId,
        conditionId: { in: conditionIds },
      },
      select: {
        conditionId: true,
        nextReviewAt: true,
        fsrsStability: true,
        fsrsDifficulty: true,
      },
    });

    for (const p of progress) {
      // Estimate retrievability from stability and elapsed time
      const stability = p.fsrsStability;
      const elapsed = stability && p.nextReviewAt
        ? Math.max(0, (new Date().getTime() - new Date(p.nextReviewAt).getTime()) / 86400_000)
        : 0;
      const retrievability = stability ? Math.exp(-elapsed / stability) : null;

      map.set(p.conditionId, {
        ...p,
        retrievability,
      });
    }
  } catch {
    // Non-fatal
  }

  return map;
}

/**
 * Fetch lastOccurrence dates for confusion pairs.
 * loadUserConfusionPairs doesn't include this field, so we query it separately.
 */
async function fetchLastOccurrences(
  prisma: PrismaClientLike,
  userId: string,
  pairs: ConfusionPairData[]
): Promise<Map<string, Date>> {
  const map = new Map<string, Date>();
  if (pairs.length === 0) return map;

  try {
    const records = await prisma.confusionPair.findMany({
      where: {
        userId,
        OR: pairs.map((p) => ({
          realConditionId: p.realConditionId,
          mistakenForId: p.mistakenConditionId,
        })),
      },
      select: {
        realConditionId: true,
        mistakenForId: true,
        lastOccurrence: true,
      },
    });

    for (const r of records) {
      const key = `${r.realConditionId}|${r.mistakenForId}`;
      if (!map.has(key)) {
        map.set(key, new Date(r.lastOccurrence));
      }
    }
  } catch {
    // Non-fatal
  }

  return map;
}

/**
 * Find a question for confusion-pair remediation.
 * Checks PreGeneratedQuestion first, then Question table.
 */
async function findConfusionQuestion(
  prisma: PrismaClientLike,
  conditionId: string,
  userId: string
): Promise<any | null> {
  try {
    const preGenerated = await prisma.preGeneratedQuestion.findFirst({
      where: {
        conditionId,
        validationStatus: { in: ['approved', 'auto_approved'] },
        flagCount: { lt: 3 },
      },
      select: {
        id: true,
        system: true,
        difficulty: true,
        questionOrder: true,
        taskCategory: true,
      },
    });

    if (preGenerated) return preGenerated;

    const question = await prisma.question.findFirst({
      where: { conditionId },
      select: {
        id: true,
        system: true,
        difficulty: true,
      },
    });

    return question;
  } catch {
    return null;
  }
}
