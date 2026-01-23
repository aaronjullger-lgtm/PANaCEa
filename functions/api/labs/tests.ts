/**
 * Lab Tests Reference API
 * GET /api/labs/tests - Fetch all lab tests
 *
 * Security: Sprint 3 - Secured with authenticatedEndpoint middleware
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import {
  createEdgePrismaClient,
  safePrismaDisconnect,
  EdgePrismaClient,
} from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

// ============================================================================
// VALIDATION SCHEMA
// ============================================================================

const LabTestsQuerySchema = z.object({
  query: z
    .object({
      category: z.string().max(100).optional(),
      query: z.string().max(200).optional(),
    })
    .optional(),
});

// ============================================================================
// ENDPOINT HANDLERS
// ============================================================================

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(
  LabTestsQuerySchema,
  async ({ env, auth, validated, request }) => {
    const log = createEndpointLogger('/api/labs/tests', auth.userId);
    let prisma: EdgePrismaClient | null = null;

    try {
      prisma = createEdgePrismaClient(env.DATABASE_URL);

      const url = new URL(request.url);
      const category = url.searchParams.get('category');
      const searchQuery = url.searchParams.get('query');

      log.info('Fetching lab tests', {
        category: category || 'all',
        searchQuery: searchQuery || 'none',
      });

      let results;

      if (searchQuery) {
        // Search mode
        results = await prisma.labTest.findMany({
          where: {
            OR: [
              { name: { contains: searchQuery, mode: 'insensitive' } },
              { abbreviation: { contains: searchQuery, mode: 'insensitive' } },
            ],
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

      log.info('Lab tests fetched successfully', { count: results.length });

      return {
        data: {
          success: true,
          data: results,
        },
      };
    } catch (error) {
      log.error('Error fetching lab tests', error);
      return {
        status: 500,
        error: 'Failed to fetch lab tests',
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
