/**
 * ECG Pattern Detail API
 * GET /api/reference/ecg/:id
 *
 * Fetches a single ECG pattern by ID
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

const ECGDetailSchema = z.object({
  params: z
    .object({
      id: z.string().uuid('Invalid ECG pattern ID format'),
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
  ECGDetailSchema,
  async ({ env, auth, params }) => {
    const log = createEndpointLogger('/api/reference/ecg/[id]', auth.userId);
    let prisma: EdgePrismaClient | null = null;

    try {
      const { id } = params;

      if (!id) {
        return {
          status: 400,
          error: 'ECG pattern ID is required',
        };
      }

      prisma = createEdgePrismaClient(env.DATABASE_URL);

      log.info('Fetching ECG pattern detail', { id });

      const result = await prisma.eCGPattern.findUnique({
        where: { id },
      });

      if (!result) {
        log.warn('ECG pattern not found', { id });
        return {
          status: 404,
          error: 'ECG pattern not found',
        };
      }

      log.info('ECG pattern fetch successful', { id });

      return {
        data: {
          success: true,
          data: result,
        },
      };
    } catch (error) {
      log.error('Error fetching ECG pattern', error);
      return {
        status: 500,
        error: 'Failed to fetch ECG pattern',
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
