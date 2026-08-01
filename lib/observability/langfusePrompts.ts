/**
 * Langfuse Prompts Module — Versioned prompt management with caching + fallbacks.
 *
 * Fetches prompts from Langfuse (versioned, with config), caches them in-process,
 * and provides graceful fallback when Langfuse is unavailable.
 *
 * Edge-safe: uses fetch(), no Node-only APIs. Works in Cloudflare Workers.
 */

import { isLangfuseEnabled, getLangfuseConfig } from '@/lib/agents/langfuse';

export interface LangfusePromptConfig {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  [key: string]: unknown;
}

export interface LangfusePrompt {
  name: string;
  type: 'text' | 'chat';
  prompt: string[] | string;
  config: LangfusePromptConfig;
  version: number;
  labels: string[];
}

export interface CompiledPrompt {
  text: string;
  config: LangfusePromptConfig;
  version: number;
  source: 'langfuse' | 'fallback' | 'cache';
}

export interface GetPromptOptions {
  variables?: Record<string, string | number | boolean>;
  fallbackText?: string;
  fallbackConfig?: LangfusePromptConfig;
  label?: string;
  type?: 'text' | 'chat';
}

interface CacheEntry {
  prompt: LangfusePrompt;
  fetchedAt: number;
}

const DEFAULT_CACHE_TTL = 5 * 60 * 1000;
const promptCache = new Map<string, CacheEntry>();

function getCached(name: string, label?: string): LangfusePrompt | null {
  const key = `${name}:${label ?? 'latest'}`;
  const entry = promptCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > DEFAULT_CACHE_TTL) {
    promptCache.delete(key);
    return null;
  }
  return entry.prompt;
}

function setCached(name: string, label: string | undefined, prompt: LangfusePrompt): void {
  const key = `${name}:${label ?? 'latest'}`;
  promptCache.set(key, { prompt, fetchedAt: Date.now() });
}

export function compilePrompt(template: string, variables?: Record<string, string | number | boolean>): string {
  if (!variables) return template;
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g'), String(value));
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
  }
  return result;
}

export function chatToText(messages: string[]): string {
  return messages.join('\n\n');
}

async function fetchPromptFromLangfuse(
  name: string,
  config: ReturnType<typeof getLangfuseConfig>,
  label?: string,
  type?: 'text' | 'chat',
): Promise<LangfusePrompt | null> {
  const params = new URLSearchParams();
  if (label) params.set('label', label);
  if (type) params.set('type', type);
  const url = `${config.baseUrl}/api/public/v2/prompts/${encodeURIComponent(name)}?${params}`;

  try {
    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + btoa(`${config.publicKey}:${config.secretKey}`),
      },
    });

    if (!resp.ok) {
      if (resp.status === 404) return null;
      console.warn(`[langfuse-prompts] Fetch failed for "${name}": ${resp.status}`);
      return null;
    }

    const data = await resp.json() as Record<string, unknown>;
    const promptType = (data.type as string) ?? 'text';
    const promptData = data.prompt;
    const promptContent: string[] | string =
      promptType === 'chat' && Array.isArray(promptData)
        ? (promptData as string[])
        : typeof promptData === 'string'
          ? promptData
          : JSON.stringify(promptData);

    return {
      name,
      type: promptType as 'text' | 'chat',
      prompt: promptContent,
      config: (data.config as LangfusePromptConfig) ?? {},
      version: (data.version as number) ?? 1,
      labels: (data.labels as string[]) ?? [],
    };
  } catch (err) {
    console.warn(`[langfuse-prompts] Network error fetching "${name}":`, err instanceof Error ? err.message : err);
    return null;
  }
}

export async function getPrompt(
  name: string,
  options: GetPromptOptions = {},
): Promise<CompiledPrompt> {
  const { variables, fallbackText, fallbackConfig, label, type } = options;

  const cached = getCached(name, label);
  if (cached) {
    const rawText = typeof cached.prompt === 'string' ? cached.prompt : chatToText(cached.prompt);
    return {
      text: compilePrompt(rawText, variables),
      config: cached.config,
      version: cached.version,
      source: 'cache',
    };
  }

  if (isLangfuseEnabled()) {
    const config = getLangfuseConfig();
    const fetched = await fetchPromptFromLangfuse(name, config, label, type);
    if (fetched) {
      setCached(name, label, fetched);
      const rawText = typeof fetched.prompt === 'string' ? fetched.prompt : chatToText(fetched.prompt);
      return {
        text: compilePrompt(rawText, variables),
        config: fetched.config,
        version: fetched.version,
        source: 'langfuse',
      };
    }
  }

  if (fallbackText !== undefined) {
    return {
      text: compilePrompt(fallbackText, variables),
      config: fallbackConfig ?? {},
      version: 0,
      source: 'fallback',
    };
  }

  throw new Error(`[langfuse-prompts] Prompt "${name}" not found and no fallback provided`);
}

export function invalidatePromptCache(name?: string): void {
  if (name) {
    for (const key of promptCache.keys()) {
      if (key.startsWith(`${name}:`)) promptCache.delete(key);
    }
  } else {
    promptCache.clear();
  }
}

export function listCachedPrompts(): string[] {
  return Array.from(promptCache.keys());
}

export async function prefetchPrompts(names: string[], label?: string): Promise<void> {
  await Promise.allSettled(
    names.map(async (name) => {
      try { await getPrompt(name, { label }); } catch { /* ignore */ }
    }),
  );
}
