/**
 * GET /api/reference/history-components/:id
 * Fetch a single history component by ID
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

const HistoryComponentByIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid history component ID format'),
  }),
});

// ============================================================================
// ENDPOINT HANDLERS
// ============================================================================

export const onRequestGet = authenticatedEndpoint(
  HistoryComponentByIdSchema,
  async ({ env, auth, validated, params }) => {
    const log = createEndpointLogger('/api/reference/history-components/[id]', auth.userId);
    let prisma: EdgePrismaClient | null = null;

    try {
      prisma = createEdgePrismaClient(env.DATABASE_URL);

      const id = validated?.params?.id || params?.id;

      if (!id) {
        log.warn('Missing history component ID');
        return { status: 400, error: 'History component ID is required' };
      }

      log.info('Fetching history component', { id });

      const result = await prisma.historyComponent.findUnique({
        where: { id },
      });

      if (!result) {
        log.warn('History component not found', { id });
        return { status: 404, error: 'History component not found' };
      }

      log.info('History component fetched successfully', { id });
      return { data: { success: true, data: result } };
    } catch (error) {
      log.error('Failed to fetch history component', error);
      return { status: 500, error: 'Failed to fetch history component' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
