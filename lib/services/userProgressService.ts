/**
 * User Progress Service
 * Manages UserProgress records with FSRS card state and review history tracking.
 *
 * WASM Sync Conflict: Review logs are merged (append-only) via atomic DB append,
 * never overwritten, so multi-device (e.g. phone offline + laptop) does not lose data.
 *
 * progressContext partitions FSRS state:
 *   READINESS — MAIN/DRILL sessions (longitudinal PANCE readiness signal)
 *   TARGETED  — Focused study sessions (local weakness tracking, does not pollute readiness)
 */

import { Prisma } from '@prisma/client';
import type { FSRSCard, Rating, ReviewSnapshot } from '../fsrs';
import { createReviewSnapshot } from '../fsrs';
import { logger } from '../logger';

const LOG_SCOPE = 'UserProgress';

export type UserProgressConditionDomain =
  | 'medical_content'
  | 'condition_only'
  | 'missing'
  | 'unknown';

export class UserProgressConditionDomainError extends Error {
  readonly code = 'USER_PROGRESS_CONDITION_DOMAIN_MISMATCH';

  constructor(
    message: string,
    readonly details: {
      userId: string;
      conditionId: string;
      progressContext: 'READINESS' | 'TARGETED';
      domain: UserProgressConditionDomain;
      causeCode?: string;
    }
  ) {
    super(message);
    this.name = 'UserProgressConditionDomainError';
  }
}

export interface UpdateUserProgressInput {
  userId: string;
  conditionId: string;
  /** Partitions FSRS state: 'READINESS' (default) or 'TARGETED'. */
  progressContext?: 'READINESS' | 'TARGETED';
  fsrsCard: FSRSCard;
  rating: Rating;
  accuracy: number; // 0-1 float
  /** When set (e.g. EOR time-block), use this instead of deriving from fsrsCard.scheduled_days. Caller (e.g. drillReviewService) is responsible for EOR clamping via applyEorClampIfNeeded when in EOR context. */
  nextReviewAt?: Date;
}

type ProgressDomainPrismaLike = {
  medicalContent?: {
    findUnique?: (args: { where: { id: string }; select: { id: true } }) => Promise<{ id: string } | null>;
    findFirst?: (args: { where: { id: string }; select: { id: true } }) => Promise<{ id: string } | null>;
  };
  condition?: {
    findUnique?: (args: { where: { id: string }; select: { id: true } }) => Promise<{ id: string } | null>;
  };
};

export async function resolveUserProgressConditionDomain(
  prisma: ProgressDomainPrismaLike,
  conditionId: string
): Promise<UserProgressConditionDomain> {
  const medicalContent = prisma.medicalContent;
  if (!medicalContent?.findUnique && !medicalContent?.findFirst) {
    return 'unknown';
  }

  const medicalContentRow = medicalContent.findUnique
    ? await medicalContent.findUnique({ where: { id: conditionId }, select: { id: true } })
    : await medicalContent.findFirst!({ where: { id: conditionId }, select: { id: true } });
  if (medicalContentRow) return 'medical_content';

  if (prisma.condition?.findUnique) {
    const conditionRow = await prisma.condition.findUnique({
      where: { id: conditionId },
      select: { id: true },
    });
    if (conditionRow) return 'condition_only';
  }

  return 'missing';
}

async function assertUserProgressConditionDomain(
  prisma: ProgressDomainPrismaLike,
  input: Pick<UpdateUserProgressInput, 'userId' | 'conditionId'> & {
    progressContext: 'READINESS' | 'TARGETED';
  }
): Promise<void> {
  const domain = await resolveUserProgressConditionDomain(prisma, input.conditionId);
  if (domain === 'medical_content' || domain === 'unknown') return;

  throw new UserProgressConditionDomainError(
    `UserProgress.conditionId must reference MedicalContent.id before FSRS progress can be created; received ${domain} id "${input.conditionId}".`,
    {
      userId: input.userId,
      conditionId: input.conditionId,
      progressContext: input.progressContext,
      domain,
    }
  );
}

/**
 * Update or create UserProgress with review history snapshot.
 * Uses atomic append for reviewHistory so concurrent updates (multi-device) merge
 * instead of last-write-wins overwriting.
 *
 * progressContext determines which partition of FSRS state to write:
 *   - 'READINESS' (default): MAIN/DRILL sessions — the longitudinal readiness signal
 *   - 'TARGETED': Focused study sessions — isolated weakness tracking
 */
