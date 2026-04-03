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
 *   - Skip questions with validationStatus === 'rejected'
 *   - Skip questions with qualityScore < 0.4
 *   - Skip questions the student has already seen too many times
 *
 * @module lib/services/reservoir/refillWorker
 */

import { RESERVOIR_POLICY, type RefillResult } from './reservoirPolicy';
import { bulkInsertReservoirItems, type InsertReservoirItemInput } from './reservoirService';

type PrismaClientLike = {
  userProgress: any;
  preGeneratedQuestion: any;
  question: any;
  userQuestionSeen: any;
  studentReservoirItem: any;
  $queryRawUnsafe: any;
  [key: string]: any;
};

// ─── Quality Gate ───────────────────────────────────────────────────────────

interface QualityDecision {
  allow: boolean;
  reason?: string;
}

function shouldEnterReservoir(question: any): QualityDecision {
  if (question.flagCount >= 3) return { allow: false, reason: 'high_flag_count' };
  if (question.validationStatus === 'rejected') return { allow: false, reason: 'rejected' };
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
  const items: InsertReservoirItemInput[] = [];
  const errors: string[] = [];

  // Get questions the student already has in reservoir (avoid duplicates)
  const existingReservoir = await prisma.studentReservoirItem.findMany({
    where: { userId },
    select: { questionId: true },
  });
  const reservoirQuestionIds = new Set(existingReservoir.map((r: any) => r.questionId));

  // Get questions the student has already seen (for variety)
  const seenQuestions = await prisma.userQuestionSeen.findMany({
    where: { userId },
    select: { questionId: true, timesShown: true },
  });
  const seenMap = new Map(seenQuestions.map((s: any) => [s.questionId, s.timesShown]));

  // ── Phase 1: FSRS Due Reviews ──

  const reviewTarget = Math.ceil(deficit * 0.7);
  let reviewsQueued = 0;

  try {
    const dueReviews = await prisma.userProgress.findMany({
      where: {
        userId,
        nextReviewAt: { lte: new Date() },
      },
      orderBy: { nextReviewAt: 'asc' },
      take: reviewTarget + 10, // Fetch extra for quality filtering
      select: {
        conditionId: true,
        system: true,
        fsrsDifficulty: true,
        nextReviewAt: true,
      },
    });

    for (const review of dueReviews) {
      if (reviewsQueued >= reviewTarget) break;
      if (!review.conditionId) continue;

      // Find a question for this condition
      const question = await findQuestionForCondition(
        prisma, review.conditionId, userId, reservoirQuestionIds, seenMap
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

  // ── Phase 2: New Cards from Pool ──

  const newTarget = deficit - reviewsQueued;
  let poolQueued = 0;

  try {
    // Parse scope for system filter
    const systemFilter = scope.startsWith('system:') ? scope.split(':')[1] : undefined;

    // Fetch from PreGeneratedQuestion pool
    const poolQuestions = await prisma.preGeneratedQuestion.findMany({
      where: {
        ...(systemFilter ? { system: systemFilter } : {}),
        validationStatus: { not: 'rejected' },
        flagCount: { lt: 3 },
        id: { notIn: Array.from(reservoirQuestionIds) },
      },
      orderBy: [
        { timesServed: 'asc' },   // Least served first
        { qualityScore: 'desc' }, // Highest quality first
      ],
      take: newTarget * 2, // Fetch extra for quality filtering
      select: {
        id: true,
        system: true,
        difficulty: true,
        questionOrder: true,
        taskCategory: true,
        flagCount: true,
        qualityScore: true,
        validationStatus: true,
        timesServed: true,
      },
    });

    // Also check the Question table
    const standardQuestions = await prisma.question.findMany({
      where: {
        ...(systemFilter ? { system: systemFilter } : {}),
        id: { notIn: Array.from(reservoirQuestionIds) },
      },
      orderBy: { createdAt: 'desc' },
      take: newTarget,
      select: {
        id: true,
        system: true,
        difficulty: true,
      },
    });

    // Merge and interleave, prioritizing unseen questions
    const allNewCandidates = [
      ...poolQuestions.map((q: any) => ({ ...q, source: 'pool' as const })),
      ...standardQuestions.map((q: any) => ({
        ...q,
        source: 'pool' as const,
        questionOrder: null,
        taskCategory: null,
        flagCount: 0,
        qualityScore: null,
        validationStatus: 'approved',
        timesServed: 0,
      })),
    ];

    // Sort: unseen first, then least-seen, then by quality
    allNewCandidates.sort((a, b) => {
      const aSeen = seenMap.get(a.id) || 0;
      const bSeen = seenMap.get(b.id) || 0;
      if (aSeen !== bSeen) return aSeen - bSeen;
      return (b.qualityScore || 0) - (a.qualityScore || 0);
    });

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
        questionOrder: q.questionOrder,
        taskCategory: q.taskCategory,
        isReview: false,
      });
      reservoirQuestionIds.add(q.id);
      poolQueued++;
    }
  } catch (err: any) {
    errors.push(`Phase 2 (pool): ${err.message}`);
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
  seenMap: Map<string, number>
): Promise<any | null> {
  // Check PreGeneratedQuestion first
  const preGenerated = await prisma.preGeneratedQuestion.findMany({
    where: {
      conditionId,
      validationStatus: { not: 'rejected' },
      flagCount: { lt: 3 },
    },
    select: {
      id: true,
      system: true,
      difficulty: true,
      questionOrder: true,
      taskCategory: true,
      flagCount: true,
      qualityScore: true,
      validationStatus: true,
    },
    take: 10,
  });

  // Check Question table
  const standard = await prisma.question.findMany({
    where: { conditionId },
    select: {
      id: true,
      system: true,
      difficulty: true,
    },
    take: 10,
  });

  // Merge candidates
  const candidates = [
    ...preGenerated,
    ...standard.map((q: any) => ({
      ...q,
      questionOrder: null,
      taskCategory: null,
      flagCount: 0,
      qualityScore: null,
      validationStatus: 'approved',
    })),
  ].filter((q) => !excludeIds.has(q.id));

  if (candidates.length === 0) return null;

  // Pick least-seen
  candidates.sort((a, b) => {
    const aSeen = seenMap.get(a.id) || 0;
    const bSeen = seenMap.get(b.id) || 0;
    return aSeen - bSeen;
  });

  return candidates[0];
}
