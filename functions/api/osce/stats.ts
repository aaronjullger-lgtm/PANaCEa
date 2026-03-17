/**
 * API: OSCE siloed stats (no FSRS/ReviewLog)
 * GET /api/osce/stats
 *
 * Returns performance metrics from OsceResult and PatientEncounterSession only.
 * Use for "Clinical Competency Trend" and pass rate; independent of FSRS/Forgetting Curve.
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { resolveUserByClerkId } from '../_shared/resolveUser';

const PASS_THRESHOLD = 70;

const Schema = z.object({ query: z.object({}).optional() });

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(Schema, async (context) => {
  const { env, auth } = context;
  const log = createEndpointLogger('/api/osce/stats', auth.userId);
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const user = await resolveUserByClerkId(prisma, auth.userId);
    if (!user) {
      log.warn('User not found', { clerkId: auth.userId });
      return { status: 404, error: 'User not found' };
    }

    const sessions = await prisma.patientEncounterSession.findMany({
      where: { userId: user.id, status: 'completed' },
      select: {
        id: true,
        startTime: true,
        OsceResult: {
          select: { score: true, clinicalReasoningScore: true }
        }
      },
      orderBy: { startTime: 'asc' },
    });

    const withScores = sessions.filter((s) => {
      if (!s.OsceResult) {
        log.debug('Session missing OsceResult', { sessionId: s.id });
        return false;
      }
      return true;
    });
    const total = withScores.length;
    const passed = withScores.filter((s) => {
      const score = s.OsceResult?.score ?? 0;
      if (score === 0 && !s.OsceResult?.score) {
        log.debug('Session has null score', { sessionId: s.id });
      }
      return score >= PASS_THRESHOLD;
    }).length;
    const avgScore =
      total > 0 ? withScores.reduce((sum, s) => sum + (s.OsceResult?.score ?? 0), 0) / total : null;
    const avgClinicalReasoning =
      total > 0
        ? withScores.reduce((sum, s) => sum + (s.OsceResult?.clinicalReasoningScore ?? 0), 0) /
          total
        : null;

    const trend = withScores.map((s) => ({
      sessionId: s.id,
      date: s.startTime.toISOString(),
      score: s.OsceResult?.score ?? 0,
      clinicalReasoningScore: s.OsceResult?.clinicalReasoningScore ?? 0,
    }));

    return {
      data: {
        totalEncounters: total,
        passRate: total > 0 ? Math.round((passed / total) * 100) : null,
        averageScore: typeof avgScore === 'number' ? Math.round(avgScore) : null,
        averageClinicalReasoningScore:
          typeof avgClinicalReasoning === 'number' ? Math.round(avgClinicalReasoning) : null,
        trend,
      },
    };
  } catch (e) {
    log.error('OSCE stats error', e);
    return { status: 500, error: 'Failed to load OSCE stats' };
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
