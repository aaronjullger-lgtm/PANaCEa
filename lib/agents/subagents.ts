/**
 * Subagent Spawning Middleware
 *
 * Implements the Deep Agents subagent delegation pattern using existing
 * LangGraph infrastructure. The orchestrator can spawn ephemeral child
 * agents that run in isolated context windows, returning only their
 * final result to the parent.
 *
 * Pattern source: Deep Agents `SubAgentMiddleware` / `task` tool.
 * Reimplemented here to avoid the npm dependency while maintaining
 * API compatibility for future migration.
 *
 * Key behaviors:
 * - Subagents get fresh context (no message history from parent)
 * - Subagents run autonomously until completion
 * - Single handoff: one final report returned to parent
 * - Configurable timeout and recursion limits
 * - Support for general-purpose and specialized subagents
 * - Parallel subagent execution with result aggregation
 *
 * @module lib/agents/subagents
 */

import { z } from 'zod';
import type { AgentContext, InvokeResult } from './shared/types';
import { getAgent } from './shared/runtime';
import { createPlanningMiddleware, type PlanningMiddleware } from './planning';

// ─── Types ───────────────────────────────────────────────────────────────

export interface SubagentConfig {
  /** Unique name for this subagent type */
  name: string;
  /** Human-readable description */
  description: string;
  /** Agent name to delegate to (must be in registry) */
  agentName: string;
  /** System prompt override for the subagent */
  systemPrompt?: string;
  /** Maximum iterations before forced termination */
  maxIterations?: number;
  /** Timeout in milliseconds */
  timeoutMs?: number;
  /** Whether this subagent can spawn its own subagents */
  allowNestedSubagents?: boolean;
}

export interface SubagentResult {
  /** Subagent name */
  subagent: string;
  /** Execution status */
  status: 'ok' | 'error' | 'timeout' | 'max_iterations';
  /** Final output from the subagent */
  output: unknown;
  /** Error message if status is error */
  error?: string;
  /** Wall-clock duration in ms */
  durationMs: number;
  /** Number of iterations executed */
  iterations: number;
}

export interface SpawnOptions {
  /** Task description for the subagent */
  task: string;
  /** Subagent config name to use */
  subagentType?: string;
  /** Context to pass to the subagent */
  context?: Record<string, unknown>;
  /** Timeout override in ms */
  timeoutMs?: number;
  /** Whether to include planning middleware */
  withPlanning?: boolean;
}

// ─── Zod Schemas ─────────────────────────────────────────────────────────

export const TaskToolInput = z.object({
  subagent_type: z.string().describe('Type of subagent to spawn (e.g., "general-purpose", "clinical-researcher")'),
  description: z.string().max(200).describe('Short (3-5 word) description of the task'),
  prompt: z.string().min(1).max(4000).describe('The full task for the subagent to perform'),
});

export type TaskToolInputType = z.infer<typeof TaskToolInput>;

// ─── Subagent Registry ───────────────────────────────────────────────────

const subagentRegistry = new Map<string, SubagentConfig>();

export function registerSubagent(config: SubagentConfig): void {
  if (subagentRegistry.has(config.name)) {
    throw new Error(`Subagent already registered: ${config.name}`);
  }
  subagentRegistry.set(config.name, config);
}

export function getSubagent(name: string): SubagentConfig | undefined {
  return subagentRegistry.get(name);
}

export function listSubagents(): Array<{ name: string; description: string; agentName: string }> {
  return Array.from(subagentRegistry.values()).map((s) => ({
    name: s.name,
    description: s.description,
    agentName: s.agentName,
  }));
}

// ─── Default Subagents ───────────────────────────────────────────────────

/**
 * Register the built-in general-purpose subagent.
 * Uses the first available agent in the registry as its delegate.
 */
