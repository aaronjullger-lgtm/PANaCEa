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

import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect, EdgePrismaClient } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { z } from 'zod';

const SubmitSchema = z.object({
  body: z.object({
    challengeId: z.string().min(1, 'Challenge ID is required'),
    answers: z.record(z.string(), z.number().int().min(0).max(4)),
    timeSpentMs: z.number().int().min(0).max(20 * 60 * 1000), // Max 20 minutes
  }),
});

export const onRequestOptions = withCors();

export const onRequestPost = authenticatedEndpoint(SubmitSchema, async ({ env, validated, auth }) => {
  const log = createEndpointLogger('/api/grand-rounds/submit', auth.userId);
  let prisma: EdgePrismaClient | null = null;

  try {
    const { challengeId, answers, timeSpentMs } = validated.body;

    prisma = createEdgePrismaClient(env.DATABASE_URL);

    // Get internal user ID
    const user = await prisma.user.findUnique({
      where: { clerkId: auth.userId },
      select: { id: true },
    });

    if (!user) {
      log.warn('User not found', { clerkId: auth.userId });
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
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
      log.warn('Challenge already completed', { userId: user.id, challengeId });
      return new Response(JSON.stringify({
        error: 'Challenge already completed. You can only attempt each challenge once.',
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get the challenge
    const challenge = await prisma.grandRoundsChallenge.findUnique({
      where: { id: challengeId },
    });

    if (!challenge) {
      log.warn('Challenge not found', { challengeId });
      return new Response(JSON.stringify({ error: 'Challenge not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate that answers match challenge questions
    const expectedQuestionIds = challenge.questionIds as string[];
    const submittedQuestionIds = Object.keys(answers);

    if (submittedQuestionIds.length !== expectedQuestionIds.length) {
      log.warn('Answer count mismatch', {
        expected: expectedQuestionIds.length,
        received: submittedQuestionIds.length,
      });
      return new Response(JSON.stringify({
        error: `Expected ${expectedQuestionIds.length} answers, got ${submittedQuestionIds.length}`,
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    for (const qid of submittedQuestionIds) {
      if (!expectedQuestionIds.includes(qid)) {
        log.warn('Invalid question ID in answers', { questionId: qid });
        return new Response(JSON.stringify({ error: `Invalid question ID: ${qid}` }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
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
    const speedBonus =
      correctCount > 0 ? Math.max(0, Math.min(20, Math.round(20 - timeInMinutes))) : 0;

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

    log.info('Grand Rounds attempt submitted', {
      userId: user.id,
      challengeId,
      score: finalScore,
      correctCount,
      totalQuestions: expectedQuestionIds.length,
    });

    // Calculate percentile and ranking
    const allAttempts = await prisma.grandRoundsAttempt.findMany({
      where: { challengeId },
      select: { score: true, timeSpentMs: true },
      orderBy: [{ score: 'desc' }, { timeSpentMs: 'asc' }],
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
    const percentile =
      totalAttempts > 1 ? Math.round(((totalAttempts - ranking) / (totalAttempts - 1)) * 100) : 100;

    return new Response(JSON.stringify({
      success: true,
      score: finalScore,
      correctCount,
      totalQuestions: expectedQuestionIds.length,
      percentile,
      ranking,
      speedBonus,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    log.error('Grand Rounds submit error', { error: error.message });
    return new Response(JSON.stringify({
      error: 'Failed to submit attempt: ' + (error.message || 'Unknown error'),
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  } finally {
    await safePrismaDisconnect(prisma);
  }
});