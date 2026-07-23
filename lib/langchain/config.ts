/**
 * LangChain Configuration
 *
 * Centralized configuration for LangChain model providers, tracing,
 * and default parameters. All AI calls in PANaCEa should use this
 * config rather than hardcoding model names or API keys.
 *
 * @module lib/langchain/config
 * Sprint: LangChain Integration — Sprint 1
 */

// ─── Provider Configuration ────────────────────────────────────────────────

export type ModelProvider = 'gemini' | 'openai' | 'anthropic' | 'deepseek';

export interface ModelConfig {
  provider: ModelProvider;
  modelId: string;
  /** Tokens per minute rate limit (approximate) */
  rateLimit?: number;
  /** Cost per 1M input tokens in USD */
  inputCostPer1M?: number;
  /** Cost per 1M output tokens in USD */
  outputCostPer1M?: number;
}

/**
 * Available models organized by capability tier.
 *
 * - **fast**: Low-latency, high-throughput. Best for structured extraction, simple Q&A.
 * - **balanced**: Good quality/speed tradeoff. Default for most generation tasks.
 * - **powerful**: Highest quality. Complex reasoning, nuanced clinical content.
 */
export const MODEL_REGISTRY = {
  // ── Gemini ──
  'gemini-2.0-flash': {
    provider: 'gemini' as ModelProvider,
    modelId: 'gemini-2.0-flash',
    rateLimit: 1500,
    inputCostPer1M: 0.10,
    outputCostPer1M: 0.40,
  },
  'gemini-2.5-flash': {
    provider: 'gemini' as ModelProvider,
    modelId: 'gemini-2.5-flash-preview-04-17',
    rateLimit: 1000,
    inputCostPer1M: 0.15,
    outputCostPer1M: 0.60,
  },
  'gemini-2.5-pro': {
    provider: 'gemini' as ModelProvider,
    modelId: 'gemini-2.5-pro-preview-05-06',
    rateLimit: 150,
    inputCostPer1M: 1.25,
    outputCostPer1M: 10.00,
  },

  // ── OpenAI ──
  'gpt-4o-mini': {
    provider: 'openai' as ModelProvider,
    modelId: 'gpt-4o-mini',
    rateLimit: 10000,
    inputCostPer1M: 0.15,
    outputCostPer1M: 0.60,
  },
  'gpt-4o': {
    provider: 'openai' as ModelProvider,
    modelId: 'gpt-4o',
    rateLimit: 5000,
    inputCostPer1M: 2.50,
    outputCostPer1M: 10.00,
  },
  'o3-mini': {
    provider: 'openai' as ModelProvider,
    modelId: 'o3-mini',
    rateLimit: 1000,
    inputCostPer1M: 1.10,
    outputCostPer1M: 4.40,
  },

  // ── Anthropic ──
  'claude-sonnet-4': {
    provider: 'anthropic' as ModelProvider,
    modelId: 'claude-sonnet-4-20250514',
    rateLimit: 4000,
    inputCostPer1M: 3.00,
    outputCostPer1M: 15.00,
  },
  'claude-haiku-3.5': {
    provider: 'anthropic' as ModelProvider,
    modelId: 'claude-3-5-haiku-20241022',
    rateLimit: 8000,
    inputCostPer1M: 0.80,
    outputCostPer1M: 4.00,
  },

  // ── DeepSeek ──
  'deepseek-chat': {
    provider: 'deepseek' as ModelProvider,
    modelId: 'deepseek-chat',
    rateLimit: 5000,
    inputCostPer1M: 0.14,
    outputCostPer1M: 0.28,
  },
} as const;

export type ModelName = keyof typeof MODEL_REGISTRY;

// ─── Task-to-Model Routing ─────────────────────────────────────────────────

/**
 * Default model assignments per PANaCEa task type.
 *
 * Primary is the first-choice model. Fallbacks are tried in order
 * if the primary fails (rate limit, timeout, error).
 */
export const TASK_MODEL_MAP: Record<string, { primary: ModelName; fallbacks: ModelName[] }> = {
  'question-generation': {
    primary: 'gpt-4o-mini',
    fallbacks: ['gemini-2.0-flash', 'claude-haiku-3.5'],
  },
  'question-critique': {
    primary: 'claude-haiku-3.5',
    fallbacks: ['gemini-2.0-flash', 'gpt-4o-mini'],
  },
  'content-generation': {
    primary: 'deepseek-chat',
    fallbacks: ['gemini-2.0-flash', 'gpt-4o-mini'],
  },
  'osce-chat': {
    primary: 'gpt-4o',
    fallbacks: ['gemini-2.0-flash', 'claude-sonnet-4'],
  },
  'clinical-reasoning': {
    primary: 'claude-sonnet-4',
    fallbacks: ['gpt-4o', 'gemini-2.5-pro'],
  },
  'extraction': {
    primary: 'gpt-4o-mini',
    fallbacks: ['gemini-2.0-flash', 'deepseek-chat'],
  },
} as const;

export type TaskType = keyof typeof TASK_MODEL_MAP;

// ─── Default Generation Parameters ─────────────────────────────────────────

export const DEFAULT_PARAMS = {
  temperature: 0.7,
  maxOutputTokens: 4096,
  /** Max retries per provider before falling back */
  maxRetries: 2,
  /** Timeout per request in ms */
  timeoutMs: 30_000,
  /** Delay between retries in ms */
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