export function registerDefaultSubagents(): void {
  // General-purpose subagent — delegates to any available agent
  registerSubagent({
    name: 'general-purpose',
    description: 'General-purpose subagent for any task. Delegates to the best available agent.',
    agentName: 'ddx-generator', // fallback; overridden at spawn time
    maxIterations: 10,
    timeoutMs: 60_000,
  });

  // Clinical researcher subagent
  registerSubagent({
    name: 'clinical-researcher',
    description: 'Researches clinical topics, synthesizes evidence, and produces cited reports.',
    agentName: 'ddx-generator',
    systemPrompt: `You are a clinical research assistant. Your task is to:
1. Research the given clinical topic thoroughly
2. Synthesize findings from multiple sources
3. Produce a concise, well-cited report
4. Highlight clinical pearls and practice implications
5. Note any controversies or gaps in evidence`,
    maxIterations: 15,
    timeoutMs: 120_000,
  });

  // Content auditor subagent
  registerSubagent({
    name: 'content-auditor',
    description: 'Audits clinical content for accuracy, completeness, and blueprint alignment.',
    agentName: 'prompt-contract-validator',
    maxIterations: 8,
    timeoutMs: 45_000,
  });

  // Code reviewer subagent
  registerSubagent({
    name: 'code-reviewer',
    description: 'Reviews code changes for quality, security, and adherence to project conventions.',
    agentName: 'schema-drift-detector',
    maxIterations: 10,
    timeoutMs: 60_000,
  });
}

// ─── Subagent Execution ──────────────────────────────────────────────────

const DEFAULT_MAX_ITERATIONS = 10;
const DEFAULT_TIMEOUT_MS = 60_000;

/**
 * Spawn a single subagent and wait for its result.
 * The subagent runs in an isolated context — it receives only the task
 * description and optional context, not the parent's message history.
 */
export async function spawnSubagent(
  options: SpawnOptions,
  ctx: AgentContext,
): Promise<SubagentResult> {
  const start = Date.now();
  const subagentType = options.subagentType ?? 'general-purpose';
  const config = subagentRegistry.get(subagentType);

  if (!config) {
    return {
      subagent: subagentType,
      status: 'error',
      output: null,
      error: `Unknown subagent type: ${subagentType}. Available: ${Array.from(subagentRegistry.keys()).join(', ')}`,
      durationMs: Date.now() - start,
      iterations: 0,
    };
  }

  const agent = getAgent(config.agentName);
  if (!agent) {
    return {
      subagent: subagentType,
      status: 'error',
      output: null,
      error: `Delegate agent not found: ${config.agentName}`,
      durationMs: Date.now() - start,
      iterations: 0,
    };
  }

  const maxIterations = config.maxIterations ?? DEFAULT_MAX_ITERATIONS;
  const timeoutMs = options.timeoutMs ?? config.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  // Build isolated context for the subagent
  const subagentInput = {
    task: options.task,
    context: options.context ?? {},
    systemPrompt: config.systemPrompt,
  };

  // Optional planning middleware
  let planning: PlanningMiddleware | undefined;
  if (options.withPlanning) {
    planning = createPlanningMiddleware();
  }

  // Execute with timeout
  let iterations = 0;
  try {
    const result = await withTimeout(
      executeSubagentLoop(agent, subagentInput, ctx, maxIterations, planning, config),
      timeoutMs,
      `subagent:${subagentType}`,
    );

    iterations = result.iterations;
    return {
      subagent: subagentType,
      status: result.status,
      output: result.output,
      error: result.error,
      durationMs: Date.now() - start,
      iterations,
    };
  } catch (err) {
    const isTimeout = err instanceof Error && err.message.includes('timed out');
    return {
      subagent: subagentType,
      status: isTimeout ? 'timeout' : 'error',
      output: null,
      error: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - start,
      iterations,
    };
  }
}

/**
 * Execute the subagent loop: invoke → check result → repeat if needed.
 */
