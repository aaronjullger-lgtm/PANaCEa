/**
 * Special Tests Reference API
 *
 * GET /api/reference/special-tests - Fetch special tests (orthopedic, neurologic, etc.)
 * Query params: system (optional)
 *
 * Security: authenticatedEndpoint with Zod validation
 */

import { z } from 'zod';
import { authenticatedEndpoint } from '../_shared/middleware';
import {
  createEdgePrismaClient,
  safePrismaDisconnect,
  EdgePrismaClient,
} from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

// ============================================================================
// SCHEMA DEFINITIONS
// ============================================================================

const GetSpecialTestsSchema = z.object({
  query: z
    .object({
      system: z.string().optional(),
      region: z.string().optional(),
      query: z.string().max(200).optional(),
      highYield: z.string().optional(),
    })
    .optional(),
});

// ============================================================================
// ENDPOINT HANDLERS
// ============================================================================

export const onRequestGet = authenticatedEndpoint(
  GetSpecialTestsSchema,
  async ({ env, auth, validated }) => {
    const log = createEndpointLogger('/api/reference/special-tests', auth.userId);
    let prisma: EdgePrismaClient | null = null;

    try {
      log.info('Fetching special tests', { system: validated?.query?.system });

      if (!env.DATABASE_URL) {
        log.error('Database not configured');
        return { status: 500, error: 'Database not configured' };
      }

      prisma = createEdgePrismaClient(env.DATABASE_URL);
      const system = validated?.query?.system;
      const region = validated?.query?.region;
      const searchQuery = validated?.query?.query;
      const highYield = validated?.query?.highYield;

      const where: any = {};
      if (system) where.system = system;
      if (region) where.region = region;
      // Note: SpecialTest model does not have isHighYield field — param accepted but not filterable
      if (searchQuery) {
        where.OR = [
          { name: { contains: searchQuery, mode: 'insensitive' } },
          { description: { contains: searchQuery, mode: 'insensitive' } },
          { region: { contains: searchQuery, mode: 'insensitive' } },
        ];
      }

      const results = await prisma.specialTest.findMany({
        where: Object.keys(where).length > 0 ? where : undefined,
        include: { Condition: { select: { id: true, name: true } } },
        orderBy: [{ name: 'asc' }],
      });

      log.info('Special tests fetched successfully', { count: results.length });
      return { data: { success: true, data: results } };
    } catch (error: any) {
      log.error('Error fetching special tests', error);
      return {
        status: 500,
        error: 'Failed to fetch special tests',
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
