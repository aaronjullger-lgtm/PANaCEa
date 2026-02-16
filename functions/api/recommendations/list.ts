import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { z } from 'zod';
import {
  getFromCache,
  setInCache,
  CACHE_CONFIG,
  isKVAvailable,
} from '../_shared/cache';

interface Env {
  DATABASE_URL: string;
  CLERK_SECRET_KEY: string;
  CACHE?: KVNamespace;
}

// Flattened schema for query params (no nested 'query' wrapper)
const RecommendationListSchema = z.object({
  status: z.enum(['pending', 'completed', 'dismissed']).optional(),
});

/**
 * Generate cache key for recommendations
 */
function getRecommendationsCacheKey(userId: string, status: string): string {
  return `${CACHE_CONFIG.PREFIX.USER_STATS}recommendations:${userId}:${status}`;
}

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(
  RecommendationListSchema,
  async (context) => {
    const { request, env, auth, validated } = context;
    const logger = createEndpointLogger('/api/recommendations/list');
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      // Direct access to validated fields (no longer nested under .query)
      const status = validated.status || 'pending';

      // Check cache first if KV is available
      if (isKVAvailable(env.CACHE)) {
        const cacheKey = getRecommendationsCacheKey(auth.userId, status);
        const cached = await getFromCache(env.CACHE, cacheKey);
        if (cached) {
          return {
            data: cached,
            headers: { 'X-Cache': 'HIT' },
          };
        }
      }

      const user = await prisma.user.findUnique({
        where: { clerkId: auth.userId },
        select: { id: true },
      });

      if (!user) {
        return {
          status: 404,
          error: 'User not found',
        };
      }

      const recommendations = await prisma.studyRecommendation.findMany({
        where: {
          userId: user.id,
          status: status as any,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 50, // Limit to 50 most recent
      });

      // Cache the result if KV is available
      if (isKVAvailable(env.CACHE)) {
        const cacheKey = getRecommendationsCacheKey(auth.userId, status);
        await setInCache(env.CACHE, cacheKey, recommendations, CACHE_CONFIG.TTL.USER_STATS);
      }

      // Return just the recommendations array for simpler frontend handling
      return {
        data: recommendations,
        headers: { 'X-Cache': 'MISS' },
      };
    } catch (error) {
      logger.error('Failed to fetch recommendations', error);
      return {
        status: 500,
        error: 'Failed to fetch recommendations',
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { source: 'query' }
);
