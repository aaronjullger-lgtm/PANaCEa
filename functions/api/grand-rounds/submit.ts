/**
 * API: Submit Grand Rounds attempt
 * POST /api/grand-rounds/submit
 * 
 * Body: {
 *   challengeId: string,
 *   answers: Record<questionId, answerIndex>,
 *   timeSpentMs: number
 * }
 * 
 * Returns: {
 *   success: true,
 *   score: number,
 *   correctCount: number,
 *   percentile: number,
 *   ranking: number,
 *   speedBonus: number
 * }
 */

import { authenticateRequest, createErrorResponse, createSuccessResponse, handleCorsOptions, type Env } from '../_shared/auth';
import { createEdgePrismaClient } from '../_shared/prisma-edge';

export const onRequestOptions = handleCorsOptions;

export async function onRequestPost(context: { request: Request; env: Env }) {
  const { request, env } = context;

  const authContext = await authenticateRequest(request, env);
  if (!authContext.isAuthenticated || !authContext.userId) {
    return createErrorResponse('Unauthorized', 401);
  }

  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const body = await request.json() as { 
      challengeId: string, 
      answers: Record<string, number>, 
      timeSpentMs: number 
    };

    const { challengeId, answers, timeSpentMs } = body;

    // Validate inputs
    if (!challengeId || !answers || typeof timeSpentMs !== 'number') {
      return createErrorResponse('Missing required fields: challengeId, answers, timeSpentMs', 400);
    }

    if (typeof answers !== 'object' || Array.isArray(answers)) {
      return createErrorResponse('Answers must be an object mapping questionId to answer index', 400);
    }

    if (timeSpentMs < 0 || timeSpentMs > 20 * 60 * 1000) {
      return createErrorResponse('Invalid timeSpentMs: must be between 0 and 20 minutes', 400);
    }

    // Get internal user ID
    const user = await prisma.user.findUnique({ 
      where: { clerkId: authContext.userId },
      select: { id: true }
    });

    if (!user) {
      return createErrorResponse('User not found', 404);
    }

    // Check if user already submitted
    const existingAttempt = await prisma.grandRoundsAttempt.findUnique({
      where: {
        userId_challengeId: {
          userId: user.id,
          challengeId,
        },
      },
    });

    if (existingAttempt) {
      return createErrorResponse('Challenge already completed. You can only attempt each challenge once.', 400);
    }

    // Get the challenge
    const challenge = await prisma.grandRoundsChallenge.findUnique({
      where: { id: challengeId },
    });

    if (!challenge) {
      return createErrorResponse('Challenge not found', 404);
    }

    // Validate that answers match challenge questions
    const expectedQuestionIds = challenge.questionIds as string[];
    const submittedQuestionIds = Object.keys(answers);

    if (submittedQuestionIds.length !== expectedQuestionIds.length) {
      return createErrorResponse(
        `Expected ${expectedQuestionIds.length} answers, got ${submittedQuestionIds.length}`,
        400
      );
    }

    for (const qid of submittedQuestionIds) {
      if (!expectedQuestionIds.includes(qid)) {
        return createErrorResponse(`Invalid question ID: ${qid}`, 400);
      }
    }

    // Fetch questions with correct answers for SERVER-SIDE GRADING
    const questions = await prisma.question.findMany({
      where: {
        id: { in: expectedQuestionIds },
      },
      select: {
        id: true,
        correctAnswer: true,
      },
    });

    // Grade the answers
    let correctCount = 0;
    const POINTS_PER_CORRECT = 20;

    for (const question of questions) {
      const userAnswerIndex = answers[question.id];
      
      // Validate answer index
      if (typeof userAnswerIndex !== 'number' || userAnswerIndex < 0 || userAnswerIndex > 4) {
        return createErrorResponse(
          `Invalid answer index for question ${question.id}: must be 0-4`,
          400
        );
      }

      // Compare with correct answer
      if (userAnswerIndex === question.correctAnswer) {
        correctCount++;
      }
    }

    // Calculate score with speed bonus
    const baseScore = correctCount * POINTS_PER_CORRECT;
    
    // Speed bonus: max 20 points, decreases by 1 point per minute
    // Complete under 1 minute = +20, under 10 minutes = +10, under 20 minutes = +0
    const timeInMinutes = timeSpentMs / 60000;
    const speedBonus = correctCount > 0 
      ? Math.max(0, Math.min(20, Math.round(20 - timeInMinutes)))
      : 0;
    
    const finalScore = baseScore + speedBonus;

    // Save the attempt with correctCount
    await prisma.grandRoundsAttempt.create({
      data: {
        userId: user.id,
        challengeId,
        score: finalScore,
        correctCount,
        timeSpentMs,
        answers: answers as any, // Store for potential review
      },
    });

    // Calculate percentile and ranking
    const allAttempts = await prisma.grandRoundsAttempt.findMany({
      where: { challengeId },
      select: { score: true, timeSpentMs: true },
      orderBy: [
        { score: 'desc' },
        { timeSpentMs: 'asc' },
      ],
    });

    const totalAttempts = allAttempts.length;
    let ranking = 1;

    for (const attempt of allAttempts) {
      if (attempt.score > finalScore) {
        ranking++;
      } else if (attempt.score === finalScore && attempt.timeSpentMs < timeSpentMs) {
        ranking++;
      } else {
        break; // Since sorted, we can break here
      }
    }

    // Calculate percentile (higher is better)
    const percentile = totalAttempts > 1
      ? Math.round(((totalAttempts - ranking) / (totalAttempts - 1)) * 100)
      : 100;

    return createSuccessResponse({
      success: true,
      score: finalScore,
      correctCount,
      totalQuestions: expectedQuestionIds.length,
      percentile,
      ranking,
      speedBonus,
    });

  } catch (error: any) {
    console.error('Grand Rounds submit error:', error);
    return createErrorResponse(
      'Failed to submit attempt: ' + (error.message || 'Unknown error'),
      500
    );
  } finally {
    await prisma.$disconnect();
  }
}
