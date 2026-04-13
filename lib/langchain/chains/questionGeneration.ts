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
 * @module lib/langchain/chains/questionGeneration
 * Sprint: LangChain Integration — Sprint 2
 */

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
}

// ─── System Prompt ────────────────────────────────────────────────────────

const QUESTION_GEN_SYSTEM_PROMPT = `You are a board-certified physician and experienced NBME item-writer creating PANCE-style clinical questions for PA students.

CRITICAL RULES:
- Generate questions ONLY from the provided clinical reference context below.
- NEVER hallucinate clinical details not present in the context.
- NEVER state the diagnosis or condition name in the vignette stem. Use raw patient data only.
- If the context is insufficient to create a clinically accurate question, return {"insufficient": true}.
- Each wrong answer must be correct for a slightly different patient scenario.
- Prefer third-order questions (mechanism, next step, complication management).
- Include at least 2 pertinent negatives that rule out top differentials.`;

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

  const userPrompt = `${formattedContext}

TASK: Generate ${count} high-quality '${questionType}' question(s) about ${conditionName} (${system}) strictly based on the clinical reference context above.

OUTPUT FORMAT (JSON array):
[{
  "type": "${questionType}",
  "question": "Clinical vignette with raw patient data only...",
  "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
  "correctAnswer": "Matches one option exactly",
  "explanation": {
    "rationale": "Why the correct answer is correct, citing specific clinical evidence.",
    "incorrect": {"A": "Why wrong for THIS patient; when correct", "B": "...", "C": "...", "D": "..."}
  },
  "difficulty": 0.5,
  "sourceSections": ["pathophysiology", "treatment"],
  "sourceConditions": ["${conditionName}"]
}]

Return ONLY valid JSON. No markdown fences.`;

  const result = await routeTask('question-generation', env, {
    systemPrompt: QUESTION_GEN_SYSTEM_PROMPT,
    userPrompt,
  }, {
    temperature: 0.7,
    maxOutputTokens: 4096,
    runName: `panacea:question-gen:${conditionName}`,
    metadata: { conditionName, system, count, questionType },
    ...options,
  });

  // Parse the JSON response
  const questions = parseQuestionResponse(result.output);

  return {
    questions,
    model: result.model,
    provider: result.provider,
    latencyMs: result.latencyMs,
    usage: result.usage,
  };
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

  const parsed = JSON.parse(cleaned);
  return Array.isArray(parsed) ? parsed : [parsed];
}
