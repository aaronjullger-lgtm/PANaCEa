/**
 * LangGraph Orchestrator StateGraph
 *
 * Replaces the simple sequential/parallel/supervisor dispatch in
 * `lib/agents/orchestrator.ts` with a proper LangGraph StateGraph that
 * supports conditional routing, streaming, checkpointing, and error
 * recovery — while preserving the existing OrchestratorConfig /
 * OrchestratorResult API surface.
 *
 * State uses `Annotation.Root` (the ONLY correct LangGraph pattern;
 * StateSchema/ReducedValue are deprecated). Reference: osceEncounter.ts.
 *
 * Graph shape:
 *   START → route → [agent_1, agent_2, ...] → merge → END
 *
 * Conditional routing is driven by a user-supplied `routeFn` that
 * inspects the accumulated state and decides which agent to invoke next.
 *
 * @module lib/agents/graphs/orchestrator-graph
 */

import {
  StateGraph,
  Annotation,
  START,
  END,
  MemorySaver,
  messagesStateReducer,
} from '@langchain/langgraph';
import type { BaseMessage } from '@langchain/core/messages';
import type { AgentContext, InvokeResult } from '../shared/types';
import { getAgent } from '../shared/runtime';

// ─── Types ─────────────────────────────────────────────────────────────────

export type OrchestratorStrategy = 'sequential' | 'parallel' | 'conditional';

export interface OrchestratorNodeResult {
  agent: string;
  status: 'ok' | 'error';
  output: unknown;
  durationMs: number;
  error?: string;
}

/**
 * Route function signature: given the accumulated state, return the next
 * agent name to invoke, or END to finish.
 */
export type OrchestratorRouteFn = (
  state: typeof OrchestratorState.State,
) => string | typeof END;

export interface OrchestratorGraphConfig {
  /** Unique orchestrator name (kebab-case). */
  name: string;
  /** Human-readable description. */
  description: string;
  /** Agent names to coordinate. */
  agents: string[];
  /** Execution strategy. */
  strategy: OrchestratorStrategy;
  /**
   * Conditional routing function. Required when strategy === 'conditional'.
   * Receives the accumulated state and returns the next agent name or END.
   */
  routeFn?: OrchestratorRouteFn;
  /**
   * Optional merger: combine all agent outputs into a single result.
   * Receives all node results and returns the merged output.
   */
  merger?: (results: OrchestratorNodeResult[]) => unknown;
  /**
   * Maximum number of agent invocations before the graph stops.
   * Prevents infinite loops in conditional routing. Default: 20.
   */
  maxSteps?: number;
  /**
   * Whether to stop on the first agent error. Default: true.
   */
  stopOnError?: boolean;
}

// ─── State Schema ──────────────────────────────────────────────────────────

export const OrchestratorState = Annotation.Root({
  /** Accumulated messages (for LangGraph tracing / streaming). */
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),
  /** The original input payload passed to the orchestrator. */
  input: Annotation<unknown>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  /** Accumulated results from each agent invocation. */
  results: Annotation<OrchestratorNodeResult[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  /** The merged output (set by the merge node). */
  mergedOutput: Annotation<unknown>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  /** Current step count — guards against infinite loops. */
  stepCount: Annotation<number>({
    reducer: (_prev, next) => next,
    default: () => 0,
  }),
  /** The orchestrator config (set at graph creation, carried in state). */
  config: Annotation<OrchestratorGraphConfig | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  /** Agent context (env, userId, signal, log). */
  ctx: Annotation<AgentContext | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  /** Whether a fatal error occurred. */
  error: Annotation<string | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
});

export type OrchestratorStateType = typeof OrchestratorState.State;

// ─── Node: Route (conditional dispatch) ────────────────────────────────────

/**
 * The route node decides which agent to invoke next based on the strategy
 * and accumulated state. For 'conditional' strategy, it calls the user's
 * routeFn. For 'sequential', it iterates through the agent list. For
 * 'parallel', all agents are invoked in a single step.
 */
