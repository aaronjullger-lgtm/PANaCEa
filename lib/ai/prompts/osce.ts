/**
 * Prompt builders for the OSCE encounter flow.
 *
 * Extracted from `functions/api/osce/evaluate.ts` so that both the REST
 * endpoint and the LangGraph OSCE encounter graph can consume the same
 * prompt contract without duplication. Behaviour matches the original
 * implementation verbatim — this is a pure refactor, no behavioural change.
 *
 * @module lib/ai/prompts/osce
 */

export interface SpbenchPromptInput {
  transcript: unknown;
  intentLog: ReadonlyArray<{ intent: string; studentText: string }>;
  studentDiagnosis: string;
  correctDiagnosis: string;
}

export function formatTranscript(messages: unknown): string {
  if (typeof messages === 'string') return messages;
  try {
    const arr = JSON.parse(JSON.stringify(messages));
    if (!Array.isArray(arr)) return JSON.stringify(messages);
    return arr
      .map((m: { role?: string; text?: string }) => {
        const role = m?.role === 'student' ? 'Student' : 'Patient';
        return `${role}: ${m?.text ?? JSON.stringify(m)}`;
      })
      .join('\n');
  } catch {
    return JSON.stringify(messages);
  }
}

export function buildSpbenchSystemPrompt({
  transcript,
  intentLog,
  studentDiagnosis,
  correctDiagnosis,
}: SpbenchPromptInput): string {
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

export function buildSpbenchUserPrompt({
  transcript,
  intentLog,
  studentDiagnosis,
  correctDiagnosis,
}: SpbenchPromptInput): string {
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

// ─── Intent classifier prompt (LangGraph OSCE graph) ────────────────────

export const INTENT_CLASSIFIER_SYSTEM_PROMPT = [
  'Classify the PA student utterance during an OSCE patient encounter.',
  'Reply with exactly one of these intent labels (no other text):',
  'history_question, ros_review, exam_request, lab_order, imaging_order,',
  'assessment_present, closure, small_talk.',
  'Rules:',
  '- "history_question": an open-ended or focused history question (HPI, PMH, meds, allergies, social/family).',
  '- "ros_review": a review-of-systems sweep (e.g. "any other symptoms?").',
  '- "exam_request": a request to perform/observe a physical exam finding.',
  '- "lab_order": an order for a lab test (CBC, BMP, etc.).',
  '- "imaging_order": an order for imaging (CXR, CT, US).',
  '- "assessment_present": the student states their diagnosis / assessment.',
  '- "closure": wrap-up with advice, follow-up, or summary.',
  '- "small_talk": rapport-building not serving clinical data gathering.',
].join('\n');