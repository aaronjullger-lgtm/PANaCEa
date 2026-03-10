/**
 * Virtual Preceptor Service
 *
 * This service acts as a Clinical Preceptor to grade PA student performance
 * after a Patient Encounter simulation. It provides detailed pedagogical
 * evaluation based on the chat transcript and case data.
 */

import { callGeminiText, type ChatMessage } from './geminiService';
import type { PatientEncounterCase } from '@/types/drill-modes';

/**
 * Structured feedback from the Virtual Preceptor
 * Matches the EncounterResult model in prisma/schema.prisma
 */
export interface PreceptorFeedback {
  /** Overall score 0-100 */
  score: number;

  /** Detailed scoring breakdown by clinical competency */
  clinicalReasoning: {
    /** History-taking quality (0-10) */
    historyTaking: number;
    /** Physical exam appropriateness (0-10) */
    physicalExam: number;
    /** Diagnostic reasoning (0-10) */
    diagnosis: number;
    /** Management plan quality (0-10) */
    management: number;
  };

  /** Narrative feedback in the voice of a supportive but rigorous preceptor */
  feedback: string;

  /** Critical cues the patient mentioned that the student missed */
  missedCriticalCues: string[];

  /** Differential diagnoses the student should have considered */
  differentialDiagnosis: string[];

  /** Strengths the student demonstrated */
  strengths: string[];

  /** Specific areas for improvement */
  areasForImprovement: string[];

  /** Dangerous or inappropriate actions (e.g. antibiotics for viral URI, missing critical workup); apply significant management score reduction */
  dangerousActions: string[];
}

/**
 * Session summary data for grading
 */
export interface EncounterSessionSummary {
  /** Chat transcript between student and patient simulator */
  transcript: ChatMessage[];

  /** Physical exam maneuvers performed */
  physicalExams: Array<{ maneuver: string; finding: string }>;

  /** Diagnostic tests ordered */
  diagnosticTests: Array<{ testName: string; result: string }>;

  /** Student's final diagnosis */
  diagnosisSubmitted: string;

  /** Student's treatment plan */
  treatmentPlan?: string;

  /** Differential diagnoses the student documented */
  differentials?: string[];
}

/**
 * Build the debrief prompt for streaming or non-streaming use.
 * Exported so the client can stream the AI response (token-by-token) for latency masking.
 */
