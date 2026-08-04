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
import type { BaseMessage } from '@langchain/core/messages';
import type { RunnableConfig } from '@langchain/core/runnables';

import {
  TASK_MODEL_MAP,
  MODEL_REGISTRY,
  DEFAULT_PARAMS,
  type TaskType,
  type ModelName,
} from './config';
import { createModel, isModelAvailable, type AIEnvKeys } from './models';
import { buildTracingConfig, type TracingOptions } from './tracing';
import type { CostTracker } from '@/lib/ai/costTracker';
import type { CircuitBreaker } from '@/lib/ai/circuitBreaker';
import { getRequestCostGuardrails } from '@/lib/ai/costGuardrailContext';

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
  /** Cost guardrail: tracker for budget enforcement. If provided, pre-call budget checks and post-call cost recording are enabled. */
  costTracker?: CostTracker;
  /** Cost guardrail: circuit breaker for provider health. If provided, budget-exceeded providers are skipped. */
  circuitBreaker?: CircuitBreaker;
  /** Cost guardrail: user ID for per-user budget tracking */
  userId?: string;
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
  estimatedCostUsd?: number;
}

// ─── Core Router ───────────────────────────────────────────────────────────

/**
 * Context passed to the per-model handler inside the retry loop.
 * Separates retry/backoff orchestration from response handling.
 */
interface InvokeContext {
  model: ReturnType<typeof createModel>;
  modelName: ModelName;
  messages: BaseMessage[];
  tracingConfig: RunnableConfig;
}

/**
 * Shared retry-with-fallback loop. Iterates over the model chain with
 * exponential backoff, delegating the actual LLM call to `handler`.
 */
