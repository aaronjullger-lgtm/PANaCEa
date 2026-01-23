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

      await prisma.patientEncounterSession.update({
        where: { id: sessionId },
        data: {
          messages: messages,
          updatedAt: new Date(),
        },
      });

      log.info('Chat saved successfully');
      return { data: { success: true } };
    } catch (error: any) {
      log.error('Error saving chat message', error);
      return { status: 500, error: 'Failed to save chat message' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
