/**
 * FSRS Question Linking Utility
 * 
 * Sprint C - Step 6: Link questions to FSRS cards for better tracking
 * 
 * Purpose: Enable question-specific FSRS scheduling by tracking which
 * questions update which FSRS cards. This allows:
 * - Question-specific review scheduling
 * - Understanding which questions contributed to card stability
 * - Better analytics on question effectiveness
 * 
 * Implementation: Extends UserProgress.reviewHistory JSON to include
 * questionId for each review event.
 */

import { PrismaClient } from '@prisma/client';

export interface FSRSReviewEvent {
  questionId: string;
  timestamp: string;
  rating: number; // 1-4 (again, hard, good, easy)
  state: number; // 0=new, 1=learning, 2=review, 3=relearning
  stability: number;
  difficulty: number;
  wasCorrect: boolean;
  timeSpentMs?: number;
}

export interface EnhancedFSRSCard {
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  state: number;
  due: string;
  lastReview?: string;
  // NEW: Question tracking
  lastQuestionId?: string;
  questionHistory?: string[]; // Recent 10 question IDs
  totalQuestionsAnswered?: number;
}

/**
 * Record a question attempt with FSRS update
 * 
 * @param prisma - Prisma client instance
 * @param userId - User ID
 * @param conditionId - Condition being studied
 * @param questionId - Question that was answered
 * @param wasCorrect - Whether answer was correct
 * @param timeSpentMs - Time spent on question
 * @param fsrsRating - FSRS rating (1=again, 2=hard, 3=good, 4=easy)
 * @returns Updated UserProgress record
 */
export async function recordQuestionWithFSRS(
  prisma: PrismaClient,
  userId: string,
  conditionId: string,
  questionId: string,
  wasCorrect: boolean,
  timeSpentMs?: number,
  fsrsRating?: number
): Promise<void> {
  try {
    // Get current progress
    const progress = await prisma.userProgress.findUnique({
      where: {
        userId_conditionId: {
          userId,
          conditionId,
        },
      },
    });

    if (!progress) {
      console.warn('[FSRSLinking] No progress found for user/condition:', userId, conditionId);
      return;
    }

    // Parse current FSRS card
    const fsrsCard = progress.fsrsCard as unknown as EnhancedFSRSCard;
    
    // Update question tracking
    const questionHistory = (fsrsCard.questionHistory || []).slice(-9); // Keep last 9
    questionHistory.push(questionId); // Add current (now 10 total)
    
    const totalQuestionsAnswered = (fsrsCard.totalQuestionsAnswered || 0) + 1;

    // Create review event
    const reviewEvent: FSRSReviewEvent = {
      questionId,
      timestamp: new Date().toISOString(),
      rating: fsrsRating || (wasCorrect ? 3 : 1), // Default: good if correct, again if wrong
      state: fsrsCard.state,
      stability: fsrsCard.stability,
      difficulty: fsrsCard.difficulty,
      wasCorrect,
      timeSpentMs,
    };

    // Append to reviewHistory
    const reviewHistory = progress.reviewHistory as any[];
    reviewHistory.push(reviewEvent);

    // Update FSRS card with question tracking
    const updatedCard: EnhancedFSRSCard = {
      ...fsrsCard,
      lastQuestionId: questionId,
      questionHistory,
      totalQuestionsAnswered,
    };

    // Update database
    await prisma.userProgress.update({
      where: {
        userId_conditionId: {
          userId,
          conditionId,
        },
      },
      data: {
        fsrsCard: updatedCard as any,
        reviewHistory: reviewHistory as any,
        totalAttempts: { increment: 1 },
        correctCount: wasCorrect ? { increment: 1 } : undefined,
        accuracy: totalQuestionsAnswered > 0 
          ? ((progress.correctCount + (wasCorrect ? 1 : 0)) / totalQuestionsAnswered) * 100
          : 0,
        lastReviewAt: new Date(),
        updatedAt: new Date(),
      },
    });

  } catch (error) {
    console.error('[FSRSLinking] Failed to record question with FSRS:', error);
    throw error;
  }
}

/**
 * Get question history for a condition
 * 
 * @param prisma - Prisma client instance
 * @param userId - User ID
 * @param conditionId - Condition ID
 * @returns Array of question IDs answered for this condition
 */
export async function getQuestionHistoryForCondition(
  prisma: PrismaClient,
  userId: string,
  conditionId: string
): Promise<string[]> {
  try {
    const progress = await prisma.userProgress.findUnique({
      where: {
        userId_conditionId: {
          userId,
          conditionId,
        },
      },
      select: {
        fsrsCard: true,
      },
    });

    if (!progress) {
      return [];
    }

    const fsrsCard = progress.fsrsCard as unknown as EnhancedFSRSCard;
    return fsrsCard.questionHistory || [];

  } catch (error) {
    console.error('[FSRSLinking] Failed to get question history:', error);
    return [];
  }
}

