/**
 * LangSmith Tracing Integration — Enriched Observability
 *
 * Creates per-request LangChain callback handlers for observability
 * across all LangChain calls. Tracing is opt-in: if no
 * LANGSMITH_API_KEY is present, returns empty config.
 *
 * Uses `LangChainTracer` callback handlers passed via `RunnableConfig`
 * instead of mutating `globalThis` — safe for concurrent Edge requests.
 *
 * Sprint 1 (LangSmith Observability Upgrade): enriched metadata with
 * model name, token usage, cost estimates, agent context, and
 * online evaluation hooks.
 *
 * @module lib/langchain/tracing
 */

import { LangChainTracer } from '@langchain/core/tracers/tracer_langchain';
import type { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import type { AIEnvKeys } from './models';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface TracingOptions {
  /** Run name shown in LangSmith UI */
  runName?: string;
  /** Tags for filtering runs */
  tags?: string[];
  /** Arbitrary metadata attached to the run */
  metadata?: Record<string, unknown>;
  /** Model name used for this invocation (enriched metadata) */
  modelName?: string;
  /** Model provider (gemini, openai, anthropic, etc.) */
  provider?: string;
  /** Agent name if this is an agent invocation */
  agentName?: string;
  /** Agent tier (encounter, ops, orchestrator) */
  agentTier?: string;
  /** Workflow/orchestrator name for multi-agent traces */
  workflowName?: string;
  /** Session ID for grouping related traces */
  sessionId?: string;
  /** User ID for per-user trace filtering */
  userId?: string;
  /** Estimated cost tier (budget, mid, premium) */
  costTier?: 'free' | 'budget' | 'mid' | 'premium';
  /** Whether to enable online evaluation for this trace */
  enableOnlineEval?: boolean;
  /** Evaluation context (e.g., 'question-generation', 'osce-grading') */
  evalContext?: string;
}

/**
 * Tracing config ready to be spread into a RunnableConfig.
 * If tracing is disabled, all arrays are empty so spreading is safe.
 */
export interface TracingConfig {
  callbacks: BaseCallbackHandler[];
  tags: string[];
  metadata: Record<string, unknown>;
  runName?: string;
}

// ─── Environment Check ────────────────────────────────────────────────────

/**
 * Check if LangSmith tracing is available.
 */
export function isTracingEnabled(env: AIEnvKeys): boolean {
  return !!env.LANGSMITH_API_KEY;
}

// ─── Tracer Factory ───────────────────────────────────────────────────────

/**
 * Build a per-request LangChainTracer callback handler with enriched metadata.
 *
 * Unlike globalThis mutation patterns (unsafe in Edge isolates),
 * this creates an isolated tracer instance safe for concurrent
 * Edge requests.
 *
 * Metadata enrichment (Sprint 1):
 * - model_name, provider: which model handled the request
 * - agent_name, agent_tier: which agent was invoked
 * - workflow_name: orchestrator context for multi-agent traces
 * - cost_tier: budget classification for cost analysis
 * - session_id, user_id: grouping and filtering
 * - eval_context: triggers online evaluation when set
 *
 * @example
 * ```ts
 * const config = buildTracingConfig(env, {
 *   runName: 'panacea:question-gen',
 *   tags: ['generation', 'cardiology'],
 *   modelName: 'claude-sonnet-5',
 *   provider: 'anthropic',
 *   agentName: 'question-generator',
 *   agentTier: 'encounter',
 *   costTier: 'premium',
 *   userId: 'user_abc',
 *   metadata: { organSystem: 'Cardiology' },
 * });
 *
 * await model.invoke(messages, config);
 * ```
 */
export function buildTracingConfig(
  env: AIEnvKeys,
  options: TracingOptions = {}
): TracingConfig {
  const config: TracingConfig = {
    callbacks: [],
    tags: [
      'panacea',
      ...(options.tags ?? []),
      ...(options.agentTier ? [`tier:${options.agentTier}`] : []),
      ...(options.costTier ? [`cost:${options.costTier}`] : []),
      ...(options.provider ? [`provider:${options.provider}`] : []),
    ],
    metadata: {
      app: 'panacea',
      framework: 'langchain',
      ...(options.modelName ? { model_name: options.modelName } : {}),
      ...(options.provider ? { provider: options.provider } : {}),
      ...(options.agentName ? { agent_name: options.agentName } : {}),
      ...(options.agentTier ? { agent_tier: options.agentTier } : {}),
      ...(options.workflowName ? { workflow_name: options.workflowName } : {}),
      ...(options.costTier ? { cost_tier: options.costTier } : {}),
      ...(options.sessionId ? { session_id: options.sessionId } : {}),
      ...(options.userId ? { user_id: options.userId } : {}),
      ...(options.evalContext ? { eval_context: options.evalContext } : {}),
      ...(options.enableOnlineEval !== undefined ? { online_eval: options.enableOnlineEval } : {}),
      ...options.metadata,
    },
    runName: options.runName,
  };

  if (!env.LANGSMITH_API_KEY) return config;

  // Sampling gate: prevents retry storms from flooding LangSmith.
  // Default 1.0 (100%); set LANGSMITH_SAMPLE_RATE=0.1 for 10% in dev.
  const sampleRate = Number(env.LANGSMITH_SAMPLE_RATE ?? 1);
  if (sampleRate < 1 && Math.random() > sampleRate) {
    return config;
  }

  const tracer = new LangChainTracer({
    projectName: env.LANGSMITH_PROJECT ?? 'panacea',
  });
  config.callbacks.push(tracer);

  return config;
}

// ─── Online Evaluation Hooks (Sprint 1) ───────────────────────────────────

/**
 * Context for online evaluation — passed to eval hooks after agent completion.
 */
export interface OnlineEvalContext {
  /** What kind of evaluation to run */
  evalType: 'question-quality' | 'osce-grading' | 'content-generation' | 'agent-performance';
  /** The input that was sent to the agent/model */
  input: unknown;
  /** The output produced by the agent/model */
  output: unknown;
  /** Model that produced the output */
  modelName: string;
  /** Provider of the model */
  provider: string;
  /** Latency in ms */
  latencyMs: number;
  /** Token usage if available */
  usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
  /** Estimated cost in USD */
  estimatedCostUsd?: number;
  /** User ID for per-user eval filtering */
  userId?: string;
  /** Session ID for grouping */
  sessionId?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Online evaluation result — can be sent to LangSmith as feedback.
 */
export interface OnlineEvalResult {
  evalType: string;
  score: number;
  label: string;
  comment?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Run an online evaluation after an agent/model invocation completes.
 *
 * This is a fire-and-forget hook — it never blocks the response and
 * failures are silently logged. Use in the background (e.g., via
 * `ctx.waitUntil` in Cloudflare Workers).
 *
 * Currently a stub — evaluation logic is implemented in
 * `lib/langchain/evals/onlineEvals.ts`.
 */
export async function runOnlineEval(
  _ctx: OnlineEvalContext,
): Promise<OnlineEvalResult | null> {
  // Stub — delegates to the eval pipeline.
  // Imported lazily to avoid circular deps.
  try {
    const { evaluateOnline } = await import('@/lib/langchain/evals/onlineEvals');
    return evaluateOnline(_ctx);
  } catch {
    // Eval module not available or failed — silent degradation.
    return null;
  }
}

// ─── Feedback Collection (Sprint 1) ───────────────────────────────────────

/**
 * Feedback payload for LangSmith feedback collection.
 */
export interface TraceFeedback {
  /** The trace/run ID to attach feedback to */
  runId: string;
  /** Score (0.0–1.0) */
  score: number;
  /** Human-readable label */
  label?: string;
  /** Optional comment */
  comment?: string;
  /** Feedback key (e.g., 'correctness', 'helpfulness') */
  key?: string;
  /** Source of feedback ('user', 'auto', 'model') */
  source?: 'user' | 'auto' | 'model';
}

/**
 * Submit feedback to LangSmith for a specific trace.
 *
 * Uses the LangSmith REST API directly (not the SDK) to avoid
 * adding a hard dependency on the langsmith package in Edge functions.
 *
 * Fire-and-forget — never throws, never blocks the response.
 */
export async function submitTraceFeedback(
  feedback: TraceFeedback,
  env: AIEnvKeys,
): Promise<void> {
  if (!env.LANGSMITH_API_KEY) return;

  try {
    const endpoint = env.LANGSMITH_ENDPOINT ?? 'https://api.smith.langchain.com';
    const url = `${endpoint}/api/v1/feedback`;

    const body = {
      run_id: feedback.runId,
      key: feedback.key ?? 'user_feedback',
      score: feedback.score,
      comment: feedback.comment ?? feedback.label ?? '',
      value: feedback.label ?? (feedback.score >= 0.5 ? 'positive' : 'negative'),
      feedback_source: feedback.source ?? 'user',
    };

    // Fire-and-forget — don't await the response in hot paths.
    // Use waitUntil in Cloudflare Workers to keep the request alive.
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.LANGSMITH_API_KEY,
      },
      body: JSON.stringify(body),
    }).catch(() => {
      // Silent — observability should never break the app.
    });
  } catch {
    // Silent degradation.
  }
}

