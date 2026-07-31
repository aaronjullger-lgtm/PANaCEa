/**
 * Subagent Delegation System
 *
 * Implements the Deep Agents subagent pattern: a parent agent can spawn
 * task-specific subagents that run in parallel or sequence, each with
 * their own tool set, system prompt, and context window.
 *
 * Inspired by langchain-ai/deepagents subagent architecture:
 * - Each subagent is a focused specialist with a narrow tool set
 * - Parent agent delegates, aggregates, and synthesizes results
 * - Subagents can run in parallel for independent tasks
 * - Context compaction prevents window overflow in long chains
 *
 * @module lib/agents/deep/subagent
 */

import type { AgentContext, InvokeResult } from '../shared/types';
import { invokeUnifiedAgent } from '../unified';

// ─── Types ─────────────────────────────────────────────────────────────────

/** A subagent task — one unit of work delegated to a specialist agent. */
export interface SubagentTask {
  /** Unique task ID within the delegation batch. */
  id: string;
  /** Agent name to invoke (must exist in Edge or Node registry). */
  agentName: string;
  /** Input payload for the subagent. */
  input: unknown;
  /** Optional: override the default system prompt for this task. */
  systemPromptOverride?: string;
  /** Optional: tags for tracing/filtering. */
  tags?: string[];
  /** Optional: timeout in ms (default: 60_000). */
  timeoutMs?: number;
}

/** Result of a single subagent task. */
export interface SubagentResult {
  taskId: string;
  agentName: string;
  status: 'ok' | 'error' | 'timeout';
  output: unknown;
  error?: string;
  durationMs: number;
  tokensUsed?: { input: number; output: number };
}

/** Configuration for a subagent delegation batch. */
export interface DelegationConfig {
  /** Human-readable name for this delegation (appears in traces). */
  name: string;
  /** Tasks to delegate. */
  tasks: SubagentTask[];
  /** Execution strategy. */
  strategy: 'parallel' | 'sequential' | 'parallel_with_merge';
  /** Optional: merge function for parallel_with_merge strategy. */
  merger?: (results: SubagentResult[]) => unknown;
  /** Optional: max concurrency for parallel execution (default: all at once). */
  maxConcurrency?: number;
  /** Optional: abort signal to cancel all subagents. */
  signal?: AbortSignal;
}

/** Result of a full delegation batch. */
export interface DelegationResult {
  delegationName: string;
  strategy: string;
  results: SubagentResult[];
  mergedOutput?: unknown;
  totalDurationMs: number;
  successCount: number;
  errorCount: number;
  timeoutCount: number;
}

// ─── Subagent Execution ────────────────────────────────────────────────────

const DEFAULT_SUBAGENT_TIMEOUT_MS = 60_000;

/**
 * Execute a single subagent task with timeout protection.
 */
async function executeSubagentTask(
  task: SubagentTask,
  ctx: AgentContext,
): Promise<SubagentResult> {
  const start = Date.now();
  const timeoutMs = task.timeoutMs ?? DEFAULT_SUBAGENT_TIMEOUT_MS;

  try {
    // Create a timeout-aware abort controller
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);

    // Merge the task's abort signal with our timeout
    const mergedSignal = ctx.signal
      ? AbortSignal.any([ctx.signal, abortController.signal])
      : abortController.signal;

    const taskCtx: AgentContext = {
      ...ctx,
      signal: mergedSignal,
    };

    const result = await invokeUnifiedAgent({
      name: task.agentName,
      input: task.input,
      ctx: taskCtx,
      trace: {
        name: `subagent/${task.agentName}/${task.id}`,
        tags: ['subagent', ...(task.tags ?? [])],
        metadata: { taskId: task.id },
      },
    });

    clearTimeout(timeoutId);

    return {
      taskId: task.id,
      agentName: task.agentName,
      status: result.status === 'ok' ? 'ok' : 'error',
      output: result.output,
      error: result.error?.message,
      durationMs: Date.now() - start,
      tokensUsed: result.telemetry?.tokensUsed as
        | { input: number; output: number }
        | undefined,
    };
  } catch (err) {
    const isTimeout = err instanceof DOMException && err.name === 'AbortError';
    return {
      taskId: task.id,
      agentName: task.agentName,
      status: isTimeout ? 'timeout' : 'error',
      output: null,
      error: isTimeout
        ? `Subagent timed out after ${timeoutMs}ms`
        : err instanceof Error
          ? err.message
          : String(err),
      durationMs: Date.now() - start,
    };
  }
}

/**
 * Execute tasks in parallel with optional concurrency limit.
 */
async function executeParallel(
  tasks: SubagentTask[],
  ctx: AgentContext,
  maxConcurrency?: number,
): Promise<SubagentResult[]> {
  if (maxConcurrency && maxConcurrency < tasks.length) {
    // Execute in batches to respect concurrency limit
    const results: SubagentResult[] = [];
    for (let i = 0; i < tasks.length; i += maxConcurrency) {
      const batch = tasks.slice(i, i + maxConcurrency);
      const batchResults = await Promise.all(
        batch.map((task) => executeSubagentTask(task, ctx)),
      );
      results.push(...batchResults);
    }
    return results;
  }

  return Promise.all(tasks.map((task) => executeSubagentTask(task, ctx)));
}

/**
 * Execute tasks sequentially, passing each result as context to the next.
 */
