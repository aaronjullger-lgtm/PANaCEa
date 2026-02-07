/**
 * Lab Tests Reference API
 *
 * GET /api/reference/labs - Fetch all lab tests with optional filtering
 *
 * Security: Sprint 3 - Authenticated endpoint with secure middleware
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
// VALIDATION SCHEMAS
// ============================================================================

const LabsQuerySchema = z.object({
  query: z
    .object({
      category: z.string().optional(),
      query: z.string().max(200).optional(),
    })
    .optional(),
  body: z.object({}).optional(),
  params: z.object({}).optional(),
});

// ============================================================================
// HANDLERS
// ============================================================================

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(
  LabsQuerySchema,
  async ({ env, auth, request }) => {
    const log = createEndpointLogger('/api/reference/labs', auth.userId);
    let prisma: EdgePrismaClient | null = null;

    try {
      const url = new URL(request.url);
      const category = url.searchParams.get('category');
      const query = url.searchParams.get('query');

      log.info('Fetching lab tests', {
        category: category || 'all',
        searchQuery: query || 'none',
      });

      prisma = createEdgePrismaClient(env.DATABASE_URL);

      let results;

      if (query) {
        // Search mode
        results = await prisma.labTest.findMany({
          where: {
            name: { contains: query, mode: 'insensitive' },
          },
          orderBy: { name: 'asc' },
          take: 20,
        });
      } else {
        // List mode with optional category filter
        results = await prisma.labTest.findMany({
          where: category ? { category } : undefined,
          orderBy: { name: 'asc' },
        });
      }

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