async function executeSubagentLoop(
  agent: { invoke: (input: unknown, ctx: AgentContext) => Promise<InvokeResult<unknown>> },
  input: unknown,
  ctx: AgentContext,
  maxIterations: number,
  planning: PlanningMiddleware | undefined,
  _config: SubagentConfig,
): Promise<{ status: SubagentResult['status']; output: unknown; error?: string; iterations: number }> {
  let iterations = 0;
  let lastOutput: unknown = null;

  for (let i = 0; i < maxIterations; i++) {
    iterations = i + 1;

    // Check abort signal
    if (ctx.signal?.aborted) {
      return { status: 'error', output: lastOutput, error: 'Aborted', iterations };
    }

    // Inject planning context if enabled
    const enrichedInput = planning
      ? { ...(input as Record<string, unknown>), planContext: planning.getPromptContext() }
      : input;

    const result = await agent.invoke(enrichedInput, ctx);

    if (result.status !== 'ok') {
      return {
        status: 'error',
        output: result.output,
        error: result.error?.message ?? 'Agent invocation failed',
        iterations,
      };
    }

    lastOutput = result.output;

    // If the agent returned a final answer (not requesting more tools),
    // we're done. The agent signals completion by returning output without
    // tool calls — we trust the agent to know when it's done.
    if (isFinalOutput(result.output)) {
      return { status: 'ok', output: result.output, iterations };
    }

    // Update planning if enabled
    if (planning && result.output) {
      const outputStr = typeof result.output === 'string'
        ? result.output
        : JSON.stringify(result.output);
      // Check if the output contains task updates
      if (outputStr.includes('write_todos')) {
        try {
          const parsed = typeof result.output === 'string'
            ? JSON.parse(result.output)
            : result.output;
          if (parsed && typeof parsed === 'object' && 'tasks' in parsed) {
            planning.writeTodos(parsed as any);
          }
        } catch {
          // Not JSON — ignore
        }
      }
    }
  }

  return {
    status: 'max_iterations',
    output: lastOutput,
    error: `Subagent did not complete within ${maxIterations} iterations`,
    iterations,
  };
}

/**
 * Heuristic: check if the agent output looks like a final answer
 * rather than an intermediate tool-call request.
 */
function isFinalOutput(output: unknown): boolean {
  if (output === null || output === undefined) return false;
  if (typeof output === 'string') {
    // If the output is a tool call request, it's not final
    if (output.trim().startsWith('{') && output.includes('tool_calls')) return false;
    return output.length > 0;
  }
  if (typeof output === 'object') {
    const obj = output as Record<string, unknown>;
    // If it has tool_calls, it's not final
    if ('tool_calls' in obj) return false;
    // If it has a final answer marker, it is final
    if ('final' in obj || 'answer' in obj || 'report' in obj) return true;
    return true;
  }
  return true;
}

// ─── Parallel Subagent Execution ─────────────────────────────────────────

export interface ParallelSpawnOptions {
  /** Tasks to execute in parallel */
  tasks: Array<{
    subagentType: string;
    description: string;
    prompt: string;
    context?: Record<string, unknown>;
  }>;
  /** Maximum concurrent subagents */
  concurrency?: number;
  /** Timeout per subagent in ms */
  timeoutMs?: number;
}

/**
 * Spawn multiple subagents in parallel with concurrency control.
 * Results are aggregated and returned as a map of task → result.
 */
export async function spawnSubagentsParallel(
  options: ParallelSpawnOptions,
  ctx: AgentContext,
): Promise<{
  results: Map<string, SubagentResult>;
  allSucceeded: boolean;
  totalDurationMs: number;
}> {
  const start = Date.now();
  const concurrency = options.concurrency ?? 4;
  const results = new Map<string, SubagentResult>();

  // Process in batches of `concurrency`
  for (let i = 0; i < options.tasks.length; i += concurrency) {
    const batch = options.tasks.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map((task) =>
        spawnSubagent(
          {
            task: task.prompt,
            subagentType: task.subagentType,
            context: task.context,
            timeoutMs: options.timeoutMs,
          },
          ctx,
        ).then((r) => ({ key: task.description, result: r })),
      ),
    );

    for (const { key, result } of batchResults) {
      results.set(key, result);
    }
  }

  const allSucceeded = Array.from(results.values()).every((r) => r.status === 'ok');

  return {
    results,
    allSucceeded,
    totalDurationMs: Date.now() - start,
  };
}

// ─── Task Tool Definition ────────────────────────────────────────────────

/**
 * Tool definition for the `task` tool — compatible with LangChain StructuredTool.
 * This is the primary interface agents use to spawn subagents.
 */
