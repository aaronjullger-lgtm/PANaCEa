/**
 * LangChain Question Generation Chain
 *
 * Replaces direct Gemini HTTP fetch calls in generate-rag.ts with
 * a LangChain-based chain that supports multi-provider fallback,
 * structured output, and LangSmith tracing.
 *
 * The RAG retrieval + CRAG guardrail logic stays in generate-rag.ts;
 * this module handles ONLY the LLM generation and self-refine calls.
 *
 * Uses ChatPromptTemplate for type-safe prompt construction.
 *
 * @module lib/langchain/chains/questionGeneration
 * Sprint: LangChain Integration — Sprint 2
 */

import { z } from 'zod';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { routeTask } from '../router';
import type { AIEnvKeys } from '../models';
import type { RouteOptions, RouteResult } from '../router';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface QuestionGenerationParams {
  conditionName: string;
  system: string;
  count: number;
  questionType: string;
  formattedContext: string;
}

export interface QuestionGenerationResult {
  questions: unknown[];
  model: string;
  provider: string;
  latencyMs: number;
  usage?: RouteResult['usage'];
  error?: string;
}

// ─── Zod Schema ────────────────────────────────────────────────────────────

const QuestionItemSchema = z.object({
  type: z.string(),
  question: z.string(),
  options: z.array(z.string()),
  correctAnswer: z.string(),
  explanation: z.object({
    rationale: z.string().optional(),
    incorrect: z.record(z.string(), z.string()).optional(),
  }).optional(),
  difficulty: z.number().optional(),
  sourceSections: z.array(z.string()).optional(),
  sourceConditions: z.array(z.string()).optional(),
  insufficient: z.boolean().optional(),
});

const QuestionResponseSchema = z.union([
  z.array(QuestionItemSchema),
  QuestionItemSchema,
  z.object({ insufficient: z.literal(true) }),
]);

// ─── Prompt Template ────────────────────────────────────────────────────────

const questionSystemPrompt = `You are a board-certified physician and experienced NBME item-writer creating PANCE-style clinical questions for PA students.

CRITICAL RULES:
- Generate questions ONLY from the provided clinical reference context below.
- NEVER hallucinate clinical details not present in the context.
- NEVER state the diagnosis or condition name in the vignette stem. Use raw patient data only.
- If the context is insufficient to create a clinically accurate question, return {{"insufficient": true}}.
- Each wrong answer must be correct for a slightly different patient scenario.
- Prefer third-order questions (mechanism, next step, complication management).
- Include at least 2 pertinent negatives that rule out top differentials.`;

const questionPromptTemplate = ChatPromptTemplate.fromMessages([
  ['system', questionSystemPrompt],
  ['human', `{formattedContext}

TASK: Generate {count} high-quality '{questionType}' question(s) about {conditionName} ({system}) strictly based on the clinical reference context above.

OUTPUT FORMAT (JSON array):
[{{
  "type": "{questionType}",
  "question": "Clinical vignette with raw patient data only...",
  "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
  "correctAnswer": "Matches one option exactly",
  "explanation": {{
    "rationale": "Why the correct answer is correct, citing specific clinical evidence.",
    "incorrect": {{"A": "Why wrong for THIS patient; when correct", "B": "...", "C": "...", "D": "..."}}
  }},
  "difficulty": 0.5,
  "sourceSections": ["pathophysiology", "treatment"],
  "sourceConditions": ["{conditionName}"]
}}]

Return ONLY valid JSON. No markdown fences.`],
]);

// ─── Chain Functions ──────────────────────────────────────────────────────

/**
 * Generate PANCE-style questions using LangChain routing with multi-provider fallback.
 */
export async function generateQuestions(
  env: AIEnvKeys,
  params: QuestionGenerationParams,
  options: RouteOptions = {}
): Promise<QuestionGenerationResult> {
  const { conditionName, system, count, questionType, formattedContext } = params;

  try {
    // Step 1: Format prompt via ChatPromptTemplate (type-safe, synchronous)
    const messages = await questionPromptTemplate.formatMessages({
      formattedContext,
      count: String(count),
      questionType,
      conditionName,
      system,
    });

    const systemMsg = messages[0]?.content as string ?? questionSystemPrompt;
    const userMsg = messages[1]?.content as string ?? '';

    // Step 2: Route through multi-provider fallback
    const result = await routeTask('question-generation', env, {
      systemPrompt: systemMsg,
      userPrompt: userMsg,
    }, {
      temperature: 0.7,
      maxOutputTokens: 4096,
      runName: `panacea:question-gen:${conditionName}`,
      metadata: { conditionName, system, count, questionType },
      ...options,
    });

    // Step 3: Parse + validate
    const questions = parseQuestionResponse(result.output);

    return {
      questions,
      model: result.model,
      provider: result.provider,
      latencyMs: result.latencyMs,
      usage: result.usage,
    };
  } catch (error) {
    return {
      questions: [],
      model: 'unknown',
      provider: 'unknown',
      latencyMs: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Run a critique pass on a generated question.
 * Returns raw critique text for parsing by selfRefineService.
 */
export async function critiqueQuestion(
  env: AIEnvKeys,
  critiquePrompt: string,
  options: RouteOptions = {}
): Promise<RouteResult<string>> {
  return routeTask('question-critique', env, {
    userPrompt: critiquePrompt,
  }, {
    temperature: 0.3,
    maxOutputTokens: 2048,
    runName: 'panacea:question-critique',
    ...options,
  });
}

/**
 * Rewrite a question based on critique feedback.
 * Returns raw rewrite text for JSON parsing.
 */
export async function rewriteQuestion(
  env: AIEnvKeys,
  rewritePrompt: string,
  options: RouteOptions = {}
): Promise<RouteResult<string>> {
  return routeTask('question-generation', env, {
    userPrompt: rewritePrompt,
  }, {
    temperature: 0.5,
    maxOutputTokens: 4096,
    runName: 'panacea:question-rewrite',
    ...options,
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function parseQuestionResponse(text: string): unknown[] {
  let cleaned = text.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) cleaned = fenceMatch[1]!.trim();

  // Clean LLM artifacts
  cleaned = cleaned
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/,(\s*[}\]])/g, '$1');

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return [];
  }

  try {
    const validated = QuestionResponseSchema.parse(parsed);
    if ('insufficient' in validated && validated.insufficient) {
      return [];
    }
    return Array.isArray(validated) ? validated : [validated];
  } catch {
    // If Zod validation fails, return the raw parsed JSON so upstream
    // self-refine logic still has something to work with.
    return Array.isArray(parsed) ? parsed : [parsed];
  }
}