function routeNode(state: OrchestratorStateType): Partial<OrchestratorStateType> {
  const config = state.config;
  if (!config) {
    return { error: 'Orchestrator config not set in state' };
  }

  // Guard: max steps
  if (state.stepCount >= (config.maxSteps ?? 20)) {
    return { error: `Max steps (${config.maxSteps ?? 20}) exceeded` };
  }

  // Guard: stop on previous error
  if (state.error) {
    return {};
  }

  // Guard: stop on error if configured
  if (config.stopOnError !== false) {
    const lastError = state.results[state.results.length - 1];
    if (lastError?.status === 'error') {
      return { error: `Agent "${lastError.agent}" failed: ${lastError.error ?? 'unknown'}` };
    }
  }

  return { stepCount: state.stepCount + 1 };
}

// ─── Node: Invoke Agent ────────────────────────────────────────────────────

/**
 * Creates an agent invocation node for a specific agent name.
 * Each agent gets its own node in the graph.
 */
function createAgentNode(agentName: string) {
  return async function agentNode(
    state: OrchestratorStateType,
  ): Promise<Partial<OrchestratorStateType>> {
    const ctx = state.ctx;
    if (!ctx) {
      return {
        error: 'AgentContext not set in state',
        results: [{
          agent: agentName,
          status: 'error',
          output: null,
          durationMs: 0,
          error: 'AgentContext not set in state',
        }],
      };
    }

    const agent = getAgent(agentName);
    if (!agent) {
      return {
        results: [{
          agent: agentName,
          status: 'error',
          output: null,
          durationMs: 0,
          error: `Agent not found: ${agentName}`,
        }],
      };
    }

    const start = Date.now();
    try {
      // Pass the merged output from previous steps as input, or the original input
      const input = state.mergedOutput ?? state.input;
      const result: InvokeResult<unknown> = await agent.invoke(input, ctx);
      const durationMs = Date.now() - start;

      return {
        results: [{
          agent: agentName,
          status: result.status === 'ok' ? 'ok' : 'error',
          output: result.output,
          durationMs,
          error: result.error?.message,
        }],
        mergedOutput: result.output,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        results: [{
          agent: agentName,
          status: 'error',
          output: null,
          durationMs: Date.now() - start,
          error: message,
        }],
      };
    }
  };
}

// ─── Node: Merge ───────────────────────────────────────────────────────────

/**
 * The merge node combines all agent results using the configured merger
 * function (or a default pass-through).
 */
function mergeNode(state: OrchestratorStateType): Partial<OrchestratorStateType> {
  const config = state.config;
  if (!config) return {};

  if (config.merger && state.results.length > 0) {
    const merged = config.merger(state.results);
    return { mergedOutput: merged };
  }

  // Default: return the last result's output
  const last = state.results[state.results.length - 1];
  return { mergedOutput: last?.output ?? null };
}

// ─── Conditional Edge: After Route ─────────────────────────────────────────

/**
 * Determines the next node after the route node.
 * For 'sequential': returns the next uninvoked agent, or 'merge' if done.
 * For 'conditional': calls the user's routeFn.
 * For 'parallel': returns 'parallel_dispatch'.
 */
function afterRoute(state: OrchestratorStateType): string {
  const config = state.config;
  if (!config) return END;

  // Stop on error or max steps
  if (state.error) return 'merge';
  if (state.stepCount >= (config.maxSteps ?? 20)) return 'merge';

  switch (config.strategy) {
    case 'sequential': {
      // Find the next agent that hasn't been invoked yet
      const invoked = new Set(state.results.map((r) => r.agent));
      const next = config.agents.find((a) => !invoked.has(a));
      return next ?? 'merge';
    }

    case 'conditional': {
      if (!config.routeFn) {
        return 'merge';
      }
      const next = config.routeFn(state);
      // Validate the returned agent name
      if (next === END) return 'merge';
      if (config.agents.includes(next)) return next;
      return 'merge';
    }

    case 'parallel': {
      // All agents fire in parallel; route to the first one
      // (parallel dispatch is handled by the graph builder)
      const invoked = new Set(state.results.map((r) => r.agent));
      const next = config.agents.find((a) => !invoked.has(a));
      return next ?? 'merge';
    }

    default:
      return 'merge';
  }
}

// ─── Graph Builder ─────────────────────────────────────────────────────────

/**
 * Build a compiled LangGraph StateGraph for an orchestrator config.
 *
 * The graph shape depends on the strategy:
 * - sequential: START → route → agent_1 → route → agent_2 → ... → merge → END
 * - conditional: START → route → (agent per routeFn) → route → ... → merge → END
 * - parallel: START → route → [agent_1, agent_2, ...] → merge → END
 *
 * All graphs include checkpointing via MemorySaver for dev and support
 * LangGraph's built-in streaming.
 */
