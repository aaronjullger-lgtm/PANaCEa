/**
 * API: Get today's Grand Rounds challenge
 * GET /api/grand-rounds/today
 * 
 * Returns:
 * - If not attempted: { status: 'active', challengeId, questions[] } (NO correctAnswer field)
 * - If already attempted: { status: 'completed', stats: { score, correctCount, percentile, ranking } }
 */

import { authenticateRequest, createErrorResponse, createSuccessResponse, handleCorsOptions, type Env } from '../_shared/auth';
import { createEdgePrismaClient } from '../_shared/prisma-edge';

export const onRequestOptions = handleCorsOptions;

export async function onRequestGet(context: { request: Request; env: Env }) {
  const { request, env } = context;

  const authContext = await authenticateRequest(request, env);
  if (!authContext.isAuthenticated || !authContext.userId) {
    return createErrorResponse('Unauthorized', 401);
  }

  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    // Get internal user ID from Clerk ID
    const user = await prisma.user.findUnique({ 
      where: { clerkId: authContext.userId },
      select: { id: true }
    });
    
    if (!user) {
      return createErrorResponse('User not found. Please refresh and try again.', 404);
    }

    // Get today's date (UTC)
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // Get or create today's challenge
    let challenge = await prisma.grandRoundsChallenge.findUnique({
      where: { date: today }
    });

    if (!challenge) {
      // Create new challenge with 5 random questions
      // Get a pool of intermediate/advanced questions
      const questionPool = await prisma.question.findMany({
        where: {
          difficulty: { in: ['intermediate', 'advanced'] },
          isActive: true
        },
        select: { id: true },
        take: 100
      });

      if (questionPool.length < 5) {
        return createErrorResponse('Insufficient questions in database', 500);
      }

      // Shuffle using today's date as seed
      const seed = today.getTime();
      const shuffled = questionPool.sort(() => {
        // Deterministic shuffle based on seed
        const x = Math.sin(seed) * 10000;
        return (x - Math.floor(x)) - 0.5;
      });

      const questionIds = shuffled.slice(0, 5).map(q => q.id);

      challenge = await prisma.grandRoundsChallenge.create({
        data: {
          date: today,
          questionIds
        }
      });
    }

    // Check if user already completed today
    const existingAttempt = await prisma.grandRoundsAttempt.findUnique({
      where: {
        userId_challengeId: {
          userId: user.id,
          challengeId: challenge.id
        }
      }
    });

    if (existingAttempt) {
      // User already completed - return stats only
      // Calculate percentile
      const allAttempts = await prisma.grandRoundsAttempt.findMany({
        where: { challengeId: challenge.id },
        select: { score: true, timeSpentMs: true },
        orderBy: [
          { score: 'desc' },
          { timeSpentMs: 'asc' }
        ]
      });

      const totalAttempts = allAttempts.length;
      let ranking = 1;
      
      for (const attempt of allAttempts) {
        if (attempt.score > existingAttempt.score) {
          ranking++;
        } else if (attempt.score === existingAttempt.score && attempt.timeSpentMs < existingAttempt.timeSpentMs) {
          ranking++;
        } else {
          break;
        }
      }

      const percentile = totalAttempts > 1 
        ? Math.round(((totalAttempts - ranking) / (totalAttempts - 1)) * 100)
        : 100;

      return createSuccessResponse({
        status: 'completed',
        stats: {
          score: existingAttempt.score,
          correctCount: existingAttempt.correctCount,
          totalQuestions: challenge.questionIds.length,
          timeSpentMs: existingAttempt.timeSpentMs,
          percentile,
          ranking
        }
      });
    }

    // Fetch questions WITHOUT correct answers (SECURITY: Never send correct answers to client)
    const questions = await prisma.question.findMany({
      where: {
        id: { in: challenge.questionIds as string[] }
      },
      select: {
        id: true,
        vignette: true,
        question: true,
        options: true,
        system: true,
        difficulty: true,
        topic: true,
        tags: true
        // CRITICAL: correctAnswer is EXCLUDED
      }
    });

    // Ensure questions are in the same order as challenge.questionIds
    const orderedQuestions = challenge.questionIds.map(qid => 
      questions.find(q => q.id === qid)
    ).filter(Boolean);

    return createSuccessResponse({
      status: 'active',
      challengeId: challenge.id,
      questions: orderedQuestions
    });

  } catch (error: any) {
    console.error('Grand Rounds today error:', error);
    return createErrorResponse(
      'Failed to fetch challenge: ' + (error.message || 'Unknown error'),
      500
    );
  } finally {
    await prisma.$disconnect();
  }
}
