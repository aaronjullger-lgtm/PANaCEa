/**
 * LangSmith Tracing Integration
 *
 * Creates per-request LangChain callback handlers for observability
 * across all LangChain calls. Tracing is opt-in: if no
 * LANGSMITH_API_KEY is present, returns empty config.
 *
 * Uses `LangChainTracer` callback handlers passed via `RunnableConfig`
 * instead of mutating `globalThis` — safe for concurrent Edge requests.
 *
 * @module lib/langchain/tracing
 * Sprint: LangChain Integration — Sprint 2
 */

import { LangChainTracer } from '@langchain/core/tracers/tracer_langchain';
import type { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import type { AIEnvKeys } from './models';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface TracingOptions {
  /** Run name shown in LangSmith UI */
  runName?: string;
  /** Tags for filtering runs */
  tags?: string[];
  /** Arbitrary metadata attached to the run */
  metadata?: Record<string, unknown>;
}

/**
 * Tracing config ready to be spread into a RunnableConfig.
 * If tracing is disabled, all arrays are empty so spreading is safe.
 */
export interface TracingConfig {
  callbacks: BaseCallbackHandler[];
  tags: string[];
  metadata: Record<string, unknown>;
  runName?: string;
}

// ─── Environment Check ────────────────────────────────────────────────────

/**
 * Check if LangSmith tracing is available.
 */
export function isTracingEnabled(env: AIEnvKeys): boolean {
  return !!env.LANGSMITH_API_KEY;
}

// ─── Tracer Factory ───────────────────────────────────────────────────────

/**
 * Build a per-request LangChainTracer callback handler.
 *
 * Unlike `configureLangSmithEnv` (which mutates globalThis),
 * this creates an isolated tracer instance safe for concurrent
 * Edge requests.
 *
 * @example
 * ```ts
 * const config = buildTracingConfig(env, {
 *   runName: 'panacea:question-gen',
 *   tags: ['generation', 'cardiology'],
 *   metadata: { userId: 'abc' },
 * });
 *
 * await model.invoke(messages, config);
 * ```
 */
export function buildTracingConfig(
  env: AIEnvKeys,
  options: TracingOptions = {}
): TracingConfig {
  const config: TracingConfig = {
    callbacks: [],
    tags: options.tags ?? [],
    metadata: { app: 'panacea', ...options.metadata },
    runName: options.runName,
  };

  if (!env.LANGSMITH_API_KEY) return config;

  const tracer = new LangChainTracer({
    projectName: env.LANGSMITH_PROJECT ?? 'panacea',
  });
  config.callbacks.push(tracer);

  return config;
}

// ─── Legacy Compatibility ─────────────────────────────────────────────────
// These are kept for backward compatibility with callers that still
// use the old globalThis pattern. They will be removed in a future sprint.

/**
 * @deprecated Use `buildTracingConfig()` instead. This mutates globalThis,
 * which is unsafe in concurrent Edge isolates.
 */
export function configureLangSmithEnv(env: AIEnvKeys): boolean {
  const apiKey = env.LANGSMITH_API_KEY;
  if (!apiKey) return false;

  const g = globalThis as Record<string, unknown>;
  g.LANGCHAIN_TRACING_V2 = 'true';
  g.LANGCHAIN_API_KEY = apiKey;
  g.LANGCHAIN_PROJECT = env.LANGSMITH_PROJECT ?? 'panacea';
  g.LANGCHAIN_ENDPOINT = 'https://api.smith.langchain.com';

  return true;
}
