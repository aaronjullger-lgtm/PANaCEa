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
import { resolveSystem } from '../../_shared/inferSystem';
import { aiEndpoint, withCors } from '../../_shared/middleware';
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
import { scheduleConceptReview } from '../../ai/learning/profile-crud';
import {
  gateway,
  GatewayError,
  toGatewayContext,
} from '@/lib/ai/aiGateway';
import {
  OsceAnalysisGradeSchema,
  OSCE_ANALYSIS_GRADE_DESCRIPTION,
  OsceSoftSkillsSchema,
  OSCE_SOFT_SKILLS_DESCRIPTION,
  type OsceAnalysisGrade,
  type OsceSoftSkills,
} from '@/lib/ai/schemas/grading';

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

// Local wire-format aliases — kept for readability of the endpoint body.
// The gateway returns `OsceAnalysisGrade`, which IS the canonical shape.
type GradePayload = OsceAnalysisGrade;
type SoftSkillsReport = OsceSoftSkills;


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

const RUBRIC_CHECKLIST_ITEM = z.object({
  item: z.string(),
  isRedFlag: z.boolean().optional(),
});
type RubricItem = z.infer<typeof RUBRIC_CHECKLIST_ITEM>;

function parseRubricChecklist(checklist: unknown): RubricItem[] {
  if (!Array.isArray(checklist)) return [];
  return checklist.filter((x): x is RubricItem => RUBRIC_CHECKLIST_ITEM.safeParse(x).success);
}

