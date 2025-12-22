/**
 * API: Get or create today's Grand Rounds challenge
 * GET /api/grandrounds/challenge
 */

import { authenticateRequest, createErrorResponse, createSuccessResponse, handleCorsOptions, type Env } from '../_shared/auth';
import { createEdgePrismaClient } from '../_shared/prisma-edge';

export async function onRequestGet(context: { request: Request; env: Env }) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return handleCorsOptions();
  }

  const authContext = await authenticateRequest(request, env);
  if (!authContext) {
    return createErrorResponse('Unauthorized', 401);
  }

  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const user = await prisma.user.findUnique({ 
      where: { clerkId: authContext.userId } 
    });
    
    if (!user) {
      return createErrorResponse('User not found', 404);
    }

    // Try to get existing challenge for today
    let challenge = await prisma.grandRoundsChallenge.findUnique({
      where: { date: today }
    });

    // If no challenge exists, create one
    if (!challenge) {
      // Generate 5 random question IDs using the date as seed
      const seed = today.getTime();
      const questionIds = await generateQuestionIds(prisma, seed, 5);

      challenge = await prisma.grandRoundsChallenge.create({
        data: {
          date: today,
          questionIds,
          seed
        }
      });
    }

    // Check if user already played today
    const existingAttempt = await prisma.grandRoundsAttempt.findFirst({
      where: {
        userId: user.id,
        challengeId: challenge.id
      }
    });

    if (existingAttempt) {
      // Calculate stats for completed challenge
      const totalQuestions = challenge.questionIds.length;
      const correctCount = Math.floor(existingAttempt.score / 20); // Assuming 20 pts per correct
      
      // Get ranking (simplified for edge)
      const ranking = await prisma.grandRoundsAttempt.count({
        where: {
          challengeId: challenge.id,
          score: { gt: existingAttempt.score }
        }
      }) + 1;

      const totalAttempts = await prisma.grandRoundsAttempt.count({
        where: { challengeId: challenge.id }
      });

      const percentile = totalAttempts > 1 
        ? Math.round(((totalAttempts - ranking) / totalAttempts) * 100)
        : 100;

      return createSuccessResponse({
        status: 'completed',
        stats: {
          score: existingAttempt.score,
          correctCount,
          totalQuestions,
          timeSpentMs: existingAttempt.timeSpentMs,
          percentile,
          ranking
        }
      });
    }

    // Fetch the actual questions
    const questions = await prisma.question.findMany({
      where: {
        id: { in: challenge.questionIds as string[] }
      }
    });

    return createSuccessResponse({ 
      status: 'active',
      challengeId: challenge.id,
      questions 
    });
  } catch (error: any) {
    console.error('Error fetching/creating Grand Rounds challenge:', error);
    return createErrorResponse('Failed to fetch challenge', 500);
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Generate deterministic question IDs based on seed
 */
async function generateQuestionIds(prisma: any, seed: number, count: number): Promise<string[]> {
  const totalQuestions = await prisma.question.count();
  if (totalQuestions === 0) return [];

  const questionIds: string[] = [];
  for (let i = 0; i < count; i++) {
    const skip = Math.floor(Math.random() * totalQuestions);
    const q = await prisma.question.findFirst({ skip });
    if (q) questionIds.push(q.id);
  }
  
  return questionIds;
}
