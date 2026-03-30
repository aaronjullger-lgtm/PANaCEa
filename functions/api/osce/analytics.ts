/**
 * API: OSCE analytics by organ system
 * GET /api/osce/analytics
 *
 * Returns aggregate OSCE performance broken down by organ system.
 * Groups completed sessions by the case's organ system and calculates:
 * - count, average score, average clinical reasoning score, pass rate
 * - recent trend (last 10 sessions)
 * - weakest and strongest systems
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { resolveUserByClerkId } from '../_shared/resolveUser';

const PASS_THRESHOLD = 70;

const Schema = z.object({ query: z.object({}).optional() });

/**
 * Infer the organ system from a patient case's chief complaint and diagnosis
 * using regex pattern matching.
 */
function inferSystemFromCase(chiefComplaint: string, correctDiagnosis: string): string {
  const text = `${chiefComplaint} ${correctDiagnosis}`.toLowerCase();

  if (/\b(heart|cardiac|chest pain|acs|mi|coronary|chf|heart failure|decompensated)\b/.test(text))
    return 'cardiovascular';
  if (/\b(dvt|deep vein|thrombosis|embol)\b/.test(text)) return 'cardiovascular';
  if (/\b(lung|pulmonary|dyspnea|copd|asthma|pe|wheez)\b/.test(text)) return 'pulmonary';
  if (/\b(gi|abdominal|hepatic|pancreat|appendic)\b/.test(text)) return 'gastrointestinal';
  if (/\b(neuro|stroke|seizure|headache|weakness|slurred|aphasia|tia)\b/.test(text))
    return 'neurological';
  if (/\b(renal|kidney|aki|ckd|urosepsis)\b/.test(text)) return 'nephrology';
  if (/\b(infection|sepsis|uti|pneumonia|cellulitis|meningit)\b/.test(text))
    return 'infectious_disease';
  if (/\b(diabetes|diabetic|dka|ketoacidosis|hyperglycemi)\b/.test(text)) return 'endocrine';
  if (/\b(ectopic|pregnan|obstetric|gynecolog|ovarian)\b/.test(text)) return 'reproductive';
  if (/\b(psych|depression|anxiety|suicid|bipolar|schizo)\b/.test(text)) return 'psychiatry';
  if (/\b(anemia|leukemia|lymphoma|coagul|thrombocytop)\b/.test(text)) return 'hematology';
  if (/\b(fracture|orthoped|musculoskel|joint|back pain)\b/.test(text)) return 'musculoskeletal';
  if (/\b(dermat|rash|skin|wound|burn)\b/.test(text)) return 'dermatology';

  return 'general';
}

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(Schema, async (context) => {
  const { env, auth } = context;
  const log = createEndpointLogger('/api/osce/analytics', auth.userId);
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const user = await resolveUserByClerkId(prisma, auth.userId);
    if (!user) {
      log.warn('User not found', { clerkId: auth.userId });
      return { status: 404, error: 'User not found' };
    }

    // Fetch all completed sessions with their case and OSCE result
    const sessions = await prisma.patientEncounterSession.findMany({
      where: { userId: user.id, status: 'completed' },
      select: {
        id: true,
        caseId: true,
        startTime: true,
        PatientEncounterCase: {
          select: {
            chiefComplaint: true,
            correctDiagnosis: true,
            targetSystem: true,
          },
        },
        OsceResult: {
          select: {
            score: true,
            clinicalReasoningScore: true,
            communicationScore: true,
            differentialScore: true,
            dangerousActionsDetected: true,
          },
        },
      },
      orderBy: { startTime: 'asc' },
    });

    // Filter sessions with valid OsceResult
    const withScores = sessions.filter((s) => {
      if (!s.OsceResult) {
        log.debug('Session missing OsceResult', { sessionId: s.id });
        return false;
      }
      if (!s.PatientEncounterCase) {
        log.debug('Session missing PatientEncounterCase', { sessionId: s.id });
        return false;
      }
      return true;
    });

    // Group by system
    type SystemEntry = {
      scores: number[];
      clinicalScores: number[];
      commScores: number[];
      diffScores: number[];
      dangerousActionCount: number;
      passed: number;
      total: number;
    };
    const bySystemMap = new Map<string, SystemEntry>();

    for (const session of withScores) {
      const pec = session.PatientEncounterCase!;
      // Prefer stored targetSystem; fall back to regex inference
      const system = (pec as { targetSystem?: string | null }).targetSystem
        || inferSystemFromCase(pec.chiefComplaint, pec.correctDiagnosis);

      const result = session.OsceResult;
      const score = result?.score ?? 0;
      const clinicalScore = result?.clinicalReasoningScore ?? 0;
      const isPassed = score >= PASS_THRESHOLD ? 1 : 0;

      if (!bySystemMap.has(system)) {
        bySystemMap.set(system, {
          scores: [], clinicalScores: [], commScores: [], diffScores: [],
          dangerousActionCount: 0, passed: 0, total: 0,
        });
      }

      const entry = bySystemMap.get(system)!;
      entry.scores.push(score);
      entry.clinicalScores.push(clinicalScore);
      if (typeof result?.communicationScore === 'number') entry.commScores.push(result.communicationScore);
      if (typeof result?.differentialScore === 'number') entry.diffScores.push(result.differentialScore);
      if (Array.isArray(result?.dangerousActionsDetected)) {
        entry.dangerousActionCount += (result.dangerousActionsDetected as unknown[]).length;
      }
      entry.passed += isPassed;
      entry.total += 1;
    }

    const avg = (arr: number[]) => arr.length > 0 ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null;

    // Build bySystem array
    const bySystem = Array.from(bySystemMap.entries())
      .map(([system, data]) => ({
        system,
        count: data.total,
        averageScore: avg(data.scores) ?? 0,
        averageClinicalReasoning: avg(data.clinicalScores) ?? 0,
        averageCommunicationScore: avg(data.commScores),
        averageDifferentialScore: avg(data.diffScores),
        dangerousActionCount: data.dangerousActionCount,
        passRate: data.total > 0 ? Math.round((data.passed / data.total) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    // Build recent trend (last 10 sessions)
    const recentTrend = withScores
      .slice(-10)
      .map((s) => {
        const pc = s.PatientEncounterCase!;
        return {
          date: s.startTime.toISOString(),
          score: s.OsceResult?.score ?? 0,
          system: (pc as { targetSystem?: string | null }).targetSystem
            || inferSystemFromCase(pc.chiefComplaint, pc.correctDiagnosis),
        };
      });

    // Find weakest and strongest systems
    let weakestSystem: string | null = null;
    let strongestSystem: string | null = null;

    if (bySystem.length > 0) {
      weakestSystem = bySystem.reduce((min, curr) =>
        curr.averageScore < min.averageScore ? curr : min
      ).system;
      strongestSystem = bySystem.reduce((max, curr) =>
        curr.averageScore > max.averageScore ? curr : max
      ).system;
    }

    return {
      data: {
        bySystem,
        recentTrend,
        weakestSystem,
        strongestSystem,
      },
    };
  } catch (e) {
    log.error('OSCE analytics error', e);
    return { status: 500, error: 'Failed to load OSCE analytics' };
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