export const taskTool = {
  name: 'task',
  description: `Launch a subagent to handle a complex, multi-step task autonomously.

Use this tool when:
- A task is too large for a single model call
- You need parallel research across multiple topics
- A subtask requires focused, uninterrupted work
- You want to isolate heavy computation from the main conversation

Available subagent types:
- general-purpose: Any task, delegates to best available agent
- clinical-researcher: Research clinical topics with evidence synthesis
- content-auditor: Audit clinical content for accuracy
- code-reviewer: Review code for quality and security

The subagent runs in an isolated context and returns a single final report.`,
  schema: TaskToolInput,
};

/**
 * Execute the task tool — spawn a subagent and return its result.
 */
export async function executeTaskTool(
  input: TaskToolInputType,
  ctx: AgentContext,
): Promise<string> {
  const result = await spawnSubagent(
    {
      task: input.prompt,
      subagentType: input.subagent_type,
      withPlanning: true,
    },
    ctx,
  );

  if (result.status === 'ok') {
    const output = typeof result.output === 'string'
      ? result.output
      : JSON.stringify(result.output, null, 2);
    return `Subagent "${result.subagent}" completed in ${result.durationMs}ms (${result.iterations} iterations):\n\n${output}`;
  }

  return `Subagent "${result.subagent}" failed (${result.status}): ${result.error ?? 'Unknown error'}`;
}

// ─── Subagent Middleware Factory ──────────────────────────────────────────

export interface SubagentMiddlewareConfig {
  /** Default subagent type for task delegation */
  defaultType?: string;
  /** Maximum concurrent subagents */
  maxConcurrency?: number;
  /** Default timeout per subagent in ms */
  defaultTimeoutMs?: number;
  /** Whether to allow nested subagents */
  allowNested?: boolean;
}

/**
 * Create a subagent middleware compatible with the orchestrator pattern.
 */
export function createSubagentMiddleware(config: SubagentMiddlewareConfig = {}) {
  const defaultType = config.defaultType ?? 'general-purpose';
  const maxConcurrency = config.maxConcurrency ?? 4;
  const defaultTimeoutMs = config.defaultTimeoutMs ?? 60_000;
  const allowNested = config.allowNested ?? false;

  let nestLevel = 0;

  return {
    /** Spawn a single subagent */
    spawn: (options: SpawnOptions, ctx: AgentContext): Promise<SubagentResult> => {
      if (!allowNested && nestLevel > 0) {
        return Promise.resolve({
          subagent: options.subagentType ?? defaultType,
          status: 'error',
          output: null,
          error: 'Nested subagents are disabled',
          durationMs: 0,
          iterations: 0,
        });
      }
      return spawnSubagent(
        { ...options, subagentType: options.subagentType ?? defaultType, timeoutMs: options.timeoutMs ?? defaultTimeoutMs },
        ctx,
      );
    },

    /** Spawn multiple subagents in parallel */
    spawnParallel: (
      tasks: ParallelSpawnOptions['tasks'],
      ctx: AgentContext,
    ): Promise<{
      results: Map<string, SubagentResult>;
      allSucceeded: boolean;
      totalDurationMs: number;
    }> => {
      return spawnSubagentsParallel(
        { tasks, concurrency: maxConcurrency, timeoutMs: defaultTimeoutMs },
        ctx,
      );
    },

    /** Enter a nested subagent context */
    enterNested: (): void => {
      nestLevel++;
    },

    /** Exit a nested subagent context */
    exitNested: (): void => {
      nestLevel = Math.max(0, nestLevel - 1);
    },

    /** Get current nesting level */
    getNestLevel: (): number => nestLevel,

    /** List available subagent types */
    listTypes: (): string[] => {
      return Array.from(subagentRegistry.keys());
    },
  };
}

export type SubagentMiddleware = ReturnType<typeof createSubagentMiddleware>;

// ─── Utility ─────────────────────────────────────────────────────────────

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Subagent "${label}" timed out after ${ms}ms`));
    }, ms);
    promise
      .then((v) => { clearTimeout(timer); resolve(v); })
      .catch((e) => { clearTimeout(timer); reject(e); });
  });
}
