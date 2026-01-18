/**
 * Single Lab Test Reference API
 * 
 * GET /api/reference/labs/:id - Fetch a single lab test by ID
 * 
 * Security: Sprint 3 - Authenticated endpoint with secure middleware
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect, EdgePrismaClient } from '../../_shared/prisma-edge';
import { createEndpointLogger } from '../../_shared/secureLogger';

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const LabByIdSchema = z.object({
  query: z.object({}).optional(),
  body: z.object({}).optional(),
  params: z.object({
    id: z.string().uuid('Invalid lab test ID format'),
  }),
});

// ============================================================================
// HANDLERS
// ============================================================================

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(LabByIdSchema, async ({ env, auth, params }) => {
  const log = createEndpointLogger('/api/reference/labs/[id]', auth.userId);
  let prisma: EdgePrismaClient | null = null;

  try {
    const { id } = params;

    log.info('Fetching lab test by ID', { labId: id });

    prisma = createEdgePrismaClient(env.DATABASE_URL);

    const result = await prisma.labTest.findUnique({
      where: { id },
    });

    if (!result) {
      log.warn('Lab test not found', { labId: id });
      return {
        status: 404,
        error: 'Lab test not found',
      };
    }

    log.info('Successfully fetched lab test', { labId: id });

    return { data: { success: true, data: result } };
  } catch (error: any) {
    log.error('Error fetching lab', error);
    return {
      status: 500,
      error: 'Failed to fetch lab',
    };
  } finally {
    await safePrismaDisconnect(prisma);
  }
});