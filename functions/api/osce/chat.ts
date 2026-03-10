/**
 * API: Save OSCE chat message
 * POST /api/osce/chat
 *
 * Security: Sprint 3 - Migrated to authenticatedEndpoint middleware
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { resolveUserByClerkId } from '../_shared/resolveUser';
import { IDSchema } from '../_shared/schemas';

// Schema for OSCE chat messages
const OSCEChatBodySchema = z.object({
  body: z.object({
    sessionId: IDSchema,
    messages: z
      .array(
        z.object({
          role: z.enum(['user', 'assistant', 'system']),
          content: z.string().max(10000),
        })
      )
      .min(1)
      .max(100),
  }),
});

export const onRequestOptions = withCors();

export const onRequestPost = authenticatedEndpoint(
  OSCEChatBodySchema,
  async ({ env, validated, auth }) => {
    const log = createEndpointLogger('/api/osce/chat', auth.userId);
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      const { sessionId, messages } = validated.body;
      log.info('Saving OSCE chat', { sessionId, messageCount: messages.length });

      // Ensure the session belongs to the authenticated user
      const user = await resolveUserByClerkId(prisma, auth.userId);

      if (!user) {
        log.warn('User not found for chat save', { clerkId: auth.userId });
        return { status: 404, error: 'User not found' };
      }

      const session = await prisma.patientEncounterSession.findFirst({
        where: { id: sessionId, userId: user.id },
        select: { id: true },
      });

      if (!session) {
        log.warn('Session not found or not owned by user for chat save', {
          sessionId,
          userId: user.id,
        });
        return { status: 404, error: 'Session not found' };
      }

      const updated = await prisma.patientEncounterSession.updateMany({
        where: { id: sessionId, userId: user.id },
        data: {
          messages,
          updatedAt: new Date(),
        },
      });

      if (updated.count === 0) {
        log.warn('Race: session not updated (ownership)', { sessionId });
        return { status: 404, error: 'Session not found' };
      }

      log.info('Chat saved successfully', { sessionId });
      return { data: { success: true } };
    } catch (error: any) {
      log.error('Error saving chat message', error);
      return { status: 500, error: 'Failed to save chat message' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
