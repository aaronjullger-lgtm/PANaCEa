/**
 * POST /api/questions/fetch
 * Fetch pre-generated questions for a user with filters
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

const QuestionFetchSchema = z.object({
  body: z.object({
    userId: z.string(),
    system: z.string().optional(),
    conditionId: z.string().optional(),
    difficulty: z.string().optional(),
    questionType: z.string().optional(),
    limit: z.number().optional(),
  }),
});

export const onRequestOptions = withCors();

export const onRequestPost = authenticatedEndpoint(QuestionFetchSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/questions/fetch');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const { userId, system, conditionId, difficulty, questionType, limit = 10 } = validated.body;

    // Get seen question IDs
    const historyWhere: { userId: string; questionType?: string } = { userId };
    if (questionType) historyWhere.questionType = questionType;

    const history = await prisma.userQuestionSeen.findMany({
      where: historyWhere,
      select: { questionId: true },
    });
    const seenQuestionIds = history.map((h) => h.questionId);

    // Build query
    const where: any = {};
    if (system) where.system = system;
    if (difficulty) where.difficulty = difficulty;
    if (questionType) where.questionType = questionType;
    if (conditionId) where.conditionId = conditionId;

    // Fetch questions excluding user's history
    const questions = await prisma.preGeneratedQuestion.findMany({
      where: { ...where, id: { notIn: seenQuestionIds } },
      take: limit,
      orderBy: [{ generatedAt: 'asc' }],
    });

    logger.info('Fetched questions', { userId: auth.userId, count: questions.length, filters: { system, conditionId, questionType } });

    return {
      data: {
        success: true,
        questions,
        source: 'database',
        count: questions.length,
        needsGeneration: questions.length < limit,
        generationNeeded: limit - questions.length,
      },
    };
  } catch (error) {
    logger.error('Error fetching questions', {
      error: error instanceof Error ? error.message : String(error),
      userId: auth.userId,
    });
    throw new Error('Failed to fetch questions');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
