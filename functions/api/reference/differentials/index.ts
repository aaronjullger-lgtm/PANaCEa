/**
 * Differential Diagnosis Reference Index API
 * GET /api/reference/differentials
 *
 * Lists and searches differential diagnoses, optionally filtered by category,
 * presenting complaint, or search query
 *
 * Sprint: Security Hardening Sprint 3
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

const DifferentialsQuerySchema = z.object({
  query: z
    .object({
      category: z.string().max(100).optional(),
      query: z.string().max(200).optional(),
      presentingComplaint: z.string().max(200).optional(),
      highYield: z.string().optional(),
    })
    .optional(),
});

// ============================================================================
// CORS HANDLER
// ============================================================================

// ============================================================================
// GET HANDLER
// ============================================================================

export const onRequestGet = authenticatedEndpoint(
  DifferentialsQuerySchema,
  async ({ env, auth, validated, request }) => {
    const log = createEndpointLogger('/api/reference/differentials', auth.userId);
    let prisma: EdgePrismaClient | null = null;

    try {
      prisma = createEdgePrismaClient(env.DATABASE_URL);

      const url = new URL(request.url);
      const category = url.searchParams.get('category');
      const query = url.searchParams.get('query');
      const presentingComplaint = url.searchParams.get('presentingComplaint');
      const highYield = url.searchParams.get('highYield');

      log.info('Fetching differentials', {
        category: category || 'all',
        query: query || 'none',
        highYield: highYield || 'false',
      });

      // Unified where builder
      const where: Record<string, unknown> = {};
      if (category) where.category = category;
      if (highYield === 'true') where.isHighYield = true;
      if (presentingComplaint) {
        where.presentingComplaint = { contains: presentingComplaint, mode: 'insensitive' };
      }
      if (query) {
        where.OR = [
          { presentingComplaint: { contains: query, mode: 'insensitive' } },
          { category: { contains: query, mode: 'insensitive' } },
        ];
      }

      const results = await prisma.differentialDiagnosis.findMany({
        where: Object.keys(where).length > 0 ? where : undefined,
        orderBy: [{ isHighYield: 'desc' }, { presentingComplaint: 'asc' }],
        take: query ? 30 : undefined,
      });

      log.info('Differentials fetch successful', { count: results.length });

      return {
        data: {
          success: true,
          data: results,
        },
      };
    } catch (error) {
      log.error('Error fetching differentials', error);
      return {
        status: 500,
        error: 'Failed to fetch differential diagnoses',
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
