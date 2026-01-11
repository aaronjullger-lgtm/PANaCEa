/**
 * No-Repeat Question Tracking Module
 * 
 * Uses UserQuestionSeen table for comprehensive question tracking
 * with performance metrics and timing data.
 */

interface QuestionFilter {
  system?: string;
  systems?: string[];
  conditionId?: string;
  questionType?: string;
}

/**
 * Record that a user has seen a question with full metrics
 */
export async function recordQuestionSeen(
  prisma: any,
  userId: string,
  questionId: string,
  metadata: {
    questionType: string;
    wasCorrect?: boolean;
    timeMs?: number;
  }
) {
  const now = new Date();
  
  try {
    // Upsert to UserQuestionSeen table
    const existing = await prisma.userQuestionSeen.findUnique({
      where: {
        userId_questionId_questionType: {
          userId,
          questionId,
          questionType: metadata.questionType,
        },
      },
    });

    if (existing) {
      // Update existing record
      const updateData: any = {
        timesShown: { increment: 1 },
        lastSeenAt: now,
      };

      // Update performance metrics if we have answer data
      if (metadata.wasCorrect !== undefined) {
        if (metadata.wasCorrect) {
          updateData.timesCorrect = { increment: 1 };
        } else {
          updateData.timesIncorrect = { increment: 1 };
        }
      }

      // Update rolling average time
      if (metadata.timeMs !== undefined && metadata.timeMs > 0) {
        // Calculate new rolling average
        const currentAvg = existing.avgTimeMs || 0;
        const currentCount = existing.timesShown || 1;
        const newAvg = Math.round(
          (currentAvg * currentCount + metadata.timeMs) / (currentCount + 1)
        );
        updateData.avgTimeMs = newAvg;
      }

      await prisma.userQuestionSeen.update({
        where: {
          userId_questionId_questionType: {
            userId,
            questionId,
            questionType: metadata.questionType,
          },
        },
        data: updateData,
      });
    } else {
      // Create new record
      await prisma.userQuestionSeen.create({
        data: {
          userId,
          questionId,
          questionType: metadata.questionType,
          firstSeenAt: now,
          lastSeenAt: now,
          timesShown: 1,
          timesCorrect: metadata.wasCorrect === true ? 1 : 0,
          timesIncorrect: metadata.wasCorrect === false ? 1 : 0,
          avgTimeMs: metadata.timeMs || null,
        },
      });
    }
  } catch (e) {
    console.error('[NoRepeat] Failed to record question seen:', e);
  }
}

/**
 * Update performance metrics for a question attempt
 * Call this when user answers a question (after initial recordQuestionSeen)
 */
export async function updateQuestionPerformance(
  prisma: any,
  userId: string,
  questionId: string,
  questionType: string,
  wasCorrect: boolean,
  timeMs?: number
) {
  try {
    const updateData: any = {};
    
    if (wasCorrect) {
      updateData.timesCorrect = { increment: 1 };
    } else {
      updateData.timesIncorrect = { increment: 1 };
    }

    // Get existing record to calculate new average time
    if (timeMs && timeMs > 0) {
      const existing = await prisma.userQuestionSeen.findUnique({
        where: {
          userId_questionId_questionType: {
            userId,
            questionId,
            questionType,
          },
        },
        select: { avgTimeMs: true, timesShown: true },
      });

      if (existing) {
        const currentAvg = existing.avgTimeMs || timeMs;
        const currentCount = existing.timesShown || 1;
        updateData.avgTimeMs = Math.round(
          (currentAvg * (currentCount - 1) + timeMs) / currentCount
        );
      } else {
        updateData.avgTimeMs = timeMs;
      }
    }

    await prisma.userQuestionSeen.update({
      where: {
        userId_questionId_questionType: {
          userId,
          questionId,
          questionType,
        },
      },
      data: updateData,
    });
  } catch (e) {
    console.error('[NoRepeat] Failed to update question performance:', e);
  }
}

/**
 * Get list of question IDs the user has already seen
 */
