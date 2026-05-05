/**
 * Refill Worker — Executes the actual question selection for reservoir refills.
 *
 * This is the logic that runs inside a BackgroundJob when processing a
 * reservoir_refill job. It reuses the existing selectSessionQuestions() engine
 * but writes results to the StudentReservoirItem table instead of returning
 * them directly.
 *
 * Strategy:
 *   Phase 1: Select FSRS due reviews (high priority, short TTL)
 *   Phase 2: Select new cards from existing pool (medium priority)
 *   Phase 3: (Future) Generate fresh questions via Gemini if pool is thin
 *
 * Quality gates:
 *   - Skip questions with flagCount >= 3
 *   - Only serve questions matching ALLOWED_VALIDATION_STATUSES (Phase 2 review gate)
 *   - Skip questions with qualityScore < 0.4
 *   - Skip questions the student has already seen too many times
 *
 * @module lib/services/reservoir/refillWorker
 */

import { RESERVOIR_POLICY, type RefillResult } from './reservoirPolicy';
import { bulkInsertReservoirItems, type InsertReservoirItemInput } from './reservoirService';
import { ALLOWED_VALIDATION_STATUSES } from '../mainSessionQuestionSelector';
import { boostReservoirItems } from './confusionPairBoost';
import {
  NCCPA_2025_BLUEPRINT_PERCENT,
  normalizeSystemName,
  getSystemAbbreviation,
} from '../../constants/blueprint';
import { computeAdjacencyPriority, getAdjacencyMultiplier } from '../../constants/clinicalAdjacency';

type PrismaClientLike = {
  userProgress: any;
  preGeneratedQuestion: any;
  question: any;
  userQuestionSeen: any;
  studentReservoirItem: any;
  $queryRaw: any;
  $queryRawUnsafe: any;
  $transaction: any;
  $executeRawUnsafe: any;
  [key: string]: any;
};

type ParsedReservoirScope =
  | { kind: 'adaptive' }
  | { kind: 'system'; system: string }
  | { kind: 'subcategory'; system: string; subcategory: string }
  | { kind: 'condition'; conditionId: string }
  | { kind: 'confusion-remediation'; userId: string };

interface ResolvedReservoirConditionScope {
  progressConditionIds: string[];
  questionConditionIds: string[];
  medicalContentIds: string[];
}

export function parseReservoirScope(scope: string): ParsedReservoirScope {
  if (scope.startsWith('system:')) {
    const system = scope.slice('system:'.length).trim();
    return system ? { kind: 'system', system } : { kind: 'adaptive' };
  }

  if (scope.startsWith('subcategory:')) {
    const [, rawSystem = '', rawSubcategory = ''] = scope.split(':');
    const system = rawSystem.trim();
    const subcategory = decodeURIComponent(rawSubcategory).trim();
    return system && subcategory
      ? { kind: 'subcategory', system, subcategory }
      : { kind: 'adaptive' };
  }

  if (scope.startsWith('condition:')) {
    const conditionId = scope.slice('condition:'.length).trim();
    return conditionId ? { kind: 'condition', conditionId } : { kind: 'adaptive' };
  }

  if (scope.startsWith('confusion-remediation:')) {
    const userId = scope.slice('confusion-remediation:'.length).trim();
    return userId ? { kind: 'confusion-remediation', userId } : { kind: 'adaptive' };
  }

  return { kind: 'adaptive' };
}

// ─── Quality Gate ───────────────────────────────────────────────────────────

interface QualityDecision {
  allow: boolean;
  reason?: string;
}

function shouldEnterReservoir(question: any): QualityDecision {
  if (question.flagCount >= 3) return { allow: false, reason: 'high_flag_count' };
  if (question.validationStatus === 'rejected') return { allow: false, reason: 'rejected' };
  // Phase 2: Prefer approved questions. Pending questions still allowed through
  // shouldEnterReservoir but ranked lower by the query ORDER BY qualityScore DESC.
  if (question.qualityScore !== null && question.qualityScore !== undefined && question.qualityScore < 0.4) {
    return { allow: false, reason: 'low_quality' };
  }
  return { allow: true };
}

// ─── Main Worker ────────────────────────────────────────────────────────────

export interface RefillJobPayload {
  userId: string;
  scope: string;
  deficit: number;
  reason: string;
  isReservoirRefill: boolean;
  /** Learner phase for Bloom's-level question ordering (didactic/clinical/pance_prep) */
  learnerPhase?: 'didactic' | 'clinical' | 'pance_prep';
  /** When true, boost reservoir priority for questions targeting active confusion pairs */
  confusionScope?: boolean;
  /**
   * Primary system for TARGETED sessions (canonical name, e.g. 'Cardiovascular').
   * When set, Phase 1 FSRS-due cards are sorted by adjacency-weighted priority score
   * rather than simple nextReviewAt order.
   * Derived from scope when scope = 'system:<abbreviation>'.
   */
  primarySystem?: string;
}

