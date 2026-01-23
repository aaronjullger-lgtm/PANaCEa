/**
 * Anatomy Reference Index API
 * GET /api/reference/anatomy
 *
 * Lists and searches anatomy structures, optionally filtered by system
 *
 * Sprint: Security Hardening Sprint 3
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

const AnatomyQuerySchema = z.object({
  query: z
    .object({
      system: z.string().max(100).optional(),
      query: z.string().max(200).optional(),
    })
    .optional(),
});

// ============================================================================
// CORS HANDLER
// ============================================================================

export const onRequestOptions = withCors();

// ============================================================================
// GET HANDLER
// ============================================================================

export const onRequestGet = authenticatedEndpoint(
  AnatomyQuerySchema,
  async ({ env, auth, validated, request }) => {
    const log = createEndpointLogger('/api/reference/anatomy', auth.userId);
    let prisma: EdgePrismaClient | null = null;

    try {
      prisma = createEdgePrismaClient(env.DATABASE_URL);

      const url = new URL(request.url);
      const system = url.searchParams.get('system');
      const query = url.searchParams.get('query');

      let results;

      if (query) {
        // Search mode
        log.info('Searching anatomy structures', { query });
        results = await prisma.anatomyStructure.findMany({
          where: {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { description: { contains: query, mode: 'insensitive' } },
            ],
          },
          take: 10,
        });
      } else {
        // List mode with optional system filter
        log.info('Listing anatomy structures', { system });
        results = await prisma.anatomyStructure.findMany({
          where: system ? { system } : undefined,
          include: { conditions: { select: { id: true, name: true } } },
          orderBy: { name: 'asc' },
        });
      }

      log.info('Anatomy fetch successful', { count: results.length });

      return {
        data: {
          success: true,
          data: results,
        },
      };
    } catch (error) {
      log.error('Error fetching anatomy', error);
      return {
        status: 500,
        error: 'Failed to fetch anatomy structures',
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