// System inference consolidated in _shared/inferSystem.ts — see resolveSystem import above

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
    PatientEncounterCase: { chiefComplaint: string; correctDiagnosis: string; targetSystem?: string | null };
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
    const system = resolveSystem(
      session.PatientEncounterCase.targetSystem,
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

// Migrated to `aiEndpoint` (Sprint 9 rate-limit advisory): OSCE encounter
// grading uses multimodal Gemini + runs a concept-gap writer in the same path.
// 25 rpm 'ai' bucket matches the actual cost profile.
export const onRequestPost = aiEndpoint(GradeBodySchema, async (context) => {
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

  // Idempotency: return cached result unless ?force=true is specified
  const url = new URL(request.url);
  const forceRegrade = url.searchParams.get('force') === 'true';
  if (!forceRegrade) {
    const existingResult = await prisma.osceResult.findUnique({ where: { sessionId } });
    if (existingResult) {
      log.info('Returning cached OSCE grade (use ?force=true to regrade)', { sessionId });
      return {
        data: {
          resultId: existingResult.id,
          score: existingResult.score,
          checklist: existingResult.checklist,
          redFlagsMissed: existingResult.redFlagsMissed,
          clinicalReasoningScore: existingResult.clinicalReasoningScore,
          billingCodeSuggestion: existingResult.billingCodeSuggestion,
          softSkillsReport: existingResult.softSkillsReport ?? undefined,
          ...(existingResult.communicationScore != null ? { communicationScore: existingResult.communicationScore } : {}),
          ...(existingResult.differentialScore != null ? { differentialScore: existingResult.differentialScore } : {}),
          ...(existingResult.dangerousActionsDetected != null ? { dangerousActionsDetected: existingResult.dangerousActionsDetected } : {}),
          cached: true,
        },
      };
    }
  }

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

  // Build dangerous actions context for this condition so Gemini can factor safety into scoring
  const diagLower = caseRecord.correctDiagnosis.toLowerCase();
  const dangerousActionsContext: string[] = [];
  for (const [condition, actions] of Object.entries(DANGEROUS_ACTIONS_MAP)) {
    if (diagLower.includes(condition) || condition.split(' ').every(w => diagLower.includes(w))) {
      for (const action of actions) {
        dangerousActionsContext.push(`- ${action.description} (${action.penalty}pt penalty): keywords [${action.keywords.join(', ')}]`);
      }
    }
  }
  const safetySection = dangerousActionsContext.length > 0
    ? `\n\nPATIENT SAFETY (critical — factor into scoring):
The following actions are DANGEROUS for this condition (${caseRecord.correctDiagnosis}):
${dangerousActionsContext.join('\n')}
If the student's transcript shows evidence of any dangerous action, deduct the penalty from the relevant competency area AND list it in redFlagsMissed. These are serious clinical errors.`
    : '';

  const systemPrompt = `You are a senior PA faculty member grading an OSCE. Evaluate the following transcript against the provided Clinical Checklist. Be strict. If the student missed a 'Red Flag' question, mark it as a critical fail.

SCORING FORMULA (mandatory — compute each section independently, then sum):

1. History Taking (20 pts max):
   - Full credit: student asks ≥4 essential questions AND covers HPI, PMH, medications, allergies, social/family history
   - Partial credit: 4 pts per major history domain covered (HPI, PMH, meds/allergies, social/family)
   - 0 pts: fewer than 2 domains addressed

2. Physical Exam (20 pts max):
   - Full credit: ≥3 relevant exam maneuvers performed AND findings correctly interpreted
   - Partial credit: 5 pts per relevant maneuver (max 4)
   - Deduct 5 pts if a critical exam was omitted (e.g., cardiac auscultation for chest pain)

3. Diagnostic Reasoning (25 pts max):
   - 10 pts: correct diagnosis identified or included in differential
   - 8 pts: appropriate diagnostic tests ordered (≥2 relevant, ≤1 unnecessary)
   - 7 pts: logical clinical reasoning demonstrated (explains why tests ordered, narrows differential)
   - Deduct 5 pts per unnecessary/inappropriate test beyond the first

4. Treatment/Management (20 pts max):
   - 10 pts: treatment plan addresses the primary diagnosis appropriately
   - 5 pts: follow-up and monitoring plan included
   - 5 pts: patient education and shared decision-making
   - Deduct 10 pts if treatment is contraindicated or dangerous

5. Communication (10 pts max):
   - 3 pts: used open-ended questions before narrowing
   - 3 pts: showed empathy (acknowledged patient emotions/concerns)
   - 2 pts: explained clinical reasoning to the patient
   - 1 pt: introduced self and explained role
   - 1 pt: asked about patient's perspective/concerns

6. Efficiency (5 pts max):
   - 5 pts: focused, no unnecessary questions or tests
   - 3 pts: mostly efficient with minor tangents
   - 1 pt: significant wasted time on irrelevant lines of inquiry
   - 0 pts: shotgun approach with many unnecessary actions

Final score = sum of sections 1-6 (0-100).
Return this sum as the "score" field.
Return the communication section total (scaled to 0-100) as "communicationScore".
Set "clinicalReasoningScore" = (section 3 score / 25) * 100.${safetySection}

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
    // ── Primary grading call — structured JSON via the unified gateway ──
    let payload: GradePayload;
    try {
      const { data } = await gateway.grade(toGatewayContext(context), {
        endpoint: '/api/osce/analysis/grade',
        schema: OsceAnalysisGradeSchema,
        schemaDescription: OSCE_ANALYSIS_GRADE_DESCRIPTION,
        systemPrompt,
        userPrompt,
        tier: 'powerful', // OSCE grading needs pro-tier reasoning
        temperature: 0.2,
        maxOutputTokens: 4096,
      });
      payload = data;
    } catch (err) {
      if (err instanceof GatewayError) {
        log.warn('OSCE gateway grading failed', {
          code: err.code,
          requestId: err.requestId,
          traceId: err.traceId,
          message: err.message.slice(0, 200),
        });
        if (err.code === 'RATE_LIMITED') {
          return { status: 429, error: 'Rate limit exceeded' };
        }
        if (err.code === 'SCHEMA_INVALID_AFTER_REPAIR') {
          return {
            status: 422,
            error: 'Invalid grading response format',
            details: err.message.slice(0, 400),
          };
        }
        return { status: 502, error: 'Grading service failed' };
      }
      log.error('Unexpected OSCE grading error', err);
      return { status: 502, error: 'Grading service failed' };
    }

    // ── Ghost Listener: soft-skills analysis — non-blocking best-effort ──
    let softSkillsReport: SoftSkillsReport | null = null;
    try {
      const { data } = await gateway.grade(toGatewayContext(context), {
        endpoint: '/api/osce/analysis/grade#soft-skills',
        schema: OsceSoftSkillsSchema,
        schemaDescription: OSCE_SOFT_SKILLS_DESCRIPTION,
        systemPrompt:
          'You are a clinical educator evaluating bedside manner in a simulated patient encounter. Analyze the student (Speaker A). Scale: 1=poor, 5=excellent. Provide brief, specific feedback. Output JSON only.',
        userPrompt: `Transcript (Speaker A = Student, Speaker B = Patient):\n${JSON.stringify(
          transcript,
        )}\n\nReturn ONLY a JSON object conforming to this schema:\n${OSCE_SOFT_SKILLS_DESCRIPTION}`,
        tier: 'balanced',
        temperature: 0.2,
        maxOutputTokens: 1024,
      });
      softSkillsReport = data;
    } catch (err) {
      // Soft skills are supplementary — never block the grade on them.
      log.warn('Soft skills analysis skipped or failed', {
        sessionId,
        code: err instanceof GatewayError ? err.code : 'unknown',
      });
    }

    // Safety net: keyword-based dangerous action detection catches anything Gemini missed
    const dangerousActions = detectDangerousActions(caseRecord.correctDiagnosis, transcript);
    if (dangerousActions.length > 0) {
      // Only apply penalties for actions Gemini didn't already flag in redFlagsMissed
      const geminiFlags = (payload.redFlagsMissed ?? []).map(f => f.toLowerCase());
      const undetected = dangerousActions.filter(
        a => !geminiFlags.some(flag =>
          flag.includes(a.description.toLowerCase().slice(0, 20)) ||
          a.keywords?.some((kw: string) => flag.includes(kw))
        )
      );
      if (undetected.length > 0) {
        const additionalPenalty = undetected.reduce((sum, a) => sum + a.penalty, 0);
        payload.score = Math.max(0, payload.score - additionalPenalty);
        // Add to redFlagsMissed if not already present
        for (const action of undetected) {
          if (!payload.redFlagsMissed.includes(action.description)) {
            payload.redFlagsMissed.push(action.description);
          }
        }
        log.info('Safety net caught additional dangerous actions', {
          sessionId,
          geminiCaught: dangerousActions.length - undetected.length,
          safetyNetCaught: undetected.length,
          additionalPenalty,
        });
      } else {
        log.info('Gemini correctly identified all dangerous actions', {
          sessionId,
          count: dangerousActions.length,
        });
      }
    }

    const sessionForPersist = {
      User: session.User,
      PatientEncounterCase: {
        chiefComplaint: caseRecord.chiefComplaint,
        correctDiagnosis: caseRecord.correctDiagnosis,
        targetSystem: caseRecord.targetSystem,
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
          const system = resolveSystem(
            caseRecord.targetSystem,
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
