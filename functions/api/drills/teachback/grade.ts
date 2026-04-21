/**
 * Teach-Back Drill — Grading Endpoint
 * POST /api/drills/teachback/grade
 *
 * Grades a PA student's free-text "explain it to a classmate" response
 * across 4 clinical categories, each scored 0-3:
 *   1. Definition/Pathophysiology
 *   2. Presentation/Recognition
 *   3. Diagnosis/Workup
 *   4. Treatment/Management
 *
 * Total (0-12) maps to FSRS: ≤6 → Again, ≥7 → Good.
 *
 * Migrated to the unified AI Gateway (Sprint 4). All model access now flows
 * through `gateway.grade()` — no direct GoogleGenerativeAI, no raw fetch to
 * generativelanguage.googleapis.com, no `aiGenerateObject` indirection, no
 * unchecked JSON.parse. Structured output validated against
 * TeachBackGradeSchema with a single schema-repair pass allowed.
 *
 * The offline keyword-matching grader is preserved ONLY as a graceful
 * degradation path for student-facing drill continuity — it is never used
 * as a silent AI fallback. If the gateway throws, we log the GatewayError
 * (with code + traceId) and fall back to the deterministic keyword grader
 * so students aren't blocked mid-drill.
 *
 * Research:
 * - Fiorella & Mayer (2016): The generation effect
 * - Chi et al. (1994): Self-explanation improves deep understanding
 *
 * @see functions/api/drills/teachback/generate.ts
 * @see hooks/game/use-teachback-drill.ts
 */

import { aiEndpoint, withCors} from '../../_shared/middleware';
import { z } from 'zod';
import { gateway, GatewayError, toGatewayContext } from '@/lib/ai/aiGateway';
import {
  TeachBackGradeSchema,
  TEACHBACK_GRADE_DESCRIPTION,
  type TeachBackGrade,
} from '@/lib/ai/schemas/grading';

const bodySchema = z.object({
  topicId: z.string(),
  topic: z.string(),
  system: z.string(),
  explanation: z.string().min(20, 'Please write at least a short paragraph'),
  expectedConcepts: z.array(z.string()),
  prompt: z.string(),
});

interface CategoryScoreWithMax {
  category: string;
  score: number;
  maxScore: number;
  feedback: string;
}

interface TeachBackGradeResult {
  categories: CategoryScoreWithMax[];
  totalScore: number;
  maxScore: number;
  overallFeedback: string;
  missingConcepts: string[];
  strengths: string[];
  modelExplanation: string;
}

const SYSTEM_PROMPT = `You grade Physician Assistant students' "teach-back" explanations of clinical topics.

Score strictly against the 4-category rubric. Be encouraging but honest — this is a learning exercise. Do not add commentary outside the required JSON.`;

function buildUserPrompt(args: {
  topic: string;
  system: string;
  studentPrompt: string;
  explanation: string;
  expectedConcepts: string[];
}): string {
  const conceptList = args.expectedConcepts
    .map((c, i) => `${i + 1}. ${c}`)
    .join('\n');

  return `TOPIC: ${args.topic}
SYSTEM: ${args.system}
PROMPT GIVEN TO STUDENT: ${args.studentPrompt}

EXPECTED KEY CONCEPTS (not all need to be covered):
${conceptList}

STUDENT'S EXPLANATION:
"""
${args.explanation}
"""

Grade across these 4 categories, each scored 0-3:

1. **Definition/Pathophysiology** — Does the student correctly explain what the condition is and the underlying mechanism?
   0 = missing/incorrect · 1 = vague or partial · 2 = correct but incomplete · 3 = clear, accurate, well-explained

2. **Presentation/Recognition** — Does the student describe how to recognize the condition?
   0 = not addressed · 1 = some symptoms without context · 2 = good description of key findings · 3 = comprehensive with distinguishing features

3. **Diagnosis/Workup** — Does the student explain the diagnostic approach?
   0 = not addressed · 1 = tests without rationale · 2 = logical workup with key tests · 3 = complete algorithm with interpretation

4. **Treatment/Management** — Does the student explain the management plan?
   0 = not addressed · 1 = vague or single intervention · 2 = appropriate treatment with key agents · 3 = comprehensive stepwise management

Be encouraging but honest. This is a learning exercise, not a pass/fail exam.

Return ONLY a JSON object conforming to this schema:
${TEACHBACK_GRADE_DESCRIPTION}`;
}

/**
 * Convert the validated TeachBackGrade (from the gateway) into the
 * wire-format TeachBackGradeResult the client expects.
 */
