/**
 * API: Post-Encounter Analysis (grade OSCE transcript)
 * POST /api/osce/analysis/grade
 *
 * Asynchronous grading of a completed OSCE session against a clinical rubric
 * via Gemini, simulating faculty review. Persists OsceResult and optionally
 * creates ConceptGap for Tutor targeting when Differential Diagnosis fails.
 *
 * Rate-limiting: Applied via _shared/rateLimiter to protect Gemini quota.
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../../_shared/middleware';
import {
  createEdgePrismaClient,
  safePrismaDisconnect,
  type EdgePrismaClient,
} from '../../_shared/prisma-edge';
import { createEndpointLogger } from '../../_shared/secureLogger';
import { resolveUserByClerkId } from '../../_shared/resolveUser';
import { validateFunctionEnv, MissingEnvError } from '../../_shared/env-validation';
import { withRateLimit, getRateLimitIdentifier } from '../../_shared/rateLimiter';
import { IDSchema } from '../../_shared/schemas';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com';
// Stable: gemini-2.5-pro; use gemini-3-pro-preview when needed for latest reasoning.
const GEMINI_GRADE_MODEL = 'gemini-2.5-pro';

const GradeBodySchema = z.object({
  body: z.object({
    sessionId: IDSchema,
  }),
});

interface Env {
  DATABASE_URL: string;
  GEMINI_API_KEY: string;
  RATE_LIMIT_KV?: KVNamespace;
}

type ChecklistItem = { item: string; status: 'PASS' | 'FAIL'; feedback: string };
type GradePayload = {
  score: number;
  checklist: ChecklistItem[];
  redFlagsMissed: string[];
  clinicalReasoningScore: number;
  billingCodeSuggestion: string;
};

type SoftSkillsReport = {
  empathy: { score: number; feedback: string };
  professionalism: { score: number; feedback: string };
  pacing: { score: number; feedback: string };
};

const SoftSkillsReportSchema = z.object({
  empathy: z.object({ score: z.number().min(1).max(5), feedback: z.string() }),
  professionalism: z.object({ score: z.number().min(1).max(5), feedback: z.string() }),
  pacing: z.object({ score: z.number().min(1).max(5), feedback: z.string() }),
});

/** Validates a single grade checklist item from Gemini before persisting */
const GRADE_CHECKLIST_ITEM = z.object({
  item: z.string(),
  status: z.enum(['PASS', 'FAIL']),
  feedback: z.string(),
});
type GradeChecklistItem = z.infer<typeof GRADE_CHECKLIST_ITEM>;

const GradePayloadSchema = z.object({
  score: z.number().min(0).max(100),
  checklist: z.array(GRADE_CHECKLIST_ITEM).default([]),
  redFlagsMissed: z.array(z.string()).default([]),
  clinicalReasoningScore: z.number().min(0).max(100),
  billingCodeSuggestion: z.string().default('N/A'),
});


function validateGradeChecklist(
  items: unknown[],
  log?: (msg: string, meta?: object) => void
): ChecklistItem[] {
  if (!Array.isArray(items)) return [];
  const validated: ChecklistItem[] = [];
  for (let i = 0; i < items.length; i++) {
    const result = GRADE_CHECKLIST_ITEM.safeParse(items[i]);
    if (result.success) {
      validated.push(result.data);
    } else if (log) {
      log('Dropped invalid checklist item from grade payload', {
        index: i,
        issues: result.error.issues,
      });
    }
  }
  return validated;
}

const RUBRIC_CHECKLIST_ITEM = z.object({
  item: z.string(),
  isRedFlag: z.boolean().optional(),
});
type RubricItem = z.infer<typeof RUBRIC_CHECKLIST_ITEM>;

function parseRubricChecklist(checklist: unknown): RubricItem[] {
  if (!Array.isArray(checklist)) return [];
  return checklist.filter((x): x is RubricItem => RUBRIC_CHECKLIST_ITEM.safeParse(x).success);
}

function inferSystemFromCase(chiefComplaint: string, correctDiagnosis: string): string {
  const text = `${chiefComplaint} ${correctDiagnosis}`.toLowerCase();
  if (/\b(heart|cardiac|chest pain|acs|mi|coronary)\b/.test(text)) return 'cardiovascular';
  if (/\b(lung|pulmonary|dyspnea|copd|asthma|pe)\b/.test(text)) return 'pulmonary';
  if (/\b(gi|abdominal|hepatic|pancreat)\b/.test(text)) return 'gastrointestinal';
  if (/\b(neuro|stroke|seizure|headache)\b/.test(text)) return 'neurological';
  if (/\b(renal|kidney|aki|ckd)\b/.test(text)) return 'nephrology';
  if (/\b(infection|sepsis|uti|pneumonia)\b/.test(text)) return 'infectious_disease';
  if (/\b(psych|depression|anxiety|suicid)\b/.test(text)) return 'psychiatry';
  return 'general';
}

