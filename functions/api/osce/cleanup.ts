/**
 * API: Delete OSCE chat history for a session
 * DELETE /api/osce/cleanup?sessionId={sessionId}
 * POST /api/osce/cleanup?sessionId={sessionId}
 *
 * Security: Sprint 3 - Migrated to authenticatedEndpoint middleware
 */

import { z } from 'zod';
import {
  withCors,
  withMiddleware,
  withAuth,
  withErrorHandling,
  withLogging,
} from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { IDSchema } from '../_shared/schemas';

// Schema for cleanup (body or query param)
const CleanupBodySchema = z.object({
  sessionId: IDSchema.optional(),
});

export const onRequestOptions = withCors();

// Shared cleanup handler
async function handleCleanup(context: any) {
  const { env, auth, request } = context;
  const log = createEndpointLogger('/api/osce/cleanup', auth.userId);
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    // Try to get sessionId from query param first
    const url = new URL(request.url);
    let sessionId = url.searchParams.get('sessionId');

    // Try body if not in query params (for POST)
    if (!sessionId && request.method === 'POST') {
      try {
        const body = await request.clone().json();
        const validation = CleanupBodySchema.safeParse(body);
        if (validation.success && validation.data.sessionId) {
          sessionId = validation.data.sessionId;
        }
      } catch {
        // No body or invalid JSON, continue with query param check
      }
    }

    if (!sessionId) {
      log.warn('Missing sessionId parameter');
      return { status: 400, error: 'Missing sessionId parameter' };
    }

    // Validate sessionId format
    const idValidation = IDSchema.safeParse(sessionId);
    if (!idValidation.success) {
      log.warn('Invalid sessionId format', { sessionId });
      return { status: 400, error: 'Invalid sessionId format' };
    }

    log.info('Cleaning up OSCE chat history', { sessionId });

    // Chat history is stored in PatientEncounterSession.messages; clear it for this session
    const updated = await prisma.patientEncounterSession.updateMany({
      where: { id: sessionId },
      data: { messages: [] },
    });

    log.info('Cleanup completed', { updated: updated.count });
    return {
      data: {
        deleted: updated.count,
        message: `Cleared chat messages for session ${sessionId}`,
      },
    };
  } catch (error: any) {
    log.error('Error deleting chat history', error);
    return { status: 500, error: 'Failed to delete chat history' };
  } finally {
    await safePrismaDisconnect(prisma);
  }
}

export const onRequestDelete = withMiddleware(
  withCors(),
  withErrorHandling(),
  withAuth(),
  withLogging(),
  handleCleanup
);

export const onRequestPost = withMiddleware(
  withCors(),
  withErrorHandling(),
  withAuth(),
  withLogging(),
  handleCleanup
);
