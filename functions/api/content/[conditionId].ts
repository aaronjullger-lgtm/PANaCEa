/**
 * GET /api/content/:conditionId
 *
 * Fetches the FULL MedicalContent object from the database
 * Returns all fields for Reference Grade UI rendering
 */

import { z } from 'zod';
import { publicEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import {
  getFromCache,
  setInCache,
  getConditionCacheKey,
  CACHE_CONFIG,
  isKVAvailable,
} from '../_shared/cache';
import type { KVNamespace } from '@cloudflare/workers-types';

const ConditionDetailSchema = z.object({
  conditionId: z.string().min(1),
});

// Public so condition detail fetches from loadConditions/getConditionById work without auth (same as /api/content/all)
export const onRequestGet = publicEndpoint(
  ConditionDetailSchema,
  async (context) => {
    const { env, validated } = context;
    const logger = createEndpointLogger('/api/content/[conditionId]');
    const prisma = createEdgePrismaClient(env.DATABASE_URL);
    const conditionId = validated.conditionId;

    try {
      if (!conditionId) {
        return { data: { error: 'conditionId parameter is required' }, status: 400 };
      }

      const sanitizedId = conditionId.trim().replace(/[<>"'`;]/g, '');

      // Check cache first if KV is available
      if (isKVAvailable((env as any).CACHE as KVNamespace)) {
        const cacheKey = getConditionCacheKey(sanitizedId);
        const cached = await getFromCache((env as any).CACHE, cacheKey);
        if (cached) {
          logger.info('Cache hit for condition', { conditionId: sanitizedId });
          return {
            data: cached,
            headers: { 'X-Cache': 'HIT', 'Cache-Control': 'public, max-age=3600' },
          };
        }
      }

      const content = await prisma.medicalContent.findFirst({
        where: {
          OR: [
            { conditionId: { equals: sanitizedId, mode: 'insensitive' } },
            { condition: { equals: sanitizedId, mode: 'insensitive' } },
          ],
          status: 'published',
        },
      });

      if (!content) {
        return { data: { error: 'Content not found', conditionId: sanitizedId }, status: 404 };
      }

      // Cache the result if KV is available
      if (isKVAvailable((env as any).CACHE as KVNamespace)) {
        const cacheKey = getConditionCacheKey(sanitizedId);
        await setInCache((env as any).CACHE, cacheKey, content, CACHE_CONFIG.TTL.CONDITION_DETAIL);
      }

      logger.info('Fetched condition detail', { conditionId: sanitizedId });
      return {
        data: content,
        headers: { 'X-Cache': 'MISS', 'Cache-Control': 'public, max-age=3600' },
      };
    } catch (error) {
      logger.error('Error fetching condition', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to fetch medical content');
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { source: 'params' }
);