export async function getUserSeenQuestions(
  prisma: any, 
  userId: string, 
  filter?: QuestionFilter
): Promise<string[]> {
  const where: any = { userId };

  if (filter?.questionType) {
    where.questionType = filter.questionType;
  }
  
  try {
    const seen = await prisma.userQuestionSeen.findMany({
      where,
      select: { questionId: true },
    });
    return seen.map((s: any) => s.questionId);
  } catch (e) {
    console.error('[NoRepeat] Failed to get seen questions:', e);
    return [];
  }
}

/**
 * Get detailed seen question records with performance data
 */
export async function getUserSeenQuestionsDetailed(
  prisma: any,
  userId: string,
  filter?: QuestionFilter
): Promise<Array<{
  questionId: string;
  questionType: string;
  timesShown: number;
  timesCorrect: number;
  timesIncorrect: number;
  avgTimeMs: number | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
}>> {
  const where: any = { userId };

  if (filter?.questionType) {
    where.questionType = filter.questionType;
  }
  
  try {
    return await prisma.userQuestionSeen.findMany({
      where,
      select: {
        questionId: true,
        questionType: true,
        timesShown: true,
        timesCorrect: true,
        timesIncorrect: true,
        avgTimeMs: true,
        firstSeenAt: true,
        lastSeenAt: true,
      },
    });
  } catch (e) {
    console.error('[NoRepeat] Failed to get detailed seen questions:', e);
    return [];
  }
}

/**
 * Fetch unseen questions for a user from PreGeneratedQuestion pool
 */
export async function fetchUnseenQuestions(
  prisma: any,
  userId: string,
  filter: QuestionFilter,
  limit: number = 10
) {
  // Get questions user has already seen
  const seenQuestionIds = await getUserSeenQuestions(prisma, userId, {
    questionType: 'pre_generated',
  });

  // Build query for pool questions
  const where: any = {
    id: { notIn: seenQuestionIds },
  };

  if (filter.system) {
    where.system = filter.system;
  }
  
  if (filter.systems && filter.systems.length > 0) {
    where.system = { in: filter.systems };
  }

  const questions = await prisma.preGeneratedQuestion.findMany({
    where,
    take: limit,
    orderBy: { generatedAt: 'desc' },
  });

  return questions;
}

/**
 * Get user's performance statistics
 */
export async function getUserQuestionStats(
  prisma: any,
  userId: string
): Promise<{
  totalSeen: number;
  totalCorrect: number;
  totalIncorrect: number;
  accuracy: number;
  avgTimeMs: number | null;
  byType: Record<string, { seen: number; correct: number; incorrect: number }>;
}> {
  try {
    const records = await prisma.userQuestionSeen.findMany({
      where: { userId },
      select: {
        questionType: true,
        timesCorrect: true,
        timesIncorrect: true,
        avgTimeMs: true,
      },
    });

    let totalSeen = 0;
    let totalCorrect = 0;
    let totalIncorrect = 0;
    let totalTime = 0;
    let timeCount = 0;
    const byType: Record<string, { seen: number; correct: number; incorrect: number }> = {};

    for (const r of records) {
      totalSeen++;
      totalCorrect += r.timesCorrect || 0;
      totalIncorrect += r.timesIncorrect || 0;
      
      if (r.avgTimeMs) {
        totalTime += r.avgTimeMs;
        timeCount++;
      }

      if (!byType[r.questionType]) {
        byType[r.questionType] = { seen: 0, correct: 0, incorrect: 0 };
      }
      byType[r.questionType].seen++;
      byType[r.questionType].correct += r.timesCorrect || 0;
      byType[r.questionType].incorrect += r.timesIncorrect || 0;
    }

    const totalAttempts = totalCorrect + totalIncorrect;
    
    return {
      totalSeen,
      totalCorrect,
      totalIncorrect,
      accuracy: totalAttempts > 0 ? totalCorrect / totalAttempts : 0,
      avgTimeMs: timeCount > 0 ? Math.round(totalTime / timeCount) : null,
      byType,
    };
  } catch (e) {
    console.error('[NoRepeat] Failed to get user stats:', e);
    return {
      totalSeen: 0,
      totalCorrect: 0,
      totalIncorrect: 0,
      accuracy: 0,
      avgTimeMs: null,
      byType: {},
    };
  }
}
