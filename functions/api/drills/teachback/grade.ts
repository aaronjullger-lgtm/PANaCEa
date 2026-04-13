/**
 * Teach-Back Grade Endpoint
 * POST /api/drills/teachback/grade
 *
 * Grades a student's teach-back explanation using Gemini.
 * Evaluates across 4 clinical categories:
 * 1. Definition/Pathophysiology — understands the "what"
 * 2. Presentation/Recognition — can identify the condition
 * 3. Diagnosis/Workup — knows how to evaluate
 * 4. Treatment/Management — can explain management
 *
 * Each category scored 0-3. Total maps to FSRS: ≤6 → Again, ≥7 → Good.
 *
 * Research:
 * - Fiorella & Mayer (2016): The generation effect in learning
 * - Chi et al. (1994): Self-explanation improves deep understanding
 *
 * @see functions/api/drills/teachback/generate.ts
 * @see hooks/game/use-teachback-drill.ts
 */

import { authenticatedEndpoint } from '../../_shared/middleware';
import { z } from 'zod';
import { aiGenerateObject } from '@/lib/ai-sdk';
import type { AIProviderEnv } from '@/lib/ai-sdk/providers';
import { createTrace, type LangfuseEnv } from '@/lib/observability/langfuse';

const bodySchema = z.object({
  topicId: z.string(),
  topic: z.string(),
  system: z.string(),
  explanation: z.string().min(20, 'Please write at least a short paragraph'),
  expectedConcepts: z.array(z.string()),
  prompt: z.string(),
});

interface CategoryScore {
  category: string;
  score: number;
  maxScore: number;
  feedback: string;
}

interface TeachBackGradeResult {
  categories: CategoryScore[];
  totalScore: number;
  maxScore: number;
  overallFeedback: string;
  missingConcepts: string[];
  strengths: string[];
  modelExplanation: string;
}

/** Zod schema for AI SDK generateObject() — structured grading output */
const TeachBackGradeSchema = z.object({
  categories: z.array(z.object({
    category: z.string().describe('Category name: Definition/Pathophysiology, Presentation/Recognition, Diagnosis/Workup, or Treatment/Management'),
    score: z.number().min(0).max(3).describe('Score 0-3 for this category'),
    feedback: z.string().describe('One sentence of specific feedback'),
  })).length(4),
  overallFeedback: z.string().describe('2-3 sentences of encouraging, constructive feedback'),
  missingConcepts: z.array(z.string()).describe('Key concepts the student missed'),
  strengths: z.array(z.string()).describe('Things the student explained well'),
  modelExplanation: z.string().describe('A concise ideal explanation in 3-4 sentences'),
});

function buildGradingPrompt(
  topic: string,
  system: string,
  prompt: string,
  explanation: string,
  expectedConcepts: string[]
): string {
  return `You are grading a PA student's "teach-back" explanation. The student was asked to explain a clinical topic as if teaching it to a classmate.

TOPIC: ${topic}
SYSTEM: ${system}
PROMPT GIVEN TO STUDENT: ${prompt}

EXPECTED KEY CONCEPTS (not all need to be covered):
${expectedConcepts.map((c, i) => `${i + 1}. ${c}`).join('\n')}

STUDENT'S EXPLANATION:
"""
${explanation}
"""

Grade the explanation across these 4 categories, each scored 0-3:

1. **Definition/Pathophysiology** (0-3): Does the student correctly explain what the condition/topic is and the underlying mechanism?
   - 0: Missing or completely incorrect
   - 1: Vague or partially correct
   - 2: Correct but incomplete
   - 3: Clear, accurate, and well-explained

2. **Presentation/Recognition** (0-3): Does the student describe how to recognize/identify the condition?
   - 0: Not addressed
   - 1: Lists some symptoms without context
   - 2: Good description of key findings
   - 3: Comprehensive with distinguishing features

3. **Diagnosis/Workup** (0-3): Does the student explain the diagnostic approach?
   - 0: Not addressed
   - 1: Mentions testing without rationale
   - 2: Logical workup with key tests
   - 3: Complete algorithm with interpretation

4. **Treatment/Management** (0-3): Does the student explain the management plan?
   - 0: Not addressed
   - 1: Vague or single intervention
   - 2: Appropriate treatment with key agents
   - 3: Comprehensive stepwise management

Respond in this exact JSON format:
{
  "categories": [
    { "category": "Definition/Pathophysiology", "score": <0-3>, "feedback": "<1 sentence>" },
    { "category": "Presentation/Recognition", "score": <0-3>, "feedback": "<1 sentence>" },
    { "category": "Diagnosis/Workup", "score": <0-3>, "feedback": "<1 sentence>" },
    { "category": "Treatment/Management", "score": <0-3>, "feedback": "<1 sentence>" }
  ],
  "overallFeedback": "<2-3 sentences of encouraging, constructive feedback>",
  "missingConcepts": ["<concept 1>", "<concept 2>"],
  "strengths": ["<strength 1>", "<strength 2>"],
  "modelExplanation": "<A concise, ideal explanation of this topic in 3-4 sentences that covers the key points>"
}

Be encouraging but honest. This is a learning exercise, not a pass/fail exam.`;
}