// ─── Trace Metadata Builder (Sprint 1) ────────────────────────────────────

/**
 * Build enriched trace metadata from a RouteResult or agent invocation result.
 *
 * Use this to attach post-hoc metadata (token usage, cost, latency) to
 * a trace that was started with `buildTracingConfig`.
 */
export interface TraceEnrichment {
  modelName: string;
  provider: string;
  latencyMs: number;
  attempts?: number;
  usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
  estimatedCostUsd?: number;
  agentName?: string;
  agentTier?: string;
  status: 'ok' | 'error';
  errorMessage?: string;
}

/**
 * Convert a trace enrichment to LangSmith-compatible metadata.
 * Can be attached to a follow-up span or logged separately.
 */
export function enrichmentToMetadata(enrichment: TraceEnrichment): Record<string, unknown> {
  return {
    model_name: enrichment.modelName,
    provider: enrichment.provider,
    latency_ms: enrichment.latencyMs,
    attempts: enrichment.attempts,
    input_tokens: enrichment.usage?.inputTokens,
    output_tokens: enrichment.usage?.outputTokens,
    total_tokens: enrichment.usage?.totalTokens,
    estimated_cost_usd: enrichment.estimatedCostUsd,
    agent_name: enrichment.agentName,
    agent_tier: enrichment.agentTier,
    status: enrichment.status,
    ...(enrichment.errorMessage ? { error: enrichment.errorMessage } : {}),
  };
}
