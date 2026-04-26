/**
 * API Endpoint: /api/user/stats
 *
 * Dashboard-compatible analytics derived from user-owned database rows.
 */

import { z } from 'zod';
import { authenticatedEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { resolveOrCreateUserId } from '../_shared/user-resolver';
import { createEndpointLogger } from '../_shared/secureLogger';
import {
  getFromCache,
  setInCache,
  getUserStatsCacheKey,
  CACHE_CONFIG,
  isKVAvailable,
} from '../_shared/cache';
import { getUserDashboardSummary } from '../../../lib/services/dashboardAnalyticsService';

const UserStatsSchema = z.object({
  query: z.object({}).optional(),
});

export const onRequestGet = authenticatedEndpoint(UserStatsSchema, async (context) => {
  const { env, auth } = context;
  const logger = createEndpointLogger('/api/user/stats');
  let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;

  if (!env.DATABASE_URL) {
    logger.error('DATABASE_URL not configured');
    return {
      data: {
        success: false,
        error: 'Analytics unavailable',
        message: 'Server database is not configured.',
      },
      status: 503,
    };
  }

  try {
    try {
      prisma = createEdgePrismaClient(env.DATABASE_URL);
    } catch (initErr) {
      const msg = initErr instanceof Error ? initErr.message : String(initErr);
      logger.error('Prisma client init failed', { error: msg });
      console.error('[user/stats] Prisma init failed:', msg);
      return {
        data: {
          success: false,
          error: 'Analytics unavailable',
          message: 'Database connection unavailable.',
        },
        status: 503,
      };
    }

    const userId = await resolveOrCreateUserId(prisma, auth.userId);

    if (isKVAvailable(env.CACHE)) {
      const cacheKey = getUserStatsCacheKey(auth.userId);
      const cached = await getFromCache(env.CACHE, cacheKey);
      if (cached) {
        logger.info('Cache hit for user stats', { userId: auth.userId });
        return {
          data: cached,
          headers: { 'X-Cache': 'HIT' },
        };
      }
    }

    const dashboardSummary = await getUserDashboardSummary(prisma as any, userId);

    if (isKVAvailable(env.CACHE)) {
      const cacheKey = getUserStatsCacheKey(auth.userId);
      await setInCache(env.CACHE, cacheKey, dashboardSummary, CACHE_CONFIG.TTL.USER_STATS);
    }

    logger.info('Fetched user stats', {
      userId,
      totalAttempts: dashboardSummary.stats.overall.totalAttempts,
      accuracy: dashboardSummary.stats.overall.accuracy,
      weakAreasCount: dashboardSummary.stats.weakAreas.length,
    });

    return {
      data: dashboardSummary,
      headers: { 'X-Cache': 'MISS' },
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    const errStack = error instanceof Error ? error.stack : undefined;
    logger.error('Error fetching user stats', {
      error: errMsg,
      stack: errStack,
      userId: auth.userId,
    });
    console.error('[user/stats] 500:', errMsg, errStack || '');
    return {
      data: {
        success: false,
        error: 'Failed to fetch user stats',
        message: 'Please try again later.',
      },
      status: 500,
    };
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