async function callGeminiSoftSkills(
  apiKey: string,
  transcript: unknown
): Promise<SoftSkillsReport | null> {
  const url = `${GEMINI_BASE}/v1beta/models/${GEMINI_GRADE_MODEL}:generateContent?key=${apiKey}`;
  const systemPrompt = `You are a clinical educator evaluating bedside manner in a simulated patient encounter. Analyze the student's communication (Speaker A). Grade 1-5 (1=poor, 5=excellent) for: Empathy, Professionalism, Pacing. Provide brief specific feedback for each. Output ONLY a JSON object: {"empathy":{"score":number,"feedback":"..."},"professionalism":{"score":number,"feedback":"..."},"pacing":{"score":number,"feedback":"..."}}`;
  const userPrompt = `Transcript (Speaker A = Student, Speaker B = Patient):\n${JSON.stringify(transcript)}\n\nOutput JSON only.`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1024,
        responseMimeType: 'application/json',
      },
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return null;
  try {
    const parsed = JSON.parse(
      text
        .replace(/^```json\s*/i, '')
        .replace(/\s*```\s*$/i, '')
        .trim()
    );
    return SoftSkillsReportSchema.parse(parsed);
  } catch {
    return null;
  }
}

async function callGeminiGrade(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const url = `${GEMINI_BASE}/v1beta/models/${GEMINI_GRADE_MODEL}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: {
        temperature: 0.2,
        topK: 40,
        topP: 0.95,
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

function parseGradePayload(
  rawText: string,
  log?: (msg: string, meta?: object) => void
): GradePayload {
  const stripped = rawText
    .replace(/^```json\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
  const parsed = JSON.parse(stripped) as unknown;
  
  // Clean checklist and redFlagsMissed, preserving logging of dropped items
  const rawChecklist = Array.isArray((parsed as any).checklist) ? (parsed as any).checklist : [];
  const checklist = validateGradeChecklist(rawChecklist, log);
  const rawRedFlags = Array.isArray((parsed as any).redFlagsMissed) ? (parsed as any).redFlagsMissed : [];
  const redFlagsMissed = rawRedFlags.filter((x): x is string => typeof x === 'string');
  
  const cleaned = {
    score: Number((parsed as any).score) || 0,
    checklist,
    redFlagsMissed,
    clinicalReasoningScore: Number((parsed as any).clinicalReasoningScore) || 0,
    billingCodeSuggestion: typeof (parsed as any).billingCodeSuggestion === 'string'
      ? (parsed as any).billingCodeSuggestion
      : 'N/A',
  };
  
  // Validate with Zod schema to enforce ranges and types
  try {
    return GradePayloadSchema.parse(cleaned);
  } catch (error) {
    // If validation fails, log and rethrow (caller will handle)
    if (log) {
      log('Grade payload validation failed', { error, cleaned });
    }
    throw error;
  }
}

interface SessionWithCase {
  id: string;
  userId: string;
  caseId: string;
  status: string;
  messages: unknown;
  PatientEncounterCase: Awaited<ReturnType<EdgePrismaClient['patientEncounterCase']['findUnique']>>;
  User: { id: string } | null;
}

async function resolveSessionAndRubric(
  prisma: EdgePrismaClient,
  sessionId: string,
  userId: string
): Promise<
  | {
      ok: true;
      session: SessionWithCase;
      caseRecord: {
        chiefComplaint: string;
        correctDiagnosis: string;
        patientName: string;
        age: string;
      };
      checklistText: string;
      transcript: unknown;
      caseLabel: string;
    }
  | { ok: false; status: number; error: string }
