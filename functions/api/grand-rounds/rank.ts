/**
 * API: Get user's rank for today
 * GET /api/grand-rounds/rank?userId={userId}&date={date}
 */

import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect, EdgePrismaClient } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { z } from 'zod';

const RankSchema = z.object({
  query: z.object({
    userId: z.string().min(1, 'userId is required'),
    date: z.string().optional(),
  }),
});

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(RankSchema, async ({ env, validated, auth }) => {
  const log = createEndpointLogger('/api/grand-rounds/rank', auth.userId);
  let prisma: EdgePrismaClient | null = null;

  try {
    const { userId, date: dateParam } = validated.query;

    prisma = createEdgePrismaClient(env.DATABASE_URL);

    const today = dateParam ? new Date(dateParam) : new Date();
    today.setHours(0, 0, 0, 0);

    // Get user's history entry
    const userHistory = await prisma.grandRoundsHistory.findUnique({
      where: {
        userId_date: {
          userId,
          date: today,
        },
      },
    });

    if (!userHistory) {
      log.info('No rank found for user', { userId, date: today.toISOString() });
      return { data: { rank: null } };
    }

    log.info('Fetched Grand Rounds rank', { userId, rank: userHistory.rank });

    return { data: { rank: userHistory.rank } };
  } catch (error: any) {
    log.error('Error fetching Grand Rounds rank', { error: error.message });
    return { status: 500, error: 'Failed to fetch rank' };
  } finally {
    await safePrismaDisconnect(prisma);
  }
});