export function buildOrchestratorGraph(
  config: OrchestratorGraphConfig,
) {
  const agentNames = config.agents;

  // LangGraph's StateGraph narrows the node-name union type after each
  // .addNode() call, which breaks dynamic (string-typed) agent names.
  // We work around this by keeping the builder typed as `any` during
  // construction, then casting the compiled result back.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder: any = new StateGraph(OrchestratorState)
    .addNode('route', routeNode)
    .addNode('merge', mergeNode);

  for (let i = 0; i < agentNames.length; i++) {
    const name = agentNames[i]!;
    builder.addNode(name, createAgentNode(name));
  }

  builder.addEdge(START, 'route');

  if (config.strategy === 'parallel') {
    for (let i = 0; i < agentNames.length; i++) {
      builder.addEdge('route', agentNames[i]);
      builder.addEdge(agentNames[i], 'merge');
    }
  } else {
    builder.addConditionalEdges('route', afterRoute, [...agentNames, 'merge']);
    for (let i = 0; i < agentNames.length; i++) {
      builder.addEdge(agentNames[i], 'route');
    }
  }

  builder.addEdge('merge', END);

  return builder.compile({ checkpointer: new MemorySaver() });
}

// ─── Graph Registry ────────────────────────────────────────────────────────

const graphCache = new Map<string, ReturnType<typeof buildOrchestratorGraph>>();

/**
 * Get or build a compiled orchestrator graph.
 * Graphs are cached by config name for reuse across invocations.
 */
export function getOrchestratorGraph(
  config: OrchestratorGraphConfig,
): ReturnType<typeof buildOrchestratorGraph> {
  const cached = graphCache.get(config.name);
  if (cached) return cached;

  const graph = buildOrchestratorGraph(config);
  graphCache.set(config.name, graph);
  return graph;
}

/**
 * Clear the graph cache (useful for tests).
 */
export function clearOrchestratorGraphCache(): void {
  graphCache.clear();
}

// ─── Invocation Helpers ────────────────────────────────────────────────────

export interface OrchestratorGraphInput {
  config: OrchestratorGraphConfig;
  input: unknown;
  ctx: AgentContext;
  /** Optional thread ID for checkpointing / conversation continuity. */
  threadId?: string;
}

export interface OrchestratorGraphOutput {
  name: string;
  strategy: string;
  results: OrchestratorNodeResult[];
  mergedOutput: unknown;
  totalDurationMs: number;
  error: string | null;
}

/**
 * Invoke an orchestrator graph with the given input and context.
 * This is the primary entry point — replaces `runOrchestrator()`.
 */
export async function invokeOrchestratorGraph(
  opts: OrchestratorGraphInput,
): Promise<OrchestratorGraphOutput> {
  const start = Date.now();
  const graph = getOrchestratorGraph(opts.config);

  const initialState: Partial<OrchestratorStateType> = {
    input: opts.input,
    config: opts.config,
    ctx: opts.ctx,
    stepCount: 0,
    results: [],
    mergedOutput: null,
    error: null,
  };

  const result = await graph.invoke(initialState, {
    configurable: {
      thread_id: opts.threadId ?? `orchestrator-${opts.config.name}-${Date.now()}`,
    },
  });

  return {
    name: opts.config.name,
    strategy: opts.config.strategy,
    results: result.results,
    mergedOutput: result.mergedOutput,
    totalDurationMs: Date.now() - start,
    error: result.error,
  };
}

/**
 * Stream an orchestrator graph invocation, yielding state updates as they
 * occur. Useful for real-time progress reporting.
 */
export async function* streamOrchestratorGraph(
  opts: OrchestratorGraphInput,
): AsyncGenerator<Partial<OrchestratorStateType>> {
  const graph = getOrchestratorGraph(opts.config);

  const initialState: Partial<OrchestratorStateType> = {
    input: opts.input,
    config: opts.config,
    ctx: opts.ctx,
    stepCount: 0,
    results: [],
    mergedOutput: null,
    error: null,
  };

  for await (const chunk of await graph.stream(initialState, {
    configurable: {
      thread_id: opts.threadId ?? `orchestrator-${opts.config.name}-${Date.now()}`,
    },
    streamMode: 'updates',
  })) {
    yield chunk as Partial<OrchestratorStateType>;
  }
}
