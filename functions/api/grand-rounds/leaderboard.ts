/**
 * API: Get today's Grand Rounds leaderboard
 * GET /api/grand-rounds/leaderboard?date={date}&limit={limit}
 */

import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import {
  createEdgePrismaClient,
  safePrismaDisconnect,
  EdgePrismaClient,
} from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { z } from 'zod';

const LeaderboardSchema = z.object({
  query: z.object({
    date: z.string().optional(),
    limit: z.string().optional().default('100'),
  }),
});

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(
  LeaderboardSchema,
  async ({ env, validated, auth }) => {
    const log = createEndpointLogger('/api/grand-rounds/leaderboard', auth.userId);
    let prisma: EdgePrismaClient | null = null;

    try {
      const { date: dateParam, limit: limitParam } = validated.query;
      const limit = Math.min(parseInt(limitParam || '100', 10), 500);

      prisma = createEdgePrismaClient(env.DATABASE_URL);

      const today = dateParam ? new Date(dateParam) : new Date();
      today.setHours(0, 0, 0, 0);

      // Get leaderboard entries for today, ordered by score (desc) then time (asc)
      const entries = await prisma.grandRoundsHistory.findMany({
        where: { date: today },
        orderBy: [{ score: 'desc' }, { completionTimeMs: 'asc' }],
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      // Format leaderboard with rank
      const leaderboard = entries.map((entry, index) => ({
        rank: index + 1,
        userId: entry.userId,
        userName: entry.user
          ? `${entry.user.firstName || ''} ${entry.user.lastName || ''}`.trim() || 'Anonymous'
          : 'Anonymous',
        score: entry.score,
        completionTimeMs: entry.completionTimeMs,
        correctAnswers: entry.correctAnswers,
      }));

      log.info('Fetched Grand Rounds leaderboard', {
        date: today.toISOString(),
        entryCount: leaderboard.length,
      });

      return { data: { leaderboard } };
    } catch (error: any) {
      log.error('Error fetching Grand Rounds leaderboard', { error: error.message });
      return { status: 500, error: 'Failed to fetch leaderboard' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
