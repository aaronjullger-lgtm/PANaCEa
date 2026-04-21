/**
 * API: Get review (rationales) for a completed Grand Rounds challenge
 * GET /api/grand-rounds/review?challengeId={challengeId}
 * Returns per-question correct/incorrect and rationale for the current user's attempt only.
 */

import { correctAnswerToIndex } from '../../../lib/grandRoundsGrading';
import { authenticatedEndpoint } from '../_shared/middleware';
import {
  createEdgePrismaClient,
  safePrismaDisconnect,
  EdgePrismaClient,
} from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { z } from 'zod';

const ReviewSchema = z.object({
  query: z.object({
    challengeId: z.string().min(1, 'challengeId is required'),
  }),
});

export const onRequestGet = authenticatedEndpoint(
  ReviewSchema,
  async ({ env, validated, auth }) => {
    const log = createEndpointLogger('/api/grand-rounds/review', auth.userId);
    let prisma: EdgePrismaClient | null = null;

    try {
      const { challengeId } = validated.query;

      prisma = createEdgePrismaClient(env.DATABASE_URL);

      const user = await prisma.user.findUnique({
        where: { clerkId: auth.userId },
        select: { id: true },
      });

      if (!user) {
        log.warn('User not found', { clerkId: auth.userId });
        return { status: 404, error: 'User not found' };
      }

      const attempt = await prisma.grandRoundsAttempt.findUnique({
        where: {
          userId_challengeId: { userId: user.id, challengeId },
        },
        select: { answers: true },
      });

      if (!attempt) {
        log.warn('Attempt not found', { userId: user.id, challengeId });
        return { status: 404, error: 'Challenge not completed or not found' };
      }

      const challenge = await prisma.grandRoundsChallenge.findUnique({
        where: { id: challengeId },
        select: { questionIds: true },
      });

      if (!challenge) {
        return { status: 404, error: 'Challenge not found' };
      }

      const questionIds = challenge.questionIds as string[];
      const userAnswers = (attempt.answers ?? {}) as Record<string, number>;

      const questions = await prisma.question.findMany({
        where: { id: { in: questionIds } },
        select: {
          id: true,
          question: true,
          options: true,
          explanation: true,
          correctAnswer: true,
        },
      });

      const ordered = questionIds
        .map((qid) => {
          const q = questions.find((r) => r.id === qid);
          if (!q) return null;
          const optionsArr = Array.isArray(q.options) ? q.options : [];
          const optionsLength = Math.max(optionsArr.length, 4);
          const correctIndex = correctAnswerToIndex(q.correctAnswer, optionsLength);
          const userIndex = userAnswers[qid];
          const correct = typeof userIndex === 'number' && userIndex === correctIndex;
          return {
            questionId: q.id,
            question: q.question,
            options: optionsArr,
            correct,
            rationale: q.explanation ?? '',
          };
        })
        .filter(Boolean);

      return { data: { review: ordered } };
    } catch (error: any) {
      log.error('Grand Rounds review error', { error: error.message });
      return { status: 500, error: 'Failed to fetch review' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
