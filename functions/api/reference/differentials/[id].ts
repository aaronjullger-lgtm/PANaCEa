/**
 * Differential Diagnosis Detail API
 * GET /api/reference/differentials/:id
 *
 * Fetches a single differential diagnosis by ID
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

const DifferentialDetailSchema = z.object({
  params: z
    .object({
      id: z.string().uuid('Invalid differential ID format'),
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
  DifferentialDetailSchema,
  async ({ env, auth, params }) => {
    const log = createEndpointLogger('/api/reference/differentials/[id]', auth.userId);
    let prisma: EdgePrismaClient | null = null;

    try {
      const { id } = params;

      if (!id) {
        return {
          status: 400,
          error: 'Differential diagnosis ID is required',
        };
      }

      prisma = createEdgePrismaClient(env.DATABASE_URL);

      log.info('Fetching differential diagnosis detail', { id });

      const result = await prisma.differentialDiagnosis.findUnique({
        where: { id },
      });

      if (!result) {
        log.warn('Differential diagnosis not found', { id });
        return {
          status: 404,
          error: 'Differential diagnosis not found',
        };
      }

      log.info('Differential diagnosis fetch successful', { id });

      return {
        data: {
          success: true,
          data: result,
        },
      };
    } catch (error) {
      log.error('Error fetching differential diagnosis', error);
      return {
        status: 500,
        error: 'Failed to fetch differential diagnosis',
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
