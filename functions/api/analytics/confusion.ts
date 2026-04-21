/**
 * POST /api/analytics/confusion
 *
 * Tracks diagnostic confusion patterns — when a user selects the wrong condition.
 * Upserts confusion pairs: increments count if pair exists, creates new record otherwise.
 * Authenticated endpoint — userId resolved from Clerk token.
 */

import { z } from 'zod';
import { authenticatedEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { resolveUserId } from '../_shared/user-resolver';
import { createEndpointLogger } from '../_shared/secureLogger';

const ConfusionSchema = z.object({
  body: z.object({
    correctCondition: z.string().min(1),
    selectedCondition: z.string().min(1),
  }),
});

export const onRequestPost = authenticatedEndpoint(ConfusionSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/analytics/confusion');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const { correctCondition, selectedCondition } = validated.body;

    const userId = await resolveUserId(prisma, auth.userId);
    if (!userId) {
      return { data: { success: false, error: 'User not found' }, status: 404 };
    }

    // Try to find existing confusion pair
    const existingPair = await prisma.confusionPair.findUnique({
      where: {
        userId_realCondition_mistakenFor: {
          userId,
          realCondition: correctCondition,
          mistakenFor: selectedCondition,
        },
      },
    });

    if (existingPair) {
      await prisma.confusionPair.update({
        where: { id: existingPair.id },
        data: {
          count: { increment: 1 },
          lastOccurrence: new Date(),
        },
      });
    } else {
      await prisma.confusionPair.create({
        data: {
          id: crypto.randomUUID(),
          userId,
          realCondition: correctCondition,
          mistakenFor: selectedCondition,
          count: 1,
        },
      });
    }

    logger.info('Confusion pattern tracked', {
      correctCondition,
      selectedCondition,
      updated: !!existingPair,
    });
    return { data: { success: true } };
  } catch (error) {
    logger.error('Failed to store confusion pattern', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error('Failed to store confusion pattern');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
