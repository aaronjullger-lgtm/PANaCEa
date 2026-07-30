/**
 * LangChain Configuration
 *
 * Centralized configuration for LangChain model providers, tracing,
 * and default parameters. All AI calls in PANaCEa should use this
 * config rather than hardcoding model names or API keys.
 *
 * Model IDs verified against provider APIs on 2026-07-29.
 *
 * @module lib/langchain/config
 */

// ─── Provider Configuration ────────────────────────────────────────────────

export type ModelProvider = 'gemini' | 'openai' | 'anthropic' | 'deepseek' | 'deepinfra' | 'openrouter';

export interface ModelConfig {
  provider: ModelProvider;
  modelId: string;
  rateLimit?: number;
  inputCostPer1M?: number;
  outputCostPer1M?: number;
}

export const MODEL_REGISTRY = {
  // ── Gemini (verified 2026-07-29: all stable, no preview models) ──
  'gemini-2.0-flash': {
    provider: 'gemini' as ModelProvider,
    modelId: 'gemini-2.0-flash',
    rateLimit: 1500,
    inputCostPer1M: 0.10,
    outputCostPer1M: 0.40,
  },
  'gemini-2.5-flash': {
    provider: 'gemini' as ModelProvider,
    modelId: 'gemini-2.5-flash',
    rateLimit: 1000,
    inputCostPer1M: 0.15,
    outputCostPer1M: 0.60,
  },
  'gemini-2.5-pro': {
    provider: 'gemini' as ModelProvider,
    modelId: 'gemini-2.5-pro',
    rateLimit: 150,
    inputCostPer1M: 1.25,
    outputCostPer1M: 10.00,
  },

  // ── OpenAI (verified 2026-07-29) ──
  'gpt-4.1-mini': {
    provider: 'openai' as ModelProvider,
    modelId: 'gpt-4.1-mini',
    rateLimit: 10000,
    inputCostPer1M: 0.40,
    outputCostPer1M: 1.60,
  },
  'gpt-4o-mini': {
    provider: 'openai' as ModelProvider,
    modelId: 'gpt-4o-mini',
    rateLimit: 10000,
    inputCostPer1M: 0.15,
    outputCostPer1M: 0.60,
  },
  'gpt-4.1': {
    provider: 'openai' as ModelProvider,
    modelId: 'gpt-4.1',
    rateLimit: 5000,
    inputCostPer1M: 2.00,
    outputCostPer1M: 8.00,
  },
  'gpt-4o': {
    provider: 'openai' as ModelProvider,
    modelId: 'gpt-4o',
    rateLimit: 5000,
    inputCostPer1M: 2.50,
    outputCostPer1M: 10.00,
  },

  // ── Anthropic (verified 2026-07-29: Sonnet 4 + Haiku 3.5 are DELETED, replaced by 5/4.5) ──
  'claude-sonnet-5': {
    provider: 'anthropic' as ModelProvider,
    modelId: 'claude-sonnet-5',
    rateLimit: 4000,
    inputCostPer1M: 3.00,
    outputCostPer1M: 15.00,
  },
  'claude-haiku-4-5': {
    provider: 'anthropic' as ModelProvider,
    modelId: 'claude-haiku-4-5-20251001',
    rateLimit: 8000,
    inputCostPer1M: 0.80,
    outputCostPer1M: 4.00,
  },

  // ── DeepSeek (verified 2026-07-29: deepseek-chat replaced by v4-pro/v4-flash) ──
  'deepseek-v4-pro': {
    provider: 'deepseek' as ModelProvider,
    modelId: 'deepseek-v4-pro',
    rateLimit: 5000,
    inputCostPer1M: 0.14,
    outputCostPer1M: 0.28,
  },
  'deepseek-v4-flash': {
    provider: 'deepseek' as ModelProvider,
    modelId: 'deepseek-v4-flash',
    rateLimit: 8000,
    inputCostPer1M: 0.07,
    outputCostPer1M: 0.14,
  },

  // ── DeepInfra (verified 2026-07-29: Llama 3.1 70B removed, Qwen3 235B added) ──
  'qwen3-235b': {
    provider: 'deepinfra' as ModelProvider,
    modelId: 'Qwen/Qwen3-235B-A22B-Instruct-2507',
    rateLimit: 3000,
    inputCostPer1M: 0.40,
    outputCostPer1M: 0.40,
  },
  'qwen-2.5-72b': {
    provider: 'deepinfra' as ModelProvider,
    modelId: 'Qwen/Qwen2.5-72B-Instruct',
    rateLimit: 3000,
    inputCostPer1M: 0.40,
    outputCostPer1M: 0.40,
  },

  // ── OpenRouter (free tier — $0 cost, low rate limit, good for dev/testing) ──
  'or-gemini-2.0-flash': {
    provider: 'openrouter' as ModelProvider,
    modelId: 'google/gemini-2.0-flash-exp:free',
    rateLimit: 200,
    inputCostPer1M: 0,
    outputCostPer1M: 0,
  },
  'or-llama-3.1-8b': {
    provider: 'openrouter' as ModelProvider,
    modelId: 'meta-llama/llama-3.1-8b-instruct:free',
    rateLimit: 200,
    inputCostPer1M: 0,
    outputCostPer1M: 0,
  },
} as const;

