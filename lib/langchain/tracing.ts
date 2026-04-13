/**
 * LangSmith Tracing Integration
 *
 * Configures LangSmith callback handlers for observability
 * across all LangChain calls. Tracing is opt-in: if no
 * LANGSMITH_API_KEY is present, calls proceed without tracing.
 *
 * @module lib/langchain/tracing
 * Sprint: LangChain Integration — Sprint 1
 */

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

// ─── Environment Setup ────────────────────────────────────────────────────

/**
 * Configure LangSmith environment variables for tracing.
 *
 * LangChain reads these from `process.env` (or globalThis in Edge).
 * Call this once at app startup or before the first LangChain call.
 *
 * In Cloudflare Edge Functions, environment variables aren't in
 * `process.env` — they're on `context.env`. This function bridges
 * that gap by setting the globals LangChain expects.
 */
export function configureLangSmithEnv(env: AIEnvKeys): boolean {
  const apiKey = env.LANGSMITH_API_KEY;
  if (!apiKey) return false;

  // LangChain SDK reads these globals for tracing config
  const g = globalThis as Record<string, unknown>;
  g.LANGCHAIN_TRACING_V2 = 'true';
  g.LANGCHAIN_API_KEY = apiKey;
  g.LANGCHAIN_PROJECT = env.LANGSMITH_PROJECT ?? 'panacea';
  g.LANGCHAIN_ENDPOINT = 'https://api.smith.langchain.com';

  return true;
}

/**
 * Build the callbacks/config object for a LangChain invocation
 * that includes LangSmith tracing metadata.
 *
 * Returns an empty object if tracing is not configured,
 * so callers can always spread it safely.
 */
export function buildTracingConfig(
  env: AIEnvKeys,
  options: TracingOptions = {}
): Record<string, unknown> {
  if (!env.LANGSMITH_API_KEY) return {};

  const config: Record<string, unknown> = {};

  if (options.runName) {
    config.runName = options.runName;
  }
  if (options.tags?.length) {
    config.tags = options.tags;
  }
  if (options.metadata) {
    config.metadata = {
      app: 'panacea',
      ...options.metadata,
    };
  }

  return config;
}

/**
 * Check if LangSmith tracing is available.
 */
export function isTracingEnabled(env: AIEnvKeys): boolean {
  return !!env.LANGSMITH_API_KEY;
}
