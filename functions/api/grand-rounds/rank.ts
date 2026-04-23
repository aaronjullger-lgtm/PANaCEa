/**
 * API: Get user's rank for today
 * GET /api/grand-rounds/rank?userId={userId}&date={date}
 */

import { authenticatedEndpoint } from '../_shared/middleware';
import {
  createEdgePrismaClient,
  safePrismaDisconnect,
  EdgePrismaClient,
} from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { z } from 'zod';

const RankSchema = z.object({
  query: z.object({
    userId: z.string().min(1, 'userId is required'),
    date: z.string().optional(),
  }),
});

export const onRequestGet = authenticatedEndpoint(RankSchema, async ({ env, validated, auth }) => {
  const log = createEndpointLogger('/api/grand-rounds/rank', auth.userId);
  let prisma: EdgePrismaClient | null = null;

  try {
    const { userId, date: dateParam } = validated.query;

    prisma = createEdgePrismaClient(env.DATABASE_URL);

    const today = dateParam ? new Date(dateParam) : new Date();
    today.setUTCHours(0, 0, 0, 0);

    const userHistory = await prisma.grandRoundsHistory.findUnique({
      where: {
        userId_date: { userId, date: today },
      },
    });

    if (!userHistory) {
      log.info('No rank found for user', { userId, date: today.toISOString() });
      return { data: { rank: null } };
    }

    // Compute rank: count entries with better (score, time) for this date
    const betterCount = await prisma.grandRoundsHistory.count({
      where: {
        date: today,
        OR: [
          { score: { gt: userHistory.score } },
          {
            score: userHistory.score,
            completionTimeMs: { lt: userHistory.completionTimeMs },
          },
        ],
      },
    });
    const rank = betterCount + 1;

    log.info('Fetched Grand Rounds rank', { userId, rank });

    return { data: { rank } };
  } catch (error: any) {
    log.error('Error fetching Grand Rounds rank', { error: error.message });
    return { status: 500, error: 'Failed to fetch rank' };
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