export type ModelName = keyof typeof MODEL_REGISTRY;

// ─── Task-to-Model Routing ─────────────────────────────────────────────────

/**
 * Per-task model routing — balances model strengths against cost.
 *
 * Verified 2026-07-29: all model IDs confirmed available on their APIs.
 *
 * Cost tiers:
 *   - Premium ($3+/$15+): Claude Sonnet 5 — clinical-critical reasoning
 *   - Mid ($2/$8): GPT-4.1 — strong all-rounder, good at Socratic
 *   - Budget ($0.40/$1.60): GPT-4.1-mini — content generation, fallback
 *   - Cheap ($0.10/$0.40): Gemini Flash — extraction, classification
 *   - Ultra-cheap ($0.14/$0.28): DeepSeek V4 — bulk pipeline
 *   - Free ($0/$0): OpenRouter free tier — dev/testing only
 */
export const TASK_MODEL_MAP: Record<string, { primary: ModelName; fallbacks: ModelName[] }> = {
  'question-generation': {
    primary: 'claude-sonnet-5',
    fallbacks: ['gpt-4.1', 'gemini-2.5-pro'],
  },
  'question-critique': {
    primary: 'claude-sonnet-5',
    fallbacks: ['gpt-4.1', 'gemini-2.5-pro'],
  },
  'content-generation': {
    primary: 'gpt-4.1-mini',
    fallbacks: ['gemini-2.0-flash', 'claude-haiku-4-5'],
  },
  'osce-chat': {
    primary: 'claude-sonnet-5',
    fallbacks: ['gpt-4.1-mini', 'claude-haiku-4-5'],
  },
  'clinical-reasoning': {
    primary: 'claude-sonnet-5',
    fallbacks: ['gpt-4.1', 'gemini-2.5-pro'],
  },
  'extraction': {
    primary: 'gemini-2.0-flash',
    fallbacks: ['gpt-4.1-mini', 'deepseek-v4-flash'],
  },
  'socratic-tutoring': {
    primary: 'gpt-4.1',
    fallbacks: ['claude-sonnet-5', 'gemini-2.5-pro'],
  },
  'bulk-enrichment': {
    primary: 'deepseek-v4-pro',
    fallbacks: ['qwen3-235b', 'gemini-2.0-flash'],
  },
} as const;

export type TaskType = keyof typeof TASK_MODEL_MAP;

// ─── Default Generation Parameters ─────────────────────────────────────────

export const DEFAULT_PARAMS = {
  temperature: 0.7,
  maxOutputTokens: 4096,
  maxRetries: 2,
  timeoutMs: 30_000,
  retryDelayMs: 1000,
} as const;

// ─── LangSmith Tracing ─────────────────────────────────────────────────────

export interface TracingConfig {
  enabled: boolean;
  projectName: string;
  endpoint?: string;
}

export function getTracingConfig(env: Record<string, string | undefined>): TracingConfig {
  const apiKey = env.LANGSMITH_API_KEY;
  return {
    enabled: !!apiKey,
    projectName: env.LANGSMITH_PROJECT ?? 'panacea',
    endpoint: env.LANGSMITH_ENDPOINT ?? 'https://api.smith.langchain.com',
  };
}