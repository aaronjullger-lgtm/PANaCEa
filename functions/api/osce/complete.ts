/**
 * API: Complete OSCE session
 * POST /api/osce/complete
 *
 * Security: Sprint 3 - Migrated to authenticatedEndpoint middleware
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { IDSchema } from '../_shared/schemas';

// Schema for OSCE completion
const OSCECompleteBodySchema = z.object({
  body: z.object({
    sessionId: IDSchema,
    diagnosis: z.string().max(2000).optional(),
    treatmentPlan: z.string().max(5000).optional(),
  }),
});

export const onRequestOptions = withCors();

export const onRequestPost = authenticatedEndpoint(
  OSCECompleteBodySchema,
  async ({ env, validated, auth }) => {
    const log = createEndpointLogger('/api/osce/complete', auth.userId);
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      const { sessionId, diagnosis, treatmentPlan } = validated.body;
      log.info('Completing OSCE session', { sessionId });

      await prisma.patientEncounterSession.update({
        where: { id: sessionId },
        data: {
          status: 'completed',
          diagnosis,
          treatmentPlan,
          updatedAt: new Date(),
        },
      });

      log.info('OSCE session completed successfully');
      return { data: { success: true } };
    } catch (error: any) {
      log.error('Error completing OSCE session', error);
      return { status: 500, error: 'Internal server error' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
