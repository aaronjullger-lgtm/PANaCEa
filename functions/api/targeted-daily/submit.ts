/**
 * API: Submit today's Targeted Daily Question (Didactic)
 * POST /api/targeted-daily/submit
 *
 * Body:
 * - answerIndex: number (0-5)
 * - timeSpentMs?: number
 *
 * Server-authoritative:
 * - Uses stored questionId for today (UTC)
 * - Computes correctness server-side
 */

import { z } from 'zod';
import { authenticatedEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

const SubmitSchema = z.object({
  answerIndex: z.number().int().min(0).max(10),
  timeSpentMs: z
    .number()
    .int()
    .min(0)
    .max(60 * 60 * 1000)
    .optional(),
});

function getUtcDateStart(d: Date): Date {
  const t = new Date(d);
  t.setUTCHours(0, 0, 0, 0);
  return t;
}

function normalizeCorrectIndexFromAny(data: any): number {
  const letterToIndex: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, E: 4, F: 5 };

  const maybeLetter =
    (typeof data?.correctAnswer === 'string' ? data.correctAnswer : undefined) ??
    (typeof data?.correct_answer === 'string' ? data.correct_answer : undefined);
  if (maybeLetter) {
    const l = maybeLetter.toUpperCase().trim().charAt(0);
    if (l in letterToIndex) return letterToIndex[l]!;
  }

  if (typeof data?.correctAnswerIndex === 'number') return data.correctAnswerIndex;
  if (typeof data?.correctIndex === 'number') return data.correctIndex;

  // Fallback: if main table correctAnswer is actual text, we can't map reliably here; default 0
  if (
    typeof data?.correctAnswer === 'string' &&
    !(data.correctAnswer.trim().charAt(0).toUpperCase() in letterToIndex)
  ) {
    return 0;
  }

  // Default
  return 0;
}

export const onRequestPost = authenticatedEndpoint(
  SubmitSchema,
  async ({ env, auth, validated }) => {
    const log = createEndpointLogger('/api/targeted-daily/submit', auth.userId);
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      const user = await prisma.user.findUnique({
        where: { clerkId: auth.userId },
        select: { id: true },
      });
      if (!user) return { status: 404, error: 'User not found. Please refresh and try again.' };

      const today = getUtcDateStart(new Date());

      const attempt = await prisma.targetedDailyAttempt.findUnique({
        where: { userId_date: { userId: user.id, date: today } },
        select: {
          id: true,
          questionId: true,
          completedAt: true,
        },
      });

      if (!attempt) return { status: 404, error: 'No targeted daily question found for today.' };
      if (attempt.completedAt) return { status: 409, error: 'Already completed today.' };

      // Fetch question (prefer pre-generated)
      const pre = await prisma.preGeneratedQuestion.findUnique({
        where: { id: attempt.questionId },
        select: { id: true, questionData: true },
      });

      let correctIndex = 0;
      if (pre) {
        correctIndex = normalizeCorrectIndexFromAny(pre.questionData as any);
      } else {
        const main = await prisma.question.findUnique({
          where: { id: attempt.questionId },
          select: { id: true, correctAnswer: true },
        });
        if (!main) return { status: 404, error: 'Question not found.' };
        correctIndex = normalizeCorrectIndexFromAny({ correctAnswer: main.correctAnswer });
      }

      const isCorrect = validated.answerIndex === correctIndex;
      const timeSpentMs = validated.timeSpentMs ?? null;

      await prisma.targetedDailyAttempt.update({
        where: { userId_date: { userId: user.id, date: today } },
        data: {
          answerIndex: validated.answerIndex,
          isCorrect,
          timeSpentMs,
          completedAt: new Date(),
        },
      });

      log.info('Targeted daily submitted', {
        userId: user.id,
        questionId: attempt.questionId,
        isCorrect,
      });

      return {
        data: {
          success: true,
          correct: isCorrect,
          correctAnswerIndex: correctIndex,
          stats: {
            correctCount: isCorrect ? 1 : 0,
            totalQuestions: 1,
            timeSpentMs: timeSpentMs ?? 0,
          },
        },
      };
    } catch (error: any) {
      log.error('Targeted daily submit error', { error: error?.message ?? String(error) });
      return { status: 500, error: 'Failed to submit targeted daily question' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { source: 'body', requestsPerMinute: 120 }
);
