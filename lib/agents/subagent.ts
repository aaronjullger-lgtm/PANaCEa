/**
 * Subagent Delegation
 *
 * Implements the Deep Agents subagent pattern: spawn isolated agent instances
 * for parallel task execution with independent contexts, timeouts, and result
 * aggregation.
 *
 * Key features:
 * - Isolated agent contexts (no shared state between subagents)
 * - Configurable timeouts per subagent
 * - Parallel execution with Promise.all
 * - Result aggregation with custom merge functions
 * - Error isolation (one subagent failure doesn't crash others)
 * - Trace hierarchy (parent → subagent spans)
 *
 * Pattern inspired by:
 * - Deep Agents Code: https://docs.langchain.com/oss/deepagents/code/subagents
 * - Open Deep Research: supervisor-researcher architecture
 *
 * @module lib/agents/subagent
 */

import type { AgentContext, InvokeResult } from './shared/types';
import { invokeAgent } from './shared/runtime';
import { createSubagentTrace, type AgentTraceSpan } from './observability';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface SubagentConfig {
  /** Agent name to invoke */
  agent: string;
  /** Input payload for this subagent */
  input: unknown;
  /** Timeout in ms (default: 30000) */
  timeoutMs?: number;
  /** Optional: transform the subagent output before aggregation */
  transform?: (output: unknown) => unknown;
  /** Optional: metadata for tracing */
  metadata?: Record<string, unknown>;
}

export interface SubagentResult {
  agent: string;
  status: 'ok' | 'error' | 'timeout';
  output: unknown;
  error?: string;
  durationMs: number;
  traceSpan?: AgentTraceSpan;
}

export interface SubagentDelegationResult {
  results: SubagentResult[];
  totalDurationMs: number;
  successCount: number;
  failureCount: number;
  timeoutCount: number;
  mergedOutput?: unknown;
}

// ─── Defaults ──────────────────────────────────────────────────────────────

const DEFAULT_SUBAGENT_TIMEOUT_MS = 30_000;
const MAX_CONCURRENT_SUBAGENTS = 10;

// ─── Subagent Execution ────────────────────────────────────────────────────

/**
 * Execute a single subagent with timeout and error isolation.
 */
async function executeSubagent(
  config: SubagentConfig,
  ctx: AgentContext,
  parentTraceId?: string,
): Promise<SubagentResult> {
  const start = Date.now();
  const timeoutMs = config.timeoutMs ?? DEFAULT_SUBAGENT_TIMEOUT_MS;

  // Create isolated trace context
  const trace = createSubagentTrace(config.agent);

  try {
    // Execute with timeout
    const result = await withTimeout(
      invokeAgent(config.agent, config.input, ctx),
      timeoutMs,
    );

    const durationMs = Date.now() - start;

    if (result.status === 'ok') {
      const output = config.transform ? config.transform(result.output) : result.output;
      return {
        agent: config.agent,
        status: 'ok',
        output,
        durationMs,
      };
    }

    return {
      agent: config.agent,
      status: 'error',
      output: null,
      error: result.error?.message ?? 'Unknown error',
      durationMs,
    };
  } catch (err) {
    const durationMs = Date.now() - start;
    const message = err instanceof Error ? err.message : String(err);

    // Distinguish timeout from other errors
    const isTimeout = message.includes('timed out') || message.includes('Timeout');

    return {
      agent: config.agent,
      status: isTimeout ? 'timeout' : 'error',
      output: null,
      error: message,
      durationMs,
    };
  }
}

/**
 * Delegate work to multiple subagents in parallel.
 *
 * @example
 * ```ts
 * const result = await delegateToSubagents([
 *   { agent: 'ddx-generator', input: { condition: 'chest pain' } },
 *   { agent: 'diagnostic-workup-advisor', input: { condition: 'chest pain' } },
 * ], ctx);
 *
 * // result.results[0].output → DDx list
 * // result.results[1].output → Recommended workup
 * ```
 */
export async function delegateToSubagents(
  subagents: SubagentConfig[],
  ctx: AgentContext,
  options?: {
    /** Max concurrent subagents (default: 10) */
    maxConcurrent?: number;
    /** Custom merge function for outputs */
    merger?: (results: SubagentResult[]) => unknown;
    /** Parent trace ID for hierarchy */
    parentTraceId?: string;
  },
): Promise<SubagentDelegationResult> {
  const start = Date.now();
  const maxConcurrent = options?.maxConcurrent ?? MAX_CONCURRENT_SUBAGENTS;

  // Enforce concurrency limit
  if (subagents.length > maxConcurrent) {
    console.warn(
      `[Subagent] Requested ${subagents.length} subagents, capping at ${maxConcurrent}`,
    );
    subagents = subagents.slice(0, maxConcurrent);
  }

  // Execute all subagents in parallel
  const results = await Promise.all(
    subagents.map((config) => executeSubagent(config, ctx, options?.parentTraceId)),
  );

  const successCount = results.filter((r) => r.status === 'ok').length;
  const failureCount = results.filter((r) => r.status === 'error').length;
  const timeoutCount = results.filter((r) => r.status === 'timeout').length;

  // Merge outputs
  const mergedOutput = options?.merger
    ? options.merger(results)
    : results.map((r) => ({
        agent: r.agent,
        status: r.status,
        output: r.output,
      }));

  return {
    results,
    totalDurationMs: Date.now() - start,
    successCount,
    failureCount,
    timeoutCount,
    mergedOutput,
  };
}

