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
    soapComparison: z.record(z.string(), z.unknown()).optional(),
    timingAnalytics: z.record(z.string(), z.unknown()).optional(),
    infographics: z.array(z.string()).optional(),
    // OSCE telemetry from useOSCEMetrics hook
    osceTelemetry: z.object({
      totalTimeMs: z.number().optional(),
      clinicalConfidenceIndex: z.number().min(1).max(4).optional(),
      redFlagsMissed: z.number().optional(),
      unnecessaryOrders: z.number().optional(),
      implicitRating: z.object({
        rating: z.number(),
        confidence: z.number(),
        components: z.record(z.string(), z.number()).optional(),
      }).optional(),
      efficiencyScore: z.number().optional(),
      speechMetrics: z.record(z.string(), z.unknown()).optional(),
      diagnosticEfficiency: z.record(z.string(), z.unknown()).optional(),
      rapportMetrics: z.record(z.string(), z.unknown()).optional(),
      actionCount: z.number().optional(),
    }).optional(),
  }),
});

export const onRequestOptions = withCors();

export const onRequestPost = authenticatedEndpoint(
  OSCECompleteBodySchema,
  async ({ env, validated, auth }) => {
    const log = createEndpointLogger('/api/osce/complete', auth.userId);
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      const { sessionId, diagnosis, treatmentPlan, soapComparison, timingAnalytics, infographics, osceTelemetry } =
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

      await prisma.patientEncounterSession.update({
        where: { id: sessionId },
        data: {
          status: 'completed',
          diagnosis,
          treatmentPlan,
          completedAt: new Date(),
          updatedAt: new Date(),
          // Persist OSCE telemetry for use in grading and analytics
          ...(osceTelemetry ? { osceTelemetry: osceTelemetry as unknown as object } : {}),
        },
      });

      // NOTE: CaseFile model removed — analytics data (soapComparison, timingAnalytics)
      // is now tracked via osceTelemetry on the session itself.

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
