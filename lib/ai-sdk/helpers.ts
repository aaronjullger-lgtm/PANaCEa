/**
 * Vercel AI SDK Helpers for PANaCEa
 *
 * Convenience wrappers around generateText/generateObject/streamText
 * that integrate with PANaCEa's Edge env pattern and token tracking.
 *
 * @module lib/ai-sdk/helpers
 */

import { generateText, generateObject, streamText } from 'ai';
import type { LanguageModelV1 } from 'ai';
import { z } from 'zod';
import { createAIModel, selectModelForTier, type AIProviderEnv, type ModelTier, type ModelName } from './providers';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface AICallOptions {
  /** Model name or tier. If tier, auto-selects best available model. */
  model?: ModelName | string;
  /** Model tier (used if model is not specified). Default: 'balanced' */
  tier?: ModelTier;
  /** System prompt */
  system?: string;
  /** User prompt */
  prompt: string;
  /** Temperature (0-2). Default: 0.7 */
  temperature?: number;
  /** Max output tokens. Default: 4096 */
  maxTokens?: number;
  /** Endpoint name for tracking */
  endpoint?: string;
}

export interface AICallResult {
  text: string;
  model: string;
  provider: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  latencyMs: number;
}

// ─── Generate Text ─────────────────────────────────────────────────────────

/**
 * Generate text using the Vercel AI SDK with automatic model selection.
 *
 * @example
 * ```ts
 * const result = await aiGenerateText(env, {
 *   model: 'gemini-2.5-flash',
 *   system: 'You are a medical educator.',
 *   prompt: 'Generate a mnemonic for CHF management',
 *   temperature: 0.8,
 * });
 * console.log(result.text);
 * ```
 */
export async function aiGenerateText(
  env: AIProviderEnv,
  options: AICallOptions
): Promise<AICallResult> {
  const start = Date.now();
  const modelName = options.model ?? selectModelForTier(options.tier ?? 'balanced', env);
  const model = createAIModel(modelName, env);

  const result = await generateText({
    model,
    system: options.system,
    prompt: options.prompt,
    temperature: options.temperature ?? 0.7,
    maxTokens: options.maxTokens ?? 4096,
  });

  return {
    text: result.text,
    model: modelName,
    provider: getProviderFromModel(model),
    usage: {
      promptTokens: result.usage?.promptTokens ?? 0,
      completionTokens: result.usage?.completionTokens ?? 0,
      totalTokens: result.usage?.totalTokens ?? 0,
    },
    latencyMs: Date.now() - start,
  };
}

// ─── Generate Object (Structured Output) ──────────────────────────────────

export interface AIObjectOptions<T extends z.ZodType> extends Omit<AICallOptions, 'prompt'> {
  /** User prompt */
  prompt: string;
  /** Zod schema for structured output */
  schema: T;
  /** Schema name for the AI model */
  schemaName?: string;
  /** Schema description */
  schemaDescription?: string;
}

/**
 * Generate a structured object validated by a Zod schema.
 *
 * @example
 * ```ts
 * const MnemonicSchema = z.object({
 *   mnemonic: z.string(),
 *   explanation: z.string(),
 *   type: z.enum(['acronym', 'story', 'visual', 'rhyme']),
 * });
 *
 * const result = await aiGenerateObject(env, {
 *   model: 'gemini-2.0-flash',
 *   system: 'Generate medical mnemonics.',
 *   prompt: 'CHF management steps',
 *   schema: MnemonicSchema,
 * });
 * result.object.mnemonic // fully typed
 * ```
 */
export async function aiGenerateObject<T extends z.ZodType>(
  env: AIProviderEnv,
  options: AIObjectOptions<T>
): Promise<{ object: z.infer<T>; model: string; usage: AICallResult['usage']; latencyMs: number }> {
  const start = Date.now();
  const modelName = options.model ?? selectModelForTier(options.tier ?? 'balanced', env);
  const model = createAIModel(modelName, env);

  const result = await generateObject({
    model,
    system: options.system,
    prompt: options.prompt,
    schema: options.schema,
    schemaName: options.schemaName,
    schemaDescription: options.schemaDescription,
    temperature: options.temperature ?? 0.5,
    maxTokens: options.maxTokens ?? 4096,
  });

  return {
    object: result.object,
    model: modelName,
    usage: {
      promptTokens: result.usage?.promptTokens ?? 0,
      completionTokens: result.usage?.completionTokens ?? 0,
      totalTokens: result.usage?.totalTokens ?? 0,
    },
    latencyMs: Date.now() - start,
  };
}

// ─── Stream Text ───────────────────────────────────────────────────────────

/**
 * Stream text for real-time responses (tutor chat, OSCE, etc.).
 * Returns a ReadableStream suitable for SSE responses.
 *
 * @example
 * ```ts
 * const stream = await aiStreamText(env, {
 *   model: 'gemini-2.5-flash',
 *   system: 'You are a Socratic clinical tutor.',
 *   prompt: userMessage,
 * });
 * return new Response(stream, {
 *   headers: { 'Content-Type': 'text/event-stream' },
 * });
 * ```
 */
export async function aiStreamText(
  env: AIProviderEnv,
  options: AICallOptions
): Promise<ReadableStream> {
  const modelName = options.model ?? selectModelForTier(options.tier ?? 'balanced', env);
  const model = createAIModel(modelName, env);

  const result = streamText({
    model,
    system: options.system,
    prompt: options.prompt,
    temperature: options.temperature ?? 0.7,
    maxTokens: options.maxTokens ?? 4096,
  });

  return result.toDataStream();
}

// ─── Utilities ─────────────────────────────────────────────────────────────

function getProviderFromModel(model: LanguageModelV1): string {
  const id = model.modelId ?? '';
  if (id.includes('gemini') || id.includes('google')) return 'google';
  if (id.includes('gpt') || id.includes('o3')) return 'openai';
  if (id.includes('claude')) return 'anthropic';
  return 'unknown';
}
