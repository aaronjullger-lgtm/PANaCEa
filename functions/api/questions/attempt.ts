/**
 * API Endpoint: /api/questions/attempt
 * 
 * Record a question attempt for a user.
 * Updates UserQuestionHistory and QuestionAttempt tables.
 * Used for tracking user progress and FSRS scheduling.
 */

import type { PagesFunction } from '@cloudflare/workers-types';
import { authenticateRequest } from '../_shared/auth';
import { createEdgePrismaClient } from '../_shared/prisma-edge';

interface Env {
  DATABASE_URL: string;
  CLERK_SECRET_KEY: string;
}

interface AttemptPayload {
  questionId: string;
  isCorrect: boolean; // Support both isCorrect and wasCorrect
  wasCorrect?: boolean;
  system?: string;
  conditionId?: string;
  questionType?: string;
  mode?: string;
  timeSpent?: number; // Support both timeSpent and timeSpentMs
  timeSpentMs?: number;
  answerChangedCount?: number;
  isRankedAttempt?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const onRequestPost: PagesFunction<Env> = async (context): Promise<any> => {
  const prisma = createEdgePrismaClient(context.env.DATABASE_URL);
  
  try {
    // Authenticate request
    const authResult = await authenticateRequest(context.request as any, context.env);
    if (!authResult) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Look up user by clerkId to get internal database ID
    const user = await prisma.user.findUnique({
      where: { clerkId: authResult.userId },
      select: { id: true },
    });

    if (!user) {
      return new Response(JSON.stringify({ 
        error: 'User not found',
        message: 'Your user account has not been synced yet. Please refresh and try again.',
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const userId = user.id;
    const body = await context.request.json() as AttemptPayload;

    const {
      questionId,
      isCorrect,
      wasCorrect,
      system,
      conditionId,
      questionType,
      mode = 'session',
      timeSpent,
      timeSpentMs,
      answerChangedCount,
      isRankedAttempt = false,
    } = body;

    // Support both isCorrect and wasCorrect field names
    const correctness = isCorrect !== undefined ? isCorrect : wasCorrect;
    
    // Support both timeSpent and timeSpentMs field names
    const timeSpentMillis = timeSpentMs !== undefined ? timeSpentMs : (timeSpent !== undefined ? timeSpent : null);

    if (!questionId) {
      return new Response(JSON.stringify({ error: 'questionId is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (correctness === undefined) {
      return new Response(JSON.stringify({ error: 'isCorrect or wasCorrect is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Generate unique IDs
    const attemptId = `attempt-${userId}-${questionId}-${Date.now()}`;
    const historyId = `${userId}-${questionId}`;

    // Use transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // 1. Record the attempt in QuestionAttempt table
      await tx.questionAttempt.create({
        data: {
          id: attemptId,
          userId,
          questionId,
          wasCorrect: correctness,
          system: system || null,
          conditionId: conditionId || null,
          questionType: questionType || null,
          mode,
          isRankedAttempt,
          timeSpentMs: timeSpentMillis,
          answerChangedCount: answerChangedCount || null,
          createdAt: new Date(),
        },
      });

      // 2. Update UserQuestionHistory (upsert - update if exists, create if not)
      await tx.userQuestionHistory.upsert({
        where: { id: historyId },
        create: {
          id: historyId,
          userId,
          questionId,
          isCorrect: correctness,
          seenAt: new Date(),
        },
        update: {
          isCorrect: correctness,
          seenAt: new Date(),
        },
      });

      // 3. Update question statistics in the Question table (if exists)
      try {
        await tx.question.update({
          where: { id: questionId },
          data: {
            timesSeen: { increment: 1 },
            timesCorrect: correctness ? { increment: 1 } : undefined,
          },
        });
      } catch {
        // Question might not exist in main table (could be pre-generated)
        // This is fine, just skip the update
      }

      // 4. Calculate aggregate stats for user
      const allAttempts = await tx.questionAttempt.findMany({
        where: { userId },
        select: { wasCorrect: true, system: true },
      });

      const totalQuestionsAnswered = allAttempts.length;
      const correctAnswers = allAttempts.filter(a => a.wasCorrect).length;
      const overallAccuracy = totalQuestionsAnswered > 0 
        ? Math.round((correctAnswers / totalQuestionsAnswered) * 100) 
        : 0;

      // System-specific stats
      let systemStats = null;
      if (system) {
        const systemAttempts = allAttempts.filter(a => a.system === system);
        const systemCorrect = systemAttempts.filter(a => a.wasCorrect).length;
        systemStats = {
          system,
          totalAttempts: systemAttempts.length,
          correctAnswers: systemCorrect,
          accuracy: systemAttempts.length > 0 
            ? Math.round((systemCorrect / systemAttempts.length) * 100) 
            : 0,
        };
      }

      return {
        attemptId,
        stats: {
          totalQuestionsAnswered,
          correctAnswers,
          overallAccuracy,
        },
        systemStats,
      };
    });

    // Get detailed system stats with trends (outside transaction for performance)
    const detailedSystemStats = system 
      ? await getUserSystemStats(prisma, userId, system) 
      : null;

    return new Response(JSON.stringify({
      success: true,
      attemptId: result.attemptId,
      stats: result.stats,
      systemStats: detailedSystemStats || result.systemStats,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error recording attempt:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } finally {
    await prisma.$disconnect();
  }
};

/**
 * Get user statistics for a specific system
 */
async function getUserSystemStats(
  prisma: ReturnType<typeof createEdgePrismaClient>,
  userId: string,
  system: string
) {
  const attempts = await prisma.questionAttempt.findMany({
    where: { userId, system },
    select: { wasCorrect: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 100, // Last 100 attempts for this system
  });

  if (attempts.length === 0) {
    return {
      system,
      totalAttempts: 0,
      correctAttempts: 0,
      accuracy: 0,
      recentTrend: 'neutral' as const,
    };
  }

  const totalAttempts = attempts.length;
  const correctAttempts = attempts.filter(a => a.wasCorrect).length;
  const accuracy = Math.round((correctAttempts / totalAttempts) * 100);

  // Calculate trend from last 10 vs previous 10
  const recent10 = attempts.slice(0, 10);
  const previous10 = attempts.slice(10, 20);
  
  let recentTrend: 'improving' | 'declining' | 'neutral' = 'neutral';
  if (recent10.length >= 5 && previous10.length >= 5) {
    const recentAccuracy = recent10.filter(a => a.wasCorrect).length / recent10.length;
    const previousAccuracy = previous10.filter(a => a.wasCorrect).length / previous10.length;
    
    if (recentAccuracy > previousAccuracy + 0.1) {
      recentTrend = 'improving';
    } else if (recentAccuracy < previousAccuracy - 0.1) {
      recentTrend = 'declining';
    }
  }

  return {
    system,
    totalAttempts,
    correctAttempts,
    accuracy,
    recentTrend,
  };
}
