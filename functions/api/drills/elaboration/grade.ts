/**
 * Elaboration Drill — Grading Endpoint
 * POST /api/drills/elaboration/grade
 *
 * Grades a student's free-text explanation of WHY a clinical fact is true.
 * Returns a 0-3 score with feedback and a model-generated reference
 * explanation.
 *
 * Migrated to the unified AI Gateway (Sprint 4). All model access goes
 * through `gateway.grade()` — no direct GoogleGenerativeAI, no regex JSON
 * extraction, no JSON.parse on raw model output. Structured output is
 * validated against ElaborationGradeSchema; one schema-repair pass is
 * allowed before falling back to a graceful "couldn't grade" response.
 */
import { aiEndpoint } from '../../_shared/middleware';
import { z } from 'zod';
import { gateway, GatewayError, toGatewayContext } from '@/lib/ai/aiGateway';
import {
  ElaborationGradeSchema,
  ELABORATION_GRADE_DESCRIPTION,
} from '@/lib/ai/schemas/grading';

const gradeSchema = z.object({
  fact: z.string().min(5),
  studentExplanation: z.string().min(10),
  gradingRubric: z.array(z.string()),
});

const SYSTEM_PROMPT = `You grade Physician Assistant students' free-text explanations of clinical mechanisms.

Score strictly against the rubric. Be specific and actionable in feedback. Do not add commentary outside the required JSON.`;

function buildUserPrompt(args: {
  fact: string;
  studentExplanation: string;
  gradingRubric: string[];
}): string {
  const rubricList = args.gradingRubric.map((r, i) => `${i + 1}. ${r}`).join('\n');
  return `CLINICAL FACT: "${args.fact}"

STUDENT'S EXPLANATION: "${args.studentExplanation}"

GRADING RUBRIC — the explanation should address these concepts:
${rubricList}

SCORING (integer 0-3):
- 0 = no relevant content or completely incorrect
- 1 = partially correct — identifies the general topic but misses the mechanism
- 2 = correct mechanism but missing important rubric details
- 3 = complete — correct mechanism AND clinical relevance

Return ONLY a JSON object conforming to this schema:
${ELABORATION_GRADE_DESCRIPTION}`;
}

// Migrated to `aiEndpoint` (Sprint 9 rate-limit advisory): elaboration grading
// uses gateway.grade() against Gemini. 25 rpm 'ai' bucket matches profile.
export const onRequestPost = aiEndpoint(gradeSchema, async (context) => {
  const { fact, studentExplanation, gradingRubric } = context.validated;

  try {
    const { data } = await gateway.grade(
      toGatewayContext(context),
      {
        endpoint: '/api/drills/elaboration/grade',
        schema: ElaborationGradeSchema,
        schemaDescription: ELABORATION_GRADE_DESCRIPTION,
        systemPrompt: SYSTEM_PROMPT,
        userPrompt: buildUserPrompt({ fact, studentExplanation, gradingRubric }),
        temperature: 0.2,
        maxOutputTokens: 1024,
      },
    );

    return {
      status: 200,
      data: {
        score: data.score,
        maxScore: 3,
        feedback: data.feedback,
        missingConcepts: data.missingConcepts,
        modelExplanation: data.modelExplanation,
      },
    };
  } catch (error) {
    if (error instanceof GatewayError) {
      console.error('[elaboration/grade] gateway failure', {
        code: error.code,
        requestId: error.requestId,
        traceId: error.traceId,
        message: error.message,
      });
    } else {
      console.error('[elaboration/grade] unexpected failure:', error);
    }
    // Graceful degradation — student's drill flow shouldn't break on AI outage.
    return {
      status: 200,
      data: {
        score: 0,
        maxScore: 3,
        feedback: 'Grading temporarily unavailable — please try again.',
        missingConcepts: [],
        modelExplanation: '',
      },
    };
  }
});
