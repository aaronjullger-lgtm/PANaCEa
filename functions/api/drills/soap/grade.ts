/**
 * POST /api/drills/soap/grade
 *
 * Server-side SOAP note grading for the SOAP Note Trainer. Replaces the
 * browser-side call that previously went through the deprecated
 * /geminiProxy endpoint (returns 410 Gone since the proxy consolidation).
 *
 * Migration notes (Sprint 4):
 *   - All model access flows through `gateway.grade()` — no browser-side
 *     model keys, no raw fetch, no ad-hoc JSON.parse with regex code-fence
 *     stripping.
 *   - Structured output validated against SoapBriefGradeSchema with a single
 *     schema-repair pass allowed.
 *   - Response shape is the long-standing client contract
 *     ({ totalScore, breakdown, feedback }) — SOAPNoteTrainer does not need
 *     to change.
 *   - Safety guard preserved: server re-sums breakdown and overrides
 *     totalScore if the model's arithmetic disagrees. Feedback bullets are
 *     also capped at 5 by the schema itself.
 */

import { z } from 'zod';
import { aiEndpoint, withCors} from '../../_shared/middleware';
import { gateway, GatewayError, toGatewayContext } from '@/lib/ai/aiGateway';
import {
  SoapBriefGradeSchema,
  SOAP_BRIEF_GRADE_DESCRIPTION,
  type SoapBriefGrade,
} from '@/lib/ai/schemas/grading';

const bodySchema = z.object({
  studentNote: z.string().min(20, 'SOAP note is too short to grade'),
  caseContext: z.string().min(20, 'Case context is too short'),
});

const SYSTEM_PROMPT = `You are a strict PANCE/USMLE Board Examiner grading a Physician Assistant student's SOAP note against the correct case findings.

Rubric:
- Award points for identifying key pathologies, correct vitals, appropriate differentials, and SAFE management plans.
- Penalize heavily for missing "do not miss" diagnoses, unsafe plans, or major misunderstandings.
- Weight each SOAP component equally: Subjective, Objective, Assessment, Plan — each scored 0-25.
- Focus feedback on what a PA student can realistically improve on their next attempt.

Scoring Rules (STRICT):
- Each section (subjective, objective, assessment, plan) MUST be scored from 0 to 25.
- The totalScore MUST equal the EXACT sum of these four section scores.
- Do NOT invent any additional scoring dimensions.

Feedback Formatting Rules:
- feedback.strengths: maximum of 5 concise bullets.
- feedback.missedConcepts: maximum of 5 concise bullets focusing on truly important missed findings.
- feedback.suggestions: maximum of 5 concise bullets focusing on style/phrasing/organization.
- Each bullet is a single coaching-oriented sentence, ≤25 words.

Return ONLY the requested JSON object — no markdown, no commentary, no code fence.`;

function buildUserPrompt(args: {
  studentNote: string;
  caseContext: string;
}): string {
  return `Student SOAP Note:
"""
${args.studentNote.trim()}
"""

Correct Case Findings (Answer Key):
"""
${args.caseContext.trim()}
"""

Return ONLY a JSON object conforming to this schema:
${SOAP_BRIEF_GRADE_DESCRIPTION}`;
}

/**
 * Defensive post-processing: re-derive totalScore from the breakdown so the
 * student can never see inconsistent math, and cap feedback arrays at 5.
 * (The schema already caps at 5, but this is belt-and-suspenders in case a
 * future schema change loosens the cap.)
 */
function reconcile(grade: SoapBriefGrade): SoapBriefGrade {
  const { subjective, objective, assessment, plan } = grade.breakdown;
  const sectionSum = subjective + objective + assessment + plan;
  return {
    ...grade,
    totalScore: sectionSum,
    feedback: {
      strengths: grade.feedback.strengths.slice(0, 5),
      missedConcepts: grade.feedback.missedConcepts.slice(0, 5),
      suggestions: grade.feedback.suggestions.slice(0, 5),
    },
  };
}

// Migrated to `aiEndpoint` (Sprint 9 rate-limit advisory): SOAP note grading
// via gateway.grade() → Gemini. 25 rpm 'ai' bucket matches cost profile.
export const onRequestOptions = withCors();

export const onRequestPost = aiEndpoint(bodySchema, async (context) => {
  const { studentNote, caseContext } = context.validated;

  try {
    const { data } = await gateway.grade(toGatewayContext(context), {
      endpoint: '/api/drills/soap/grade',
      schema: SoapBriefGradeSchema,
      schemaDescription: SOAP_BRIEF_GRADE_DESCRIPTION,
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: buildUserPrompt({ studentNote, caseContext }),
      temperature: 0.2,
      maxOutputTokens: 2048,
    });

    return {
      status: 200,
      data: reconcile(data),
    };
  } catch (error) {
    if (error instanceof GatewayError) {
      console.error('[soap/grade] gateway failure', {
        code: error.code,
        requestId: error.requestId,
        traceId: error.traceId,
        message: error.message,
      });
      if (error.code === 'RATE_LIMITED') {
        return {
          status: 429,
          error: 'Grading is rate-limited right now — please try again shortly.',
        };
      }
      if (error.code === 'SCHEMA_INVALID_AFTER_REPAIR') {
        return {
          status: 422,
          error: 'The grader returned a malformed response. Please try again.',
        };
      }
      return { status: 502, error: `Grading failed: ${error.code}` };
    }
    console.error('[soap/grade] unexpected failure:', error);
    return { status: 500, error: 'Unexpected grading failure' };
  }
});
