/**
 * GET /api/question-statistics/:questionId
 *
 * Retrieve anonymous aggregated statistics for a question (peer validation).
 * Returns total attempts, correct attempts, and percentage missed.
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

const QuestionStatisticsSchema = z.object({
  params: z.object({
    questionId: z.string().min(1),
  }),
});

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(QuestionStatisticsSchema, async (context) => {
  const { env, validated } = context;
  const logger = createEndpointLogger('/api/question-statistics/[questionId]');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const questionId = validated.params?.questionId;
    if (!questionId) {
      return { data: { error: 'Question ID is required' }, status: 400 };
    }

    const question = await prisma.preGeneratedQuestion.findUnique({
      where: { id: questionId },
      select: {
        timesServed: true,
        timesCorrect: true,
        timesIncorrect: true,
      },
    });

    if (!question) {
      return { data: { error: 'Question not found' }, status: 404 };
    }

    const totalAttempts = question.timesServed;
    const correctAttempts = question.timesCorrect;
    const incorrectAttempts = question.timesIncorrect;
    const percentageMissed = totalAttempts > 0 ? (incorrectAttempts / totalAttempts) * 100 : 0;
    const percentageCorrect = totalAttempts > 0 ? (correctAttempts / totalAttempts) * 100 : 0;

    logger.info('Fetched question statistics', { questionId, totalAttempts, percentageMissed });
    return {
      data: {
        totalAttempts,
        correctAttempts,
        incorrectAttempts,
        percentageMissed: Math.round(percentageMissed),
        percentageCorrect: Math.round(percentageCorrect),
      },
      headers: { 'Cache-Control': 'public, max-age=300' }, // 5 minutes cache
    };
  } catch (error) {
    logger.error('Failed to fetch question statistics', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error('Failed to fetch question statistics');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});