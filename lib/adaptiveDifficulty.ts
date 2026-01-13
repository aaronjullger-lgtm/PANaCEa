/**
 * Adaptive Difficulty Utility
 * 
 * Sprint B - Step 4: Determine question difficulty based on user performance
 * 
 * Uses:
 * - QuestionAttempt table for recent accuracy per system
 * - UserProgress.fsrsCard JSON for FSRS stability metric
 * 
 * Logic:
 * - Low skill (accuracy < 50% OR stability < 2): Serve "easy" questions
 * - High skill (accuracy > 80% AND stability > 10): Serve "hard" questions
 * - Medium skill: Serve "medium" questions
 */

import { PrismaClient } from '@prisma/client';

export type DifficultyLevel = 'easy' | 'medium' | 'hard';

interface UserPerformance {
  accuracy: number; // 0-100
  totalAttempts: number;
  avgStability: number; // From FSRS
  recommendedDifficulty: DifficultyLevel;
}

interface FSRSCard {
  stability: number;
  difficulty: number;
  state: number;
  due: string;
  [key: string]: any;
}

// Cache for user performance (2-minute TTL, shorter than deduplication)
interface PerformanceCache {
  data: UserPerformance;
  timestamp: number;
}

const performanceCache = new Map<string, PerformanceCache>();
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

/**
 * Get user's recent performance for a specific system
 * 
 * @param prisma - Prisma client instance
 * @param userId - User ID to check
 * @param system - System code (e.g., 'CV', 'PULM', 'GI')
 * @param lookbackDays - How many days to look back for attempts (default: 7)
 * @returns User performance metrics
 */
export async function getUserPerformanceBySystem(
  prisma: PrismaClient,
  userId: string,
  system: string,
  lookbackDays: number = 7
): Promise<UserPerformance> {
  // Check cache
  const cacheKey = `${userId}:${system}:${lookbackDays}`;
  const cached = performanceCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);

  try {
    // 1. Get recent question attempts for this system
    const attempts = await prisma.questionAttempt.findMany({
      where: {
        userId,
        system,
        createdAt: { gte: cutoffDate },
      },
      select: {
        wasCorrect: true,
        conditionId: true,
      },
    });

    const totalAttempts = attempts.length;
    const correctAttempts = attempts.filter(a => a.wasCorrect).length;
    const accuracy = totalAttempts > 0 ? (correctAttempts / totalAttempts) * 100 : 50; // Default to 50% if no data

    // 2. Get FSRS stability from UserProgress for conditions in this system
    const conditionIds = [...new Set(attempts.map(a => a.conditionId).filter(Boolean))];
    
    let avgStability = 5.0; // Default to medium stability if no data
    
    if (conditionIds.length > 0) {
      const progressRecords = await prisma.userProgress.findMany({
        where: {
          userId,
          conditionId: { in: conditionIds as string[] },
        },
        select: {
          fsrsCard: true,
        },
      });

      const stabilities = progressRecords
        .map(p => {
          try {
            const card = p.fsrsCard as FSRSCard;
            return card.stability || 5.0;
          } catch {
            return 5.0;
          }
        })
        .filter(s => s > 0);

      if (stabilities.length > 0) {
        avgStability = stabilities.reduce((sum, s) => sum + s, 0) / stabilities.length;
      }
    }

    // 3. Determine recommended difficulty
    const recommendedDifficulty = calculateRecommendedDifficulty(accuracy, avgStability, totalAttempts);

    const performance: UserPerformance = {
      accuracy,
      totalAttempts,
      avgStability,
      recommendedDifficulty,
    };

    // Cache result
    performanceCache.set(cacheKey, {
      data: performance,
      timestamp: Date.now(),
    });

    return performance;
  } catch (error) {
    console.error('[AdaptiveDifficulty] Failed to get user performance:', error);
    
    // Return safe defaults on error
    return {
      accuracy: 50,
      totalAttempts: 0,
      avgStability: 5.0,
      recommendedDifficulty: 'medium',
    };
  }
}

/**
 * Calculate recommended difficulty based on accuracy and FSRS stability
 * 
 * Rules:
 * - New learners (< 5 attempts): Start with "easy"
 * - Low skill (accuracy < 50% OR stability < 2): "easy"
 * - High skill (accuracy > 80% AND stability > 10): "hard"
 * - Medium skill: "medium"
 * 
 * @param accuracy - Percentage correct (0-100)
 * @param stability - FSRS stability metric
 * @param totalAttempts - Total number of attempts in lookback period
 * @returns Recommended difficulty level
 */
function calculateRecommendedDifficulty(
  accuracy: number,
  stability: number,
  totalAttempts: number
): DifficultyLevel {
  // New learners start with easy
  if (totalAttempts < 5) {
    return 'easy';
  }

  // Low skill indicators
  if (accuracy < 50 || stability < 2) {
    return 'easy';
  }

  // High skill indicators
  if (accuracy > 80 && stability > 10) {
    return 'hard';
  }

  // Default to medium
  return 'medium';
}

