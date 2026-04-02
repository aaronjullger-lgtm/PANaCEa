/**
 * User Progress Service
 * Manages UserProgress records with FSRS card state and review history tracking.
 *
 * WASM Sync Conflict: Review logs are merged (append-only) via atomic DB append,
 * never overwritten, so multi-device (e.g. phone offline + laptop) does not lose data.
 */

import { Prisma } from '@prisma/client';
import type { FSRSCard, Rating, ReviewSnapshot } from '../fsrs';
import { createReviewSnapshot } from '../fsrs';

export interface UpdateUserProgressInput {
  userId: string;
  conditionId: string;
  fsrsCard: FSRSCard;
  rating: Rating;
  accuracy: number; // 0-1 float
  /** When set (e.g. EOR time-block), use this instead of deriving from fsrsCard.scheduled_days. Caller (e.g. drillReviewService) is responsible for EOR clamping via applyEorClampIfNeeded when in EOR context. */
  nextReviewAt?: Date;
}

/**
 * Update or create UserProgress with review history snapshot.
 * Uses atomic append for reviewHistory so concurrent updates (multi-device) merge
 * instead of last-write-wins overwriting.
 */
export async function updateUserProgressWithHistory(
  prisma: any,
  input: UpdateUserProgressInput
): Promise<void> {
  const { userId, conditionId, fsrsCard, rating, accuracy, nextReviewAt } = input;

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
            "lastReviewAt" = ${now},
            "nextReviewAt" = ${nextReviewDate},
            "updatedAt" = ${now}
          WHERE "userId" = ${userId} AND "conditionId" = ${conditionId}
        `
      );
      const updated = typeof result === 'number' ? result : Number(result);
      if (updated > 0) return;
    } catch (e) {
      // Fallback to read-modify-write if raw not supported or DB type differs
    }
  }

  // 2. No row updated: create or fallback read-modify-write
  const existing = await prisma.userProgress.findUnique({
    where: { userId_conditionId: { userId, conditionId } },
  });

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
      where: { userId_conditionId: { userId, conditionId } },
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
    if (error.code === 'P2003' || error.code === 'P2002') {
      // Log the error but don't throw - this allows the review to continue
      // even if UserProgress can't be created due to missing user/condition
      console.warn(
        `Failed to create/update UserProgress for user ${userId}, condition ${conditionId}:`,
        error.message
      );
      return;
    }
    // Re-throw other errors
    throw error;
  }
}

/**
 * Fetch review history for a user's condition
 * Returns snapshots for visualization
 *
 * @param prisma - Prisma client instance
 * @param userId - User ID
 * @param conditionId - Condition ID
 * @param days - Number of days to fetch (default 30)
 * @returns Array of review snapshots within the date range
 */
export async function getUserReviewHistory(
  prisma: any,
  userId: string,
  conditionId: string,
  days: number = 30
): Promise<ReviewSnapshot[]> {
  const progress = await prisma.userProgress.findUnique({
    where: {
      userId_conditionId: {
        userId,
        conditionId,
      },
    },
    select: {
      reviewHistory: true,
    },
  });

  if (!progress || !Array.isArray(progress.reviewHistory)) {
    return [];
  }

  // Filter by date range
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  return (progress.reviewHistory as ReviewSnapshot[])
    .filter((snapshot) => {
      const snapshotDate = new Date(snapshot.date);
      return snapshotDate >= cutoffDate;
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

/**
 * Get aggregated review history across all conditions for a user
 * Useful for dashboard visualization of overall stability growth
 *
 * @param prisma - Prisma client instance
 * @param userId - User ID
 * @param days - Number of days to fetch (default 30)
 * @returns Array of all review snapshots within the date range, sorted by date
 */
export async function getAllUserReviewHistory(
  prisma: any,
  userId: string,
  days: number = 30
): Promise<Array<ReviewSnapshot & { conditionId: string }>> {
  const allProgress = await prisma.userProgress.findMany({
    where: { userId },
    select: {
      conditionId: true,
      reviewHistory: true,
    },
  });

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const allSnapshots: Array<ReviewSnapshot & { conditionId: string }> = [];

  for (const progress of allProgress) {
    if (!Array.isArray(progress.reviewHistory)) continue;

    const snapshots = (progress.reviewHistory as ReviewSnapshot[])
      .filter((snapshot) => {
        const snapshotDate = new Date(snapshot.date);
        return snapshotDate >= cutoffDate;
      })
      .map((snapshot) => ({
        ...snapshot,
        conditionId: progress.conditionId,
      }));

    allSnapshots.push(...snapshots);
  }

  // Sort by date
  return allSnapshots.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

/**
 * Get aggregated mastery stats for a condition family
 */
export async function getConditionFamilyMastery(
  prisma: any,
  canonicalName: string,
  userId: string
) {
  // Get all conditions in family
  const family = await prisma.medicalContent.findMany({
    where: { canonicalName },
    select: { id: true, condition: true },
  });

  if (family.length === 0) {
    return null;
  }

  // Get UserProgress for all family members
  const progressRecords = await prisma.userProgress.findMany({
    where: {
      userId,
      conditionId: { in: family.map((c: any) => c.id) },
    },
  });

  // Calculate aggregate mastery
  const totalStability = progressRecords.reduce(
    (sum: number, p: any) => sum + (p.fsrsCard?.stability || 0),
    0
  );
  const avgStability = progressRecords.length > 0 ? totalStability / progressRecords.length : 0;

  // Determine overall mastery level
  let overallMastery = 'low'; // < 0.8
  if (avgStability > 10) overallMastery = 'high';
  else if (avgStability > 3) overallMastery = 'medium';

  return {
    canonicalName,
    familyMemberCount: family.length,
    progressRecordCount: progressRecords.length,
    avgStability,
    overallMastery, // 'high' | 'medium' | 'low'
    coveragePercentage: Math.round((progressRecords.length / family.length) * 100),
  };
}
