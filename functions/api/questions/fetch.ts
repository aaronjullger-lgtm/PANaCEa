/**
 * POST /api/questions/fetch
 * Fetch pre-generated questions for a user with filters
 */

import { z } from 'zod';
import { authenticatedEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { resolveUserByClerkId } from '../_shared/resolveUser';
import {
  withProductionPregeneratedSafety,
  withProgressLinkage,
} from '../../../lib/services/questionServingSafety';

const QuestionFetchSchema = z.object({
  system: z.string().optional(),
  conditionId: z.string().optional(),
  difficulty: z.string().optional(),
  questionType: z.string().optional(),
  limit: z.number().optional(),
});

export const onRequestPost = authenticatedEndpoint(QuestionFetchSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/questions/fetch');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const { system, conditionId, difficulty, questionType, limit = 10 } = validated;

    // Resolve internal user ID from Clerk auth — never trust client-supplied userId
    const user = await resolveUserByClerkId(prisma, auth.userId);
    if (!user) {
      logger.warn('User not found for question fetch', { clerkId: auth.userId });
      return { status: 404, error: 'User not found' };
    }
    const userId = user.id;

    // Get seen question IDs
    const historyWhere: { userId: string; questionType?: string } = { userId };
    if (questionType) historyWhere.questionType = questionType;

    const history = await prisma.userQuestionSeen.findMany({
      where: historyWhere,
      select: { questionId: true },
    });
    type HistoryItem = (typeof history)[0];
    const seenQuestionIds = history.map((h: HistoryItem) => h.questionId);

    // Learner-facing fetches fail closed to validated content. Admin and
    // authoring surfaces have separate routes for pending/rejected drafts.
    // Progress linkage required: unlinked questions cannot persist review state.
    const where: any = withProgressLinkage(withProductionPregeneratedSafety({}));
    if (system) where.system = system;
    if (difficulty) where.difficulty = difficulty;
    if (questionType) where.questionType = questionType;
    if (conditionId) where.conditionId = conditionId;

    // Fetch questions excluding user's history and kill-switch rejected
    const questions = await prisma.preGeneratedQuestion.findMany({
      where: { ...where, id: { notIn: seenQuestionIds } },
      take: limit,
      orderBy: [{ generatedAt: 'asc' }],
    });

    logger.info('Fetched questions', {
      userId: auth.userId,
      count: questions.length,
      filters: { system, conditionId, questionType },
    });

    // Increment timesServed for all served questions (fire-and-forget).
    // Enables the flag-rate kill switch: questions with flagRate > 0.1 AND timesServed >= 20
    // are auto-rejected by contentHealthService. Without timesServed the kill switch never fires.
    if (questions.length > 0) {
      prisma.preGeneratedQuestion
        .updateMany({
          where: { id: { in: questions.map((q) => q.id) } },
          data: { timesServed: { increment: 1 } },
        })
        .catch((err: unknown) =>
          logger.warn('timesServed increment failed (non-fatal)', {
            error: err instanceof Error ? err.message : String(err),
          })
        );
    }

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
