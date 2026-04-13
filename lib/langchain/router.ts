/**
 * LangChain Model Router with Multi-Provider Fallback
 *
 * Routes AI tasks to the appropriate model with automatic fallback
 * across providers when the primary model fails.
 *
 * Features:
 * - Task-based model selection (question-generation, osce-chat, etc.)
 * - Automatic retry with exponential backoff
 * - Provider fallback chain (e.g., Gemini → OpenAI → Anthropic)
 * - LangSmith tracing integration
 * - Structured output via Zod schemas
 *
 * @module lib/langchain/router
 * Sprint: LangChain Integration — Sprint 2
 */

import { z } from 'zod';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { BaseMessage } from '@langchain/core/messages';

import {
  TASK_MODEL_MAP,
  MODEL_REGISTRY,
  DEFAULT_PARAMS,
  type TaskType,
  type ModelName,
} from './config';
import { createModel, isModelAvailable, type AIEnvKeys, type CreateModelOptions } from './models';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface RouteOptions {
  /** Override temperature for this call */
  temperature?: number;
  /** Override max output tokens */
  maxOutputTokens?: number;
  /** Force a specific model (bypasses task routing) */
  forceModel?: ModelName;
  /** Max total attempts across all providers */
  maxAttempts?: number;
  /** LangSmith run name for tracing */
  runName?: string;
  /** Additional metadata for tracing */
  metadata?: Record<string, unknown>;
}

export interface RouteResult<T = string> {
  /** The parsed output */
  output: T;
  /** Which model actually handled the request */
  model: ModelName;
  /** Which provider handled the request */
  provider: string;
  /** Number of attempts before success */
  attempts: number;
  /** Total latency in ms */
  latencyMs: number;
  /** Token usage (if available) */
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
}

// ─── Core Router ───────────────────────────────────────────────────────────

/**
 * Route a text prompt to the best available model for a given task.
 *
 * @example
 * ```ts
 * const result = await routeTask('question-generation', env, {
 *   systemPrompt: 'You are a medical educator...',
 *   userPrompt: 'Generate a question about CHF...',
 * });
 * console.log(result.output); // The generated text
 * console.log(result.model);  // 'gemini-2.0-flash'
 * ```
 */
export async function routeTask(
  task: TaskType | string,
  env: AIEnvKeys,
  params: {
    systemPrompt?: string;
    userPrompt: string;
    messages?: BaseMessage[];
  },
  options: RouteOptions = {}
): Promise<RouteResult<string>> {
  const models = resolveModelChain(task, env, options.forceModel);

  if (models.length === 0) {
    throw new Error(
      `No available models for task "${task}". ` +
      `Configure at least one API key: GEMINI_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY, or DEEPSEEK_API_KEY.`
    );
  }

  const maxAttempts = options.maxAttempts ?? models.length * DEFAULT_PARAMS.maxRetries;
  let attempt = 0;
  let lastError: Error | null = null;

  for (const modelName of models) {
    for (let retry = 0; retry < DEFAULT_PARAMS.maxRetries; retry++) {
      attempt++;
      if (attempt > maxAttempts) break;

      try {
        const start = Date.now();

        const model = createModel(modelName, env, {
          temperature: options.temperature,
          maxOutputTokens: options.maxOutputTokens,
          runName: options.runName ?? `panacea:${task}`,
        });

        const messages: BaseMessage[] = params.messages ?? [
          ...(params.systemPrompt ? [new SystemMessage(params.systemPrompt)] : []),
          new HumanMessage(params.userPrompt),
        ];

        const response = await model.invoke(messages);
        const latencyMs = Date.now() - start;

        const text = typeof response.content === 'string'
          ? response.content
          : JSON.stringify(response.content);

        return {
          output: text,
          model: modelName,
          provider: MODEL_REGISTRY[modelName]?.provider ?? 'unknown',
          attempts: attempt,
          latencyMs,
          usage: extractUsage(response),
        };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.warn(
          `[LangChain Router] ${modelName} attempt ${retry + 1} failed:`,
          lastError.message.slice(0, 200)
        );

        // Backoff before retry (not before fallback to next model)
        if (retry < DEFAULT_PARAMS.maxRetries - 1) {
          await sleep(DEFAULT_PARAMS.retryDelayMs * (retry + 1));
        }
      }
    }
  }

  throw new Error(
    `All models failed for task "${task}" after ${attempt} attempts. ` +
    `Last error: ${lastError?.message ?? 'unknown'}`
  );
}