async function executeWithFallback<T>(
  task: string,
  env: AIEnvKeys,
  params: {
    systemPrompt?: string;
    userPrompt: string;
    messages?: BaseMessage[];
  },
  options: RouteOptions,
  handler: (ctx: InvokeContext) => Promise<{ output: T; usage?: RouteResult['usage'] }>,
): Promise<RouteResult<T>> {
  const ctx = getRequestCostGuardrails();
  const costTracker = options.costTracker ?? ctx.costTracker;
  const circuitBreaker = options.circuitBreaker ?? ctx.circuitBreaker;
  const userId = options.userId ?? ctx.userId;
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
  const temperature = options.temperature;
  const maxTokens = options.maxOutputTokens ?? DEFAULT_PARAMS.maxOutputTokens;

  // Build base tracing config — enriched per-model inside the loop.
  const baseTracingConfig: RunnableConfig = buildTracingConfig(env, {
    runName: options.runName ?? `panacea:${task}`,
    tags: ['task', task],
    metadata: {
      task_type: task,
      ...options.metadata,
    },
  });

  for (const modelName of models) {
    const registry = MODEL_REGISTRY[modelName];
    const provider = registry?.provider ?? 'unknown';
    const costTier: TracingOptions['costTier'] =
      (registry?.inputCostPer1M ?? 999) === 0 ? 'free' :
      (registry?.inputCostPer1M ?? 999) <= 0.15 ? 'budget' :
      (registry?.inputCostPer1M ?? 999) <= 2.00 ? 'mid' : 'premium';

    // Enrich tracing config with model-specific metadata.
    const modelTracingConfig: RunnableConfig = {
      ...baseTracingConfig,
      tags: [...(baseTracingConfig.tags ?? []), `model:${modelName}`, `provider:${provider}`, `cost:${costTier}`],
      metadata: {
        ...(baseTracingConfig.metadata ?? {}),
        model_name: modelName,
        provider,
        cost_tier: costTier,
        input_cost_per_1m: registry?.inputCostPer1M,
        output_cost_per_1m: registry?.outputCostPer1M,
      },
    };
    if (circuitBreaker) {
      const provider = MODEL_REGISTRY[modelName]?.provider as import('@/lib/langchain/config').ModelProvider | undefined;
      if (provider && !circuitBreaker.isAvailable(provider)) {
        console.warn(`[LangChain Router] ${modelName} skipped — circuit breaker open`);
        continue;
      }
    }

    if (costTracker) {
      const registry = MODEL_REGISTRY[modelName];
      if (registry) {
        const budgetCheck = await costTracker.checkBudget({
          provider: registry.provider,
          userId,
          estimatedInputTokens: Math.ceil(params.userPrompt.length / 4),
          estimatedOutputTokens: maxTokens,
          inputCostPer1M: registry.inputCostPer1M ?? 0,
          outputCostPer1M: registry.outputCostPer1M ?? 0,
        });

        if (!budgetCheck.allowed) {
          console.warn(`[CostGuardrail] ${modelName} BLOCKED: ${budgetCheck.reason}`);
          if (circuitBreaker && budgetCheck.reason?.includes('exhausted')) {
            circuitBreaker.tripForBudget(registry.provider);
          }
          continue;
        }
      }
    }

    for (let retry = 0; retry < DEFAULT_PARAMS.maxRetries; retry++) {
      attempt++;
      if (attempt > maxAttempts) break;

      try {
        const start = Date.now();

        const model = createModel(modelName, env, {
          temperature,
          maxOutputTokens: maxTokens,
        });

        const messages: BaseMessage[] = params.messages ?? [
          ...(params.systemPrompt ? [new SystemMessage(params.systemPrompt)] : []),
          new HumanMessage(params.userPrompt),
        ];

        // Only attach LangSmith tracer on the first attempt per model.
        // Retries during error storms would otherwise multiply trace events
        // and burn through the LangSmith event quota.
        const activeConfig = retry === 0
          ? modelTracingConfig
          : { tags: modelTracingConfig.tags, metadata: modelTracingConfig.metadata };

        const result = await handler({ model, modelName, messages, tracingConfig: activeConfig });
        const latencyMs = Date.now() - start;

        const registry = MODEL_REGISTRY[modelName];
        const cost = registry && result.usage
          ? ((result.usage.inputTokens ?? 0) / 1_000_000) * (registry.inputCostPer1M ?? 0) +
            ((result.usage.outputTokens ?? 0) / 1_000_000) * (registry.outputCostPer1M ?? 0)
          : undefined;

        if (costTracker && registry && result.usage) {
          await costTracker.recordCost({
            provider: registry.provider,
            modelName,
            userId,
            inputTokens: result.usage.inputTokens ?? 0,
            outputTokens: result.usage.outputTokens ?? 0,
            inputCostPer1M: registry.inputCostPer1M ?? 0,
            outputCostPer1M: registry.outputCostPer1M ?? 0,
          });
        }

        if (circuitBreaker && registry) {
          circuitBreaker.recordSuccess(registry.provider);
        }

        return {
          output: result.output,
          model: modelName,
          provider: registry?.provider ?? 'unknown',
          attempts: attempt,
          latencyMs,
          usage: result.usage,
          estimatedCostUsd: cost,
        };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.warn(
          `[LangChain Router] ${modelName} attempt ${retry + 1} failed:`,
          lastError.message.slice(0, 200)
        );

        if (circuitBreaker) {
          const registry = MODEL_REGISTRY[modelName];
          if (registry) circuitBreaker.recordFailure(registry.provider);
        }

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
  return executeWithFallback(task, env, params, options, async ({ model, messages, tracingConfig }) => {
    const response = await model.invoke(messages, tracingConfig);

    const text = typeof response.content === 'string'
      ? response.content
      : JSON.stringify(response.content);

    return { output: text, usage: extractUsage(response) };
  });
}

/**
 * Route a task with structured JSON output validated by a Zod schema.
 *
 * Attempts `withStructuredOutput()` first (native tool calling on
 * Anthropic, OpenAI, Gemini). Falls back to JSON-prompt + Zod parse
 * for providers that don't support structured output or when the
 * feature call fails.
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
    messages?: BaseMessage[];
  },
  schema: T,
  options: RouteOptions = {}
): Promise<RouteResult<z.infer<T>>> {
  // Structured output benefits from lower temperature for deterministic JSON
  const structuredOptions = { ...options, temperature: options.temperature ?? 0.5 };

  return executeWithFallback(task, env, params, structuredOptions, async ({ model, messages, tracingConfig }) => {
    // Try native structured output first
    try {
      const structuredModel = model.withStructuredOutput(schema);
      const structured = await structuredModel.invoke(messages, tracingConfig);
      return { output: structured as z.infer<T> };
    } catch (structuredErr) {
      console.warn(
        `[LangChain Router] withStructuredOutput failed:`,
        structuredErr instanceof Error ? structuredErr.message.slice(0, 200) : String(structuredErr).slice(0, 200)
      );
    }

    // Fallback: instruct JSON + manual parse + Zod validate
    const response = await model.invoke(messages, tracingConfig);

    const text = typeof response.content === 'string'
      ? response.content
      : JSON.stringify(response.content);

    const parsed = parseJsonResponse(text);
    const validated = schema.parse(parsed);

    return { output: validated };
  });
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

/** Shared JSON response parser. Strips code fences, normalizes smart quotes, removes trailing commas. */
export function parseJsonResponse(text: string): unknown {
  // Strip markdown code fences if present
  let cleaned = text.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch?.[1]) cleaned = fenceMatch[1].trim();

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
