/**
 * API: Get today's Grand Rounds challenge
 * GET /api/grand-rounds/today
 *
 * Returns:
 * - If not attempted: { status: 'active', challengeId, questions[] } (NO correctAnswer field)
 * - If already attempted: { status: 'completed', stats: { score, correctCount, percentile, ranking } }
 *
 * Question source: Question table only (unified with submit grading).
 */

import { authenticatedEndpoint } from '../_shared/middleware';
import {
  createEdgePrismaClient,
  safePrismaDisconnect,
  EdgePrismaClient,
} from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { z } from 'zod';

// No query params needed for this endpoint
const TodaySchema = z.object({});

const QUESTIONS_PER_CHALLENGE = 5;

/** Normalize Question.options (Json) to string[] for client. */
function normalizeOptions(options: unknown): string[] {
  if (Array.isArray(options)) {
    return options.filter((x): x is string => typeof x === 'string');
  }
  if (options && typeof options === 'object' && 'options' in options) {
    const arr = (options as Record<string, unknown>).options;
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : [];
  }
  return [];
}

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

    // Get or create today's challenge (Question table only)
    let challenge = await prisma.grandRoundsChallenge.findUnique({
      where: { date: today },
    });

    if (!challenge) {
      // Create new challenge with 5 questions from Question table (deterministic by date seed)
      const questionPool = await prisma.question.findMany({
        where: {
          difficulty: { in: ['easy', 'medium', 'hard', 'PANCE-level', 'intermediate', 'advanced'] },
        },
        select: { id: true },
        take: 100,
      });

      if (questionPool.length < QUESTIONS_PER_CHALLENGE) {
        log.error('Insufficient questions in database', { poolSize: questionPool.length });
        return { status: 500, error: 'Insufficient questions in database' };
      }

      // Deterministic shuffle using today's date as seed
      const seed = today.getTime();
      const shuffled = [...questionPool].sort(() => {
        const x = Math.sin(seed) * 10000;
        return x - Math.floor(x) - 0.5;
      });

      const questionIds = shuffled.slice(0, QUESTIONS_PER_CHALLENGE).map((q) => q.id);

      challenge = await prisma.grandRoundsChallenge.create({
        data: {
          id: crypto.randomUUID(),
          date: today,
          questionIds,
        },
      });

      log.info('Created new Grand Rounds challenge', {
        challengeId: challenge.id,
        questionCount: questionIds.length,
      });
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

      log.info('Returning completed challenge stats', {
        userId: user.id,
        score: existingAttempt.score,
      });

      return {
        data: {
          status: 'completed',
          challengeId: challenge.id,
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

    // Fetch questions from Question table WITHOUT correct answers (SECURITY)
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
        // correctAnswer EXCLUDED - never sent to client
      },
    });

    type QuestionRow = (typeof questions)[0];

    // Return in same order as challenge.questionIds; map topic for client (topic -> conditionName equivalent)
    const orderedQuestions = (challenge.questionIds as string[])
      .map((qid: string) => {
        const q = questions.find((r: QuestionRow) => r.id === qid);
        if (!q) return null;
        return {
          id: q.id,
          vignette: q.vignette,
          question: q.question,
          options: normalizeOptions(q.options),
          system: q.system,
          difficulty: q.difficulty,
          topic: q.topic ?? undefined,
          tags: q.tags ?? undefined,
        };
      })
      .filter(Boolean);

    log.info('Returning active challenge', {
      challengeId: challenge.id,
      questionCount: orderedQuestions.length,
    });

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
