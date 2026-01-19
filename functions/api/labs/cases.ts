/**
 * Lab Cases Reference API
 * GET /api/labs/cases - Fetch all lab cases
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

const LabCasesQuerySchema = z.object({
  query: z
    .object({
      difficulty: z.string().max(50).optional(),
      category: z.string().max(100).optional(),
    })
    .optional(),
});

// ============================================================================
// ENDPOINT HANDLERS
// ============================================================================

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(
  LabCasesQuerySchema,
  async ({ env, auth, validated, request }) => {
    const log = createEndpointLogger('/api/labs/cases', auth.userId);
    let prisma: EdgePrismaClient | null = null;

    try {
      prisma = createEdgePrismaClient(env.DATABASE_URL);

      const url = new URL(request.url);
      const difficulty = url.searchParams.get('difficulty');
      const category = url.searchParams.get('category');

      log.info('Fetching lab cases', {
        difficulty: difficulty || 'all',
        category: category || 'all',
      });

      const where: Record<string, string> = {};
      if (difficulty) where.difficulty = difficulty;
      if (category) where.category = category;

      const cases = await prisma.labCase.findMany({
        where: Object.keys(where).length > 0 ? where : undefined,
        orderBy: { createdAt: 'desc' },
      });

      log.info('Lab cases fetched successfully', { count: cases.length });

      return {
        data: {
          success: true,
          data: cases,
        },
      };
    } catch (error) {
      log.error('Error fetching lab cases', error);
      return {
        status: 500,
        error: 'Failed to fetch lab cases',
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);