/** Primary: Vercel AI SDK generateObject() with Zod schema validation */
async function gradeWithAISDK(
  env: AIProviderEnv,
  gradingPrompt: string
): Promise<TeachBackGradeResult> {
  const result = await aiGenerateObject(env, {
    model: 'gemini-2.0-flash',
    system: 'You are grading a PA student teach-back explanation. Be encouraging but honest.',
    prompt: gradingPrompt,
    schema: TeachBackGradeSchema,
    schemaName: 'TeachBackGrade',
    schemaDescription: 'Structured grading of a teach-back explanation across 4 clinical categories',
    temperature: 0.3,
    maxTokens: 1024,
  });

  const { object } = result;
  const totalScore = object.categories.reduce((sum: number, c: { score: number }) => sum + c.score, 0);

  return {
    categories: object.categories.map((c: { category: string; score: number; feedback: string }) => ({ ...c, maxScore: 3 })),
    totalScore,
    maxScore: 12,
    overallFeedback: object.overallFeedback,
    missingConcepts: object.missingConcepts || [],
    strengths: object.strengths || [],
    modelExplanation: object.modelExplanation || '',
  };
}

/** Fallback: raw Gemini API call with JSON response parsing */
async function gradeWithGeminiRaw(
  apiKey: string,
  prompt: string
): Promise<TeachBackGradeResult> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 1024,
          responseMimeType: 'application/json',
        },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty Gemini response');

  const parsed = JSON.parse(text) as {
    categories: CategoryScore[];
    overallFeedback: string;
    missingConcepts: string[];
    strengths: string[];
    modelExplanation: string;
  };

  const totalScore = parsed.categories.reduce((sum, c) => sum + c.score, 0);

  return {
    categories: parsed.categories.map((c) => ({ ...c, maxScore: 3 })),
    totalScore,
    maxScore: 12,
    overallFeedback: parsed.overallFeedback,
    missingConcepts: parsed.missingConcepts || [],
    strengths: parsed.strengths || [],
    modelExplanation: parsed.modelExplanation || '',
  };
}

/** Fallback grading when Gemini is unavailable — keyword matching */
function gradeOffline(
  explanation: string,
  expectedConcepts: string[]
): TeachBackGradeResult {
  const lowerExplanation = explanation.toLowerCase();
  const matchedConcepts = expectedConcepts.filter((concept) => {
    const keywords = concept.toLowerCase().split(/[\s,/()]+/).filter((w) => w.length > 3);
    return keywords.some((kw) => lowerExplanation.includes(kw));
  });

  const coverage = matchedConcepts.length / Math.max(expectedConcepts.length, 1);
  const baseScore = Math.round(coverage * 3);
  const lengthBonus = explanation.length > 200 ? 1 : 0;

  const categories: CategoryScore[] = [
    { category: 'Definition/Pathophysiology', score: Math.min(baseScore + lengthBonus, 3), maxScore: 3, feedback: 'Scored by keyword matching (AI grading unavailable)' },
    { category: 'Presentation/Recognition', score: baseScore, maxScore: 3, feedback: 'Scored by keyword matching' },
    { category: 'Diagnosis/Workup', score: baseScore, maxScore: 3, feedback: 'Scored by keyword matching' },
    { category: 'Treatment/Management', score: baseScore, maxScore: 3, feedback: 'Scored by keyword matching' },
  ];

  const totalScore = categories.reduce((sum, c) => sum + c.score, 0);
  const missingConcepts = expectedConcepts.filter((c) => !matchedConcepts.includes(c));

  return {
    categories,
    totalScore,
    maxScore: 12,
    overallFeedback: `You covered ${matchedConcepts.length} of ${expectedConcepts.length} key concepts. ${missingConcepts.length > 0 ? 'Review the missing concepts below to strengthen your understanding.' : 'Great coverage!'}`,
    missingConcepts,
    strengths: matchedConcepts.slice(0, 3),
    modelExplanation: '',
  };
}

export const onRequestPost = authenticatedEndpoint(
  bodySchema,
  async (context) => {
    const { topic, system, explanation, expectedConcepts, prompt: studentPrompt } = context.data;
    const env = context.env as Record<string, string>;
    const geminiApiKey = env.GEMINI_API_KEY;

    let result: TeachBackGradeResult;
    let gradingMethod = 'offline';

    if (geminiApiKey) {
      const gradingPrompt = buildGradingPrompt(topic, system, studentPrompt, explanation, expectedConcepts);

      // Primary: AI SDK generateObject() with Zod schema
      try {
        const aiSdkEnv: AIProviderEnv = { GEMINI_API_KEY: geminiApiKey };
        result = await gradeWithAISDK(aiSdkEnv, gradingPrompt);
        gradingMethod = 'ai-sdk';
      } catch (aiSdkErr) {
        // Fallback: raw Gemini API
        try {
          result = await gradeWithGeminiRaw(geminiApiKey, gradingPrompt);
          gradingMethod = 'gemini-raw';
        } catch (rawErr) {
          console.warn('[teachback/grade] All AI grading failed, using offline fallback:', rawErr);
          result = gradeOffline(explanation, expectedConcepts);
        }
      }
    } else {
      result = gradeOffline(explanation, expectedConcepts);
    }

    // Langfuse tracing (fire-and-forget)
    try {
      const trace = createTrace(env as unknown as LangfuseEnv, {
        name: 'teachback-grade',
        userId: (context.auth as { userId?: string })?.userId,
        tags: [gradingMethod, 'ghost-grader', 'teachback'],
        metadata: { topic, system, gradingMethod, totalScore: result.totalScore },
      });
      if (trace) {
        trace.score({ name: 'teachback_score', value: result.totalScore / 12 });
        const ctx = context as unknown as { waitUntil?: (p: Promise<unknown>) => void };
        if (ctx.waitUntil && trace.flush) ctx.waitUntil(trace.flush());
      }
    } catch { /* Never block for observability */ }

    // Map to FSRS: ≤6/12 → Again (1), ≥7/12 → Good (3)
    const fsrsRating = result.totalScore >= 7 ? 3 : 1;

    return Response.json({
      data: {
        ...result,
        fsrsRating,
        passed: result.totalScore >= 7,
        gradingMethod,
      },
    });
  }
);
