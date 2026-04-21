/**
 * GET /api/reference/procedures/:id
 * Fetch a single procedure by ID with related conditions
 *
 * Security: Sprint 3 - Secured with authenticatedEndpoint middleware
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

const ProcedureByIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid procedure ID format'),
  }),
});

// ============================================================================
// ENDPOINT HANDLERS
// ============================================================================

export const onRequestGet = authenticatedEndpoint(
  ProcedureByIdSchema,
  async ({ env, auth, validated, params }) => {
    const log = createEndpointLogger('/api/reference/procedures/[id]', auth.userId);
    let prisma: EdgePrismaClient | null = null;

    try {
      prisma = createEdgePrismaClient(env.DATABASE_URL);

      const id = validated?.params?.id || params?.id;

      if (!id) {
        log.warn('Missing procedure ID');
        return { status: 400, error: 'Procedure ID is required' };
      }

      log.info('Fetching procedure', { id });

      const result = await prisma.procedure.findUnique({
        where: { id },
        include: {
          ProcedureConditionLink: {
            include: { Condition: { select: { id: true, name: true } } },
          },
        },
      });

      if (!result) {
        log.warn('Procedure not found', { id });
        return { status: 404, error: 'Procedure not found' };
      }

      const conditions =
        result.ProcedureConditionLink?.map((l) => l.Condition).filter(Boolean) ?? [];
      log.info('Procedure fetched successfully', {
        id,
        conditionCount: conditions.length,
      });
      return {
        data: {
          success: true,
          data: { ...result, conditions },
        },
      };
    } catch (error) {
      log.error('Failed to fetch procedure', error);
      return { status: 500, error: 'Failed to fetch procedure' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