function shapeResult(grade: TeachBackGrade): TeachBackGradeResult {
  const categories: CategoryScoreWithMax[] = grade.categories.map((c) => ({
    category: c.category,
    score: c.score,
    maxScore: 3,
    feedback: c.feedback,
  }));
  const totalScore = categories.reduce((sum, c) => sum + c.score, 0);
  return {
    categories,
    totalScore,
    maxScore: 12,
    overallFeedback: grade.overallFeedback,
    missingConcepts: grade.missingConcepts,
    strengths: grade.strengths,
    modelExplanation: grade.modelExplanation,
  };
}

/**
 * Deterministic offline grader — preserved solely for graceful degradation
 * when the AI gateway fails end-to-end. NOT an AI fallback; produces
 * keyword-match results that are clearly labeled as such.
 */
function gradeOffline(
  explanation: string,
  expectedConcepts: string[],
): TeachBackGradeResult {
  const lowerExplanation = explanation.toLowerCase();
  const matchedConcepts = expectedConcepts.filter((concept) => {
    const keywords = concept
      .toLowerCase()
      .split(/[\s,/()]+/)
      .filter((w) => w.length > 3);
    return keywords.some((kw) => lowerExplanation.includes(kw));
  });

  const coverage = matchedConcepts.length / Math.max(expectedConcepts.length, 1);
  const baseScore = Math.round(coverage * 3);
  const lengthBonus = explanation.length > 200 ? 1 : 0;

  const categories: CategoryScoreWithMax[] = [
    {
      category: 'Definition/Pathophysiology',
      score: Math.min(baseScore + lengthBonus, 3),
      maxScore: 3,
      feedback: 'Scored by keyword matching (AI grading temporarily unavailable).',
    },
    {
      category: 'Presentation/Recognition',
      score: baseScore,
      maxScore: 3,
      feedback: 'Scored by keyword matching.',
    },
    {
      category: 'Diagnosis/Workup',
      score: baseScore,
      maxScore: 3,
      feedback: 'Scored by keyword matching.',
    },
    {
      category: 'Treatment/Management',
      score: baseScore,
      maxScore: 3,
      feedback: 'Scored by keyword matching.',
    },
  ];

  const totalScore = categories.reduce((sum, c) => sum + c.score, 0);
  const missingConcepts = expectedConcepts.filter((c) => !matchedConcepts.includes(c));

  return {
    categories,
    totalScore,
    maxScore: 12,
    overallFeedback: `You covered ${matchedConcepts.length} of ${expectedConcepts.length} key concepts. ${
      missingConcepts.length > 0
        ? 'Review the missing concepts below to strengthen your understanding.'
        : 'Great coverage!'
    }`,
    missingConcepts,
    strengths: matchedConcepts.slice(0, 3),
    modelExplanation: '',
  };
}

// Migrated to `aiEndpoint` (Sprint 9 rate-limit advisory): teachback grading
// invokes Gemini to score free-text clinical explanations. 25 rpm 'ai' bucket.
export const onRequestOptions = withCors();

export const onRequestPost = aiEndpoint(bodySchema, async (context) => {
  const {
    topic,
    system,
    explanation,
    expectedConcepts,
    prompt: studentPrompt,
  } = context.validated;

  let result: TeachBackGradeResult;
  let gradingMethod: 'gateway' | 'offline' = 'gateway';

  try {
    const { data } = await gateway.grade(toGatewayContext(context), {
      endpoint: '/api/drills/teachback/grade',
      schema: TeachBackGradeSchema,
      schemaDescription: TEACHBACK_GRADE_DESCRIPTION,
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: buildUserPrompt({
        topic,
        system,
        studentPrompt,
        explanation,
        expectedConcepts,
      }),
      temperature: 0.3,
      maxOutputTokens: 1024,
    });
    result = shapeResult(data);
  } catch (error) {
    if (error instanceof GatewayError) {
      console.error('[teachback/grade] gateway failure', {
        code: error.code,
        requestId: error.requestId,
        traceId: error.traceId,
        message: error.message,
      });
    } else {
      console.error('[teachback/grade] unexpected failure:', error);
    }
    // Graceful degradation — student's drill flow shouldn't break on AI outage.
    result = gradeOffline(explanation, expectedConcepts);
    gradingMethod = 'offline';
  }

  // FSRS mapping: ≤6/12 → Again (1), ≥7/12 → Good (3)
  const fsrsRating = result.totalScore >= 7 ? 3 : 1;

  return {
    status: 200,
    data: {
      ...result,
      fsrsRating,
      passed: result.totalScore >= 7,
      gradingMethod,
    },
  };
});
