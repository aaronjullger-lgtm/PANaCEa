/**
 * Langfuse Observability Integration
 *
 * Provides LLM call tracing, prompt management, and quality evaluation
 * via Langfuse (open-source, 50K free observations/month on cloud tier).
 *
 * Works with both direct Gemini calls and Vercel AI SDK calls.
 * Framework-agnostic: no coupling to LangChain or specific providers.
 *
 * Environment variables:
 * - LANGFUSE_PUBLIC_KEY: Public key for Langfuse project
 * - LANGFUSE_SECRET_KEY: Secret key for Langfuse project
 * - LANGFUSE_BASE_URL: Optional custom host (default: https://cloud.langfuse.com)
 *
 * @module lib/observability/langfuse
 */

import { Langfuse } from 'langfuse';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface LangfuseEnv {
  LANGFUSE_PUBLIC_KEY?: string;
  LANGFUSE_SECRET_KEY?: string;
  LANGFUSE_BASE_URL?: string;
}

export interface TraceOptions {
  /** Unique trace name (e.g., endpoint path) */
  name: string;
  /** User ID for per-user tracing */
  userId?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Tags for filtering in Langfuse UI */
  tags?: string[];
  /** Session ID for grouping related traces */
  sessionId?: string;
}

export interface GenerationOptions {
  /** Generation name (e.g., 'question-generation', 'mnemonic') */
  name: string;
  /** Model identifier */
  model: string;
  /** Input prompt(s) */
  input: string | Record<string, unknown>;
  /** Model output */
  output?: string;
  /** Token usage */
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  /** Generation parameters */
  modelParameters?: {
    temperature?: number;
    maxTokens?: number;
    [key: string]: unknown;
  };
  /** Cost in USD (if known) */
  costUsd?: number;
  /** Latency in ms */
  latencyMs?: number;
  /** Status */
  level?: 'DEFAULT' | 'DEBUG' | 'WARNING' | 'ERROR';
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

// ─── Singleton Client ──────────────────────────────────────────────────────

let _client: Langfuse | null = null;

/**
 * Get or create the Langfuse client singleton.
 * Returns null if keys are not configured (tracing silently disabled).
 */
export function getLangfuseClient(env: LangfuseEnv): Langfuse | null {
  if (!env.LANGFUSE_PUBLIC_KEY || !env.LANGFUSE_SECRET_KEY) {
    return null;
  }

  if (!_client) {
    _client = new Langfuse({
      publicKey: env.LANGFUSE_PUBLIC_KEY,
      secretKey: env.LANGFUSE_SECRET_KEY,
      baseUrl: env.LANGFUSE_BASE_URL ?? 'https://cloud.langfuse.com',
      // Edge-compatible: use fetch, not Node http
      requestTimeout: 10_000,
    });
  }

  return _client;
}

/**
 * Check if Langfuse is configured and available.
 */
export function isLangfuseEnabled(env: LangfuseEnv): boolean {
  return !!(env.LANGFUSE_PUBLIC_KEY && env.LANGFUSE_SECRET_KEY);
}

// ─── Tracing ───────────────────────────────────────────────────────────────

/**
 * Create a Langfuse trace for an AI operation.
 * Returns a trace object with methods to add generations and spans.
 * Returns null if Langfuse is not configured.
 *
 * @example
 * ```ts
 * const trace = createTrace(env, {
 *   name: '/api/ai/generate-mnemonic',
 *   userId: auth.userId,
 *   tags: ['mnemonic', 'production'],
 * });
 *
 * if (trace) {
 *   trace.generation({
 *     name: 'mnemonic-gen',
 *     model: 'gemini-2.0-flash',
 *     input: prompt,
 *     output: result.text,
 *     usage: { promptTokens: 100, completionTokens: 50 },
 *   });
 * }
 * ```
 */
export function createTrace(env: LangfuseEnv, options: TraceOptions) {
  const client = getLangfuseClient(env);
  if (!client) return null;

  try {
    const trace = client.trace({
      name: options.name,
      userId: options.userId,
      metadata: options.metadata,
      tags: options.tags,
      sessionId: options.sessionId,
    });

    return {
      /** Add a generation (LLM call) to this trace */
      generation(gen: GenerationOptions) {
        try {
          trace.generation({
            name: gen.name,
            model: gen.model,
            input: gen.input,
            output: gen.output,
            usage: gen.usage
              ? {
                  promptTokens: gen.usage.promptTokens,
                  completionTokens: gen.usage.completionTokens,
                  totalTokens: gen.usage.totalTokens,
                }
              : undefined,
            modelParameters: gen.modelParameters as any,
            metadata: {
              ...gen.metadata,
              latencyMs: gen.latencyMs,
              costUsd: gen.costUsd,
            },
            level: gen.level ?? 'DEFAULT',
          });
        } catch (err) {
          console.warn('[langfuse] Generation tracking failed:', err);
        }
      },

      /** Add a span (non-LLM operation like retrieval, validation) */
      span(name: string, input?: unknown, output?: unknown) {
        try {
          trace.span({ name, input: input as any, output: output as any });
        } catch (err) {
          console.warn('[langfuse] Span tracking failed:', err);
        }
      },

      /** Add a score for evaluation */
      score(name: string, value: number, comment?: string) {
        try {
          client.score({
            traceId: trace.id,
            name,
            value,
            comment,
          });
        } catch (err) {
          console.warn('[langfuse] Score tracking failed:', err);
        }
      },

      /** Flush pending events (call in finally block or waitUntil) */
      async flush() {
        try {
          await client.flushAsync();
        } catch (err) {
          console.warn('[langfuse] Flush failed:', err);
        }
      },

      /** Get the trace ID for linking */
      get traceId() {
        return trace.id;
      },
    };
  } catch (err) {
    console.warn('[langfuse] Trace creation failed:', err);
    return null;
  }
}

/**
 * Flush all pending Langfuse events.
 * Call this in Edge function finally blocks or via waitUntil.
 */
export async function flushLangfuse(): Promise<void> {
  if (_client) {
    try {
      await _client.flushAsync();
    } catch {
      // Silent — never block response for observability
    }
  }
}

/**
 * Shutdown Langfuse client (call on process exit in Node scripts).
 */
export async function shutdownLangfuse(): Promise<void> {
  if (_client) {
    try {
      await _client.shutdownAsync();
    } catch {
      // Silent
    }
    _client = null;
  }
}

/**
 * Inputs to {@link traceGatewayCall}. Every field is something the AI Gateway
 * (`lib/ai/aiGateway.ts`) already produces from a single call, so wiring is
 * one line per public method (callText / callStructured / callVision /
 * callStream). Designed to match the Langfuse SDK v3 trace + generation shape
 * so the observation lands with model name, token usage, latency, and a
 * generation-typed observation on the first hop.
 */
export interface GatewayTraceInput {
  env: LangfuseEnv;
  waitUntil?: (p: Promise<unknown>) => void;
  userId?: string;
  traceId: string;
  requestId: string;
  task: string;
  endpoint: string;
  model: string;
  provider: string;
  userPrompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxOutputTokens?: number;
  output?: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  latencyMs?: number;
  level?: 'DEFAULT' | 'DEBUG' | 'WARNING' | 'ERROR';
  errorMessage?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
  /** Multi-turn grouping (tutoring/OSCE). Optional; defer to fast-follow. */
  sessionId?: string;
}

/**
 * Emit a single-trace + single-generation Langfuse observation for an AI
 * Gateway call. **No-op when Langfuse keys are absent** and safe on Cloudflare
 * Edge (uses `waitUntil` to flush, never blocks the response).
 *
 * Best-practice rationale (per Langfuse skill `references/instrumentation.md`):
 * - `input` is the user-facing message (+ system prompt as object field) rather
 *   than every function arg, so API keys / fetch config never leak into traces.
 * - `model`, `usage`, `level`, and a generation-typed observation are set so
 *   model analytics, cost calculation, and the Agent Graph all work.
 * - `traceId` from the gateway is carried in metadata (NOT as sessionId) so a
 *   Langfuse trace cross-references Workers Logs + Sentry on the same id.
 *
 * Errors from the Langfuse SDK are swallowed: observability must never break
 * the underlying AI call.
 */
export function traceGatewayCall(input: GatewayTraceInput): void {
  const client = getLangfuseClient(input.env);
  if (!client) return;

  const traceMetadata: Record<string, unknown> = {
    traceId: input.traceId,
    requestId: input.requestId,
    endpoint: input.endpoint,
    task: input.task,
    provider: input.provider,
    model: input.model,
    ...input.metadata,
  };
  if (input.latencyMs !== undefined) traceMetadata.latencyMs = input.latencyMs;
  if (input.errorMessage) traceMetadata.errorMessage = input.errorMessage;

  const generationMetadata: Record<string, unknown> = {
    provider: input.provider,
  };
  if (input.systemPrompt !== undefined) {
    generationMetadata.systemPromptLength = input.systemPrompt.length;
  }

  try {
    const trace = client.trace({
      name: `ai-gateway:${input.task}`,
      userId: input.userId,
      sessionId: input.sessionId,
      tags: ['ai-gateway', input.task, ...(input.tags ?? [])],
      metadata: traceMetadata,
    });

    trace.generation({
      name: `${input.task}:${input.endpoint}`,
      model: input.model,
      input: input.systemPrompt
        ? { system: input.systemPrompt, user: input.userPrompt }
        : input.userPrompt,
      output: input.output,
      usage: input.usage
        ? {
            promptTokens: input.usage.inputTokens,
            completionTokens: input.usage.outputTokens,
            totalTokens: input.usage.totalTokens,
          }
        : undefined,
      modelParameters: {
        ...(input.temperature !== undefined ? { temperature: input.temperature } : {}),
        ...(input.maxOutputTokens !== undefined
          ? { maxOutputTokens: input.maxOutputTokens }
          : {}),
      },
      level: input.level ?? (input.errorMessage ? 'ERROR' : 'DEFAULT'),
      metadata: generationMetadata,
    });

    // waitUntil keeps the trace flush alive after the Edge response returns;
    // without it the worker could terminate before Langfuse receives the POST.
    if (input.waitUntil) {
      input.waitUntil(
        client.flushAsync().catch(() => {
          /* swallow: observability must never break the request */
        }),
      );
    }
  } catch (err) {
    console.warn('[langfuse] traceGatewayCall failed:', err);
  }
}

// ─── Agent Tracing ──────────────────────────────────────────────────────────

export interface AgentTraceOptions {
  tier?: string;
  inputPreview?: unknown;
  metadata?: Record<string, unknown>;
  tags?: string[];
}

type TraceHandle = {
  span(name: string, input?: unknown, output?: unknown): void;
  score(name: string, value: number, comment?: string): void;
  flush(): Promise<void>;
  readonly traceId: string;
};

function buildTraceHandle(client: Langfuse, trace: ReturnType<Langfuse['trace']>): TraceHandle {
  return {
    span(name, input, output) {
      try {
        trace.span({ name, input: input as any, output: output as any });
      } catch { /* swallow — observability must never break the caller */ }
    },
    score(name, value, comment) {
      try {
        client.score({ traceId: trace.id, name, value, comment });
      } catch { /* swallow */ }
    },
    async flush() {
      try {
        await client.flushAsync();
      } catch { /* swallow */ }
    },
    get traceId() { return trace.id; },
  };
}

export function traceAgentInvocation(
  agentName: string,
  options?: AgentTraceOptions,
): TraceHandle | null {
  if (!_client) return null;

  try {
    const trace = _client.trace({
      name: `agent:${agentName}`,
      tags: ['agent', agentName, ...(options?.tags ?? [])],
      metadata: {
        agentName,
        tier: options?.tier,
        inputPreview: options?.inputPreview,
        ...options?.metadata,
      },
    });
    return buildTraceHandle(_client, trace);
  } catch {
    return null;
  }
}

export function traceTeamWorkflow(
  workflowName: string,
  options?: {
    agentNames?: string[];
    strategy?: string;
    metadata?: Record<string, unknown>;
    tags?: string[];
  },
): TraceHandle | null {
  if (!_client) return null;

  try {
    const trace = _client.trace({
      name: `workflow:${workflowName}`,
      tags: ['workflow', workflowName, ...(options?.tags ?? [])],
      metadata: {
        workflowName,
        agentNames: options?.agentNames,
        strategy: options?.strategy,
        ...options?.metadata,
      },
    });
    return buildTraceHandle(_client, trace);
  } catch {
    return null;
  }
}
