/**
 * Edge-safe LangSmith tracing helper for PANaCEa agent invocations.
 *
 * Wraps agent calls with LangSmith's `traceable` for automatic trace
 * creation in Cloudflare Edge runtime. Handles missing API keys
 * gracefully (tracing disabled, no errors).
 *
 * @module lib/agents/langsmith-edge
 */

import { traceable } from 'langsmith/traceable';
import { Client } from 'langsmith';
import { agentMetrics } from './observability';
import type { AIEnvKeys } from '@/lib/langchain/models';

// ─── LangSmith Client ────────────────────────────────────────────────

interface LangSmithEdgeConfig {
  apiKey: string;
  project: string;
  tracingEnabled: boolean;
}

function resolveEdgeConfig(env: AIEnvKeys): LangSmithEdgeConfig {
  const apiKey = env.LANGSMITH_API_KEY ?? '';
  return {
    apiKey,
    project: env.LANGSMITH_PROJECT ?? 'panacea',
    tracingEnabled: !!apiKey,
  };
}

/**
 * Create a LangSmith Client for Edge runtime.
 * Returns null when LANGSMITH_API_KEY is absent (tracing disabled).
 */
export function getLangSmithClient(env: AIEnvKeys): Client | null {
  const config = resolveEdgeConfig(env);
  if (!config.tracingEnabled) return null;

  return new Client({
    apiKey: config.apiKey,
  });
}

// ─── Traceable Agent Wrapper ─────────────────────────────────────────

interface TraceAgentInput {
  agent: string;
  input: Record<string, unknown>;
  userId: string;
  env: AIEnvKeys;
}

/**
 * Wrap an agent invocation with LangSmith tracing for Edge runtime.
 *
 * Usage:
 * ```ts
 * const result = await traceAgentInvocation({
 *   agent: agentName,
 *   input,
 *   userId: auth.userId,
 *   env,
 *   invoke: () => invokeAgent(agentName, input, { env, userId }),
 * });
 * ```
 *
 * When LANGSMITH_API_KEY is absent, the `invoke` callback runs
 * without tracing (zero overhead).
 */
export function traceAgentInvocation<T>(
  params: TraceAgentInput & { invoke: () => Promise<T> },
): Promise<T> {
  const client = getLangSmithClient(params.env);

  if (!client) {
    // Tracing disabled — run without overhead
    return params.invoke();
  }

  const tracedInvoke = traceable(
    async () => {
      return params.invoke();
    },
    {
      name: `agent:${params.agent}`,
      run_type: 'chain',
      project_name: params.env.LANGSMITH_PROJECT ?? 'panacea',
      client,
      tracingEnabled: true,
      tags: ['panacea', 'edge', params.agent],
      metadata: {
        agentName: params.agent,
        userId: params.userId,
      },
    },
  );

  return tracedInvoke();
}

/**
 * Record agent invocation metrics for the in-memory MetricsCollector.
 * Non-blocking: errors are caught and silently ignored.
 */
export function recordAgentMetric(
  agentName: string,
  durationMs: number,
  success: boolean,
): void {
  try {
    agentMetrics.recordInvocation(agentName, durationMs, success);
  } catch {
    // Metrics collection is best-effort; never fail the request
  }
}
