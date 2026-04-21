/**
 * GET /api/reference/history-components
 * Fetch all history components, optionally filtered by type or search query
 *
 * Security: Sprint 3 - Secured with authenticatedEndpoint middleware
 */

import { z } from 'zod';
import { authenticatedEndpoint } from '../../_shared/middleware';
import {
  createEdgePrismaClient,
  safePrismaDisconnect,
  EdgePrismaClient,
} from '../../_shared/prisma-edge';
import { createEndpointLogger } from '../../_shared/secureLogger';

// ============================================================================
// VALIDATION SCHEMA
// ============================================================================

const HistoryComponentsQuerySchema = z.object({
  query: z
    .object({
      type: z.string().max(100).optional(),
      query: z.string().max(200).optional(),
      highYield: z.string().optional(),
    })
    .optional(),
});

// ============================================================================
// ENDPOINT HANDLERS
// ============================================================================

export const onRequestGet = authenticatedEndpoint(
  HistoryComponentsQuerySchema,
  async ({ env, auth, validated, request }) => {
    const log = createEndpointLogger('/api/reference/history-components', auth.userId);
    let prisma: EdgePrismaClient | null = null;

    try {
      prisma = createEdgePrismaClient(env.DATABASE_URL);

      const url = new URL(request.url);
      const type = url.searchParams.get('type') || validated?.query?.type;
      const searchQuery = url.searchParams.get('query') || validated?.query?.query;
      const highYield = url.searchParams.get('highYield');

      log.info('Fetching history components', {
        type: type || 'all',
        searchQuery: searchQuery || 'none',
        highYield: highYield || 'false',
      });

      // Unified where builder
      const where: Record<string, unknown> = {};
      if (type) where.category = type;
      if (highYield === 'true') where.isHighYield = true;
      if (searchQuery) {
        where.OR = [
          { name: { contains: searchQuery, mode: 'insensitive' } },
          { description: { contains: searchQuery, mode: 'insensitive' } },
          { category: { contains: searchQuery, mode: 'insensitive' } },
        ];
      }

      const results = await prisma.historyComponent.findMany({
        where: Object.keys(where).length > 0 ? where : undefined,
        orderBy: [{ isHighYield: 'desc' }, { name: 'asc' }],
        take: searchQuery ? 20 : undefined,
      });

      log.info('History components fetched', { count: results.length });
      return { data: { success: true, data: results } };
    } catch (error) {
      log.error('Failed to fetch history components', error);
      return { status: 500, error: 'Failed to fetch history components' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
