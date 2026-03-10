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
    // NEW: Optional analytics data from Module 4
    soapComparison: z.any().optional(),
    timingAnalytics: z.any().optional(),
    infographics: z.array(z.string()).optional(),
  }),
});

export const onRequestOptions = withCors();

export const onRequestPost = authenticatedEndpoint(
  OSCECompleteBodySchema,
  async ({ env, validated, auth }) => {
    const log = createEndpointLogger('/api/osce/complete', auth.userId);
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      const { sessionId, diagnosis, treatmentPlan, soapComparison, timingAnalytics, infographics } =
        validated.body;
      log.info('Completing OSCE session', { sessionId });

      const user = await resolveUserByClerkId(prisma, auth.userId);

      if (!user) {
        log.warn('User not found for OSCE complete', { clerkId: auth.userId });
        return { status: 404, error: 'User not found' };
      }

      // Fetch the session first to check status and ensure idempotency
      const session = await prisma.patientEncounterSession.findUnique({
        where: { id: sessionId, userId: user.id },
        select: { status: true }
      });

      if (!session) {
        log.warn('Session not found on complete', { sessionId, userId: user.id });
        return { status: 404, error: 'Session not found' };
      }

      if (session.status === 'completed') {
        log.info('Session already completed, idempotent success', { sessionId });
        return { data: { success: true, alreadyCompleted: true } };
      }

      const updated = await prisma.patientEncounterSession.updateMany({
        where: { id: sessionId, userId: user.id },
        data: {
          status: 'completed',
          diagnosis,
          treatmentPlan,
          completedAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Since we already checked the session exists and is active, count should be 1
      if (updated.count === 0) {
        // This should not happen, but guard against race conditions
        log.error('Race condition: session not updated after status check', { sessionId });
        return { status: 500, error: 'Internal server error' };
      }

      // NEW: Create CaseFile if analytics provided (Module 4)
      if (soapComparison || timingAnalytics) {
        try {
          await prisma.caseFile.create({
            data: {
              sessionId,
              soapComparison: soapComparison || {},
              timingAnalytics: timingAnalytics || {},
              infographics: infographics || [],
            },
          });
          log.info('CaseFile created', { sessionId });
        } catch (caseFileError) {
          // Non-blocking: log but don't fail the request
          log.warn('Failed to create CaseFile', { error: caseFileError });
        }
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
