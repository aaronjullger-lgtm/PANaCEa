/**
 * POST /api/osce/grade-soap
 * SOAP Note Auto-Grader: grade free-text SOAP note against CaseRubric checklist via Gemini.
 * Saves result to OsceResult.checklist and OsceResult.clinicalReasoningScore.
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import {
  createEdgePrismaClient,
  safePrismaDisconnect,
  type EdgePrismaClient,
} from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { resolveUserByClerkId } from '../_shared/resolveUser';
import { validateFunctionEnv, MissingEnvError } from '../_shared/env-validation';
import { withRateLimit, getRateLimitIdentifier } from '../_shared/rateLimiter';
import { IDSchema } from '../_shared/schemas';

const GradeSoapBodySchema = z.object({
  body: z.object({
    sessionId: IDSchema,
    soapNote: z.string().min(1).max(30000),
  }),
});

const GEMINI_BASE = 'https://generativelanguage.googleapis.com';
const GEMINI_MODEL = 'gemini-2.0-flash';

type ChecklistItem = { item: string; status: 'PASS' | 'FAIL'; feedback: string };
/** Rubric: support both "item" and "concept" (schema can use either). */
type RubricItem = { item?: string; concept?: string; isRedFlag?: boolean };

function parseRubricChecklist(checklist: unknown): RubricItem[] {
  if (!Array.isArray(checklist)) return [];
  return checklist.filter((x): x is RubricItem => {
    if (typeof x !== 'object' || x === null) return false;
    const o = x as Record<string, unknown>;
    return typeof (o.item ?? o.concept) === 'string';
  });
}

function rubricItemLabel(r: RubricItem): string {
  return (r.item ?? r.concept ?? '').trim();
}