export function buildDebriefPrompt(
  session: EncounterSessionSummary,
  caseData: PatientEncounterCase
): string {
  const caseSummary = buildCaseSummary(caseData);
  const formattedTranscript = formatTranscript(session.transcript);
  const physicalExamSummary =
    session.physicalExams.map((e) => `  - ${e.maneuver}: ${e.finding}`).join('\n') ||
    '  (None performed)';
  const diagnosticsSummary =
    session.diagnosticTests.map((t) => `  - ${t.testName}: ${t.result}`).join('\n') ||
    '  (None ordered)';
  const differentialsSummary =
    session.differentials && session.differentials.length > 0
      ? session.differentials.map((d) => `  - ${d}`).join('\n')
      : '  (None documented)';

  return `
You are a **Clinical Preceptor** evaluating a Physician Assistant (PA) student's performance in an OSCE-style patient encounter simulation.

Your tone should be:
- Educational and constructive
- Encouraging but rigorous regarding patient safety
- Specific and actionable in feedback
- Balanced (acknowledge strengths AND areas for improvement)

---

## GROUND TRUTH (PATIENT CASE)

${caseSummary}

**Correct Diagnosis:** ${caseData.correctDiagnosis}

**Critical Learning Points:**
${caseData.teachingPoints?.map((p) => `  - ${p}`).join('\n') || '  (None provided)'}

**Ideal Workup:**
${formatIdealWorkup(caseData)}

---

## STUDENT'S PERFORMANCE

**Chat Transcript:**
${formattedTranscript}

**Physical Exams Performed:**
${physicalExamSummary}

**Diagnostic Tests Ordered:**
${diagnosticsSummary}

**Differential Diagnoses Documented:**
${differentialsSummary}

**Final Diagnosis Submitted:** ${session.diagnosisSubmitted || '(None submitted)'}

**Treatment Plan:** ${session.treatmentPlan || '(None submitted)'}

---

## YOUR TASK

Evaluate the student's performance across these competencies:

1. **History-Taking (0-10)**:
   - Did they ask essential questions to establish onset, character, severity, timing?
   - Did they explore red flags and dangerous differentials?
   - Did they avoid redundant or unnecessary questions?
   - Did they miss any critical cues the patient mentioned?

2. **Physical Exam (0-10)**:
   - Were the exam maneuvers appropriate for the chief complaint and differentials?
   - Did they perform targeted exams to rule out life-threatening conditions?
   - Were any essential exams omitted?

3. **Diagnosis (0-10)**:
   - Was the final diagnosis correct or close to correct?
   - Did they consider appropriate differentials?
   - Was their reasoning sound based on the data gathered?

4. **Management (0-10)**:
   - Was the treatment plan safe and appropriate?
   - Did they address immediate threats (e.g., stabilization, airway, circulation)?
   - Did they order appropriate follow-up or disposition?
   - **Apply a significant score reduction (e.g. management ≤ 3)** if the student committed dangerous or inappropriate actions (see below).

5. **Dangerous or inappropriate actions** (required when present):
   - Identify any dangerous or inappropriate actions the student took. Examples: prescribing antibiotics for a clearly viral illness; missing critical workup (e.g. no EKG for chest pain); unsafe treatment; ignoring red flags.
   - List each in \`dangerousActions\`. For each such action, also add a brief note to \`areasForImprovement\` and apply a significant score reduction for management (e.g. management ≤ 3 when such actions occur). When dangerous actions occur, reduce the management subscore substantially—this is non-negotiable for patient safety.

**Output Requirements:**

Return **ONLY** a valid JSON object with NO markdown formatting, matching this exact structure:

{
  "score": <number 0-100>,
  "clinicalReasoning": {
    "historyTaking": <number 0-10>,
    "physicalExam": <number 0-10>,
    "diagnosis": <number 0-10>,
    "management": <number 0-10>
  },
  "feedback": "<string: 3-5 sentences of narrative feedback in the voice of a supportive preceptor>",
  "missedCriticalCues": ["<string>", "<string>"],
  "differentialDiagnosis": ["<string>", "<string>", "<string>"],
  "strengths": ["<string>", "<string>"],
  "areasForImprovement": ["<string>", "<string>"],
  "dangerousActions": ["<string>"]
}

**Critical Instructions:**
- The "score" is the sum of the four clinicalReasoning subscores multiplied by 2.5 (so max is 100).
- "missedCriticalCues" should list specific things the patient said that the student failed to follow up on.
- "differentialDiagnosis" should list 3-5 conditions the student SHOULD have considered given the presentation.
- "strengths" should acknowledge 2-3 things the student did well.
- "areasForImprovement" should list 2-3 specific, actionable improvements.
- "feedback" should be written as if you are speaking directly to the student in a debrief session.
- "dangerousActions" must list any dangerous or inappropriate actions (e.g. antibiotics for viral URI, missing critical workup, unsafe treatment). If none, use an empty array []. When any are present, apply a significant reduction to the management subscore (e.g. ≤ 3).

Return ONLY the JSON object. Do NOT include \`\`\`json markers or any other text.
`;
}

/** Exported for client-side parsing of streamed debrief JSON */
export function cleanDebriefJsonResponse(text: string): string {
  return cleanJsonResponse(text);
}

/** Exported for client-side normalization of parsed debrief */
export function normalizeDebriefFeedback(raw: any): PreceptorFeedback {
  return normalizePreceptorFeedback(raw);
}

/** Exported for client-side fallback when streaming/parse fails */
export function getFallbackDebriefFeedback(
  session: EncounterSessionSummary,
  caseData: PatientEncounterCase
): PreceptorFeedback {
  return generateFallbackFeedback(session, caseData);
}

/**
 * Generates a comprehensive pedagogical debrief from the Virtual Preceptor.
 * For streaming (latency masking), use buildDebriefPrompt + streamGeminiText + cleanDebriefJsonResponse + normalizeDebriefFeedback on the client.
 *
 * @param session - Summary of the student's encounter session
 * @param caseData - The ground truth patient case
 * @returns Structured feedback with scores and narrative evaluation
 */
export async function generateDebrief(
  session: EncounterSessionSummary,
  caseData: PatientEncounterCase
): Promise<PreceptorFeedback> {
  const prompt = buildDebriefPrompt(session, caseData);

  try {
    const rawResponse = await callGeminiText('gemini-2.5-pro', prompt, 0.7);
    const cleanedResponse = cleanJsonResponse(rawResponse);
    const parsed = JSON.parse(cleanedResponse);
    return normalizePreceptorFeedback(parsed);
  } catch (error) {
    console.error('Error generating Virtual Preceptor debrief:', error);
    return generateFallbackFeedback(session, caseData);
  }
}

/**
 * Builds a concise case summary for the AI prompt
 */
