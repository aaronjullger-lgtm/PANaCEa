/**
 * API: Get OSCE chat history for a session
 * GET /api/osce/history?sessionId={sessionId}
 *
 * Security: Sprint 3 - Migrated to authenticatedEndpoint middleware
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors, withMiddleware, withAuth, withErrorHandling, withLogging } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { IDSchema } from '../_shared/schemas';

// Schema for history query params
const OSCEHistoryQuerySchema = z.object({
  query: z.object({
    sessionId: IDSchema,
    limit: z.coerce.number().int().min(1).max(500).default(100),
  }),
});

export const onRequestOptions = withCors();

export const onRequestGet = withMiddleware(
  withCors(),
  withErrorHandling(),
  withAuth(),
  withLogging(),
  async (context: any) => {
    const { env, auth } = context;
    const log = createEndpointLogger('/api/osce/history', auth.userId);
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      const url = new URL(context.request.url);
      const sessionId = url.searchParams.get('sessionId');
      const limitParam = url.searchParams.get('limit') || '100';

      // Validate query params
      const validation = OSCEHistoryQuerySchema.safeParse({
        query: {
          sessionId: sessionId || '',
          limit: limitParam,
        },
      });

      if (!validation.success) {
        log.warn('Validation failed', { errors: validation.error.issues });
        return {
          status: 400,
          error: `Validation failed: ${validation.error.issues.map((e) => e.message).join('; ')}`,
        };
      }

      const { sessionId: validSessionId, limit } = validation.data.query;
      log.info('Fetching OSCE history', { sessionId: validSessionId, limit });

      const history = await prisma.encounterChatHistory.findMany({
        where: { sessionId: validSessionId },
        orderBy: { timestamp: 'asc' },
        take: limit,
      });

      log.info('History fetched successfully', { count: history.length });
      return { data: { history } };
    } catch (error: any) {
      log.error('Error fetching chat history', error);
      return { status: 500, error: 'Failed to fetch chat history' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);