> {
  const rawSession = await prisma.patientEncounterSession.findFirst({
    where: { id: sessionId, userId },
    include: {
      PatientEncounterCase: true,
      User: { select: { id: true } },
    },
  });
  if (!rawSession) return { ok: false, status: 404, error: 'Session not found' };
  if (rawSession.status !== 'completed') {
    return { ok: false, status: 400, error: 'Session must be completed before grading' };
  }
  const caseRecord = rawSession.PatientEncounterCase;
  if (!caseRecord) return { ok: false, status: 404, error: 'Case record not found' };
  const session = rawSession as SessionWithCase;
  const rubric = await prisma.caseRubric.findUnique({ where: { caseId: session.caseId } });

  let checklistText: string;
  if (rubric && Array.isArray(rubric.checklist)) {
    const rubricItems = parseRubricChecklist(rubric.checklist as unknown);
    checklistText = rubricItems
      .map((r) => `- ${r.item}${r.isRedFlag ? ' [RED FLAG]' : ''}`)
      .join('\n');
  } else {
    // Fallback: build checklist from case essentialQuestions and idealWorkup so grading works without a CaseRubric
    const essential = (caseRecord as { essentialQuestions?: string[] }).essentialQuestions ?? [];
    const workup = (caseRecord as { idealWorkup?: string[] }).idealWorkup ?? [];
    const fallbackItems = [
      ...essential.map((q) => `- ${q}`),
      ...workup.map((w) => `- ${w} [RED FLAG]`),
    ];
    checklistText =
      fallbackItems.length > 0
        ? fallbackItems.join('\n')
        : '- Obtain relevant history\n- Perform focused physical exam\n- Order appropriate workup\n- Document diagnosis and plan';
  }

  const caseLabel = `${caseRecord.chiefComplaint} - ${caseRecord.patientName} ${caseRecord.age}`;
  const transcript = session.messages;
  return {
    ok: true,
    session: session as SessionWithCase,
    caseRecord: {
      chiefComplaint: caseRecord.chiefComplaint,
      correctDiagnosis: caseRecord.correctDiagnosis,
      patientName: caseRecord.patientName,
      age: String(caseRecord.age),
    },
    checklistText,
    transcript,
    caseLabel,
  };
}

async function persistGradeAndConceptGap(
  prisma: EdgePrismaClient,
  sessionId: string,
  payload: GradePayload,
  session: {
    User?: { id: string } | null;
    PatientEncounterCase: { chiefComplaint: string; correctDiagnosis: string };
  },
  softSkillsReport: SoftSkillsReport | null
): Promise<{ resultId: string; conceptGapCreated: boolean }> {
  const existingResult = await prisma.osceResult.findUnique({ where: { sessionId } });
  const data = {
    score: payload.score,
    checklist: payload.checklist as unknown as object,
    redFlagsMissed: payload.redFlagsMissed,
    clinicalReasoningScore: payload.clinicalReasoningScore,
    billingCodeSuggestion: payload.billingCodeSuggestion || null,
    softSkillsReport: softSkillsReport ? (softSkillsReport as unknown as object) : undefined,
  };
  if (existingResult) {
    await prisma.osceResult.update({ where: { sessionId }, data });
  } else {
    await prisma.osceResult.create({ data: { sessionId, ...data } });
  }
  const savedResult = await prisma.osceResult.findUnique({ where: { sessionId } });
  if (!savedResult) throw new Error('Failed to persist OsceResult');

  const differentialFailed =
    payload.clinicalReasoningScore < 60 || payload.redFlagsMissed.length > 0;
  let conceptGapCreated = false;
  if (differentialFailed && session.User?.id) {
    const system = inferSystemFromCase(
      session.PatientEncounterCase.chiefComplaint,
      session.PatientEncounterCase.correctDiagnosis
    );
    const existingGap = await prisma.conceptGap.findFirst({
      where: { userId: session.User.id, system, sourceType: 'osce', sourceId: savedResult.id },
    });
    if (!existingGap) {
      await prisma.conceptGap.create({
        data: { userId: session.User.id, system, sourceType: 'osce', sourceId: savedResult.id },
      });
      conceptGapCreated = true;
    }
  }
  return { resultId: savedResult.id, conceptGapCreated };
}

export const onRequestOptions = withCors();

