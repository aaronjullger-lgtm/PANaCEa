/**
 * API: Evaluate OSCE session using SPBench rubric
 * POST /api/osce/evaluate
 *
 * Purpose: Post-hoc SPBench 8-dimension rubric scoring via AI Gateway.
 * Model: Gemini 2.5 Pro (routed through unified AI Gateway).
 *
 * Feature-gated behind ENABLE_OSCE_BETA.
 */

import { z } from 'zod';
import { authenticatedEndpoint, type CloudflareContext } from '../_shared/middleware';
import { featureDisabledResponse, isFeatureEnabled } from '../_shared/feature-flags';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { resolveUserByClerkId } from '../_shared/resolveUser';
import { gateway, GatewayError, toGatewayContext } from '@/lib/ai/aiGateway';
import { SpbenchScoreSchema, SPBENCH_SCORE_DESCRIPTION } from '@/lib/ai/schemas/grading';
import {
  buildSpbenchSystemPrompt,
  buildSpbenchUserPrompt,
  type SpbenchPromptInput,
} from '@/lib/ai/prompts/osce';

// ─── Schema ────────────────────────────────────────────────────────────────

const EvaluateSessionSchema = z.object({
  body: z.object({
    sessionId: z.string(),
  }),
});

// ─── Handler ───────────────────────────────────────────────────────────────

const evaluateSessionHandler = authenticatedEndpoint(
  EvaluateSessionSchema,
  async ({ env, validated, auth, request }) => {
    const log = createEndpointLogger('/api/osce/evaluate', auth.userId);
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      const { sessionId } = validated.body;
      log.info('Evaluating OSCE session with SPBench', { sessionId });

      // Resolve the authenticated user
      const user = await resolveUserByClerkId(prisma, auth.userId);
      if (!user) {
        log.warn('User not found for OSCE evaluation', { clerkId: auth.userId });
        return { status: 404, error: 'User not found' };
      }

      // Fetch session with ownership check
      const peSession = await prisma.patientEncounterSession.findFirst({
        where: { id: sessionId, userId: user.id },
        include: { PatientEncounterCase: true },
      });

      if (!peSession) {
        log.warn('Session not found for evaluation', { sessionId });
        return { status: 404, error: 'Session not found' };
      }

      // Check for existing evaluation (idempotency)
      const existingEval = await prisma.spbenchScore.findUnique({
        where: { sessionId },
      });
      if (existingEval) {
        log.info('Returning cached SPBench evaluation', { sessionId });
        return {
          data: {
            success: true,
            cached: true,
            scores: {
              QC: existingEval.queryCompetence,
              CC: existingEval.caseCoverage,
              CD: existingEval.clinicalDepth,
              RC: existingEval.relevanceCheck,
              LC: existingEval.logicalConsistency,
              LN: existingEval.languageNaturality,
              CS: existingEval.clinicalSafety,
              PD: existingEval.professionalDemeanor,
              overall: existingEval.overallScore,
            },
            justification: existingEval.justification,
          },
        };
      }

      // Fetch intent log for richer evaluation context
      const intentLog = await prisma.clinicalIntentLog.findMany({
        where: { sessionId },
        orderBy: { classifiedAt: 'asc' },
        select: { intent: true, studentText: true },
      });

      const studentDiagnosis = peSession.diagnosis ?? 'not provided';
      const correctDiagnosis = peSession.PatientEncounterCase?.correctDiagnosis ?? 'unknown';
      const transcript = peSession.messages ?? [];

      // Build prompt for SPBench evaluation
      const promptInput = buildSpbenchPromptInput(
        transcript,
        intentLog,
        studentDiagnosis,
        correctDiagnosis,
      );
      const systemPrompt = buildSpbenchSystemPrompt(promptInput);
      const userPrompt = buildSpbenchUserPrompt(promptInput);

      // ── Call AI Gateway for SPBench scoring ──
      let scores;
      try {
        const { data } = await gateway.grade(toGatewayContext({ request, env, validated, auth } as any), {
          endpoint: '/api/osce/evaluate',
          schema: SpbenchScoreSchema,
          schemaDescription: SPBENCH_SCORE_DESCRIPTION,
          systemPrompt,
          userPrompt,
          tier: 'powerful', // SPBench evaluation needs pro-tier reasoning
          temperature: 0.2,
          maxOutputTokens: 2048,
        });
        scores = data;
      } catch (err: unknown) {
        if (err instanceof GatewayError) {
          log.warn('SPBench gateway grading failed', {
            code: err.code,
            requestId: err.requestId,
            message: err.message.slice(0, 200),
          });
          if (err.code === 'RATE_LIMITED') {
            return { status: 429, error: 'Rate limit exceeded' };
          }
          if (err.code === 'SCHEMA_INVALID_AFTER_REPAIR') {
            return { status: 422, error: 'Invalid evaluation response format' };
          }
        }
        log.error('Unexpected SPBench evaluation error', err);
        return { status: 502, error: 'Evaluation service failed' };
      }

      log.info('SPBench scores generated', { sessionId, overallScore: scores.overallScore });

      // Persist SPBench scores
      await prisma.spbenchScore.upsert({
        where: { sessionId },
        create: {
          id: crypto.randomUUID(),
          sessionId,
          queryCompetence: scores.QC,
          caseCoverage: scores.CC,
          clinicalDepth: scores.CD,
          relevanceCheck: scores.RC,
          logicalConsistency: scores.LC,
          languageNaturality: scores.LN,
          clinicalSafety: scores.CS,
          professionalDemeanor: scores.PD,
          overallScore: scores.overallScore,
          justification: scores.justification,
        },
        update: {
          queryCompetence: scores.QC,
          caseCoverage: scores.CC,
          clinicalDepth: scores.CD,
          relevanceCheck: scores.RC,
          logicalConsistency: scores.LC,
          languageNaturality: scores.LN,
          clinicalSafety: scores.CS,
          professionalDemeanor: scores.PD,
          overallScore: scores.overallScore,
          justification: scores.justification,
        },
      });

      return {
        data: {
          success: true,
          scores: {
            QC: scores.QC,
            CC: scores.CC,
            CD: scores.CD,
            RC: scores.RC,
            LC: scores.LC,
            LN: scores.LN,
            CS: scores.CS,
            PD: scores.PD,
            overall: scores.overallScore,
          },
          justification: scores.justification,
        },
      };
    } catch (error) {
      log.error('Session evaluation failed', error);
      return { status: 500, error: 'Failed to evaluate session' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
);

// ─── Export (feature-gated) ────────────────────────────────────────────────

export const onRequestPost = (context: CloudflareContext) => {
  if (!isFeatureEnabled(context.env, 'ENABLE_OSCE_BETA')) {
    return featureDisabledResponse(
      context.request,
      'OSCE beta endpoints are disabled for this launch.',
    );
  }
  return evaluateSessionHandler(context);
};

// ─── Prompt Builders ───────────────────────────────────────────────────────
// Prompt builders live in `lib/ai/prompts/osce.ts` so both this endpoint and
// the LangGraph OSCE encounter graph share the same prompt contract.

function buildSpbenchPromptInput(
  transcript: unknown,
  intentLog: ReadonlyArray<{ intent: string; studentText: string }>,
  studentDiagnosis: string,
  correctDiagnosis: string,
): SpbenchPromptInput {
  return { transcript, intentLog, studentDiagnosis, correctDiagnosis };
}
