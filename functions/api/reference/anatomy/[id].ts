/**
 * Anatomy Structure Detail API
 * GET /api/reference/anatomy/:id
 *
 * Fetches a single anatomy structure by ID with related conditions
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

const AnatomyDetailSchema = z.object({
  params: z
    .object({
      id: z.string().uuid('Invalid anatomy structure ID format'),
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
  AnatomyDetailSchema,
  async ({ env, auth, params }) => {
    const log = createEndpointLogger('/api/reference/anatomy/[id]', auth.userId);
    let prisma: EdgePrismaClient | null = null;

    try {
      const { id } = params;

      if (!id) {
        return {
          status: 400,
          error: 'Anatomy structure ID is required',
        };
      }

      prisma = createEdgePrismaClient(env.DATABASE_URL);

      log.info('Fetching anatomy structure detail', { id });

      const result = await prisma.anatomyStructure.findUnique({
        where: { id },
        include: { Condition: { select: { id: true, name: true } } },
      });

      if (!result) {
        log.warn('Anatomy structure not found', { id });
        return {
          status: 404,
          error: 'Anatomy structure not found',
        };
      }

      log.info('Anatomy structure fetch successful', { id });

      return {
        data: {
          success: true,
          data: result,
        },
      };
    } catch (error) {
      log.error('Error fetching anatomy structure detail', error);
      return {
        status: 500,
        error: 'Failed to fetch anatomy structure',
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
