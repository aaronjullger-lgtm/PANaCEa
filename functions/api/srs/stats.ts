/**
 * GET /api/srs/stats
 * Fetch SRS statistics for dashboard widget
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

const SRSStatsSchema = z.object({});

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(SRSStatsSchema, async (context) => {
  const { env, auth } = context;
  const logger = createEndpointLogger('/api/srs/stats');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const user = await prisma.user.findUnique({
      where: { clerkId: auth.userId },
      select: { id: true },
    });

    if (!user) {
      return {
        data: { error: 'User not found', message: 'Your user account has not been synced yet.' },
        status: 404,
      };
    }

    const userId = user.id;
    const now = new Date();

    const [dueCount, totalCards, matureCards, recentAttempts] = await Promise.all([
      prisma.sRSItem.count({ where: { userId, dueDate: { lte: now } } }),
      prisma.sRSItem.count({ where: { userId } }),
      prisma.sRSItem.count({ where: { userId, interval: { gt: 21 } } }),
      prisma.questionAttempt.findMany({
        where: { userId, createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
        select: { isCorrect: true },
      }),
    ]);

    const retentionRate =
      recentAttempts.length > 0
        ? Math.round((recentAttempts.filter((a) => a.isCorrect).length / recentAttempts.length) * 100)
        : 0;

    logger.info('Fetched SRS stats', { userId: auth.userId, dueCount, totalCards });

    return { data: { dueCount, totalCards, retentionRate, matureCards } };
  } catch (error) {
    logger.error('SRS stats error', {
      error: error instanceof Error ? error.message : String(error),
      userId: auth.userId,
    });
    throw new Error('Failed to fetch SRS stats');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
