/**
 * API: Complete OSCE session
 * POST /api/osce/complete
 *
 * Data isolation: Writes only to PatientEncounterSession (status, diagnosis, treatmentPlan).
 * Does NOT create ReviewLog. OSCE results are persisted to OsceResult via /api/osce/analysis/grade.
 * Security: Sprint 3 - Migrated to authenticatedEndpoint middleware
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { resolveUserByClerkId } from '../_shared/resolveUser';
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

      const user = await resolveUserByClerkId(prisma, auth.userId);

      if (!user) {
        log.warn('User not found for OSCE complete', { clerkId: auth.userId });
        return { status: 404, error: 'User not found' };
      }

      const updated = await prisma.patientEncounterSession.updateMany({
        where: { id: sessionId, userId: user.id },
        data: {
          status: 'completed',
          diagnosis,
          treatmentPlan,
          updatedAt: new Date(),
        },
      });

      if (updated.count === 0) {
        log.warn('No session updated on complete (not found or not owned by user)', {
          sessionId,
          userId: user.id,
        });
        return { status: 404, error: 'Session not found' };
      }

      log.info('OSCE session completed successfully', { sessionId });
      return { data: { success: true } };
    } catch (error: any) {
      log.error('Error completing OSCE session', error);
      return { status: 500, error: 'Internal server error' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
