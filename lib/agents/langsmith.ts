import type { AIEnvKeys } from '@/lib/langchain/models';

export interface LangSmithConfig {
  tracing: boolean;
  apiKey: string;
  endpoint: string;
  project: string;
}

function resolveEnv(): Partial<AIEnvKeys> {
  if (typeof process !== 'undefined' && process.env) {
    return {
      LANGSMITH_API_KEY: process.env.LANGSMITH_API_KEY,
      LANGSMITH_PROJECT: process.env.LANGSMITH_PROJECT,
    };
  }
  return {};
}

function buildConfig(env?: AIEnvKeys | null): LangSmithConfig {
  const apiKey = env?.LANGSMITH_API_KEY ?? resolveEnv().LANGSMITH_API_KEY ?? '';
  return {
    tracing: !!apiKey,
    apiKey,
    endpoint: 'https://api.smith.langchain.com',
    project: env?.LANGSMITH_PROJECT ?? resolveEnv().LANGSMITH_PROJECT ?? 'panacea',
  };
}

export function getLangSmithConfig(env?: AIEnvKeys | null): LangSmithConfig {
  return buildConfig(env);
}

export function isTracingEnabled(env?: AIEnvKeys | null): boolean {
  return buildConfig(env).tracing;
}