async function callGemini(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const url = `${GEMINI_BASE}/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
      },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned no text');
  return text;
}

function validateChecklistResponse(items: unknown[]): ChecklistItem[] {
  const out: ChecklistItem[] = [];
  for (const x of items) {
    if (typeof x !== 'object' || x === null) continue;
    const o = x as Record<string, unknown>;
    const item = typeof o.item === 'string' ? o.item : '';
    const status = o.status === 'PASS' || o.status === 'FAIL' ? o.status : 'FAIL';
    const feedback = typeof o.feedback === 'string' ? o.feedback : '';
    out.push({ item, status, feedback });
  }
  return out;
}

export const onRequestOptions = withCors();

export const onRequestPost = authenticatedEndpoint(GradeSoapBodySchema, async (context) => {
  const { request, env, validated, auth } = context as {
    request: Request;
    env: { GEMINI_API_KEY?: string; DATABASE_URL?: string; RATE_LIMIT_KV?: KVNamespace };
    validated: z.infer<typeof GradeSoapBodySchema>;
    auth: { userId: string };
  };
  const log = createEndpointLogger('/api/osce/grade-soap', auth.userId);

  try {
    validateFunctionEnv(env as unknown as Record<string, unknown>, 'GEMINI');
  } catch (e) {
    if (e instanceof MissingEnvError) return e.toResponse();
    throw e;
  }

  const identifier = getRateLimitIdentifier(request);
  const { response: rateLimitResponse } = await withRateLimit(env, identifier, 'gemini');
  if (rateLimitResponse) return rateLimitResponse;

  const { sessionId, soapNote } = validated.body;
  const prisma = createEdgePrismaClient(env.DATABASE_URL!) as EdgePrismaClient;

  try {
    const user = await resolveUserByClerkId(prisma, auth.userId);
    if (!user) {
      return { status: 404, error: 'User not found' };
    }

    const session = await prisma.patientEncounterSession.findFirst({
      where: { id: sessionId, userId: user.id },
      include: {
        PatientEncounterCase: true,
      },
    });
    if (!session) {
      return { status: 404, error: 'Session not found' };
    }
    if (session.status !== 'completed') {
      return { status: 400, error: 'Session must be completed before grading SOAP note' };
    }

    const rubric = await prisma.caseRubric.findUnique({
      where: { caseId: session.caseId },
      select: { checklist: true },
    });
    const rubricItems =
      rubric && Array.isArray(rubric.checklist) ? parseRubricChecklist(rubric.checklist) : [];
    const checklistText =
      rubricItems.length > 0
        ? rubricItems
            .map((r) => `- ${rubricItemLabel(r)}${r.isRedFlag ? ' [RED FLAG]' : ''}`)
            .join('\n')
        : '- Subjective\n- Objective\n- Assessment\n- Plan';

    const systemPrompt = `You are a senior PA faculty grading a student's SOAP note against a rubric.
Use semantic matching: e.g. "Dad died young" matches "Family history of sudden death". Do not require exact keywords.
For each rubric item, mark PASS if the student's note addresses that concept (same meaning); otherwise mark FAIL.
If a rubric item is marked [RED FLAG] and the student did NOT address it, mark that item as FAIL and in feedback write "CRITICAL: Red flag item missing."
Compute an overall clinicalReasoningScore 0-100 based on completeness and accuracy.
Respond with ONLY a JSON object in this exact shape (no markdown, no code fence):
{"checklist": [{"item": "exact rubric item/concept text", "status": "PASS" or "FAIL", "feedback": "brief feedback"}], "clinicalReasoningScore": number 0-100}`;

    const soapUserPrompt = `Rubric checklist:
${checklistText}

Student SOAP note:
${soapNote}

Output your grading as a single JSON object only.`;

    let rawText: string;
    try {
      rawText = await callGemini(env.GEMINI_API_KEY!, systemPrompt, soapUserPrompt);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.warn('Gemini SOAP grade error', { msg: msg.slice(0, 200) });
      return {
        status: 502,
        error: msg.startsWith('Gemini 429') ? 'Rate limit exceeded' : 'Grading service failed',
      };
    }

    const stripped = rawText.replaceAll(/```json|```/gi, '').trim();
    let parsed: { checklist?: unknown[]; clinicalReasoningScore?: number };
    try {
      parsed = JSON.parse(stripped) as { checklist?: unknown[]; clinicalReasoningScore?: number };
    } catch {
      log.error('Failed to parse Gemini SOAP JSON', { raw: stripped.slice(0, 300) });
      return { status: 502, error: 'Invalid grading response format' };
    }

    const checklist = Array.isArray(parsed.checklist)
      ? validateChecklistResponse(parsed.checklist)
      : [];
    const clinicalReasoningScore = Number(parsed.clinicalReasoningScore);
    const score =
      typeof clinicalReasoningScore === 'number' &&
      clinicalReasoningScore >= 0 &&
      clinicalReasoningScore <= 100
        ? clinicalReasoningScore
        : 0;

    const redFlagsMissed = rubricItems
      .filter((r) => r.isRedFlag)
      .filter((r) => {
        const label = rubricItemLabel(r);
        return checklist.find((c) => c.item === label)?.status === 'FAIL';
      })
      .map((r) => rubricItemLabel(r));

    const FAILING_CAP = 59;
    const finalScore = redFlagsMissed.length > 0 ? Math.min(score, FAILING_CAP) : score;
    const finalClinicalReasoning = redFlagsMissed.length > 0 ? Math.min(score, FAILING_CAP) : score;

    const existingResult = await prisma.osceResult.findUnique({ where: { sessionId } });
    const data = {
      score: finalScore,
      checklist: checklist as unknown as object,
      redFlagsMissed,
      clinicalReasoningScore: finalClinicalReasoning,
      billingCodeSuggestion: null as string | null,
    };
    if (existingResult) {
      await prisma.osceResult.update({ where: { sessionId }, data });
    } else {
      await prisma.osceResult.create({ data: { sessionId, ...data } });
    }

    log.info('SOAP grade saved', {
      sessionId,
      score: finalScore,
      redFlagsMissed: redFlagsMissed.length,
    });
    return {
      data: {
        success: true,
        checklist,
        clinicalReasoningScore: finalClinicalReasoning,
        score: finalScore,
        redFlagsMissed,
      },
    };
  } catch (e) {
    log.error('SOAP grade error', e);
    return { status: 500, error: 'Failed to grade SOAP note' };
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
