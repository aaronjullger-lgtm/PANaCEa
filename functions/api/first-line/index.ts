/**
 * First Line Treatments Endpoint
 * GET /api/first-line
 *
 * Retrieves first-line treatments, optionally filtered by category
 * Public endpoint - no authentication required
 *
 * Security: publicEndpoint with Zod validation
 */

import { publicEndpoint, withCors } from '../_shared/middleware';
import {
  createEdgePrismaClient,
  safePrismaDisconnect,
  EdgePrismaClient,
} from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { z } from 'zod';

// ============================================================================
// SCHEMAS
// ============================================================================

const FirstLineQuerySchema = z.object({
  query: z.object({
    category: z.string().optional(),
  }),
});

// ============================================================================
// OPTIONS HANDLER
// ============================================================================

export const onRequestOptions = withCors();

// ============================================================================
// GET HANDLER
// ============================================================================

export const onRequestGet = publicEndpoint(FirstLineQuerySchema, async ({ env, validated }) => {
  const log = createEndpointLogger('/api/first-line');
  let prisma: EdgePrismaClient | null = null;

  try {
    if (!env.DATABASE_URL) {
      return {
        status: 500,
        error: 'Database not configured',
      };
    }

    prisma = createEdgePrismaClient(env.DATABASE_URL);

    const { category } = validated.query;
    const where = category ? { category: String(category) } : {};

    const treatments = await prisma.firstLineTreatment.findMany({
      where,
      orderBy: { condition: 'asc' },
    });

    log.info('First line treatments fetched', {
      count: treatments.length,
      category: category || 'all',
    });

    return { data: treatments };
  } catch (error) {
    log.error('Error fetching first line treatments', error);
    return {
      status: 500,
      error: 'Failed to fetch first line treatments',
    };
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
