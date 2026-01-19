/**
 * Random Lab Cases API
 * GET /api/labs/cases/random - Fetch random lab cases for drills
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

const RandomLabCasesQuerySchema = z.object({
  query: z
    .object({
      count: z.string().regex(/^\d+$/).transform(Number).optional(),
      difficulty: z.string().max(50).optional(),
    })
    .optional(),
});

// ============================================================================
// ENDPOINT HANDLERS
// ============================================================================

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(
  RandomLabCasesQuerySchema,
  async ({ env, auth, validated, request }) => {
    const log = createEndpointLogger('/api/labs/cases/random', auth.userId);
    let prisma: EdgePrismaClient | null = null;

    try {
      prisma = createEdgePrismaClient(env.DATABASE_URL);

      const url = new URL(request.url);
      const count = Math.min(parseInt(url.searchParams.get('count') || '1'), 10); // Cap at 10
      const difficulty = url.searchParams.get('difficulty');

      log.info('Fetching random lab cases', { count, difficulty: difficulty || 'all' });

      // Build WHERE clause for raw query if difficulty filter is provided
      let cases;
      if (difficulty) {
        cases = await prisma.$queryRaw`
          SELECT * FROM "LabCase"
          WHERE "difficulty" = ${difficulty}
          ORDER BY RANDOM()
          LIMIT ${count}
        `;
      } else {
        cases = await prisma.$queryRaw`
          SELECT * FROM "LabCase"
          ORDER BY RANDOM()
          LIMIT ${count}
        `;
      }

      log.info('Random lab cases fetched successfully', {
        count: Array.isArray(cases) ? cases.length : 0,
      });

      return {
        data: {
          success: true,
          data: cases,
        },
      };
    } catch (error) {
      log.error('Error fetching random lab cases', error);
      return {
        status: 500,
        error: 'Failed to fetch random lab cases',
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);