export async function updateUserProgressWithHistory(
  prisma: any,
  input: UpdateUserProgressInput
): Promise<void> {
  const { userId, conditionId, fsrsCard, rating, accuracy, nextReviewAt } = input;
  const progressContext = input.progressContext ?? 'READINESS';

  const snapshot: ReviewSnapshot = createReviewSnapshot(fsrsCard, rating);
  const snapshotJson = JSON.stringify(snapshot);

  const now = new Date();
  const derivedNext = new Date(now.getTime() + fsrsCard.scheduled_days * 24 * 60 * 60 * 1000);
  const nextReviewDate = nextReviewAt ?? derivedNext;

  // 1. Atomic append to existing row (merge review logs; never overwrite whole array)
  const executeRaw =
    typeof prisma.$executeRaw === 'function' ? prisma.$executeRaw.bind(prisma) : null;

  if (executeRaw) {
    try {
      // Single atomic UPDATE: append reviewHistory, increment counters, set FSRS card
      // Avoids read-between-writes race condition on totalAttempts/correctCount
      const correctIncrement = accuracy >= 0.7 ? 1 : 0;
      const fsrsCardJson = JSON.stringify({
        stability: fsrsCard.stability,
        difficulty: fsrsCard.difficulty,
        state: fsrsCard.state,
        elapsed_days: fsrsCard.elapsed_days,
        scheduled_days: fsrsCard.scheduled_days,
        reps: fsrsCard.reps,
        lapses: fsrsCard.lapses,
        last_review: fsrsCard.last_review.toISOString(),
      });

      const result = await executeRaw(
        Prisma.sql`
          UPDATE "UserProgress"
          SET
            "reviewHistory" = array_append("reviewHistory", (${snapshotJson})::jsonb),
            "totalAttempts" = "totalAttempts" + 1,
            "correctCount" = "correctCount" + ${correctIncrement},
            "accuracy" = CASE
              WHEN "totalAttempts" + 1 > 0
              THEN ("correctCount" + ${correctIncrement})::float / ("totalAttempts" + 1)::float
              ELSE 0
            END,
            "fsrsCard" = (${fsrsCardJson})::jsonb,
            "fsrsStability" = ${fsrsCard.stability},
            "fsrsDifficulty" = ${fsrsCard.difficulty},
            "fsrsState" = ${fsrsCard.state},
            "fsrsReps" = ${fsrsCard.reps},
            "lastReviewAt" = ${now},
            "nextReviewAt" = ${nextReviewDate},
            "updatedAt" = ${now}
          WHERE "userId" = ${userId} AND "conditionId" = ${conditionId} AND "progressContext" = ${progressContext}::"ProgressContext"
        `
      );
      const updated = typeof result === 'number' ? result : Number(result);
      if (updated > 0) return;
    } catch (e) {
      // Fallback to read-modify-write if raw not supported or DB type differs
      console.error('[UserProgress] Raw update failed, falling back to read-modify-write', e);
    }
  }

  // 2. No row updated: create or fallback read-modify-write
  const existing = await prisma.userProgress.findUnique({
    where: { userId_conditionId_progressContext: { userId, conditionId, progressContext } },
  });

  if (!existing) {
    await assertUserProgressConditionDomain(prisma, { userId, conditionId, progressContext });
  }

  let reviewHistory: any[] =
    existing && Array.isArray(existing.reviewHistory) ? [...existing.reviewHistory] : [];
  const oneYearAgo = new Date();
  oneYearAgo.setDate(oneYearAgo.getDate() - 365);
  reviewHistory = reviewHistory.filter((entry: any) => new Date(entry.date) >= oneYearAgo);
  reviewHistory.push(snapshot);

  const totalAttempts = (existing?.totalAttempts ?? 0) + 1;
  const correctCount = (existing?.correctCount ?? 0) + (accuracy >= 0.7 ? 1 : 0);
  const newAccuracy = totalAttempts > 0 ? correctCount / totalAttempts : 0;

  try {
    await prisma.userProgress.upsert({
      where: { userId_conditionId_progressContext: { userId, conditionId, progressContext } },
      update: {
        fsrsCard: {
          stability: fsrsCard.stability,
          difficulty: fsrsCard.difficulty,
          state: fsrsCard.state,
          elapsed_days: fsrsCard.elapsed_days,
          scheduled_days: fsrsCard.scheduled_days,
          reps: fsrsCard.reps,
          lapses: fsrsCard.lapses,
          last_review: fsrsCard.last_review.toISOString(),
        },
        // Dual-write scalar FSRS fields so readers using these columns
        // stay in sync with the authoritative fsrsCard JSON.
        fsrsStability: fsrsCard.stability,
        fsrsDifficulty: fsrsCard.difficulty,
        fsrsState: fsrsCard.state,
        fsrsReps: fsrsCard.reps,
        reviewHistory,
        totalAttempts,
        correctCount,
        accuracy: newAccuracy,
        lastReviewAt: now,
        nextReviewAt: nextReviewDate,
        updatedAt: now,
      },
      create: {
        id: crypto.randomUUID(),
        userId,
        conditionId,
        progressContext,
        fsrsCard: {
          stability: fsrsCard.stability,
          difficulty: fsrsCard.difficulty,
          state: fsrsCard.state,
          elapsed_days: fsrsCard.elapsed_days,
          scheduled_days: fsrsCard.scheduled_days,
          reps: fsrsCard.reps,
          lapses: fsrsCard.lapses,
          last_review: fsrsCard.last_review.toISOString(),
        },
        // Dual-write scalar FSRS fields for readers that query these directly.
        fsrsStability: fsrsCard.stability,
        fsrsDifficulty: fsrsCard.difficulty,
        fsrsState: fsrsCard.state,
        fsrsReps: fsrsCard.reps,
        reviewHistory,
        totalAttempts,
        correctCount,
        accuracy: newAccuracy,
        lastReviewAt: now,
        nextReviewAt: nextReviewDate,
        createdAt: now,
        updatedAt: now,
      },
    });
  } catch (error: any) {
    // Check if it's a foreign key constraint error
    if (error.code === 'P2003') {
      throw new UserProgressConditionDomainError(
        `UserProgress.conditionId failed the MedicalContent FK; received "${conditionId}".`,
        {
          userId,
          conditionId,
          progressContext,
          domain: 'missing',
          causeCode: error.code,
        }
      );
    }
    if (error.code === 'P2002') {
      logger.warn(`[${LOG_SCOPE}] Concurrent UserProgress write lost unique race`, {
        userId,
        conditionId,
        progressContext,
        errorCode: error.code,
        message: error.message,
      });
      return;
    }
    // Re-throw other errors
    throw error;
  }
}
