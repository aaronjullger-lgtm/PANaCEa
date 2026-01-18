/**
 * Retention Stats API Endpoint
 * GET /api/stats/retention
 * Returns retention analytics for dashboard visualizations
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

const RetentionStatsSchema = z.object({});

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(RetentionStatsSchema, async (context) => {
  const { env, auth } = context;
  const logger = createEndpointLogger('/api/stats/retention');
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

    const srsItems = await prisma.sRSItem.findMany({
      where: { userId },
      select: {
        id: true,
        interval: true,
        dueDate: true,
        lastReviewed: true,
        easiness: true,
        repetition: true,
        fsrsStability: true,
      },
    });

    const dueCount = srsItems.filter((item) => item.dueDate <= now).length;

    const avgStability =
      srsItems.reduce((sum, item) => sum + (item.fsrsStability || 5), 0) / (srsItems.length || 1);

    const decayCurveData = Array.from({ length: 31 }, (_, day) => ({
      day,
      retentionProb: Math.max(0, Math.min(100, Math.exp(-day / avgStability) * 100)),
    }));

    const stabilityBuckets = [
      { bucket: '<1d', count: 0, color: '#ef4444' },
      { bucket: '1-3d', count: 0, color: '#f97316' },
      { bucket: '3-7d', count: 0, color: '#eab308' },
      { bucket: '7-21d', count: 0, color: '#3b82f6' },
      { bucket: '21d+', count: 0, color: '#10b981' },
    ];

    srsItems.forEach((item) => {
      const interval = item.interval;
      if (interval < 1) stabilityBuckets[0].count++;
      else if (interval < 3) stabilityBuckets[1].count++;
      else if (interval < 7) stabilityBuckets[2].count++;
      else if (interval < 21) stabilityBuckets[3].count++;
      else stabilityBuckets[4].count++;
    });

    const lastTuned = new Date(now.getTime() - 6 * 60 * 60 * 1000);
    const tuningReason = 'Pharmacology';
    const adjustment: 'tighten' | 'loosen' = 'tighten';

    logger.info('Fetched retention stats', { userId: auth.userId, dueCount, totalCards: srsItems.length });

    return {
      data: {
        success: true,
        data: {
          dueCount,
          totalCards: srsItems.length,
          decayCurveData,
          stabilityBuckets,
          lastTuned: lastTuned.toISOString(),
          tuningReason,
          adjustment,
        },
      },
    };
  } catch (error) {
    logger.error('Retention stats error', {
      error: error instanceof Error ? error.message : String(error),
      userId: auth.userId,
    });
    throw new Error('Failed to fetch retention stats');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
