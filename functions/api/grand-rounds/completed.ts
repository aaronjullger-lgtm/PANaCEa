/**
 * API: Check if current user has completed today's Grand Rounds challenge
 * GET /api/grand-rounds/completed
 * Uses auth to resolve internal user; no query params required.
 */

import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import {
  createEdgePrismaClient,
  safePrismaDisconnect,
  EdgePrismaClient,
} from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { z } from 'zod';

const CompletedSchema = z.object({ query: z.object({}) });

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(
  CompletedSchema,
  async ({ env, auth }) => {
    const log = createEndpointLogger('/api/grand-rounds/completed', auth.userId);
    let prisma: EdgePrismaClient | null = null;

    try {
      prisma = createEdgePrismaClient(env.DATABASE_URL);

      const user = await prisma.user.findUnique({
        where: { clerkId: auth.userId },
        select: { id: true },
      });

      if (!user) {
        log.warn('User not found', { clerkId: auth.userId });
        return { data: { completed: false } };
      }

      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      const history = await prisma.grandRoundsHistory.findUnique({
        where: {
          userId_date: { userId: user.id, date: today },
        },
      });

      log.info('Checked Grand Rounds completion', { userId: user.id, completed: !!history });

      return { data: { completed: !!history } };
    } catch (error: any) {
      log.error('Error checking Grand Rounds completion', { error: error.message });
      return { status: 500, error: 'Failed to check completion status' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
