/**
 * User Progress Service
 * Manages UserProgress records with FSRS card state and review history tracking
 */

import type { FSRSCard, Rating, ReviewSnapshot } from '../fsrs';
import { createReviewSnapshot } from '../fsrs';

export interface UpdateUserProgressInput {
  userId: string;
  conditionId: string;
  fsrsCard: FSRSCard;
  rating: Rating;
  accuracy: number; // 0-1 float
}

/**
 * Update or create UserProgress with review history snapshot
 * Should be called after every FSRS review to track stability growth over time
 * 
 * @param prisma - Prisma client instance
 * @param input - Progress update data
 */
export async function updateUserProgressWithHistory(
  prisma: any,
  input: UpdateUserProgressInput
): Promise<void> {
  const { userId, conditionId, fsrsCard, rating, accuracy } = input;

  // Create review snapshot
  const snapshot: ReviewSnapshot = createReviewSnapshot(fsrsCard, rating);

  // Fetch existing progress
  const existing = await prisma.userProgress.findUnique({
    where: {
      userId_conditionId: {
        userId,
        conditionId,
      },
    },
  });

  // Prepare review history
  let reviewHistory: any[] = [];

  if (existing) {
    reviewHistory = Array.isArray(existing.reviewHistory) ? existing.reviewHistory : [];

    // Keep only last 365 days of history to prevent bloat
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 365);

    reviewHistory = reviewHistory.filter((entry: any) => {
      const entryDate = new Date(entry.date);
      return entryDate >= thirtyDaysAgo;
    });
  }

  // Add new snapshot
  reviewHistory.push(snapshot);

  // Calculate updated stats
  const totalAttempts = (existing?.totalAttempts || 0) + 1;
  const correctCount = (existing?.correctCount || 0) + (accuracy >= 0.7 ? 1 : 0); // Consider 70%+ as correct
  const newAccuracy = totalAttempts > 0 ? correctCount / totalAttempts : 0;

  // Upsert UserProgress
  await prisma.userProgress.upsert({
    where: {
      userId_conditionId: {
        userId,
        conditionId,
      },
    },
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
      lastReviewAt: new Date(),
      nextReviewAt: new Date(Date.now() + fsrsCard.scheduled_days * 24 * 60 * 60 * 1000),
      updatedAt: new Date(),
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
      lastReviewAt: new Date(),
      nextReviewAt: new Date(Date.now() + fsrsCard.scheduled_days * 24 * 60 * 60 * 1000),
    },
  });
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
    select: { id: true, condition: true }
  });

  if (family.length === 0) {
    return null;
  }

  // Get UserProgress for all family members
  const progressRecords = await prisma.userProgress.findMany({
    where: {
      userId,
      conditionId: { in: family.map((c: any) => c.id) }
    }
  });

  // Calculate aggregate mastery
  const totalStability = progressRecords.reduce((sum: number, p: any) => sum + (p.fsrsCard?.stability || 0), 0);
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
    coveragePercentage: Math.round((progressRecords.length / family.length) * 100)
  };
}
