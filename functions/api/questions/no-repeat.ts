/**
 * POST /api/questions/no-repeat
 * Fetch questions user hasn't seen yet
 */

import { z } from 'zod';
import { authenticatedEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { fetchUnseenQuestions } from '../_shared/no-repeat';

const NoRepeatSchema = z.object({
  body: z.object({
    filter: z
      .object({
        system: z.string().max(100).optional(),
        systems: z.array(z.string().max(100)).max(15).optional(),
        difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
        conditionId: z.string().max(100).optional(),
      })
      .optional()
      .default({}),
    limit: z.number().int().min(1).max(100).optional().default(10),
  }),
});

export const onRequestPost = authenticatedEndpoint(NoRepeatSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/questions/no-repeat');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const { filter, limit } = validated.body;
    const userId = auth.userId;

    const questions = await fetchUnseenQuestions(prisma, userId, filter || {}, limit || 10);

    logger.info('Fetched unseen questions', { userId, count: questions.length });

    return { data: { success: true, questions } };
  } catch (error) {
    logger.error('Failed to fetch unseen questions', {
      error: error instanceof Error ? error.message : String(error),
      userId: auth.userId,
    });
    throw new Error('Failed to fetch unseen questions');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
