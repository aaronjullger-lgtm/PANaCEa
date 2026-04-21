/**
 * API: Get OSCE chat history for a session
 * GET /api/osce/history?sessionId={sessionId}&limit={limit}
 *
 * Query params (flat):
 * - sessionId (required): ID of the PatientEncounterSession
 * - limit (optional): max messages to return (1–500, default 100)
 *
 * Response: { data: { history: Array<{ role, content }> } }
 * Security: Session ownership enforced; returns 404 if session not found or not owned by caller.
 */

import { z } from 'zod';
import { authenticatedEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { resolveUserByClerkId } from '../_shared/resolveUser';
import { IDSchema } from '../_shared/schemas';

// Schema for history query params (flat keys from GET ?sessionId=...&limit=...)
const OSCEHistoryQuerySchema = z.object({
  sessionId: IDSchema,
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

export const onRequestGet = authenticatedEndpoint(
  OSCEHistoryQuerySchema,
  async (context) => {
    const { env, auth } = context;
    const log = createEndpointLogger('/api/osce/history', auth.userId);
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      const { sessionId: validSessionId, limit } = context.validated;
      log.info('Fetching OSCE history', { sessionId: validSessionId, limit });

      // Ensure the session belongs to the authenticated user
      const user = await resolveUserByClerkId(prisma, auth.userId);

      if (!user) {
        log.warn('User not found for OSCE history', { clerkId: auth.userId });
        return { status: 404, error: 'User not found' };
      }

      const session = await prisma.patientEncounterSession.findFirst({
        where: { id: validSessionId, userId: user.id },
        select: { messages: true, startTime: true, updatedAt: true },
      });

      if (!session) {
        log.warn('Session not found or not owned by user for history', {
          sessionId: validSessionId,
          userId: user.id,
        });
        return { status: 404, error: 'Session not found' };
      }

      const messages = Array.isArray(session.messages) ? session.messages : [];
      const history = messages.slice(-limit);

      log.info('History fetched successfully', { count: history.length });
      return { data: { history } };
    } catch (error: any) {
      log.error('Error fetching chat history', error);
      return { status: 500, error: 'Failed to fetch chat history' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { source: 'query', requestsPerMinute: 60 }
);
