/**
 * LangChain Model Factory
 *
 * Creates LangChain chat model instances for each provider.
 * All models are configured with consistent defaults and
 * LangSmith tracing when available.
 *
 * @module lib/langchain/models
 * Sprint: LangChain Integration — Sprint 1
 */

import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';

import {
  MODEL_REGISTRY,
  DEFAULT_PARAMS,
  type ModelName,
  type ModelProvider,
} from './config';

// ─── Environment Keys ──────────────────────────────────────────────────────

export interface AIEnvKeys {
  GEMINI_API_KEY?: string;
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  DEEPSEEK_API_KEY?: string;
  DEEPINFRA_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  LANGSMITH_API_KEY?: string;
  LANGSMITH_PROJECT?: string;
  LANGSMITH_SAMPLE_RATE?: string;
  LANGFUSE_PUBLIC_KEY?: string;
  LANGFUSE_SECRET_KEY?: string;
  LANGFUSE_BASE_URL?: string;
}

// ─── Model Creation ────────────────────────────────────────────────────────

export interface CreateModelOptions {
  temperature?: number;
  maxOutputTokens?: number;
  /** Override the model ID (e.g., for A/B testing) */
  modelIdOverride?: string;
  /** LangSmith run name for tracing */
  runName?: string;
}

/**
 * Create a LangChain chat model by registry name.
 *
 * @example
 * ```ts
 * const model = createModel('gemini-2.0-flash', env, { temperature: 0.3 });
 * const result = await model.invoke([new HumanMessage('Hello')]);
 * ```
 */
export function createModel(
  name: ModelName,
  env: AIEnvKeys,
  options: CreateModelOptions = {}
): BaseChatModel {
  const config = MODEL_REGISTRY[name];
  if (!config) {
    throw new Error(`Unknown model: ${name}. Available: ${Object.keys(MODEL_REGISTRY).join(', ')}`);
  }

  const temperature = options.temperature ?? DEFAULT_PARAMS.temperature;
  const maxTokens = options.maxOutputTokens ?? DEFAULT_PARAMS.maxOutputTokens;
  const modelId = options.modelIdOverride ?? config.modelId;

  return createProviderModel(config.provider, modelId, env, {
    temperature,
    maxTokens,
    runName: options.runName,
  });
}

/**
 * Create a model instance for a specific provider.
 */
function createProviderModel(
  provider: ModelProvider,
  modelId: string,
  env: AIEnvKeys,
  opts: { temperature: number; maxTokens: number; runName?: string }
): BaseChatModel {
  switch (provider) {
    case 'gemini': {
      const apiKey = env.GEMINI_API_KEY;
      if (!apiKey) throw new Error('GEMINI_API_KEY not configured');
      return new ChatGoogleGenerativeAI({
        apiKey,
        model: modelId,
        temperature: opts.temperature,
        maxOutputTokens: opts.maxTokens,
      });
    }

    case 'openai': {
      const apiKey = env.OPENAI_API_KEY;
      if (!apiKey) throw new Error('OPENAI_API_KEY not configured');
      return new ChatOpenAI({
        apiKey,
        model: modelId,
        temperature: opts.temperature,
        maxTokens: opts.maxTokens,
      });
    }

    case 'anthropic': {
      const apiKey = env.ANTHROPIC_API_KEY;
      if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');
      return new ChatAnthropic({
        apiKey,
        model: modelId,
        temperature: opts.temperature,
        maxTokens: opts.maxTokens,
      });
    }

    case 'deepseek': {
      const apiKey = env.DEEPSEEK_API_KEY;
      if (!apiKey) throw new Error('DEEPSEEK_API_KEY not configured');
      return new ChatOpenAI({
        apiKey,
        model: modelId,
        temperature: opts.temperature,
        maxTokens: opts.maxTokens,
        configuration: {
          baseURL: 'https://api.deepseek.com/v1',
        },
      });
    }

    case 'deepinfra': {
      const apiKey = env.DEEPINFRA_API_KEY;
      if (!apiKey) throw new Error('DEEPINFRA_API_KEY not configured');
      return new ChatOpenAI({
        apiKey,
        model: modelId,
        temperature: opts.temperature,
        maxTokens: opts.maxTokens,
        configuration: {
          baseURL: 'https://api.deepinfra.com/v1/openai',
        },
      });
    }

    case 'openrouter': {
      const apiKey = env.OPENROUTER_API_KEY;
      if (!apiKey) throw new Error('OPENROUTER_API_KEY not configured');
      return new ChatOpenAI({
        apiKey,
        model: modelId,
        temperature: opts.temperature,
        maxTokens: opts.maxTokens,
        configuration: {
          baseURL: 'https://openrouter.ai/api/v1',
          defaultHeaders: {
            'HTTP-Referer': 'https://studypanacea.com',
            'X-Title': 'PANaCEa',
          },
        },
      });
    }

    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

/**
 * Check which providers have valid API keys configured.
 */
export function getAvailableProviders(env: AIEnvKeys): ModelProvider[] {
  const providers: ModelProvider[] = [];
  if (env.GEMINI_API_KEY) providers.push('gemini');
  if (env.OPENAI_API_KEY) providers.push('openai');
  if (env.ANTHROPIC_API_KEY) providers.push('anthropic');
  if (env.DEEPSEEK_API_KEY) providers.push('deepseek');
  if (env.DEEPINFRA_API_KEY) providers.push('deepinfra');
  if (env.OPENROUTER_API_KEY) providers.push('openrouter');
  return providers;
}

/**
 * Check if a specific model can be created with the given environment.
 */
export function isModelAvailable(name: ModelName, env: AIEnvKeys): boolean {
  const config = MODEL_REGISTRY[name];
  if (!config) return false;
  return getAvailableProviders(env).includes(config.provider);
}
