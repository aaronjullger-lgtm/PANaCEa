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
      const systemPrompt = buildSpbenchSystemPrompt(
        transcript,
        intentLog,
        studentDiagnosis,
        correctDiagnosis,
      );

      const userPrompt = buildSpbenchUserPrompt(
        transcript,
        intentLog,
        studentDiagnosis,
        correctDiagnosis,
      );

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

export function formatTranscript(
  messages: unknown,
): string {
  if (typeof messages === 'string') return messages;
  try {
    const arr = Array.isArray(messages) ? messages : JSON.parse(JSON.stringify(messages));
    if (!Array.isArray(arr)) return JSON.stringify(messages);
    return arr
      .map((message) => {
        const record = isTranscriptRecord(message) ? message : {};
        const role = formatTranscriptRole(record.role);
        const content = formatTranscriptContent(record, message);
        return `${role}: ${content}`;
      })
      .join('\n');
  } catch {
    return JSON.stringify(messages);
  }
}

function isTranscriptRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function formatTranscriptRole(role: unknown): string {
  if (role === 'student' || role === 'user') return 'Student';
  if (role === 'patient' || role === 'assistant') return 'Patient';
  if (role === 'system') return 'System';
  return 'Patient';
}

function formatTranscriptContent(record: Record<string, unknown>, fallback: unknown): string {
  if (typeof record.text === 'string') return record.text;
  if (typeof record.content === 'string') return record.content;

  const serialized = JSON.stringify(fallback);
  return serialized ?? String(fallback);
}

function buildSpbenchSystemPrompt(
  transcript: unknown,
  intentLog: ReadonlyArray<{ intent: string; studentText: string }>,
  studentDiagnosis: string,
  correctDiagnosis: string,
): string {
  const transcriptText = formatTranscript(transcript);
  const intentText = intentLog
    .map((i) => `[INTENT:${i.intent}] "${i.studentText}"`)
    .join('\n');

  return `You are a post-hoc OSCE evaluation agent using the SPBench rubric.

Score 8 dimensions on a 0-100 scale:

1. Query Competence (QC): How well did the student choose appropriate history questions? Focused, systematic, and relevant questions rate higher.

2. Case Coverage (CC): How complete was the data gathered? Did the student cover chief complaint, HPI, PMH, medications, allergies, ROS, social/family history?

3. Clinical Depth (CD): How deep was the diagnostic reasoning? Did the student form a plausible differential, interpret findings, and reach a well-supported diagnosis?

4. Relevance Check (RC): How focused was the questioning? Did the student stay on track or pursue irrelevant lines of inquiry?

5. Logical Consistency (LC): How coherent was the reasoning chain from data → differential → diagnosis → plan?

6. Language Naturality (LN): Was the communication patient-appropriate? Clear, jargon-free, empathetic?

7. Clinical Safety (CS): Did the student recognize red flags? Avoid dangerous omissions? Consider "cannot-miss" diagnoses?

8. Professional Demeanor (PD): Was the student respectful, empathetic, and professional? Did they introduce themselves and explain their role?

--- SESSION DATA ---

Transcript (Student = Student, Patient = Simulated Patient):
${transcriptText}

Intent log (clinical intents the student explored):
${intentText}

Student's diagnosis: ${studentDiagnosis}
Correct diagnosis: ${correctDiagnosis}

--- SCORING GUIDANCE ---
- Score each dimension independently based on what is evidenced in the transcript.
- If the diagnosis is correct AND well-supported by history/exam data, score CD and LC higher.
- If the diagnosis is correct but poorly supported (guessing), score LC lower.
- If red flags were missed (e.g., no CVA tenderness check in suspected pyelonephritis), lower CS.
- If the student used open-ended questions, showed empathy, and explained their reasoning, raise LN and PD.
- Provide a brief, specific justification summarizing key strengths and areas for improvement.

Return ONLY a single JSON object. No markdown, no code fence, no prose.`;
}

function buildSpbenchUserPrompt(
  transcript: unknown,
  intentLog: ReadonlyArray<{ intent: string; studentText: string }>,
  studentDiagnosis: string,
  correctDiagnosis: string,
): string {
  const transcriptText = formatTranscript(transcript);
  const intentText = intentLog
    .map((i) => `[INTENT:${i.intent}] "${i.studentText}"`)
    .join('\n');

  return `Evaluate this OSCE session using the SPBench 8-dimension rubric.

Session transcript:
${transcriptText}

Clinical intents explored:
${intentText}

Student's submitted diagnosis: ${studentDiagnosis}
Correct answer: ${correctDiagnosis}

Return JSON with 8 SPBench dimension scores (0-100 each), an overall weighted score, and a justification.`;
}
