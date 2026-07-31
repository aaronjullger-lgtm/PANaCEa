import type { AIEnvKeys } from '@/lib/langchain/models';

export interface LangfuseConfig {
  enabled: boolean;
  publicKey: string;
  secretKey: string;
  baseUrl: string;
}

function resolveEnv(): Partial<AIEnvKeys> {
  if (typeof process !== 'undefined' && process.env) {
    return {
      LANGFUSE_PUBLIC_KEY: process.env.LANGFUSE_PUBLIC_KEY,
      LANGFUSE_SECRET_KEY: process.env.LANGFUSE_SECRET_KEY,
      LANGFUSE_BASE_URL: process.env.LANGFUSE_BASE_URL,
    };
  }
  return {};
}

function buildConfig(env?: AIEnvKeys | null): LangfuseConfig {
  const publicKey = env?.LANGFUSE_PUBLIC_KEY ?? resolveEnv().LANGFUSE_PUBLIC_KEY ?? '';
  const secretKey = env?.LANGFUSE_SECRET_KEY ?? resolveEnv().LANGFUSE_SECRET_KEY ?? '';
  return {
    enabled: !!(publicKey && secretKey),
    publicKey,
    secretKey,
    baseUrl: env?.LANGFUSE_BASE_URL ?? resolveEnv().LANGFUSE_BASE_URL ?? 'https://cloud.langfuse.com',
  };
}

let _cachedConfig: LangfuseConfig | null = null;

export function getLangfuseConfig(env?: AIEnvKeys | null): LangfuseConfig {
  if (!_cachedConfig || env) {
    _cachedConfig = buildConfig(env);
  }
  return _cachedConfig;
}

export function isLangfuseEnabled(env?: AIEnvKeys | null): boolean {
  return getLangfuseConfig(env).enabled;
}

export interface TraceContext {
  traceId: string;
  name: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  userId?: string;
  sessionId?: string;
}

export function createTraceContext(
  name: string,
  options?: {
    tags?: string[];
    metadata?: Record<string, unknown>;
    userId?: string;
    sessionId?: string;
  },
): TraceContext {
  return {
    traceId: crypto.randomUUID?.() ?? `trace-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    name,
    tags: options?.tags,
    metadata: { app: 'panacea', ...options?.metadata },
    userId: options?.userId,
    sessionId: options?.sessionId,
  };
}

export interface SpanContext {
  traceId: string;
  parentSpanId?: string;
  name: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export function createSpanContext(
  trace: TraceContext,
  name: string,
  options?: { tags?: string[]; metadata?: Record<string, unknown> },
): SpanContext {
  return {
    traceId: trace.traceId,
    name,
    tags: [...(trace.tags ?? []), ...(options?.tags ?? [])],
    metadata: { ...trace.metadata, ...options?.metadata },
  };
}
