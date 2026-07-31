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
 * Unlike globalThis mutation patterns (unsafe in Edge isolates),
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

  // Sampling gate: prevents retry storms from flooding LangSmith.
  // Default 1.0 (100%); set LANGSMITH_SAMPLE_RATE=0.1 for 10% in dev.
  const sampleRate = Number(env.LANGSMITH_SAMPLE_RATE ?? 1);
  if (sampleRate < 1 && Math.random() > sampleRate) {
    return config;
  }

  const tracer = new LangChainTracer({
    projectName: env.LANGSMITH_PROJECT ?? 'panacea',
  });
  config.callbacks.push(tracer);

  return config;
}
