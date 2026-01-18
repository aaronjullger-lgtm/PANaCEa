/**
 * GET /api/reference/history-components
 * Fetch all history components, optionally filtered by type or search query
 *
 * Security: Sprint 3 - Secured with authenticatedEndpoint middleware
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../../_shared/middleware';
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
    })
    .optional(),
});

// ============================================================================
// ENDPOINT HANDLERS
// ============================================================================

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(
  HistoryComponentsQuerySchema,
  async ({ env, auth, validated }) => {
    const log = createEndpointLogger('/api/reference/history-components', auth.userId);
    let prisma: EdgePrismaClient | null = null;

    try {
      prisma = createEdgePrismaClient(env.DATABASE_URL);

      const type = validated?.query?.type;
      const searchQuery = validated?.query?.query;

      let results;

      if (searchQuery) {
        // Search mode
        log.info('Searching history components', { searchQuery });
        results = await prisma.historyComponent.findMany({
          where: {
            OR: [
              { name: { contains: searchQuery, mode: 'insensitive' } },
              { description: { contains: searchQuery, mode: 'insensitive' } },
            ],
          },
          orderBy: { name: 'asc' },
          take: 20,
        });
      } else {
        // List mode with optional type filter
        log.info('Listing history components', { type: type || 'all' });
        results = await prisma.historyComponent.findMany({
          where: type ? { type } : undefined,
          orderBy: { name: 'asc' },
        });
      }

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