/**
 * Delegate work to subagents sequentially (each receives previous output).
 * Useful for pipeline workflows where each agent builds on the last.
 *
 * @example
 * ```ts
 * const result = await delegateSequential([
 *   { agent: 'ddx-generator', input: { condition: 'chest pain' } },
 *   { agent: 'soap-note-grader', input: null }, // receives DDx output
 *   { agent: 'feedback-summarizer', input: null }, // receives grading output
 * ], ctx);
 * ```
 */
export async function delegateSequential(
  subagents: SubagentConfig[],
  ctx: AgentContext,
  options?: {
    merger?: (results: SubagentResult[]) => unknown;
    parentTraceId?: string;
  },
): Promise<SubagentDelegationResult> {
  const start = Date.now();
  const results: SubagentResult[] = [];
  let currentInput: unknown = null;

  for (const config of subagents) {
    // Use previous output as input if no explicit input provided
    const input = config.input ?? currentInput;
    if (input === null && results.length > 0) {
      // No input available — skip this subagent
      results.push({
        agent: config.agent,
        status: 'error',
        output: null,
        error: 'No input available from previous subagent',
        durationMs: 0,
      });
      continue;
    }

    const result = await executeSubagent(
      { ...config, input },
      ctx,
      options?.parentTraceId,
    );

    results.push(result);

    // Pass output to next subagent
    if (result.status === 'ok' && result.output) {
      currentInput = result.output;
    }

    // Stop on error (unless we want to continue)
    if (result.status !== 'ok') {
      break;
    }
  }

  const successCount = results.filter((r) => r.status === 'ok').length;
  const failureCount = results.filter((r) => r.status === 'error').length;
  const timeoutCount = results.filter((r) => r.status === 'timeout').length;

  const mergedOutput = options?.merger
    ? options.merger(results)
    : results[results.length - 1]?.output;

  return {
    results,
    totalDurationMs: Date.now() - start,
    successCount,
    failureCount,
    timeoutCount,
    mergedOutput,
  };
}

// ─── Utilities ─────────────────────────────────────────────────────────────

/**
 * Execute a promise with a timeout.
 */
function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Subagent timed out after ${ms}ms`));
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

// ─── Pre-built Subagent Workflows ──────────────────────────────────────────

/**
 * Clinical encounter workflow: DDx → SOAP grading → Feedback.
 */
export async function runClinicalEncounterSubagents(
  caseData: unknown,
  ctx: AgentContext,
): Promise<SubagentDelegationResult> {
  return delegateSequential(
    [
      {
        agent: 'ddx-generator',
        input: caseData,
        metadata: { workflow: 'clinical-encounter', step: 1 },
      },
      {
        agent: 'soap-note-grader',
        input: null, // receives DDx output
        metadata: { workflow: 'clinical-encounter', step: 2 },
      },
      {
        agent: 'feedback-summarizer',
        input: null, // receives grading output
        metadata: { workflow: 'clinical-encounter', step: 3 },
      },
    ],
    ctx,
    {
      merger: (results) => ({
        differentialDiagnosis: results[0]?.output,
        soapGrading: results[1]?.output,
        feedback: results[2]?.output,
        workflow: 'clinical-encounter',
        timestamp: new Date().toISOString(),
      }),
    },
  );
}

/**
 * Diagnostic workup workflow: DDx + Workup advisor in parallel.
 */
export async function runDiagnosticWorkupSubagents(
  caseData: unknown,
  ctx: AgentContext,
): Promise<SubagentDelegationResult> {
  return delegateToSubagents(
    [
      {
        agent: 'ddx-generator',
        input: caseData,
        metadata: { workflow: 'diagnostic-workup' },
      },
      {
        agent: 'diagnostic-workup-advisor',
        input: caseData,
        metadata: { workflow: 'diagnostic-workup' },
      },
    ],
    ctx,
    {
      merger: (results) => ({
        differentialDiagnosis: results.find((r) => r.agent === 'ddx-generator')?.output,
        recommendedWorkup: results.find((r) => r.agent === 'diagnostic-workup-advisor')?.output,
        workflow: 'diagnostic-workup',
        timestamp: new Date().toISOString(),
      }),
    },
  );
}

/**
 * Ops audit workflow: Run all ops agents in parallel.
 */
export async function runOpsAuditSubagents(
  auditTarget: unknown,
  ctx: AgentContext,
): Promise<SubagentDelegationResult> {
  return delegateToSubagents(
    [
      {
        agent: 'call-gemini-auditor',
        input: auditTarget,
        metadata: { workflow: 'ops-audit' },
      },
      {
        agent: 'prompt-contract-validator',
        input: auditTarget,
        metadata: { workflow: 'ops-audit' },
      },
      {
        agent: 'schema-drift-detector',
        input: auditTarget,
        metadata: { workflow: 'ops-audit' },
      },
      {
        agent: 'env-var-auditor',
        input: auditTarget,
        metadata: { workflow: 'ops-audit' },
      },
    ],
    ctx,
    {
      merger: (results) => ({
        geminiAudit: results.find((r) => r.agent === 'call-gemini-auditor')?.output,
        promptValidation: results.find((r) => r.agent === 'prompt-contract-validator')?.output,
        schemaDrift: results.find((r) => r.agent === 'schema-drift-detector')?.output,
        envAudit: results.find((r) => r.agent === 'env-var-auditor')?.output,
        workflow: 'ops-audit',
        timestamp: new Date().toISOString(),
      }),
    },
  );
}
