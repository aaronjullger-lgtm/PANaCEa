/**
 * API: Submit Grand Rounds completion and get rank
 * POST /api/grandrounds/submit
 * 
 * Body: {
 *   userId: string,
 *   date: string (ISO),
 *   score: number,
 *   completionTimeMs: number,
 *   correctAnswers: number,
 *   timeBonus: number
 * }
 */

import { authenticateRequest, createErrorResponse, createSuccessResponse, handleCorsOptions, type Env } from '../_shared/auth';
import { createEdgePrismaClient } from '../_shared/prisma-edge';

export async function onRequestPost(context: { request: Request; env: Env }) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return handleCorsOptions();
  }

  const authContext = await authenticateRequest(request, env);
  if (!authContext) {
    return createErrorResponse('Unauthorized', 401);
  }

  try {
    const { challengeId, answers, timeSpentMs } = await request.json() as { 
      challengeId: string, 
      answers: Record<string, string>, 
      timeSpentMs: number 
    };

    if (!challengeId || !answers || typeof timeSpentMs !== 'number') {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    // Get internal user ID
    const user = await prisma.user.findUnique({ where: { clerkId: authContext.userId } });
    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
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
      return new Response(JSON.stringify({ error: 'Challenge already completed' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get the challenge
    const challenge = await prisma.grandRoundsChallenge.findUnique({
      where: { id: challengeId },
    });

    if (!challenge) {
      return new Response(JSON.stringify({ error: 'Challenge not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Fetch questions with correct answers for grading
    const questions = await prisma.question.findMany({
      where: {
        id: { in: challenge.questionIds as string[] },
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
      const userAnswer = answers[question.id];
      if (userAnswer === question.correctAnswer) {
        correctCount++;
      }
    }

    // Calculate score with speed bonus
    const rawScore = correctCount * POINTS_PER_CORRECT;
    const timeInMinutes = timeSpentMs / 60000;
    const speedBonus = correctCount > 0 ? Math.max(0, Math.min(20, 20 - timeInMinutes)) : 0;
    const finalScore = Math.round(rawScore + speedBonus);

    // Save the attempt
    await prisma.grandRoundsAttempt.create({
      data: {
        userId: user.id,
        challengeId,
        score: finalScore,
        timeSpentMs,
      },
    });

    // Calculate percentile
    const allAttempts = await prisma.grandRoundsAttempt.findMany({
      where: { challengeId },
      select: { score: true },
    });
    const worseCount = allAttempts.filter(a => a.score < finalScore).length;
    const percentile = allAttempts.length > 0 ? Math.round((worseCount / allAttempts.length) * 100) : 100;

    // Calculate ranking
    const rankingAttempts = await prisma.grandRoundsAttempt.findMany({
      where: { challengeId },
      select: { score: true, timeSpentMs: true },
      orderBy: [
        { score: 'desc' },
        { timeSpentMs: 'asc' },
      ],
    });
    let ranking = 1;
    for (const attempt of rankingAttempts) {
      if (attempt.score > finalScore) {
        ranking++;
      } else if (attempt.score === finalScore && attempt.timeSpentMs < timeSpentMs) {
        ranking++;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      score: finalScore,
      correctCount,
      totalQuestions: questions.length,
      percentile,
      ranking,
      speedBonus: Math.round(speedBonus),
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error submitting Grand Rounds completion:', error);
    return createErrorResponse('Failed to submit completion', 500);
  }
}