function buildCaseSummary(caseData: PatientEncounterCase): string {
  const vitals = caseData.vitalSigns;
  const vitalsStr = `BP ${vitals.bp}, HR ${vitals.hr} bpm, RR ${vitals.rr}/min, Temp ${vitals.temp}°F, O₂ ${vitals.o2sat}%`;

  return `
**Patient:** ${caseData.patientName}, ${caseData.age}yo ${caseData.sex}
**Chief Complaint:** ${caseData.chiefComplaint}
**Vital Signs:** ${vitalsStr}
`.trim();
}

/**
 * Formats the chat transcript for readability
 */
function formatTranscript(messages: ChatMessage[]): string {
  if (messages.length === 0) {
    return '  (No conversation recorded)';
  }

  return messages
    .map((msg, idx) => {
      const speaker = msg.role === 'user' ? 'Student' : 'Patient';
      const content = msg.content.trim();
      return `  [${idx + 1}] ${speaker}: ${content}`;
    })
    .join('\n');
}

/**
 * Formats the ideal workup for the case
 */
function formatIdealWorkup(caseData: PatientEncounterCase): string {
  if (!caseData.idealWorkup || caseData.idealWorkup.length === 0) {
    return '  (Not specified)';
  }

  return caseData.idealWorkup.map((item) => `  - ${item}`).join('\n');
}

/**
 * Cleans JSON response by removing markdown code fences
 */
function cleanJsonResponse(text: string): string {
  return text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
}

/**
 * Validates and normalizes the AI response into a PreceptorFeedback object
 */
function normalizePreceptorFeedback(raw: any): PreceptorFeedback {
  // Ensure all required fields exist with safe defaults
  const clinicalReasoning = {
    historyTaking: clamp(raw.clinicalReasoning?.historyTaking ?? 5, 0, 10),
    physicalExam: clamp(raw.clinicalReasoning?.physicalExam ?? 5, 0, 10),
    diagnosis: clamp(raw.clinicalReasoning?.diagnosis ?? 5, 0, 10),
    management: clamp(raw.clinicalReasoning?.management ?? 5, 0, 10),
  };

  // Calculate total score (sum of subscores × 2.5)
  const calculatedScore =
    (clinicalReasoning.historyTaking +
      clinicalReasoning.physicalExam +
      clinicalReasoning.diagnosis +
      clinicalReasoning.management) *
    2.5;

  return {
    score: clamp(raw.score ?? calculatedScore, 0, 100),
    clinicalReasoning,
    feedback: String(
      raw.feedback || 'Good effort. Continue to refine your clinical reasoning skills.'
    ),
    missedCriticalCues: ensureStringArray(raw.missedCriticalCues),
    differentialDiagnosis: ensureStringArray(raw.differentialDiagnosis),
    strengths: ensureStringArray(raw.strengths),
    areasForImprovement: ensureStringArray(raw.areasForImprovement),
    dangerousActions: ensureStringArray(raw.dangerousActions),
  };
}

/**
 * Generates a basic fallback response if AI fails
 */
function generateFallbackFeedback(
  session: EncounterSessionSummary,
  caseData: PatientEncounterCase
): PreceptorFeedback {
  const diagnosisMatch = session.diagnosisSubmitted
    ?.toLowerCase()
    .includes(caseData.correctDiagnosis.toLowerCase());

  const diagnosisScore = diagnosisMatch ? 8 : 4;
  const historyScore = Math.min(10, session.transcript.length > 5 ? 7 : 4);
  const examScore = Math.min(10, session.physicalExams.length > 2 ? 7 : 4);
  const managementScore = session.treatmentPlan ? 6 : 3;

  return {
    score: (historyScore + examScore + diagnosisScore + managementScore) * 2.5,
    clinicalReasoning: {
      historyTaking: historyScore,
      physicalExam: examScore,
      diagnosis: diagnosisScore,
      management: managementScore,
    },
    feedback: diagnosisMatch
      ? 'You correctly identified the diagnosis. Continue to refine your history-taking and physical exam skills to build stronger clinical reasoning.'
      : `The correct diagnosis was ${caseData.correctDiagnosis}. Review the key clinical features and consider how you might have gathered more targeted information.`,
    missedCriticalCues: [],
    differentialDiagnosis: [],
    strengths: ['Engaged with the patient', 'Attempted a systematic approach'],
    areasForImprovement: ['Gather more focused history', 'Consider broader differentials'],
    dangerousActions: [],
  };
}

/**
 * Clamps a number between min and max
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Ensures a value is an array of strings
 */
function ensureStringArray(value: any): string[] {
  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === 'string');
  }
  return [];
}
