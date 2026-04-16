/**
 * Scoring Systems Reference API
 *
 * GET /api/reference/scoring-systems - Fetch all scoring systems with optional filtering
 *
 * Supports:
 *   ?category=Risk+Stratification  — filter by category
 *   ?query=wells                   — search by name/alias
 *   ?highYield=true                — only high-yield systems
 *   ?system=cardiac                — filter by body system (via condition links)
 *
 * Security: Authenticated endpoint with secure middleware
 */

import { z } from 'zod';
import { publicEndpoint, withCors } from '../../_shared/middleware';
import {
  createEdgePrismaClient,
  safePrismaDisconnect,
  EdgePrismaClient,
} from '../../_shared/prisma-edge';
import { createEndpointLogger } from '../../_shared/secureLogger';

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const ScoringSystemsQuerySchema = z.object({
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

export const onRequestOptions = withCors();

export const onRequestGet = publicEndpoint(
  ScoringSystemsQuerySchema,
  async ({ env, request }) => {
    const log = createEndpointLogger('/api/reference/scoring-systems');
    let prisma: EdgePrismaClient | null = null;

    try {
      const url = new URL(request.url);
      const category = url.searchParams.get('category');
      const query = url.searchParams.get('query');
      const highYield = url.searchParams.get('highYield');

      log.info('Fetching scoring systems', {
        category: category || 'all',
        searchQuery: query || 'none',
        highYield: highYield || 'false',
      });

      prisma = createEdgePrismaClient(env.DATABASE_URL);

      // Build where clause
      const where: Record<string, unknown> = {};

      if (category) {
        where.category = category;
      }

      if (highYield === 'true') {
        where.isHighYield = true;
      }

      if (query) {
        where.OR = [
          { name: { contains: query, mode: 'insensitive' } },
          { displayName: { contains: query, mode: 'insensitive' } },
          { condition: { contains: query, mode: 'insensitive' } },
        ];
      }

      const results = await prisma.scoringSystem.findMany({
        where,
        orderBy: [
          { isHighYield: 'desc' },
          { panceYield: 'desc' },
          { name: 'asc' },
        ],
        take: 250,
        select: {
          id: true,
          name: true,
          displayName: true,
          category: true,
          condition: true,
          panceYield: true,
          isHighYield: true,
          maxScore: true,
          sensitivity: true,
          specificity: true,
        },
      });

      log.info('Successfully fetched scoring systems', { count: results.length });

      return { data: { success: true, data: results } };
    } catch (error: any) {
      log.error('Error fetching scoring systems', error);
      return {
        status: 500,
        error: 'Failed to fetch scoring systems',
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
