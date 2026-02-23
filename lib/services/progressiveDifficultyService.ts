/**
 * Adaptive Difficulty Engine
 *
 * This service implements the logic for dynamically adjusting question difficulty
 * based on user performance. It analyzes rolling accuracy and response times
 * to keep the user in their "Zone of Proximal Development".
 */

import { prisma } from '@/lib/prisma';
import type { User, Question } from '@prisma/client';

// ============================================================================
// Types
// ============================================================================

export type DifficultyLevel = 'easy' | 'medium' | 'hard';

export interface PerformanceMetrics {
  userId: string;
  rollingAccuracy: number; // 0-1
  averageResponseTime: number; // in milliseconds
  recentPerformance: {
    correct: number;
    total: number;
  };
}

// ============================================================================
// Constants
// ============================================================================

const ACCURACY_THRESHOLD_UP = 0.9; // 90% accuracy to increase difficulty
const ACCURACY_THRESHOLD_DOWN = 0.7; // 70% accuracy to decrease difficulty
const RESPONSE_TIME_THRESHOLD_FAST = 5000; // 5 seconds for fast response
const RESPONSE_TIME_THRESHOLD_SLOW = 20000; // 20 seconds for slow response

// ============================================================================
// Core Logic
// ============================================================================

/**
 * Determines the next appropriate difficulty level based on performance.
 * @param metrics - The user's current performance metrics.
 * @param currentDifficulty - The current difficulty level.
 * @returns The next recommended difficulty level.
 */
export function getNextDifficultyLevel(
  metrics: PerformanceMetrics,
  currentDifficulty: DifficultyLevel
): DifficultyLevel {
  const { rollingAccuracy, averageResponseTime } = metrics;

  if (rollingAccuracy > ACCURACY_THRESHOLD_UP) {
    if (averageResponseTime < RESPONSE_TIME_THRESHOLD_FAST) {
      return increaseDifficulty(currentDifficulty);
    }
  }

  if (rollingAccuracy < ACCURACY_THRESHOLD_DOWN) {
    return decreaseDifficulty(currentDifficulty);
  }

  // If accuracy is stable, adjust based on response time
  if (averageResponseTime > RESPONSE_TIME_THRESHOLD_SLOW) {
    return decreaseDifficulty(currentDifficulty);
  }
  if (averageResponseTime < RESPONSE_TIME_THRESHOLD_FAST) {
    return increaseDifficulty(currentDifficulty);
  }

  return currentDifficulty; // Maintain current difficulty
}

/**
 * Increases the difficulty level.
 */
function increaseDifficulty(current: DifficultyLevel): DifficultyLevel {
  if (current === 'easy') return 'medium';
  if (current === 'medium') return 'hard';
  return 'hard'; // Maxed out
}

/**
 * Decreases the difficulty level.
 */
function decreaseDifficulty(current: DifficultyLevel): DifficultyLevel {
  if (current === 'hard') return 'medium';
  if (current === 'medium') return 'easy';
  return 'easy'; // Min-ed out
}

/**
 * Fetches a question with the specified difficulty level.
 * @param userId - The user's ID to exclude recently seen questions.
 * @param difficulty - The desired difficulty level.
 * @returns A question or null if not found.
 */
export async function getQuestionByDifficulty(
  userId: string,
  difficulty: DifficultyLevel
): Promise<Question | null> {
  // Get IDs of questions the user has answered recently to avoid repeats
  const recentReviews = await prisma.reviewLog.findMany({
    where: { userId },
    orderBy: { reviewedAt: 'desc' },
    take: 100,
    select: { questionId: true },
  });
  const seenQuestionIds = recentReviews.map((r) => r.questionId);

  const question = await prisma.question.findFirst({
    where: {
      difficulty,
      id: {
        notIn: seenQuestionIds,
      },
    },
  });

  return question;
}

/**
 * Retrieves the user's current performance metrics.
 * @param userId - The user's ID.
 * @returns The user's performance metrics.
 */
export async function getPerformanceMetrics(userId: string): Promise<PerformanceMetrics> {
  const reviews = await prisma.reviewLog.findMany({
    where: { userId },
    orderBy: { reviewedAt: 'desc' },
    take: 50,
  });

  if (reviews.length === 0) {
    return {
      userId,
      rollingAccuracy: 0.8, // Start with a neutral accuracy
      averageResponseTime: 10000, // Start with a neutral time
      recentPerformance: { correct: 0, total: 0 },
    };
  }

  const correctCount = reviews.filter((r) => r.grade >= 3).length;
  const totalCount = reviews.length;
  const rollingAccuracy = totalCount > 0 ? correctCount / totalCount : 0;

  const totalResponseTime = reviews.reduce((sum, r) => sum + (r.durationMs || 0), 0);
  const averageResponseTime = totalCount > 0 ? totalResponseTime / totalCount : 0;

  return {
    userId,
    rollingAccuracy,
    averageResponseTime,
    recentPerformance: {
      correct: correctCount,
      total: totalCount,
    },
  };
}
