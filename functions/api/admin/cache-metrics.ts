// functions/api/admin/cache-metrics.ts
// Admin endpoint to view cache performance metrics

import { z } from 'zod';
import { adminAuthenticatedEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { getCacheMetrics, isKVAvailable } from '../_shared/cache';
import type { KVNamespace } from '@cloudflare/workers-types';

const CacheMetricsSchema = z.object({
  query: z.object({}).optional(),
});

/**
 * GET /api/admin/cache-metrics
 * Returns cache hit/miss statistics for monitoring performance
 * Admin-only endpoint
 */
export const onRequestGet = adminAuthenticatedEndpoint(CacheMetricsSchema, async (context) => {
  const { env, auth } = context;
  const logger = createEndpointLogger('/api/admin/cache-metrics');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { clerkId: auth.userId },
      select: { role: true, id: true },
    });

    if (user?.role !== 'ADMIN' && user?.role !== 'SUPERADMIN') {
      logger.warn('Non-admin attempted to access cache metrics', {
        userId: auth.userId,
        role: user?.role,
      });

      return {
        data: { error: 'Admin access required' },
        status: 403,
      };
    }

    // Check if KV is available
    const cache = (env as any).CACHE as KVNamespace | undefined;

    if (!isKVAvailable(cache)) {
      logger.warn('Cache not available', { userId: user.id });

      return {
        data: {
          error: 'Cache not available',
          message: 'KV namespace is not configured',
        },
        status: 503,
      };
    }

    // Get cache metrics
    const metrics = await getCacheMetrics(cache);

    // Calculate hit rate
    const total = metrics.hits + metrics.misses;
    const hitRate = total > 0 ? Math.round((metrics.hits / total) * 100) : 0;

    logger.info('Cache metrics retrieved', {
      userId: user.id,
      total,
      hitRate,
    });

    return {
      data: {
        success: true,
        metrics: {
          hits: metrics.hits,
          misses: metrics.misses,
          errors: metrics.errors,
          total,
          hitRate: `${hitRate}%`,
          lastUpdated: metrics.lastUpdated,
        },
      },
    };
  } catch (error) {
    logger.error('Error fetching cache metrics', {
      error: error instanceof Error ? error.message : String(error),
      userId: auth.userId,
    });
    throw new Error('Failed to fetch cache metrics');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
