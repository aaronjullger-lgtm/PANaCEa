/**
 * Treatments Reference API
 *
 * GET /api/reference/treatments - Fetch treatment options
 * Query params: category (optional)
 *
 * Security: authenticatedEndpoint with Zod validation
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
// SCHEMA DEFINITIONS
// ============================================================================

const GetTreatmentsSchema = z.object({
  query: z
    .object({
      category: z.string().optional(),
    })
    .optional(),
});

// ============================================================================
// ENDPOINT HANDLERS
// ============================================================================

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(
  GetTreatmentsSchema,
  async ({ env, auth, validated }) => {
    const log = createEndpointLogger('/api/reference/treatments', auth.userId);
    let prisma: EdgePrismaClient | null = null;

    try {
      log.info('Fetching treatments', { category: validated?.query?.category });

      if (!env.DATABASE_URL) {
        log.error('Database not configured');
        return { status: 500, error: 'Database not configured' };
      }

      prisma = createEdgePrismaClient(env.DATABASE_URL);
      const category = validated?.query?.category;

      const results = await prisma.treatment.findMany({
        where: category ? { category } : undefined,
        orderBy: { name: 'asc' },
      });

      log.info('Treatments fetched successfully', { count: results.length });
      return { data: { success: true, data: results } };
    } catch (error: any) {
      log.error('Error fetching treatments', error);
      return {
        status: 500,
        error: 'Failed to fetch treatments',
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
