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

      // NEW: Load case data to check for state machine
      const caseData = await prisma.patientEncounterCase.findUnique({
        where: { id: caseId },
        select: { id: true, stateMachine: true },
      });

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

        // NEW: Return enhanced session info
        const wsUrl = env.VOICE_WEBSOCKET_URL
          ? `${env.VOICE_WEBSOCKET_URL}/voice/${existingSession.id}`
          : null;

        return {
          data: {
            success: true,
            session: existingSession,
            wsUrl,
            features: {
              voiceModeAvailable: !!env.VOICE_WEBSOCKET_URL,
              stateMachineAvailable: false, // Would need to check case
              realtimeSOAPAvailable: true,
              timingAnalyticsAvailable: true,
            },
          },
        };
      }

      // Create new session
      const sessionId = `osce-${user.id.slice(0, 8)}-${Date.now()}`;
      const now = new Date();
      const session = await prisma.patientEncounterSession.create({
        data: {
          id: sessionId,
          userId: user.id,
          caseId,
          startTime: now,
          updatedAt: now,
          messages: [],
          status: 'active',
        },
      });

      log.info('Created new OSCE session', { sessionId: session.id });

      // NEW: Prepare WebSocket URL for voice mode (if PatientVoiceSession deployed)
      const wsUrl = env.VOICE_WEBSOCKET_URL
        ? `${env.VOICE_WEBSOCKET_URL}/voice/${session.id}`
        : null;

      return {
        data: {
          success: true,
          session,
          wsUrl, // NEW: Voice mode WebSocket URL
          features: {
            // NEW: Available features for this session
            voiceModeAvailable: !!env.VOICE_WEBSOCKET_URL,
            stateMachineAvailable: !!caseData?.stateMachine,
            realtimeSOAPAvailable: true,
            timingAnalyticsAvailable: true,
          },
        },
      };
    } catch (error: any) {
      log.error('Error creating OSCE session', error);
      return { status: 500, error: 'Internal server error' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
