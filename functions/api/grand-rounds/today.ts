/**
 * API: Get today's Grand Rounds challenge
 * GET /api/grand-rounds/today
 *
 * Returns:
 * - If not attempted: { status: 'active', challengeId, questions[] } (NO correctAnswer field)
 * - If already attempted: { status: 'completed', stats: { score, correctCount, percentile, ranking } }
 */

import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect, EdgePrismaClient } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { z } from 'zod';

// No query params needed for this endpoint
const TodaySchema = z.object({});

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(TodaySchema, async ({ env, auth }) => {
  const log = createEndpointLogger('/api/grand-rounds/today', auth.userId);
  let prisma: EdgePrismaClient | null = null;

  try {
    prisma = createEdgePrismaClient(env.DATABASE_URL);

    // Get internal user ID from Clerk ID
    const user = await prisma.user.findUnique({
      where: { clerkId: auth.userId },
      select: { id: true },
    });

    if (!user) {
      log.warn('User not found', { clerkId: auth.userId });
      return { status: 404, error: 'User not found. Please refresh and try again.' };
    }

    // Get today's date (UTC)
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // Get or create today's challenge
    let challenge = await prisma.grandRoundsChallenge.findUnique({
      where: { date: today },
    });

    if (!challenge) {
      // Create new challenge with 5 random questions
      // Get a pool of intermediate/advanced questions
      const questionPool = await prisma.question.findMany({
        where: {
          difficulty: { in: ['intermediate', 'advanced'] },
          isActive: true,
        },
        select: { id: true },
        take: 100,
      });

      if (questionPool.length < 5) {
        log.error('Insufficient questions in database', { poolSize: questionPool.length });
        return { status: 500, error: 'Insufficient questions in database' };
      }

      // Shuffle using today's date as seed
      const seed = today.getTime();
      const shuffled = questionPool.sort(() => {
        // Deterministic shuffle based on seed
        const x = Math.sin(seed) * 10000;
        return x - Math.floor(x) - 0.5;
      });

      const questionIds = shuffled.slice(0, 5).map((q) => q.id);

      challenge = await prisma.grandRoundsChallenge.create({
        data: {
          date: today,
          questionIds,
        },
      });

      log.info('Created new Grand Rounds challenge', { challengeId: challenge.id, questionCount: questionIds.length });
    }

    // Check if user already completed today
    const existingAttempt = await prisma.grandRoundsAttempt.findUnique({
      where: {
        userId_challengeId: {
          userId: user.id,
          challengeId: challenge.id,
        },
      },
    });

    if (existingAttempt) {
      // User already completed - return stats only
      // Calculate percentile
      const allAttempts = await prisma.grandRoundsAttempt.findMany({
        where: { challengeId: challenge.id },
        select: { score: true, timeSpentMs: true },
        orderBy: [{ score: 'desc' }, { timeSpentMs: 'asc' }],
      });

      const totalAttempts = allAttempts.length;
      let ranking = 1;

      for (const attempt of allAttempts) {
        if (attempt.score > existingAttempt.score) {
          ranking++;
        } else if (
          attempt.score === existingAttempt.score &&
          attempt.timeSpentMs < existingAttempt.timeSpentMs
        ) {
          ranking++;
        } else {
          break;
        }
      }

      const percentile =
        totalAttempts > 1
          ? Math.round(((totalAttempts - ranking) / (totalAttempts - 1)) * 100)
          : 100;

      log.info('Returning completed challenge stats', { userId: user.id, score: existingAttempt.score });

      return {
        data: {
          status: 'completed',
          stats: {
            score: existingAttempt.score,
            correctCount: existingAttempt.correctCount,
            totalQuestions: (challenge.questionIds as string[]).length,
            timeSpentMs: existingAttempt.timeSpentMs,
            percentile,
            ranking,
          },
        },
      };
    }

    // Fetch questions WITHOUT correct answers (SECURITY: Never send correct answers to client)
    const questions = await prisma.question.findMany({
      where: {
        id: { in: challenge.questionIds as string[] },
      },
      select: {
        id: true,
        vignette: true,
        question: true,
        options: true,
        system: true,
        difficulty: true,
        topic: true,
        tags: true,
        // CRITICAL: correctAnswer is EXCLUDED
      },
    });

    // Ensure questions are in the same order as challenge.questionIds
    const orderedQuestions = (challenge.questionIds as string[])
      .map((qid) => questions.find((q) => q.id === qid))
      .filter(Boolean);

    log.info('Returning active challenge', { challengeId: challenge.id, questionCount: orderedQuestions.length });

    return {
      data: {
        status: 'active',
        challengeId: challenge.id,
        questions: orderedQuestions,
      },
    };
  } catch (error: any) {
    log.error('Grand Rounds today error', { error: error.message });
    return { status: 500, error: 'Failed to fetch challenge' };
  } finally {
    await safePrismaDisconnect(prisma);
  }
});