/**
 * Vercel AI SDK Provider Registry
 *
 * Centralizes multi-provider model creation for the Vercel AI SDK.
 * Used for NEW endpoints (streaming tutor, OSCE tools, etc.).
 * Existing LangChain-based endpoints remain unchanged.
 *
 * @module lib/ai-sdk/providers
 */

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import type { LanguageModel } from 'ai';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface AIProviderEnv {
  GEMINI_API_KEY?: string;
  GOOGLE_GENERATIVE_AI_API_KEY?: string;
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  /** Cloudflare AI Gateway — when set, routes Google AI calls through edge cache */
  CLOUDFLARE_ACCOUNT_ID?: string;
  CF_AI_GATEWAY_ID?: string;
}

export type ModelTier = 'fast' | 'balanced' | 'powerful';

export interface ModelSpec {
  provider: 'google' | 'openai' | 'anthropic';
  modelId: string;
  tier: ModelTier;
  inputCostPer1M: number;
  outputCostPer1M: number;
}

// ─── Model Catalog ─────────────────────────────────────────────────────────

export const AI_MODELS: Record<string, ModelSpec> = {
  'gemini-2.0-flash': {
    provider: 'google',
    modelId: 'gemini-2.0-flash',
    tier: 'fast',
    inputCostPer1M: 0.10,
    outputCostPer1M: 0.40,
  },
  'gemini-2.5-flash': {
    provider: 'google',
    modelId: 'gemini-2.5-flash-preview-04-17',
    tier: 'balanced',
    inputCostPer1M: 0.15,
    outputCostPer1M: 0.60,
  },
  'gemini-2.5-pro': {
    provider: 'google',
    modelId: 'gemini-2.5-pro-preview-05-06',
    tier: 'powerful',
    inputCostPer1M: 1.25,
    outputCostPer1M: 10.00,
  },
  'gpt-4o-mini': {
    provider: 'openai',
    modelId: 'gpt-4o-mini',
    tier: 'fast',
    inputCostPer1M: 0.15,
    outputCostPer1M: 0.60,
  },
  'gpt-4o': {
    provider: 'openai',
    modelId: 'gpt-4o',
    tier: 'powerful',
    inputCostPer1M: 2.50,
    outputCostPer1M: 10.00,
  },
  'claude-haiku-3.5': {
    provider: 'anthropic',
    modelId: 'claude-3-5-haiku-20241022',
    tier: 'fast',
    inputCostPer1M: 0.80,
    outputCostPer1M: 4.00,
  },
  'claude-sonnet-4': {
    provider: 'anthropic',
    modelId: 'claude-sonnet-4-20250514',
    tier: 'powerful',
    inputCostPer1M: 3.00,
    outputCostPer1M: 15.00,
  },
} as const;

export type ModelName = keyof typeof AI_MODELS;

// ─── Provider Factory ──────────────────────────────────────────────────────

/**
 * Create a Vercel AI SDK LanguageModel from a model name + env keys.
 *
 * @example
 * ```ts
 * const model = createAIModel('gemini-2.5-flash', { GEMINI_API_KEY: env.GEMINI_API_KEY });
 * const result = await generateText({ model, prompt: '...' });
 * ```
 */
export function createAIModel(
  name: ModelName | string,
  env: AIProviderEnv
): LanguageModel {
  const spec = AI_MODELS[name];
  if (!spec) {
    throw new Error(`Unknown model: "${name}". Available: ${Object.keys(AI_MODELS).join(', ')}`);
  }

  switch (spec.provider) {
    case 'google': {
      if (!env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY required for Google models');
      // Route through Cloudflare AI Gateway when configured
      const googleConfig: { apiKey: string; baseURL?: string } = { apiKey: env.GEMINI_API_KEY };
      if (env.CLOUDFLARE_ACCOUNT_ID && env.CF_AI_GATEWAY_ID) {
        googleConfig.baseURL = `https://gateway.ai.cloudflare.com/v1/${env.CLOUDFLARE_ACCOUNT_ID}/${env.CF_AI_GATEWAY_ID}/google-ai-studio/v1beta`;
      }
      const google = createGoogleGenerativeAI(googleConfig);
      return google(spec.modelId);
    }
    case 'openai': {
      if (!env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY required for OpenAI models');
      const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });
      return openai(spec.modelId);
    }
    case 'anthropic': {
      if (!env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY required for Anthropic models');
      const anthropic = createAnthropic({ apiKey: env.ANTHROPIC_API_KEY });
      return anthropic(spec.modelId);
    }
    default:
      throw new Error(`Unsupported provider: ${spec.provider}`);
  }
}

// ─── Model Selection Helpers ───────────────────────────────────────────────

/**
 * Get the best available model for a tier, preferring Gemini, then OpenAI, then Anthropic.
 */
export function selectModelForTier(tier: ModelTier, env: AIProviderEnv): ModelName {
  const candidates = Object.entries(AI_MODELS)
    .filter(([, spec]) => spec.tier === tier)
    .sort((a, b) => a[1].inputCostPer1M - b[1].inputCostPer1M);

  for (const [name, spec] of candidates) {
    if (spec.provider === 'google' && env.GEMINI_API_KEY) return name as ModelName;
    if (spec.provider === 'openai' && env.OPENAI_API_KEY) return name as ModelName;
    if (spec.provider === 'anthropic' && env.ANTHROPIC_API_KEY) return name as ModelName;
  }

  throw new Error(`No API key available for any "${tier}" tier model`);
}

/**
 * Get a fallback chain: primary model + alternatives from other providers.
 */
export function getFallbackChain(primary: ModelName, env: AIProviderEnv): ModelName[] {
  const primarySpec = AI_MODELS[primary];
  if (!primarySpec) return [primary];

  const chain: ModelName[] = [primary];

  // Add same-tier models from other providers
  for (const [name, spec] of Object.entries(AI_MODELS)) {
    if (name === primary) continue;
    if (spec.tier !== primarySpec.tier) continue;
    if (spec.provider === 'google' && env.GEMINI_API_KEY) chain.push(name as ModelName);
    else if (spec.provider === 'openai' && env.OPENAI_API_KEY) chain.push(name as ModelName);
    else if (spec.provider === 'anthropic' && env.ANTHROPIC_API_KEY) chain.push(name as ModelName);
  }

  return chain;
}

/**
 * Check which providers have API keys configured.
 */
export function getAvailableProviders(env: AIProviderEnv): string[] {
  const providers: string[] = [];
  if (env.GEMINI_API_KEY) providers.push('google');
  if (env.OPENAI_API_KEY) providers.push('openai');
  if (env.ANTHROPIC_API_KEY) providers.push('anthropic');
  return providers;
}
