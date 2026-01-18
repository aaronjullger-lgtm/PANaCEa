/**
 * Question Deduplication Utility
 *
 * Sprint B - Step 3: Prevent users from seeing duplicate questions
 *
 * Uses UserQuestionSeen table to track which questions each user has encountered.
 * Provides filtering and deduplication functions for question selection.
 */

import { PrismaClient } from '@prisma/client';

// In-memory cache for seen questions (5-minute TTL)
interface CacheEntry {
  questionIds: Set<string>;
  timestamp: number;
}

const seenQuestionsCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get list of question IDs the user has already seen
 *
 * @param prisma - Prisma client instance
 * @param userId - User ID to check
 * @param options - Optional filters
 * @returns Set of question IDs the user has seen
 */
export async function getUserSeenQuestionIds(
  prisma: PrismaClient,
  userId: string,
  options?: {
    questionType?: string; // Filter by question type
    since?: Date; // Only questions seen after this date
  }
): Promise<Set<string>> {
  // Check cache first
  const cacheKey = `${userId}:${options?.questionType || 'all'}:${options?.since?.toISOString() || 'all'}`;
  const cached = seenQuestionsCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return new Set(cached.questionIds);
  }

  // Build where clause
  const where: any = { userId };

  if (options?.questionType) {
    where.questionType = options.questionType;
  }

  if (options?.since) {
    where.lastSeenAt = {
      gte: options.since,
    };
  }

  try {
    const seenRecords = await prisma.userQuestionSeen.findMany({
      where,
      select: { questionId: true },
    });

    const questionIds = new Set(seenRecords.map((r) => r.questionId));

    // Update cache
    seenQuestionsCache.set(cacheKey, {
      questionIds,
      timestamp: Date.now(),
    });

    return questionIds;
  } catch (error) {
    console.error('[Deduplication] Failed to get seen question IDs:', error);
    return new Set();
  }
}

/**
 * Filter out questions the user has already seen
 *
 * @param prisma - Prisma client instance
 * @param userId - User ID to check
 * @param questionIds - Array of question IDs to filter
 * @param questionType - Type of questions being filtered
 * @returns Filtered array containing only unseen question IDs
 */
export async function filterUnseenQuestions(
  prisma: PrismaClient,
  userId: string,
  questionIds: string[],
  questionType: string = 'pre_generated'
): Promise<string[]> {
  if (questionIds.length === 0) {
    return [];
  }

  const seenIds = await getUserSeenQuestionIds(prisma, userId, { questionType });

  return questionIds.filter((id) => !seenIds.has(id));
}

/**
 * Get count of how many questions from a pool the user has seen
 *
 * @param prisma - Prisma client instance
 * @param userId - User ID to check
 * @param poolQuestionIds - Array of question IDs in the pool
 * @param questionType - Type of questions
 * @returns Object with seen count, unseen count, and percentage explored
 */
export async function getPoolExplorationStats(
  prisma: PrismaClient,
  userId: string,
  poolQuestionIds: string[],
  questionType: string = 'pre_generated'
): Promise<{
  total: number;
  seen: number;
  unseen: number;
  percentExplored: number;
}> {
  if (poolQuestionIds.length === 0) {
    return { total: 0, seen: 0, unseen: 0, percentExplored: 0 };
  }

  const seenIds = await getUserSeenQuestionIds(prisma, userId, { questionType });

  const seenCount = poolQuestionIds.filter((id) => seenIds.has(id)).length;
  const unseenCount = poolQuestionIds.length - seenCount;
  const percentExplored = Math.round((seenCount / poolQuestionIds.length) * 100);

  return {
    total: poolQuestionIds.length,
    seen: seenCount,
    unseen: unseenCount,
    percentExplored,
  };
}

/**
 * Check if specific questions have been seen by the user
 *
 * @param prisma - Prisma client instance
 * @param userId - User ID to check
 * @param questionIds - Array of question IDs to check
 * @param questionType - Type of questions
 * @returns Map of questionId -> boolean (true if seen)
 */
export async function checkQuestionsSeenStatus(
  prisma: PrismaClient,
  userId: string,
  questionIds: string[],
  questionType: string = 'pre_generated'
): Promise<Map<string, boolean>> {
  const statusMap = new Map<string, boolean>();

  if (questionIds.length === 0) {
    return statusMap;
  }

  const seenIds = await getUserSeenQuestionIds(prisma, userId, { questionType });

  for (const id of questionIds) {
    statusMap.set(id, seenIds.has(id));
  }

  return statusMap;
}

/**
 * Get detailed information about when questions were seen
 *
 * @param prisma - Prisma client instance
 * @param userId - User ID to check
 * @param questionIds - Array of question IDs to get details for
 * @param questionType - Type of questions
 * @returns Array of seen question details
 */
export async function getSeenQuestionDetails(
  prisma: PrismaClient,
  userId: string,
  questionIds: string[],
  questionType: string = 'pre_generated'
): Promise<
  Array<{
    questionId: string;
    firstSeenAt: Date;
    lastSeenAt: Date;
    timesShown: number;
    timesCorrect: number;
    timesIncorrect: number;
    avgTimeMs: number | null;
    correctOnFirst: boolean | null;
  }>
> {
  if (questionIds.length === 0) {
    return [];
  }

  try {
    const records = await prisma.userQuestionSeen.findMany({
      where: {
        userId,
        questionId: { in: questionIds },
        questionType,
      },
      select: {
        questionId: true,
        firstSeenAt: true,
        lastSeenAt: true,
        timesShown: true,
        timesCorrect: true,
        timesIncorrect: true,
        avgTimeMs: true,
        correctOnFirst: true,
      },
    });

    return records;
  } catch (error) {
    console.error('[Deduplication] Failed to get seen question details:', error);
    return [];
  }
}

/**
 * Clear the seen questions cache for a specific user
 * Call this after recording new question views
 *
 * @param userId - User ID to clear cache for
 */
export function clearSeenQuestionsCache(userId?: string): void {
  if (userId) {
    // Clear all entries for this user
    for (const key of seenQuestionsCache.keys()) {
      if (key.startsWith(`${userId}:`)) {
        seenQuestionsCache.delete(key);
      }
    }
  } else {
    // Clear entire cache
    seenQuestionsCache.clear();
  }
}

/**
 * Get cache statistics (useful for monitoring)
 */
export function getCacheStats(): {
  size: number;
  entries: Array<{ key: string; age: number }>;
} {
  const now = Date.now();
  const entries = Array.from(seenQuestionsCache.entries()).map(([key, entry]) => ({
    key,
    age: Math.round((now - entry.timestamp) / 1000), // Age in seconds
  }));

  return {
    size: seenQuestionsCache.size,
    entries,
  };
}