/**
 * Get detailed review history including questions
 * 
 * @param prisma - Prisma client instance
 * @param userId - User ID
 * @param conditionId - Condition ID
 * @returns Array of review events with question IDs
 */
export async function getDetailedReviewHistory(
  prisma: PrismaClient,
  userId: string,
  conditionId: string
): Promise<FSRSReviewEvent[]> {
  try {
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

    if (!progress) {
      return [];
    }

    return progress.reviewHistory as unknown as FSRSReviewEvent[];

  } catch (error) {
    console.error('[FSRSLinking] Failed to get review history:', error);
    return [];
  }
}

/**
 * Get statistics about question usage per condition
 * 
 * @param prisma - Prisma client instance
 * @param userId - User ID
 * @param conditionId - Condition ID
 * @returns Question usage statistics
 */
export async function getQuestionUsageStats(
  prisma: PrismaClient,
  userId: string,
  conditionId: string
): Promise<{
  totalQuestionsAnswered: number;
  uniqueQuestions: number;
  lastQuestionId: string | null;
  averagePerformance: number;
  recentQuestions: string[];
}> {
  try {
    const progress = await prisma.userProgress.findUnique({
      where: {
        userId_conditionId: {
          userId,
          conditionId,
        },
      },
      select: {
        fsrsCard: true,
        reviewHistory: true,
        accuracy: true,
      },
    });

    if (!progress) {
      return {
        totalQuestionsAnswered: 0,
        uniqueQuestions: 0,
        lastQuestionId: null,
        averagePerformance: 0,
        recentQuestions: [],
      };
    }

    const fsrsCard = progress.fsrsCard as unknown as EnhancedFSRSCard;
    const reviewHistory = progress.reviewHistory as unknown as FSRSReviewEvent[];

    const questionHistory = fsrsCard.questionHistory || [];
    const uniqueQuestions = new Set(questionHistory).size;

    return {
      totalQuestionsAnswered: fsrsCard.totalQuestionsAnswered || 0,
      uniqueQuestions,
      lastQuestionId: fsrsCard.lastQuestionId || null,
      averagePerformance: progress.accuracy,
      recentQuestions: questionHistory.slice(-10),
    };

  } catch (error) {
    console.error('[FSRSLinking] Failed to get question usage stats:', error);
    return {
      totalQuestionsAnswered: 0,
      uniqueQuestions: 0,
      lastQuestionId: null,
      averagePerformance: 0,
      recentQuestions: [],
    };
  }
}

/**
 * Find conditions that need more question variety
 * (same questions being repeated too often)
 * 
 * @param prisma - Prisma client instance
 * @param userId - User ID
 * @param minRepetitionRate - Threshold for flagging (default: 0.5 = 50% repetition)
 * @returns Array of conditions with high repetition rates
 */
export async function findHighRepetitionConditions(
  prisma: PrismaClient,
  userId: string,
  minRepetitionRate: number = 0.5
): Promise<Array<{
  conditionId: string;
  totalQuestions: number;
  uniqueQuestions: number;
  repetitionRate: number;
}>> {
  try {
    const allProgress = await prisma.userProgress.findMany({
      where: { userId },
      select: {
        conditionId: true,
        fsrsCard: true,
      },
    });

    const highRepetition: Array<{
      conditionId: string;
      totalQuestions: number;
      uniqueQuestions: number;
      repetitionRate: number;
    }> = [];

    for (const progress of allProgress) {
      const fsrsCard = progress.fsrsCard as unknown as EnhancedFSRSCard;
      const totalQuestions = fsrsCard.totalQuestionsAnswered || 0;
      const questionHistory = fsrsCard.questionHistory || [];
      const uniqueQuestions = new Set(questionHistory).size;

      if (totalQuestions > 5) { // Only consider conditions with enough attempts
        const repetitionRate = 1 - (uniqueQuestions / totalQuestions);
        
        if (repetitionRate >= minRepetitionRate) {
          highRepetition.push({
            conditionId: progress.conditionId,
            totalQuestions,
            uniqueQuestions,
            repetitionRate: Math.round(repetitionRate * 100) / 100,
          });
        }
      }
    }

    return highRepetition.sort((a, b) => b.repetitionRate - a.repetitionRate);

  } catch (error) {
    console.error('[FSRSLinking] Failed to find high repetition conditions:', error);
    return [];
  }
}