export const onRequestPost = authenticatedEndpoint(GradeBodySchema, async (context) => {
  const { request, env, validated, auth } = context as {
    request: Request;
    env: Env;
    validated: z.infer<typeof GradeBodySchema>;
    auth: { userId: string };
  };
  const log = createEndpointLogger('/api/osce/analysis/grade', auth.userId);

  try {
    validateFunctionEnv(env as unknown as Record<string, unknown>, 'GEMINI');
  } catch (e) {
    if (e instanceof MissingEnvError) return e.toResponse();
    throw e;
  }

  // Tight Gemini-specific rate limiting on top of standard API limits
  const identifier = getRateLimitIdentifier(request);
  const { response: rateLimitResponse } = await withRateLimit(
    env as { RATE_LIMIT_KV?: KVNamespace },
    identifier,
    'gemini'
  );
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const { sessionId } = validated.body;
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  const user = await resolveUserByClerkId(prisma, auth.userId);
  if (!user) {
    log.warn('User not found', { clerkId: auth.userId });
    return { status: 404, error: 'User not found' };
  }

  const resolved = await resolveSessionAndRubric(prisma, sessionId, user.id);
  if (!resolved.ok) {
    if (resolved.status === 404) log.warn('Session or rubric not found', { sessionId });
    return { status: resolved.status, error: resolved.error };
  }

  const { session, caseRecord, checklistText, transcript, caseLabel } = resolved;
  const systemPrompt = `You are a senior PA faculty member grading an OSCE. Evaluate the following transcript against the provided Clinical Checklist. Be strict. If the student missed a 'Red Flag' question, mark it as a critical fail.

Evaluate using the 4 PANCE blueprint skill areas (weight them in your overall score):
- History Taking (16%)
- Physical Exam (16%)
- Differential Diagnosis (18%)
- Clinical Intervention (16%)

Respond with ONLY a single JSON object (no markdown, no code fence), in this exact shape:
{"score": number 0-100, "checklist": [{"item": "exact rubric item text", "status": "PASS" or "FAIL", "feedback": "brief feedback"}], "redFlagsMissed": ["list of red flag items the student missed"], "clinicalReasoningScore": number 0-100, "billingCodeSuggestion": "ICD-10 code or N/A"}`;

  const userPrompt = `Case: ${caseLabel}

Clinical Checklist:
${checklistText}

Transcript (Speaker A = Student, Speaker B = Simulated Patient):
${JSON.stringify(transcript)}

Output your grading as a single JSON object only.`;

  try {
    let rawText: string;
    try {
      rawText = await callGeminiGrade(env.GEMINI_API_KEY, systemPrompt, userPrompt);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const is429 = msg.startsWith('Gemini 429');
      log.warn('Gemini grading error', { msg: msg.slice(0, 200) });
      return {
        status: is429 ? 429 : 502,
        error: is429 ? 'Rate limit exceeded' : 'Grading service failed',
      };
    }

    let payload: GradePayload;
    try {
      payload = parseGradePayload(rawText, (msg, meta) =>
        log.warn(msg, meta as Record<string, unknown>)
      );
    } catch (error_) {
      if (error_ instanceof z.ZodError) {
        log.error('Gemini returned invalid grade payload', {
          raw: rawText.slice(0, 300),
          issues: error_.issues
        });
        return {
          status: 422,
          error: 'Invalid grading response format',
          details: error_.issues.map(issue => issue.message).join(', ')
        };
      }
      // JSON parse error or other unexpected error
      log.error('Failed to parse Gemini JSON', { raw: rawText.slice(0, 300), err: error_ });
      return { status: 502, error: 'Invalid grading response format' };
    }

    // Ghost Listener: Bedside manner analysis (soft skills) - non-blocking, best-effort
    let softSkillsReport: SoftSkillsReport | null = null;
    try {
      softSkillsReport = await callGeminiSoftSkills(env.GEMINI_API_KEY, transcript);
    } catch {
      log.warn('Soft skills analysis skipped or failed', { sessionId });
    }

    const sessionForPersist = {
      User: session.User,
      PatientEncounterCase: {
        chiefComplaint: caseRecord.chiefComplaint,
        correctDiagnosis: caseRecord.correctDiagnosis,
      },
    };
    const { resultId, conceptGapCreated } = await persistGradeAndConceptGap(
      prisma,
      sessionId,
      payload,
      sessionForPersist,
      softSkillsReport
    );
    if (conceptGapCreated) {
      log.info('ConceptGap created for Tutor', {
        userId: session.User?.id,
        sessionId,
      });
    }
    log.info('OSCE grading completed', { sessionId, score: payload.score });
    return {
      data: {
        resultId,
        score: payload.score,
        checklist: payload.checklist,
        redFlagsMissed: payload.redFlagsMissed,
        clinicalReasoningScore: payload.clinicalReasoningScore,
        billingCodeSuggestion: payload.billingCodeSuggestion,
        softSkillsReport: softSkillsReport ?? undefined,
        conceptGapCreated,
      },
    };
  } catch (err) {
    log.error('Grade analysis error', err);
    return { status: 500, error: 'Internal server error' };
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
