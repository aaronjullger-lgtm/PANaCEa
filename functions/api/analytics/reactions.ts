/**
 * POST /api/analytics/reactions
 *
 * Stores user reactions to explanation helpfulness (helpful / not_helpful).
 * Authenticated endpoint — userId resolved from Clerk token.
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

const ReactionsSchema = z.object({
  body: z.object({
    questionId: z.string().min(1),
    reaction: z.enum(['helpful', 'not_helpful']),
    userId: z.string().optional(),
  }),
});

export const onRequestOptions = withCors();

export const onRequestPost = authenticatedEndpoint(ReactionsSchema, async (context) => {
  const { env, validated } = context;
  const logger = createEndpointLogger('/api/analytics/reactions');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const { questionId, reaction } = validated.body;

    await prisma.explanationReaction.create({
      data: {
        id: crypto.randomUUID(),
        questionId,
        reaction,
      },
    });

    logger.info('Reaction stored', { questionId, reaction });
    return { data: { success: true } };
  } catch (error) {
    logger.error('Failed to store reaction', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error('Failed to store reaction');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
