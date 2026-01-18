/**
 * API: Create or get active OSCE session
 * POST /api/osce/session
 *
 * Security: Sprint 3 - Migrated to authenticatedEndpoint middleware
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { IDSchema } from '../_shared/schemas';

// Schema for OSCE session creation
const OSCESessionBodySchema = z.object({
  body: z.object({
    caseId: IDSchema,
  }),
});

export const onRequestOptions = withCors();

export const onRequestPost = authenticatedEndpoint(
  OSCESessionBodySchema,
  async ({ env, validated, auth }) => {
    const log = createEndpointLogger('/api/osce/session', auth.userId);
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      const { caseId } = validated.body;
      log.info('Creating OSCE session', { caseId });

      const user = await prisma.user.findUnique({
        where: { clerkId: auth.userId },
      });

      if (!user) {
        log.warn('User not found');
        return { status: 404, error: 'User not found' };
      }

      // Check for existing active session for this case
      const existingSession = await prisma.patientEncounterSession.findFirst({
        where: {
          userId: user.id,
          caseId: caseId,
          status: 'active',
        },
      });

      if (existingSession) {
        log.info('Returning existing session', { sessionId: existingSession.id });
        return { data: { success: true, session: existingSession } };
      }

      // Create new session
      const session = await prisma.patientEncounterSession.create({
        data: {
          userId: user.id,
          caseId,
          messages: [],
          status: 'active',
        },
      });

      log.info('Created new OSCE session', { sessionId: session.id });
      return { data: { success: true, session } };
    } catch (error: any) {
      log.error('Error creating OSCE session', error);
      return { status: 500, error: 'Internal server error' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);