async function executeSequential(
  tasks: SubagentTask[],
  ctx: AgentContext,
): Promise<SubagentResult[]> {
  const results: SubagentResult[] = [];
  let accumulatedContext: unknown = undefined;

  for (const task of tasks) {
    // Enrich input with previous results for context propagation
    const enrichedInput = accumulatedContext
      ? { task: task.input, previousResults: accumulatedContext }
      : task.input;

    const result = await executeSubagentTask(
      { ...task, input: enrichedInput },
      ctx,
    );
    results.push(result);

    if (result.status === 'ok') {
      accumulatedContext = result.output;
    }
    // Continue on error — don't stop the whole chain for one failure
  }

  return results;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Delegate a batch of tasks to subagents.
 *
 * This is the main entry point for the subagent delegation pattern.
 * Use it when a complex workflow can be broken into independent or
 * sequential specialist tasks.
 *
 * @example
 * ```ts
 * // Parallel: run DDx generation and diagnostic workup simultaneously
 * const result = await delegateToSubagents({
 *   name: 'clinical-workup',
 *   tasks: [
 *     { id: 'ddx', agentName: 'ddx-generator', input: { condition: 'chest pain' } },
 *     { id: 'workup', agentName: 'diagnostic-workup-advisor', input: { condition: 'chest pain' } },
 *   ],
 *   strategy: 'parallel_with_merge',
 *   merger: (results) => ({
 *     ddx: results.find(r => r.taskId === 'ddx')?.output,
 *     workup: results.find(r => r.taskId === 'workup')?.output,
 *   }),
 * });
 * ```
 *
 * @example
 * ```ts
 * // Sequential: generate DDx, then grade the SOAP note, then summarize feedback
 * const result = await delegateToSubagents({
 *   name: 'encounter-pipeline',
 *   tasks: [
 *     { id: 'ddx', agentName: 'ddx-generator', input: encounterData },
 *     { id: 'soap', agentName: 'soap-note-grader', input: encounterData },
 *     { id: 'feedback', agentName: 'feedback-summarizer', input: encounterData },
 *   ],
 *   strategy: 'sequential',
 * });
 * ```
 */
export async function delegateToSubagents(
  config: DelegationConfig,
  ctx: AgentContext,
): Promise<DelegationResult> {
  const start = Date.now();

  let results: SubagentResult[];

  switch (config.strategy) {
    case 'parallel':
    case 'parallel_with_merge':
      results = await executeParallel(config.tasks, ctx, config.maxConcurrency);
      break;
    case 'sequential':
      results = await executeSequential(config.tasks, ctx);
      break;
    default:
      results = await executeParallel(config.tasks, ctx, config.maxConcurrency);
  }

  const successCount = results.filter((r) => r.status === 'ok').length;
  const errorCount = results.filter((r) => r.status === 'error').length;
  const timeoutCount = results.filter((r) => r.status === 'timeout').length;

  const delegationResult: DelegationResult = {
    delegationName: config.name,
    strategy: config.strategy,
    results,
    totalDurationMs: Date.now() - start,
    successCount,
    errorCount,
    timeoutCount,
  };

  // Apply merger if configured
  if (config.strategy === 'parallel_with_merge' && config.merger) {
    delegationResult.mergedOutput = config.merger(results);
  }

  return delegationResult;
}

/**
 * Create a pre-configured subagent delegation for a clinical encounter.
 *
 * This is a convenience wrapper that sets up the standard clinical
 * encounter pipeline: DDx generation → SOAP grading → feedback summary.
 */
export async function runClinicalEncounterPipeline(
  encounterData: unknown,
  ctx: AgentContext,
): Promise<DelegationResult> {
  return delegateToSubagents(
    {
      name: 'clinical-encounter-pipeline',
      tasks: [
        {
          id: 'ddx',
          agentName: 'ddx-generator',
          input: encounterData,
          tags: ['clinical', 'ddx'],
        },
        {
          id: 'soap',
          agentName: 'soap-note-grader',
          input: encounterData,
          tags: ['clinical', 'soap'],
        },
        {
          id: 'feedback',
          agentName: 'feedback-summarizer',
          input: encounterData,
          tags: ['clinical', 'feedback'],
        },
      ],
      strategy: 'parallel_with_merge',
      merger: (results) => ({
        differentialDiagnosis: results.find((r) => r.taskId === 'ddx')?.output,
        soapGrading: results.find((r) => r.taskId === 'soap')?.output,
        feedbackSummary: results.find((r) => r.taskId === 'feedback')?.output,
        timestamp: new Date().toISOString(),
      }),
    },
    ctx,
  );
}

/**
 * Create a pre-configured subagent delegation for content operations.
 *
 * Runs content audit, enrichment, and quality checks in parallel.
 */
export async function runContentOperationsPipeline(
  contentData: unknown,
  ctx: AgentContext,
): Promise<DelegationResult> {
  return delegateToSubagents(
    {
      name: 'content-operations-pipeline',
      tasks: [
        {
          id: 'audit',
          agentName: 'content-audit',
          input: contentData,
          tags: ['content', 'audit'],
          timeoutMs: 120_000, // Content audit can take longer
        },
        {
          id: 'enrichment',
          agentName: 'content-enrichment',
          input: contentData,
          tags: ['content', 'enrichment'],
          timeoutMs: 120_000,
        },
      ],
      strategy: 'parallel_with_merge',
      merger: (results) => ({
        auditFindings: results.find((r) => r.taskId === 'audit')?.output,
        enrichmentCandidates: results.find((r) => r.taskId === 'enrichment')?.output,
        timestamp: new Date().toISOString(),
      }),
    },
    ctx,
  );
}