/**
 * Route a task with structured JSON output validated by a Zod schema.
 *
 * Uses LangChain's `withStructuredOutput` when available, falling back
 * to JSON parsing with Zod validation.
 *
 * @example
 * ```ts
 * const QuestionSchema = z.object({
 *   question: z.string(),
 *   options: z.array(z.string()),
 *   correctAnswer: z.string(),
 *   explanation: z.string(),
 * });
 *
 * const result = await routeStructured('question-generation', env, {
 *   systemPrompt: 'Generate a PANCE question...',
 *   userPrompt: 'Topic: CHF',
 * }, QuestionSchema);
 *
 * result.output.question // fully typed!
 * ```
 */
export async function routeStructured<T extends z.ZodType>(
  task: TaskType | string,
  env: AIEnvKeys,
  params: {
    systemPrompt?: string;
    userPrompt: string;
  },
  schema: T,
  options: RouteOptions = {}
): Promise<RouteResult<z.infer<T>>> {
  // Add JSON instruction to the prompt
  const jsonInstruction =
    '\n\nReturn ONLY valid JSON matching the required schema. No markdown fences, no explanatory text.';

  const result = await routeTask(task, env, {
    systemPrompt: params.systemPrompt,
    userPrompt: params.userPrompt + jsonInstruction,
  }, {
    ...options,
    temperature: options.temperature ?? 0.5, // Lower temp for structured output
  });

  // Parse and validate
  const parsed = parseJsonResponse(result.output);
  const validated = schema.parse(parsed);

  return {
    ...result,
    output: validated,
  };
}

// ─── Model Chain Resolution ────────────────────────────────────────────────

/**
 * Determine the ordered list of models to try for a given task,
 * filtered to only those with available API keys.
 */
function resolveModelChain(
  task: string,
  env: AIEnvKeys,
  forceModel?: ModelName
): ModelName[] {
  if (forceModel) {
    if (!isModelAvailable(forceModel, env)) {
      throw new Error(`Forced model "${forceModel}" is not available (missing API key)`);
    }
    return [forceModel];
  }

  const mapping = TASK_MODEL_MAP[task as TaskType];
  if (!mapping) {
    // Unknown task — try all models in cost order
    return (Object.keys(MODEL_REGISTRY) as ModelName[])
      .filter((name) => isModelAvailable(name, env))
      .sort((a, b) => {
        const costA = (MODEL_REGISTRY[a].inputCostPer1M ?? 999);
        const costB = (MODEL_REGISTRY[b].inputCostPer1M ?? 999);
        return costA - costB;
      });
  }

  const chain: ModelName[] = [];
  if (isModelAvailable(mapping.primary, env)) {
    chain.push(mapping.primary);
  }
  for (const fallback of mapping.fallbacks) {
    if (isModelAvailable(fallback, env)) {
      chain.push(fallback);
    }
  }

  return chain;
}

// ─── Utilities ─────────────────────────────────────────────────────────────

function parseJsonResponse(text: string): unknown {
  // Strip markdown code fences if present
  let cleaned = text.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) cleaned = fenceMatch[1].trim();

  // Clean common LLM artifacts
  cleaned = cleaned
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/,(\s*[}\]])/g, '$1'); // trailing commas

  return JSON.parse(cleaned);
}

function extractUsage(response: unknown): RouteResult['usage'] {
  const resp = response as Record<string, unknown>;
  const meta = resp?.response_metadata as Record<string, unknown> | undefined;
  const usage = (meta?.usage ?? resp?.usage_metadata) as Record<string, number> | undefined;
  if (!usage) return undefined;

  return {
    inputTokens: usage.prompt_tokens ?? usage.input_tokens ?? usage.promptTokenCount,
    outputTokens: usage.completion_tokens ?? usage.output_tokens ?? usage.candidatesTokenCount,
    totalTokens: usage.total_tokens ?? usage.totalTokenCount,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
