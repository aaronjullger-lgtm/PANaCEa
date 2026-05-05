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
import { authenticatedEndpoint, withCors} from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { resolveCorrectAnswerIndex } from '../../../lib/answerLetterMap';

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

function asStringOptions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((option) => String(option ?? ''));
}

function normalizeCorrectIndexFromAny(data: Record<string, unknown>): number | null {
  const options = asStringOptions(data.options ?? data.answers ?? data.choices);
  const rawAnswer =
    data.correctAnswer ?? data.correct_answer ?? data.answer ?? data.correct_option ?? data.correctChoice;

  if (typeof rawAnswer === 'string' || typeof rawAnswer === 'number') {
    const resolved = resolveCorrectAnswerIndex(String(rawAnswer), options);
    if (resolved !== null) return resolved;
  }

  if (
    typeof data.correctAnswerIndex === 'number' &&
    Number.isInteger(data.correctAnswerIndex) &&
    data.correctAnswerIndex >= 0 &&
    (options.length === 0 || data.correctAnswerIndex < options.length)
  ) {
    return data.correctAnswerIndex;
  }

  if (
    typeof data.correctIndex === 'number' &&
    Number.isInteger(data.correctIndex) &&
    data.correctIndex >= 0 &&
    (options.length === 0 || data.correctIndex < options.length)
  ) {
    return data.correctIndex;
  }

  return null;
}

export const onRequestOptions = withCors();

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

      let correctIndex: number | null = null;
      if (pre) {
        correctIndex = normalizeCorrectIndexFromAny(pre.questionData as Record<string, unknown>);
      } else {
        const main = await prisma.question.findUnique({
          where: { id: attempt.questionId },
          select: { id: true, correctAnswer: true, options: true },
        });
        if (!main) return { status: 404, error: 'Question not found.' };
        correctIndex = normalizeCorrectIndexFromAny({
          correctAnswer: main.correctAnswer,
          options: main.options,
        });
      }

      if (correctIndex === null) {
        log.error('Targeted daily question has incomplete scoring data', {
          userId: auth.userId,
          questionId: attempt.questionId,
        });
        return { status: 422, error: 'Question scoring data is incomplete.' };
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
    } catch (error: unknown) {
      log.error('Targeted daily submit error', { error: error instanceof Error ? error.message : String(error) });
      return { status: 500, error: 'Failed to submit targeted daily question' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { source: 'body', requestsPerMinute: 120 }
);
