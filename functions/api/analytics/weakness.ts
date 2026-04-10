/**
 * POST /api/analytics/weakness
 *
 * Tracks user weakness patterns by condition.
 * Authenticated endpoint — userId resolved from Clerk token.
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { resolveUserId } from '../_shared/user-resolver';
import { createEndpointLogger } from '../_shared/secureLogger';

const WeaknessSchema = z.object({
  body: z.object({
    conditionId: z.string().min(1),
    wasCorrect: z.boolean(),
  }),
});

export const onRequestOptions = withCors();

export const onRequestPost = authenticatedEndpoint(WeaknessSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/analytics/weakness');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const { conditionId, wasCorrect } = validated.body;

    const userId = await resolveUserId(prisma, auth.userId);
    if (!userId) {
      return { data: { success: true }, status: 200 }; // Silently skip if user not synced yet
    }

    await prisma.weaknessPattern.create({
      data: {
        id: crypto.randomUUID(),
        userId,
        conditionId,
        wasCorrect,
      },
    });

    logger.info('Weakness pattern stored', { userId, conditionId, wasCorrect });
    return { data: { success: true } };
  } catch (error) {
    logger.error('Failed to store weakness pattern', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error('Failed to store weakness pattern');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
