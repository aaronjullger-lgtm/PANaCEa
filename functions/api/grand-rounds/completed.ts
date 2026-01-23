/**
 * API: Check if user has completed today's Grand Rounds challenge
 * GET /api/grand-rounds/completed?userId={userId}
 */

import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import {
  createEdgePrismaClient,
  safePrismaDisconnect,
  EdgePrismaClient,
} from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { z } from 'zod';

const CompletedSchema = z.object({
  query: z.object({
    userId: z.string().min(1, 'userId is required'),
  }),
});

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(
  CompletedSchema,
  async ({ env, validated, auth }) => {
    const log = createEndpointLogger('/api/grand-rounds/completed', auth.userId);
    let prisma: EdgePrismaClient | null = null;

    try {
      const { userId } = validated.query;

      prisma = createEdgePrismaClient(env.DATABASE_URL);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Check if user has a history entry for today
      const history = await prisma.grandRoundsHistory.findUnique({
        where: {
          userId_date: {
            userId,
            date: today,
          },
        },
      });

      log.info('Checked Grand Rounds completion', { userId, completed: !!history });

      return { data: { completed: !!history } };
    } catch (error: any) {
      log.error('Error checking Grand Rounds completion', { error: error.message });
      return { status: 500, error: 'Failed to check completion status' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
