/**
 * Edge Environment Adapter
 *
 * Bridges Cloudflare Pages Functions context.env (or process.env
 * in Node scripts) to the AIEnvKeys shape expected by LangChain modules.
 *
 * Edge Functions don't have process.env — keys live on context.env.
 * Node scripts (auto-author, batch generators) use process.env.
 * This adapter unifies both into one shape.
 *
 * @module lib/langchain/envAdapter
 * Sprint: LangChain Integration — Sprint 2
 */

import type { AIEnvKeys } from './models';

/**
 * Extract AIEnvKeys from a Cloudflare Pages Function context.env object.
 *
 * @example
 * ```ts
 * // In a Cloudflare Edge Function:
 * const aiEnv = fromCloudflareEnv(context.env);
 * const result = await routeTask('question-generation', aiEnv, { ... });
 * ```
 */
export function fromCloudflareEnv(env: Record<string, unknown>): AIEnvKeys {
  return {
    GEMINI_API_KEY: asString(env.GEMINI_API_KEY),
    OPENAI_API_KEY: asString(env.OPENAI_API_KEY),
    ANTHROPIC_API_KEY: asString(env.ANTHROPIC_API_KEY),
    DEEPSEEK_API_KEY: asString(env.DEEPSEEK_API_KEY),
    LANGSMITH_API_KEY: asString(env.LANGSMITH_API_KEY),
    LANGSMITH_PROJECT: asString(env.LANGSMITH_PROJECT),
  };
}

/**
 * Extract AIEnvKeys from process.env (Node.js scripts).
 *
 * @example
 * ```ts
 * // In a batch generator script:
 * const aiEnv = fromProcessEnv();
 * const result = await routeTask('content-generation', aiEnv, { ... });
 * ```
 */
export function fromProcessEnv(): AIEnvKeys {
  const env = typeof process !== 'undefined' ? process.env : {};
  return fromCloudflareEnv(env as Record<string, unknown>);
}

/**
 * Build AIEnvKeys from explicit values (useful for testing).
 */
export function fromExplicitKeys(keys: Partial<AIEnvKeys>): AIEnvKeys {
  return {
    GEMINI_API_KEY: keys.GEMINI_API_KEY,
    OPENAI_API_KEY: keys.OPENAI_API_KEY,
    ANTHROPIC_API_KEY: keys.ANTHROPIC_API_KEY,
    DEEPSEEK_API_KEY: keys.DEEPSEEK_API_KEY,
    LANGSMITH_API_KEY: keys.LANGSMITH_API_KEY,
    LANGSMITH_PROJECT: keys.LANGSMITH_PROJECT,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function asString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.length > 0) return value;
  return undefined;
}
