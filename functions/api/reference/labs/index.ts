/**
 * Lab Tests Reference API
 *
 * GET /api/reference/labs - Fetch all lab tests with optional filtering
 *
 * Security: Sprint 3 - Authenticated endpoint with secure middleware
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
// VALIDATION SCHEMAS
// ============================================================================

const LabsQuerySchema = z.object({
  query: z
    .object({
      category: z.string().optional(),
      query: z.string().max(200).optional(),
      highYield: z.string().optional(),
    })
    .optional(),
  body: z.object({}).optional(),
  params: z.object({}).optional(),
});

// ============================================================================
// HANDLERS
// ============================================================================

export const onRequestGet = authenticatedEndpoint(
  LabsQuerySchema,
  async ({ env, auth, request }) => {
    const log = createEndpointLogger('/api/reference/labs', auth.userId);
    let prisma: EdgePrismaClient | null = null;

    try {
      const url = new URL(request.url);
      const category = url.searchParams.get('category');
      const query = url.searchParams.get('query');
      const highYield = url.searchParams.get('highYield');

      log.info('Fetching lab tests', {
        category: category || 'all',
        searchQuery: query || 'none',
        highYield: highYield || 'false',
      });

      prisma = createEdgePrismaClient(env.DATABASE_URL);

      // Unified where builder
      const where: Record<string, unknown> = {};
      if (category) where.category = category;
      if (highYield === 'true') where.isHighYield = true;
      if (query) {
        where.OR = [
          { name: { contains: query, mode: 'insensitive' } },
          { typicalUse: { contains: query, mode: 'insensitive' } },
          { category: { contains: query, mode: 'insensitive' } },
        ];
      }

      const results = await prisma.labTest.findMany({
        where: Object.keys(where).length > 0 ? where : undefined,
        orderBy: [{ isHighYield: 'desc' }, { name: 'asc' }],
        take: query ? 20 : undefined,
      });

      log.info('Successfully fetched lab tests', { count: results.length });

      return { data: { success: true, data: results } };
    } catch (error: any) {
      log.error('Error fetching labs', error);
      return {
        status: 500,
        error: 'Failed to fetch labs',
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
