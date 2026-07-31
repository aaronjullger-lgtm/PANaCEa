/**
 * Orchestrator State Schema
 *
 * Annotation.Root state for the LangGraph-based orchestrator.
 * Replaces the imperative switch/case in orchestrator.ts with a
 * proper StateGraph that supports checkpointing, streaming, and
 * parallel agent execution.
 *
 * @module lib/agents/orchestrator-state
 */

import { Annotation } from '@langchain/langgraph';
import type { BaseMessage } from '@langchain/core/messages';

// ─── Agent Result ──────────────────────────────────────────────────────────

export interface AgentExecutionResult {
  agent: string;
  status: 'ok' | 'error';
  output: unknown;
  durationMs: number;
  error?: string;
}

// ─── Orchestrator Config ───────────────────────────────────────────────────

export interface OrchestratorNodeConfig {
  /** Orchestrator name */
  name: string;
  /** Agent names to coordinate */
  agents: string[];
  /** Execution strategy */
  strategy: 'sequential' | 'parallel' | 'supervisor';
  /** Supervisor name if strategy is 'supervisor' */
  supervisorName?: string;
  /** Optional merger for parallel results */
  merger?: (results: AgentExecutionResult[]) => unknown;
}

// ─── State Schema ──────────────────────────────────────────────────────────

export const OrchestratorState = Annotation.Root({
  /** The original input to the orchestrator */
  messages: Annotation<BaseMessage[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),

  /** Orchestrator configuration */
  config: Annotation<OrchestratorNodeConfig>({
    reducer: (_prev, next) => next,
    default: () => ({
      name: 'default',
      agents: [],
      strategy: 'sequential',
    }),
  }),

  /** Results from each agent execution */
  results: Annotation<AgentExecutionResult[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),

  /** Merged output (for parallel strategy with merger) */
  mergedOutput: Annotation<unknown>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),

  /** Current execution phase */
  phase: Annotation<'init' | 'executing' | 'merging' | 'complete' | 'error'>({
    reducer: (_prev, next) => next,
    default: () => 'init',
  }),

  /** Index of the current agent in sequential execution */
  currentAgentIndex: Annotation<number>({
    reducer: (_prev, next) => next,
    default: () => 0,
  }),

  /** Accumulated input for sequential execution (output of previous agent) */
  accumulatedInput: Annotation<unknown>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),

  /** Error message if phase is 'error' */
  error: Annotation<string | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),

  /** Total execution duration in ms */
  totalDurationMs: Annotation<number>({
    reducer: (_prev, next) => next,
    default: () => 0,
  }),

  /** Start timestamp for duration calculation */
  startTime: Annotation<number>({
    reducer: (_prev, next) => next,
    default: () => 0,
  }),

  /** Metadata for tracing */
  metadata: Annotation<Record<string, unknown>>({
    reducer: (_prev, next) => next,
    default: () => ({}),
  }),
});

export type OrchestratorStateType = typeof OrchestratorState.State;
