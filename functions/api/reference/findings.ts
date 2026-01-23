/**
 * Physical Exam Findings Reference API
 *
 * GET /api/reference/findings - Fetch physical exam findings
 *
 * Security: Sprint 3 - Authenticated endpoint with secure middleware
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
// VALIDATION SCHEMAS
// ============================================================================

const FindingsQuerySchema = z.object({
  query: z
    .object({
      system: z.string().optional(),
    })
    .optional(),
  body: z.object({}).optional(),
  params: z.object({}).optional(),
});

// ============================================================================
// HANDLERS
// ============================================================================

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(
  FindingsQuerySchema,
  async ({ env, auth, request }) => {
    const log = createEndpointLogger('/api/reference/findings', auth.userId);
    let prisma: EdgePrismaClient | null = null;

    try {
      const url = new URL(request.url);
      const system = url.searchParams.get('system');

      log.info('Fetching physical exam findings', { system: system || 'all' });

      prisma = createEdgePrismaClient(env.DATABASE_URL);

      const results = await prisma.physicalExamFinding.findMany({
        where: system ? { system } : undefined,
        orderBy: { name: 'asc' },
      });

      log.info('Successfully fetched findings', { count: results.length });

      return { data: { success: true, data: results } };
    } catch (error: any) {
      log.error('Error fetching findings', error);
      return {
        status: 500,
        error: 'Failed to fetch findings',
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
