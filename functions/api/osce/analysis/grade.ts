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
import { scheduleConceptReview } from '../../intelligence/profile';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com';
// Stable: gemini-2.5-pro; use gemini-3-pro-preview when needed for latest reasoning.
const GEMINI_GRADE_MODEL = 'gemini-2.5-pro';

const GradeBodySchema = z.object({
  body: z.object({
    sessionId: IDSchema,
    differentials: z.array(z.string()).max(10).optional(),
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
  communicationScore?: number;
  differentialScore?: number;
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


// =============================================================================
// DANGEROUS ACTION DETECTION (inline for Edge compatibility)
// =============================================================================

type DetectedDangerousAction = { description: string; penalty: number };

const DANGEROUS_ACTIONS_MAP: Record<string, Array<{ keywords: string[]; description: string; penalty: number }>> = {
  'acute coronary syndrome': [
    { keywords: ['beta-blocker', 'metoprolol', 'atenolol', 'decompensated'], description: 'Beta-blocker in decompensated heart failure', penalty: 15 },
    { keywords: ['missed', 'aspirin', 'no aspirin', 'without aspirin'], description: 'Missed aspirin administration', penalty: 15 },
  ],
  'stroke': [
    { keywords: ['tpa', 'alteplase', 'thrombolytic', 'late', '4.5 hour', 'window'], description: 'tPA considered outside treatment window', penalty: 20 },
    { keywords: ['no glucose', 'skip glucose', 'without glucose'], description: 'Failed to check glucose before treatment', penalty: 15 },
  ],
  'diabetic ketoacidosis': [
    { keywords: ['insulin', 'before potassium', 'without potassium', 'hypokalemia'], description: 'Insulin before verifying potassium level', penalty: 20 },
    { keywords: ['bicarbonate', 'bicarb', 'nahco3'], description: 'Inappropriate bicarbonate in DKA', penalty: 10 },
  ],
  'sepsis': [
    { keywords: ['delay', 'antibiotic', 'wait', 'hold antibiotics'], description: 'Delayed antibiotics in sepsis', penalty: 15 },
    { keywords: ['no cultures', 'skip cultures', 'without cultures'], description: 'Antibiotics without obtaining cultures first', penalty: 10 },
  ],
  'asthma': [
    { keywords: ['sedative', 'benzodiazepine', 'morphine'], description: 'Sedative in acute asthma exacerbation', penalty: 15 },
    { keywords: ['beta-blocker', 'propranolol', 'metoprolol'], description: 'Beta-blocker in acute asthma', penalty: 15 },
  ],
  'pulmonary embolism': [
    { keywords: ['no anticoag', 'skip heparin', 'without anticoag'], description: 'Missed anticoagulation in PE', penalty: 20 },
  ],
};

function detectDangerousActions(diagnosis: string, transcript: unknown): DetectedDangerousAction[] {
  const diagLower = diagnosis.toLowerCase();
  const transcriptStr = typeof transcript === 'string' ? transcript : JSON.stringify(transcript ?? '');
  const tLower = transcriptStr.toLowerCase();

  const detected: DetectedDangerousAction[] = [];
  for (const [condition, actions] of Object.entries(DANGEROUS_ACTIONS_MAP)) {
    if (!diagLower.includes(condition) && !condition.split(' ').every(w => diagLower.includes(w))) continue;
    for (const action of actions) {
      const matches = action.keywords.filter(kw => tLower.includes(kw));
      if (matches.length >= 2 || (matches.length >= 1 && action.keywords.length <= 2)) {
        detected.push({ description: action.description, penalty: action.penalty });
      }
    }
  }
  return detected;
}

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
  if (/\b(heart|cardiac|chest pain|acs|mi|coronary|chf|heart failure|decompensated)\b/.test(text)) return 'cardiovascular';
  if (/\b(dvt|deep vein|thrombosis|embol)\b/.test(text)) return 'cardiovascular';
  if (/\b(lung|pulmonary|dyspnea|copd|asthma|pe|wheez)\b/.test(text)) return 'pulmonary';
  if (/\b(gi|abdominal|hepatic|pancreat|appendic)\b/.test(text)) return 'gastrointestinal';
  if (/\b(neuro|stroke|seizure|headache|weakness|slurred|aphasia|tia)\b/.test(text)) return 'neurological';
  if (/\b(renal|kidney|aki|ckd|urosepsis)\b/.test(text)) return 'nephrology';
  if (/\b(infection|sepsis|uti|pneumonia|cellulitis|meningit)\b/.test(text)) return 'infectious_disease';
  if (/\b(diabetes|diabetic|dka|ketoacidosis|hyperglycemi)\b/.test(text)) return 'endocrine';
  if (/\b(ectopic|pregnan|obstetric|gynecolog|ovarian)\b/.test(text)) return 'reproductive';
  if (/\b(psych|depression|anxiety|suicid|bipolar|schizo)\b/.test(text)) return 'psychiatry';
  if (/\b(anemia|leukemia|lymphoma|coagul|thrombocytop)\b/.test(text)) return 'hematology';
  if (/\b(fracture|orthoped|musculoskel|joint|back pain)\b/.test(text)) return 'musculoskeletal';
  if (/\b(dermat|rash|skin|wound|burn)\b/.test(text)) return 'dermatology';
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
  const redFlagsMissed = rawRedFlags.filter((x: unknown): x is string => typeof x === 'string');
  
  // Extract optional new scoring fields
  const rawCommScore = Number((parsed as any).communicationScore);
  const rawDiffScore = Number((parsed as any).differentialScore);

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
    const validated = GradePayloadSchema.parse(cleaned);
    // Attach optional scores after Zod validation (not in schema since they're optional)
    const result: GradePayload = { ...validated };
    if (!isNaN(rawCommScore) && rawCommScore >= 0 && rawCommScore <= 100) {
      result.communicationScore = Math.round(rawCommScore);
    }
    if (!isNaN(rawDiffScore) && rawDiffScore >= 0 && rawDiffScore <= 100) {
      result.differentialScore = Math.round(rawDiffScore);
    }
    return result;
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
  softSkillsReport: SoftSkillsReport | null,
  dangerousActions?: DetectedDangerousAction[]
): Promise<{ resultId: string; conceptGapCreated: boolean }> {
  const existingResult = await prisma.osceResult.findUnique({ where: { sessionId } });
  const data: Record<string, unknown> = {
    score: payload.score,
    checklist: payload.checklist as unknown as object,
    redFlagsMissed: payload.redFlagsMissed,
    clinicalReasoningScore: payload.clinicalReasoningScore,
    billingCodeSuggestion: payload.billingCodeSuggestion || null,
    softSkillsReport: softSkillsReport ? (softSkillsReport as unknown as object) : undefined,
  };
  // Persist new optional fields
  if (typeof payload.differentialScore === 'number') {
    data.differentialScore = payload.differentialScore;
  }
  if (typeof payload.communicationScore === 'number') {
    data.communicationScore = payload.communicationScore;
  }
  if (dangerousActions && dangerousActions.length > 0) {
    data.dangerousActionsDetected = dangerousActions as unknown as object;
  }
  if (existingResult) {
    await prisma.osceResult.update({ where: { sessionId }, data });
  } else {
    await prisma.osceResult.create({ data: { sessionId, ...data } as any });
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
        data: { id: crypto.randomUUID(), userId: session.User.id, system, sourceType: 'osce', sourceId: savedResult.id },
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

  // Build telemetry context if available (from useOSCEMetrics via complete endpoint)
  const telemetry = (session as { osceTelemetry?: Record<string, unknown> }).osceTelemetry;
  const telemetryContext = telemetry
    ? `\n\nBehavioral Telemetry (use to inform your assessment):
- Total encounter time: ${telemetry.totalTimeMs ? Math.round(Number(telemetry.totalTimeMs) / 1000) + 's' : 'unknown'}
- Clinical confidence index: ${telemetry.clinicalConfidenceIndex ?? 'N/A'} (1.0-4.0 scale)
- Red flags missed by tracker: ${telemetry.redFlagsMissed ?? 'N/A'}
- Unnecessary orders placed: ${telemetry.unnecessaryOrders ?? 'N/A'}
- Efficiency score: ${telemetry.efficiencyScore ?? 'N/A'}
- Total clinical actions: ${telemetry.actionCount ?? 'N/A'}
Note: Factor efficiency and clinical decision-making speed into your overall assessment.`
    : '';

  const systemPrompt = `You are a senior PA faculty member grading an OSCE. Evaluate the following transcript against the provided Clinical Checklist. Be strict. If the student missed a 'Red Flag' question, mark it as a critical fail.

Evaluate using the 4 PANCE blueprint skill areas (weight them in your overall score):
- History Taking (16%)
- Physical Exam (16%)
- Differential Diagnosis (18%)
- Clinical Intervention (16%)

Also consider: time management, clinical efficiency, and decision-making quality when behavioral telemetry is available.

Additionally, evaluate the student's communication quality:
- Did they use open-ended questions before closed-ended questions?
- Did they show empathy (acknowledging patient emotions, concerns)?
- Did they explain their clinical reasoning to the patient?
- Did they ask about the patient's perspective and concerns?
- Did they introduce themselves and explain their role?
Rate communication quality as "communicationScore" (0-100).

If the student submitted differential diagnoses, evaluate them:
- Are the key differentials for this presentation included?
- Is the correct diagnosis in the list?
- Are there any dangerous "cannot-miss" diagnoses missing?
Rate differential quality as "differentialScore" (0-100). Omit if no differentials were provided.

Respond with ONLY a single JSON object (no markdown, no code fence), in this exact shape:
{"score": number 0-100, "checklist": [{"item": "exact rubric item text", "status": "PASS" or "FAIL", "feedback": "brief feedback"}], "redFlagsMissed": ["list of red flag items the student missed"], "clinicalReasoningScore": number 0-100, "billingCodeSuggestion": "ICD-10 code or N/A", "communicationScore": number 0-100, "differentialScore": number 0-100 (only if differentials provided)}`;

  // Build differentials section if provided
  const differentials = validated.body.differentials;
  const differentialsSection = differentials && differentials.length > 0
    ? `\n\nStudent's Differential Diagnoses:\n${differentials.map(d => `- ${d}`).join('\n')}`
    : '';

  const userPrompt = `Case: ${caseLabel}

Clinical Checklist:
${checklistText}

Transcript (Speaker A = Student, Speaker B = Simulated Patient):
${JSON.stringify(transcript)}${telemetryContext}${differentialsSection}

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

    // Dangerous action detection: check transcript for condition-specific contraindications
    const dangerousActions = detectDangerousActions(caseRecord.correctDiagnosis, transcript);
    if (dangerousActions.length > 0) {
      const totalPenalty = dangerousActions.reduce((sum, a) => sum + a.penalty, 0);
      payload.score = Math.max(0, payload.score - totalPenalty);
      log.info('Dangerous actions detected', {
        sessionId,
        count: dangerousActions.length,
        totalPenalty,
        actions: dangerousActions.map(a => a.description),
      });
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
      softSkillsReport,
      dangerousActions
    );
    if (conceptGapCreated) {
      log.info('ConceptGap created for Tutor', {
        userId: session.User?.id,
        sessionId,
      });
      if (user?.id) {
        try {
          const system = inferSystemFromCase(
            caseRecord.chiefComplaint,
            caseRecord.correctDiagnosis
          );
          await scheduleConceptReview(prisma, user.id, `${system}|osce`, false);
        } catch (srsErr) {
          log.warn('SRS scheduleConceptReview failed (non-fatal)', {
            error: srsErr instanceof Error ? srsErr.message : String(srsErr),
          });
        }
      }
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
        ...(payload.communicationScore != null ? { communicationScore: payload.communicationScore } : {}),
        ...(payload.differentialScore != null ? { differentialScore: payload.differentialScore } : {}),
        ...(dangerousActions.length > 0 ? { dangerousActionsDetected: dangerousActions } : {}),
      },
    };
  } catch (err) {
    log.error('Grade analysis error', err);
    return { status: 500, error: 'Internal server error' };
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
