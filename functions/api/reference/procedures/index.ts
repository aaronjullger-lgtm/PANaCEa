/**
 * GET /api/reference/procedures
 * Fetch all procedures, optionally filtered by category, system, or search query
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

const ProceduresQuerySchema = z.object({
  query: z
    .object({
      category: z.string().max(100).optional(),
      system: z.string().max(100).optional(),
      query: z.string().max(200).optional(),
    })
    .optional(),
});

// ============================================================================
// ENDPOINT HANDLERS
// ============================================================================

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(
  ProceduresQuerySchema,
  async ({ env, auth, validated }) => {
    const log = createEndpointLogger('/api/reference/procedures', auth.userId);
    let prisma: EdgePrismaClient | null = null;

    try {
      prisma = createEdgePrismaClient(env.DATABASE_URL);

      const category = validated?.query?.category;
      const system = validated?.query?.system;
      const searchQuery = validated?.query?.query;

      let results;

      if (searchQuery) {
        // Search mode
        log.info('Searching procedures', { searchQuery });
        results = await prisma.procedure.findMany({
          where: {
            OR: [
              { name: { contains: searchQuery, mode: 'insensitive' } },
              { description: { contains: searchQuery, mode: 'insensitive' } },
              { indication: { contains: searchQuery, mode: 'insensitive' } },
            ],
          },
          orderBy: { name: 'asc' },
          take: 20,
        });
      } else {
        // List mode with optional filters
        log.info('Listing procedures', { category: category || 'all', system: system || 'all' });

        const where: any = {};
        if (category) where.category = category;
        if (system) where.system = system;

        results = await prisma.procedure.findMany({
          where: Object.keys(where).length > 0 ? where : undefined,
          orderBy: { name: 'asc' },
        });
      }

      log.info('Procedures fetched', { count: results.length });
      return { data: { success: true, data: results } };
    } catch (error) {
      log.error('Failed to fetch procedures', error);
      return { status: 500, error: 'Failed to fetch procedures' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
