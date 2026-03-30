/**
 * GET /api/reference/vitals
 * Fetch all vital sign ranges, optionally filtered by age group
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

const VitalsQuerySchema = z.object({
  query: z
    .object({
      ageGroup: z.string().max(50).optional(),
      query: z.string().max(200).optional(),
    })
    .optional(),
});

// ============================================================================
// ENDPOINT HANDLERS
// ============================================================================

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(
  VitalsQuerySchema,
  async ({ env, auth, validated, request }) => {
    const log = createEndpointLogger('/api/reference/vitals', auth.userId);
    let prisma: EdgePrismaClient | null = null;

    try {
      prisma = createEdgePrismaClient(env.DATABASE_URL);

      const url = new URL(request.url);
      const ageGroup = url.searchParams.get('ageGroup') || validated?.query?.ageGroup;
      const query = url.searchParams.get('query');

      log.info('Fetching vital sign ranges', {
        ageGroup: ageGroup || 'all',
        searchQuery: query || 'none',
      });

      // Unified where builder
      const where: Record<string, unknown> = {};
      if (ageGroup) where.category = ageGroup;
      if (query) {
        where.OR = [
          { vitalSign: { contains: query, mode: 'insensitive' } },
          { displayName: { contains: query, mode: 'insensitive' } },
          { category: { contains: query, mode: 'insensitive' } },
        ];
      }

      const results = await prisma.vitalSignRange.findMany({
        where: Object.keys(where).length > 0 ? where : undefined,
        orderBy: { vitalSign: 'asc' },
      });

      log.info('Vital sign ranges fetched', { count: results.length });
      return { data: { success: true, data: results } };
    } catch (error) {
      log.error('Failed to fetch vital sign ranges', error);
      return { status: 500, error: 'Failed to fetch vital sign ranges' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