/**
 * Execute a reservoir refill job.
 *
 * Called by the background worker when processing a generate_questions job
 * with isReservoirRefill: true in the payload.
 */
export async function executeRefill(
  prisma: PrismaClientLike,
  payload: RefillJobPayload
): Promise<RefillResult> {
  const { userId, scope, deficit } = payload;
  const parsedScope = parseReservoirScope(scope);
  const parsedConditionScope =
    parsedScope.kind === 'condition'
      ? await resolveReservoirConditionScope(prisma, parsedScope.conditionId)
      : null;

  // Resolve primarySystem for TARGETED adjacency scoring.
  // Accept explicit payload.primarySystem, or infer from scope ('system:CV' → 'Cardiovascular').
  const rawPrimarySystem =
    payload.primarySystem ??
    (parsedScope.kind === 'system' || parsedScope.kind === 'subcategory'
      ? parsedScope.system
      : undefined);
  const primarySystem = rawPrimarySystem ? normalizeSystemName(rawPrimarySystem) : undefined;
  const items: InsertReservoirItemInput[] = [];
  const errors: string[] = [];

  // Get questions the student already has in reservoir (avoid duplicates)
  const existingReservoir = await prisma.studentReservoirItem.findMany({
    where: { userId },
    select: { questionId: true },
  });
  const reservoirQuestionIds = new Set<string>(existingReservoir.map((r: any) => String(r.questionId)));

  // Get questions the student has already seen (for variety)
  const seenQuestions = await prisma.userQuestionSeen.findMany({
    where: { userId },
    select: { questionId: true, timesShown: true },
  });
  const seenMap = new Map<string, number>(
    seenQuestions.map((s: any) => [String(s.questionId), Number(s.timesShown) || 0])
  );

  // ── Phase 1: FSRS Due Reviews ──

  const reviewTarget = Math.ceil(deficit * 0.7);
  let reviewsQueued = 0;

  try {
    const now = new Date();
    const dueReviewsRaw = await prisma.userProgress.findMany({
      where: {
        userId,
        nextReviewAt: { lte: now },
        ...(parsedConditionScope
          ? { conditionId: { in: parsedConditionScope.progressConditionIds } }
          : {}),
        ...(parsedScope.kind === 'system' || parsedScope.kind === 'subcategory'
          ? { system: parsedScope.system }
          : {}),
      },
      // Fetch a larger batch so adjacency sorting has sufficient candidates.
      // Final slice applied after scoring.
      orderBy: { nextReviewAt: 'asc' },
      take: (reviewTarget + 10) * 3,
      select: {
        conditionId: true,
        system: true,
        fsrsDifficulty: true,
        nextReviewAt: true,
      },
    });

    // ── Adjacency-weighted sort (TARGETED sessions only) ───────────────────
    // When primarySystem is set, sort candidates by:
    //   priorityScore = fsrsOverdueness × adjacencyMultiplier
    // where adjacencyMultiplier is 2.0 (same system), 1.5 (adjacent), or 1.0 (other).
    // Falls back to chronological order when no primarySystem is configured.
    const nowMs = now.getTime();
    const dueReviews = primarySystem
      ? (() => {
          type ReviewRow = typeof dueReviewsRaw[number];

          // Compute scores for all candidates
          const scored: Array<{ row: ReviewRow; score: number; multiplier: number }> =
            dueReviewsRaw.map((row) => {
              const cardSystem = row.system ? normalizeSystemName(row.system) : '';
              const dueMs = row.nextReviewAt ? row.nextReviewAt.getTime() : nowMs;
              const score = computeAdjacencyPriority(dueMs, nowMs, cardSystem, primarySystem);
              const multiplier = getAdjacencyMultiplier(cardSystem, primarySystem);
              return { row, score, multiplier };
            });

          // Sort descending by priority score
          scored.sort((a, b) => b.score - a.score);

          // Fallback rule: if top candidates are all multiplier=1.0 (no adjacency),
          // re-sort purely by fsrsOverdueness to maintain existing behaviour.
          const hasPrimaryOrAdjacent = scored.some((s) => s.multiplier > 1.0);
          const sortedRows = hasPrimaryOrAdjacent
            ? scored
            : scored.sort((a, b) => {
                const aDue = a.row.nextReviewAt?.getTime() ?? nowMs;
                const bDue = b.row.nextReviewAt?.getTime() ?? nowMs;
                return aDue - bDue; // most overdue first
              });

          return sortedRows.slice(0, reviewTarget + 10).map((s) => s.row);
        })()
      : dueReviewsRaw.slice(0, reviewTarget + 10);

    for (const review of dueReviews) {
      if (reviewsQueued >= reviewTarget) break;
      if (!review.conditionId) continue;

      // Find a question for this condition
      const question = await findQuestionForCondition(
        prisma,
        review.conditionId,
        userId,
        reservoirQuestionIds,
        seenMap,
        parsedScope
      );
      if (!question) continue;

      const qualityCheck = shouldEnterReservoir(question);
      if (!qualityCheck.allow) continue;

      const isOverdue = review.nextReviewAt && review.nextReviewAt < new Date(Date.now() - 86400_000);

      items.push({
        userId,
        questionId: question.id,
        questionSource: 'review',
        scope,
        priority: isOverdue
          ? RESERVOIR_POLICY.PRIORITY.OVERDUE_REVIEW
          : RESERVOIR_POLICY.PRIORITY.DUE_REVIEW,
        system: question.system || review.system,
        difficulty: question.difficulty,
        conditionId: review.conditionId,
        questionOrder: question.questionOrder || null,
        taskCategory: question.taskCategory || null,
        isReview: true,
      });
      reservoirQuestionIds.add(question.id);
      reviewsQueued++;
    }
  } catch (err: any) {
    errors.push(`Phase 1 (reviews): ${err.message}`);
  }

  // ── Phase 2: New Cards from Pool (Blueprint-weighted for main sessions) ──

  const newTarget = deficit - reviewsQueued;
  let poolQueued = 0;

  try {
    const scopeSystemFilter =
      parsedScope.kind === 'system' || parsedScope.kind === 'subcategory'
        ? parsedScope.system
        : undefined;
    const scopeConditionFilter =
      parsedConditionScope ?? undefined;

    // Sprint 3: When scope is global (main session), distribute new cards
    // proportionally to NCCPA blueprint weights so the reservoir reflects
    // true PANCE distribution. System-specific scopes still use direct filter.
    const isGlobalScope = parsedScope.kind === 'adaptive' || parsedScope.kind === 'confusion-remediation';

    // Calculate per-system quotas for blueprint-weighted filling
    let systemQuotas: Record<string, number> | null = null;
    if (isGlobalScope && newTarget > 0) {
      const totalWeight = Object.values(NCCPA_2025_BLUEPRINT_PERCENT).reduce((a, b) => a + b, 0);
      systemQuotas = {};
      let remaining = newTarget;
      const systems = Object.entries(NCCPA_2025_BLUEPRINT_PERCENT)
        .sort(([, a], [, b]) => b - a); // Highest weight first for rounding
      for (const [sys, weight] of systems) {
        const quota = Math.max(1, Math.round((weight / totalWeight) * newTarget));
        systemQuotas[sys] = Math.min(quota, remaining);
        remaining -= systemQuotas[sys]!;
        if (remaining <= 0) break;
      }
      // Distribute any leftover to highest-weight systems
      if (remaining > 0) {
        for (const [sys] of systems) {
          if (remaining <= 0) break;
          systemQuotas[sys] = (systemQuotas[sys] || 0) + 1;
          remaining--;
        }
      }
    }

    // Build phase-aware order preference weights.
    const phaseOrderWeights: Record<string, number> = {};
    if (payload.learnerPhase) {
      const weights = {
        didactic:   { first: 0.30, second: 0.50, third: 0.20 },
        clinical:   { first: 0.15, second: 0.40, third: 0.45 },
        pance_prep: { first: 0.10, second: 0.35, third: 0.55 },
      }[payload.learnerPhase];
      if (weights) {
        phaseOrderWeights.first  = weights.first;
        phaseOrderWeights.second = weights.second;
        phaseOrderWeights.third  = weights.third;
      }
    }

    // Helper: fetch candidates for a single system (or all if no filter)
    const fetchCandidatesForSystem = async (
      sysFilter?: string,
      limit: number = newTarget * 2,
      conditionScope?: ResolvedReservoirConditionScope
    ) => {
      const conditionWhere = conditionScope
        ? buildPregeneratedConditionWhere(conditionScope)
        : {};
      const poolQuestions = await prisma.preGeneratedQuestion.findMany({
        where: {
          ...(sysFilter ? { system: sysFilter } : {}),
          ...conditionWhere,
          validationStatus: { in: ALLOWED_VALIDATION_STATUSES },
          flagCount: { lt: 3 },
          id: { notIn: Array.from(reservoirQuestionIds) },
        },
        orderBy: [
          { timesServed: 'asc' },
          { qualityScore: 'desc' },
        ],
        take: limit,
        select: {
          id: true,
          system: true,
          conditionId: true,
          medicalContentId: true,
          difficulty: true,
          questionOrder: true,
          taskCategory: true,
          flagCount: true,
          qualityScore: true,
          validationStatus: true,
          timesServed: true,
        },
      });

      return poolQuestions.map((q: any) => ({ ...q, source: 'pool' as const }));
    };

    // Sort helper
    const sortCandidates = (candidates: any[]) => {
      candidates.sort((a, b) => {
        const aSeen = seenMap.get(a.id) || 0;
        const bSeen = seenMap.get(b.id) || 0;
        if (aSeen !== bSeen) return aSeen - bSeen;
        if (payload.learnerPhase && a.questionOrder && b.questionOrder) {
          const aWeight = Number(phaseOrderWeights[a.questionOrder] || 0);
          const bWeight = Number(phaseOrderWeights[b.questionOrder] || 0);
          if (aWeight !== bWeight) return bWeight - aWeight;
        }
        return (b.qualityScore || 0) - (a.qualityScore || 0);
      });
    };

    if (systemQuotas) {
      // Blueprint-weighted: fetch per system in proportion to NCCPA weights
      for (const [blueprintSystem, quota] of Object.entries(systemQuotas)) {
        if (quota <= 0 || poolQueued >= newTarget) continue;

        const abbrev = getSystemAbbreviation(blueprintSystem);
        const candidates = await fetchCandidatesForSystem(abbrev, quota * 3);
        sortCandidates(candidates);

        let systemQueued = 0;
        for (const q of candidates) {
          if (systemQueued >= quota || poolQueued >= newTarget) break;
          if (reservoirQuestionIds.has(q.id)) continue;

          const qualityCheck = shouldEnterReservoir(q);
          if (!qualityCheck.allow) continue;

          items.push({
            userId,
            questionId: q.id,
            questionSource: 'pool',
            scope,
            priority: RESERVOIR_POLICY.PRIORITY.NEW_STANDARD,
            system: q.system,
            difficulty: q.difficulty,
            conditionId: q.conditionId ?? null,
            questionOrder: q.questionOrder,
            taskCategory: q.taskCategory,
            isReview: false,
          });
          reservoirQuestionIds.add(q.id);
          poolQueued++;
          systemQueued++;
        }
      }
    } else {
      // Scoped session: preserve mode intent instead of filling from the
      // global blueprint pool.
      const allNewCandidates = await fetchCandidatesForSystem(
        scopeSystemFilter,
        newTarget * 2,
        scopeConditionFilter
      );
      sortCandidates(allNewCandidates);

      for (const q of allNewCandidates) {
        if (poolQueued >= newTarget) break;
        if (reservoirQuestionIds.has(q.id)) continue;

        const qualityCheck = shouldEnterReservoir(q);
        if (!qualityCheck.allow) continue;

        items.push({
          userId,
          questionId: q.id,
          questionSource: 'pool',
          scope,
          priority: RESERVOIR_POLICY.PRIORITY.NEW_STANDARD,
          system: q.system,
          difficulty: q.difficulty,
          conditionId:
            q.conditionId ??
            (parsedScope.kind === 'condition' ? parsedScope.conditionId : null),
          questionOrder: q.questionOrder,
          taskCategory: q.taskCategory,
          isReview: false,
        });
        reservoirQuestionIds.add(q.id);
        poolQueued++;
      }
    }
  } catch (err: any) {
    errors.push(`Phase 2 (pool): ${err.message}`);
  }

  // ── Phase 2.5: Confusion-Pair Priority Boost ──

  let confusionBoostedCount = 0;

  if (payload.confusionScope !== false && items.length > 0) {
    // Default ON — confusion awareness is always active unless explicitly disabled.
    // The boostReservoirItems function gracefully returns 0 if the user has no pairs.
    try {
      // Build a parallel array that boostReservoirItems can mutate in-place.
      // It needs { priority, conditionId } — we'll map priorities back after.
      const boostTargets = items.map(item => ({
        priority: item.priority,
        conditionId: item.conditionId ?? item.system ?? null,
      }));

      const boostResult = await boostReservoirItems(prisma, userId, boostTargets);

      // Apply boosted priorities back to items
      if (boostResult.boostedCount > 0) {
        for (let i = 0; i < items.length; i++) {
          items[i]!.priority = boostTargets[i]!.priority;
        }
        confusionBoostedCount = boostResult.boostedCount;
      }
    } catch (err: any) {
      // Non-fatal: confusion boost is an enhancement, not a requirement
      errors.push(`Phase 2.5 (confusion boost): ${err.message}`);
    }
  }

  // ── Phase 3: Insert into Reservoir ──

  let totalInserted = 0;
  const skipped = deficit - items.length;

  if (items.length > 0) {
    try {
      totalInserted = await bulkInsertReservoirItems(prisma, items);
    } catch (err: any) {
      errors.push(`Phase 3 (insert): ${err.message}`);
    }
  }

  return {
    reviewsQueued,
    poolQueued,
    generated: 0, // Phase 3 Gemini generation — future enhancement
    totalInserted,
    skipped,
    confusionBoostedCount,
    errors,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Find the best question for a given condition, preferring unseen variants.
 * Mirrors getLeastSeenQuestionForCondition from batchVariantService.
 */
async function findQuestionForCondition(
  prisma: PrismaClientLike,
  conditionId: string,
  userId: string,
  excludeIds: Set<string>,
  seenMap: Map<string, number>,
  scope: ParsedReservoirScope = { kind: 'adaptive' }
): Promise<any | null> {
  const conditionScope = await resolveReservoirConditionScope(prisma, conditionId);
  const conditionWhere = buildPregeneratedConditionWhere(conditionScope);
  // Check PreGeneratedQuestion first
  const preGenerated = await prisma.preGeneratedQuestion.findMany({
    where: {
      ...conditionWhere,
      ...(scope.kind === 'system' || scope.kind === 'subcategory' ? { system: scope.system } : {}),
      validationStatus: { in: ALLOWED_VALIDATION_STATUSES },
      flagCount: { lt: 3 },
    },
    select: {
      id: true,
      system: true,
      conditionId: true,
      medicalContentId: true,
      difficulty: true,
      questionOrder: true,
      taskCategory: true,
      flagCount: true,
      qualityScore: true,
      validationStatus: true,
    },
    take: 10,
  });

  const candidates = preGenerated.filter((q: any) => !excludeIds.has(q.id));

  if (candidates.length === 0) return null;

  // Pick least-seen
  candidates.sort((a, b) => {
    const aSeen = seenMap.get(a.id) || 0;
    const bSeen = seenMap.get(b.id) || 0;
    return aSeen - bSeen;
  });

  return candidates[0];
}

async function resolveReservoirConditionScope(
  prisma: PrismaClientLike,
  conditionId: string
): Promise<ResolvedReservoirConditionScope> {
  const fallback: ResolvedReservoirConditionScope = {
    progressConditionIds: [conditionId],
    questionConditionIds: [conditionId],
    medicalContentIds: [],
  };

  if (!prisma.medicalContent?.findMany) {
    return fallback;
  }

  try {
    const rows = await prisma.medicalContent.findMany({
      where: {
        OR: [
          { id: conditionId },
          { conditionId },
        ],
      },
      select: {
        id: true,
        conditionId: true,
      },
    });

    for (const row of rows ?? []) {
      if (row?.id) {
        fallback.progressConditionIds.push(row.id);
        fallback.medicalContentIds.push(row.id);
      }
      if (row?.conditionId) {
        fallback.questionConditionIds.push(row.conditionId);
      }
    }
  } catch {
    return uniqueConditionScope(fallback);
  }

  return uniqueConditionScope(fallback);
}

function buildPregeneratedConditionWhere(
  scope: ResolvedReservoirConditionScope
): Record<string, unknown> {
  const or: Array<Record<string, unknown>> = [];
  if (scope.questionConditionIds.length > 0) {
    or.push({ conditionId: { in: scope.questionConditionIds } });
  }
  if (scope.medicalContentIds.length > 0) {
    or.push({ medicalContentId: { in: scope.medicalContentIds } });
  }

  if (or.length === 0) return {};
  if (or.length === 1) return or[0]!;
  return { OR: or };
}

function uniqueConditionScope(
  scope: ResolvedReservoirConditionScope
): ResolvedReservoirConditionScope {
  return {
    progressConditionIds: [...new Set(scope.progressConditionIds.filter(Boolean))],
    questionConditionIds: [...new Set(scope.questionConditionIds.filter(Boolean))],
    medicalContentIds: [...new Set(scope.medicalContentIds.filter(Boolean))],
  };
}
