/**
 * GET /api/content/curated-passages
 *
 * Returns curated textbook passages (e.g. OpenStax excerpts) for a condition/system.
 */

import { z } from 'zod';
import { authenticatedEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

const CuratedPassagesQuerySchema = z.object({
  conditionId: z.string().optional(),
  system: z.string().optional(),
  limit: z.string().optional(),
  source: z.string().optional(),
});

export const onRequestGet = authenticatedEndpoint(
  CuratedPassagesQuerySchema,
  async (context) => {
    const { env, validated } = context;
    const logger = createEndpointLogger('/api/content/curated-passages');
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      const { conditionId, system, source } = validated;
      const limit = Math.min(Math.max(Number.parseInt(validated.limit || '5', 10), 1), 20);

      const where: {
        conditionIds?: { has: string };
        systemCodes?: { has: string };
        source?: string;
      } = {};

      if (conditionId) {
        where.conditionIds = { has: conditionId };
      }

      if (system) {
        where.systemCodes = { has: system };
      }

      if (source) {
        where.source = source;
      }

      const passages = await prisma.curatedPassage.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          title: true,
          body: true,
          source: true,
          sourceUrl: true,
          license: true,
          systemCodes: true,
          conditionIds: true,
          createdAt: true,
        },
      });

      logger.info('Curated passages fetched', {
        count: passages.length,
        hasConditionId: Boolean(conditionId),
        hasSystem: Boolean(system),
      });

      return {
        data: { passages, count: passages.length },
        headers: { 'Cache-Control': 'public, max-age=300' },
      };
    } catch (error) {
      logger.error('Error fetching curated passages', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to fetch curated passages');
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { source: 'query' }
);
