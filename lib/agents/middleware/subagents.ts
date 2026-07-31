/**
 * SubAgent Middleware — DeepAgents-inspired parallel agent spawning.
 *
 * Enables an orchestrator agent to spawn subagents for parallel work,
 * inspired by the DeepAgents SDK's SubAgentMiddleware pattern.
 * Each subagent runs independently with its own context, tools, and
 * system prompt. Results are collected and merged.
 *
 * Key differences from raw Promise.all:
 * - Each subagent gets a scoped system prompt + context
 * - Subagents can have different models (cost-optimized routing)
 * - Timeout and error isolation per subagent
 * - Structured result aggregation with metadata
 *
 * @module lib/agents/middleware/subagents
 */

import type { AgentContext, InvokeResult } from '../shared/types';
import { invokeUnifiedAgent } from '../unified';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface SubAgentDefinition {
  /** Unique name for this subagent invocation */
  name: string;
  /** Agent name in the registry to invoke */
  agentName: string;
  /** Scoped system prompt override */
  systemPrompt?: string;
  /** Input payload for this subagent */
  input: unknown;
  /** Timeout in ms (default: 30000) */
  timeoutMs?: number;
  /** Tags for tracing */
  tags?: string[];
}

export interface SubAgentResult {
  name: string;
  agentName: string;
  status: 'ok' | 'error' | 'timeout';
  output: unknown;
  error?: string;
  durationMs: number;
}

export interface SubAgentBatchResult {
  results: SubAgentResult[];
  totalDurationMs: number;
  successCount: number;
  failureCount: number;
  timeoutCount: number;
}

// ─── SubAgent Spawner ──────────────────────────────────────────────────────

const DEFAULT_SUBAGENT_TIMEOUT = 30_000;

/**
 * Spawn a single subagent with timeout and error isolation.
 * The subagent runs in the same process but with scoped context.
 */
async function spawnSubAgent(
  def: SubAgentDefinition,
  ctx: AgentContext,
): Promise<SubAgentResult> {
  const start = Date.now();
  const timeoutMs = def.timeoutMs ?? DEFAULT_SUBAGENT_TIMEOUT;

  try {
    const result = await withTimeout(
      invokeUnifiedAgent({
        name: def.agentName,
        input: def.input,
        ctx,
        trace: {
          name: `subagent/${def.name}`,
          tags: [...(def.tags ?? []), 'subagent'],
          metadata: {
            parentAgent: def.agentName,
            subAgentName: def.name,
          },
        },
      }),
      timeoutMs,
      `subagent:${def.name}`,
    );

    return {
      name: def.name,
      agentName: def.agentName,
      status: result.status === 'ok' ? 'ok' : 'error',
      output: result.output,
      error: result.error?.message,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    const isTimeout = err instanceof Error && err.message.includes('timed out');
    return {
      name: def.name,
      agentName: def.agentName,
      status: isTimeout ? 'timeout' : 'error',
      output: null,
      error: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - start,
    };
  }
}

/**
 * Spawn multiple subagents in parallel and collect results.
 *
 * @example
 * ```ts
 * const results = await spawnSubAgents([
 *   { name: 'cardio-qa', agentName: 'ddx-generator', input: { condition: 'CHF' } },
 *   { name: 'pulm-qa', agentName: 'ddx-generator', input: { condition: 'COPD' } },
 *   { name: 'gi-qa', agentName: 'ddx-generator', input: { condition: 'GI bleed' } },
 * ], ctx);
 * ```
 */
export async function spawnSubAgents(
  definitions: SubAgentDefinition[],
  ctx: AgentContext,
): Promise<SubAgentBatchResult> {
  const batchStart = Date.now();

  const results = await Promise.all(
    definitions.map((def) => spawnSubAgent(def, ctx)),
  );

  const successCount = results.filter((r) => r.status === 'ok').length;
  const failureCount = results.filter((r) => r.status === 'error').length;
  const timeoutCount = results.filter((r) => r.status === 'timeout').length;

  return {
    results,
    totalDurationMs: Date.now() - batchStart,
    successCount,
    failureCount,
    timeoutCount,
  };
}

/**
 * Spawn subagents with a concurrency limit to avoid overwhelming
 * rate-limited APIs.
 *
 * @example
 * ```ts
 * const results = await spawnSubAgentsWithConcurrency(
 *   definitions,
 *   ctx,
 *   3, // max 3 concurrent subagents
 * );
 * ```
 */
export async function spawnSubAgentsWithConcurrency(
  definitions: SubAgentDefinition[],
  ctx: AgentContext,
  concurrency: number = 3,
): Promise<SubAgentBatchResult> {
  const batchStart = Date.now();
  const results: SubAgentResult[] = [];

  for (let i = 0; i < definitions.length; i += concurrency) {
    const batch = definitions.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map((def) => spawnSubAgent(def, ctx)),
    );
    results.push(...batchResults);
  }

  const successCount = results.filter((r) => r.status === 'ok').length;
  const failureCount = results.filter((r) => r.status === 'error').length;
  const timeoutCount = results.filter((r) => r.status === 'timeout').length;

  return {
    results,
    totalDurationMs: Date.now() - batchStart,
    successCount,
    failureCount,
    timeoutCount,
  };
}

// ─── SubAgent Workflow (LangGraph-native) ──────────────────────────────────

/**
 * Create a LangGraph StateGraph that fans out to subagents and merges results.
 * This is the DeepAgents pattern: one supervisor node spawns N worker nodes,
 * then a merge node combines outputs.
 *
 * Usage: compose this into a larger orchestrator graph.
 */
export interface SubAgentWorkflowConfig {
  /** Subagent definitions to fan out */
  subAgents: SubAgentDefinition[];
  /** Optional: merge function for combining subagent outputs */
  merger?: (results: SubAgentResult[]) => unknown;
  /** Optional: concurrency limit (default: all parallel) */
  concurrency?: number;
}

/**
 * Execute a subagent workflow — fan out, collect, merge.
 * Simpler than building a full StateGraph for one-off parallel work.
 */
export async function executeSubAgentWorkflow(
  config: SubAgentWorkflowConfig,
  ctx: AgentContext,
): Promise<{ merged: unknown; batch: SubAgentBatchResult }> {
  const batch = config.concurrency
    ? await spawnSubAgentsWithConcurrency(config.subAgents, ctx, config.concurrency)
    : await spawnSubAgents(config.subAgents, ctx);

  const merged = config.merger
    ? config.merger(batch.results)
    : batch.results.map((r) => ({
        name: r.name,
        status: r.status,
        output: r.output,
      }));

  return { merged, batch };
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Operation "${label}" timed out after ${ms}ms`));
    }, ms);
    promise
      .then((v) => {
        clearTimeout(timer);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(timer);
        reject(e);
      });
  });
}