/**
 * Get recommended difficulty for multiple systems
 * Useful for session planning across multiple systems
 * 
 * @param prisma - Prisma client instance
 * @param userId - User ID to check
 * @param systems - Array of system codes
 * @param lookbackDays - How many days to look back
 * @returns Map of system -> recommended difficulty
 */
export async function getRecommendedDifficultiesBySystem(
  prisma: PrismaClient,
  userId: string,
  systems: string[],
  lookbackDays: number = 7
): Promise<Map<string, DifficultyLevel>> {
  const results = new Map<string, DifficultyLevel>();

  // Fetch all in parallel
  const promises = systems.map(async (system) => {
    const performance = await getUserPerformanceBySystem(prisma, userId, system, lookbackDays);
    return { system, difficulty: performance.recommendedDifficulty };
  });

  const systemResults = await Promise.all(promises);

  for (const { system, difficulty } of systemResults) {
    results.set(system, difficulty);
  }

  return results;
}

/**
 * Get overall user skill level (useful for UI display)
 * 
 * @param prisma - Prisma client instance
 * @param userId - User ID to check
 * @param lookbackDays - How many days to look back
 * @returns Overall skill assessment
 */
export async function getUserOverallSkillLevel(
  prisma: PrismaClient,
  userId: string,
  lookbackDays: number = 30
): Promise<{
  skillLevel: 'beginner' | 'intermediate' | 'advanced';
  overallAccuracy: number;
  avgStability: number;
  totalAttempts: number;
  recommendedDifficulty: DifficultyLevel;
}> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);

  try {
    // Get all recent attempts across all systems
    const attempts = await prisma.questionAttempt.findMany({
      where: {
        userId,
        createdAt: { gte: cutoffDate },
      },
      select: {
        wasCorrect: true,
        conditionId: true,
      },
    });

    const totalAttempts = attempts.length;
    const correctAttempts = attempts.filter(a => a.wasCorrect).length;
    const overallAccuracy = totalAttempts > 0 ? (correctAttempts / totalAttempts) * 100 : 50;

    // Get overall FSRS stability
    const conditionIds = [...new Set(attempts.map(a => a.conditionId).filter(Boolean))];
    
    let avgStability = 5.0;
    
    if (conditionIds.length > 0) {
      const progressRecords = await prisma.userProgress.findMany({
        where: {
          userId,
          conditionId: { in: conditionIds as string[] },
        },
        select: {
          fsrsCard: true,
        },
      });

      const stabilities = progressRecords
        .map(p => {
          try {
            const card = p.fsrsCard as FSRSCard;
            return card.stability || 5.0;
          } catch {
            return 5.0;
          }
        })
        .filter(s => s > 0);

      if (stabilities.length > 0) {
        avgStability = stabilities.reduce((sum, s) => sum + s, 0) / stabilities.length;
      }
    }

    // Determine skill level
    let skillLevel: 'beginner' | 'intermediate' | 'advanced';
    
    if (totalAttempts < 20) {
      skillLevel = 'beginner';
    } else if (overallAccuracy < 65 || avgStability < 5) {
      skillLevel = 'beginner';
    } else if (overallAccuracy >= 65 && overallAccuracy < 80) {
      skillLevel = 'intermediate';
    } else {
      skillLevel = 'advanced';
    }

    const recommendedDifficulty = calculateRecommendedDifficulty(overallAccuracy, avgStability, totalAttempts);

    return {
      skillLevel,
      overallAccuracy,
      avgStability,
      totalAttempts,
      recommendedDifficulty,
    };
  } catch (error) {
    console.error('[AdaptiveDifficulty] Failed to get overall skill level:', error);
    
    return {
      skillLevel: 'beginner',
      overallAccuracy: 50,
      avgStability: 5.0,
      totalAttempts: 0,
      recommendedDifficulty: 'medium',
    };
  }
}

/**
 * Clear the performance cache for a specific user
 * Call this after new question attempts are recorded
 * 
 * @param userId - User ID to clear cache for
 */
export function clearPerformanceCache(userId?: string): void {
  if (userId) {
    // Clear all entries for this user
    for (const key of performanceCache.keys()) {
      if (key.startsWith(`${userId}:`)) {
        performanceCache.delete(key);
      }
    }
  } else {
    // Clear entire cache
    performanceCache.clear();
  }
}

/**
 * Get cache statistics (useful for monitoring)
 */
export function getPerformanceCacheStats(): {
  size: number;
  entries: Array<{ key: string; age: number }>;
} {
  const now = Date.now();
  const entries = Array.from(performanceCache.entries()).map(([key, entry]) => ({
    key,
    age: Math.round((now - entry.timestamp) / 1000), // Age in seconds
  }));

  return {
    size: performanceCache.size,
    entries,
  };
}
