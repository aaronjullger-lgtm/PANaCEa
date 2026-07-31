/**
 * Supervisor State Schema
 *
 * Annotation.Root state for the LLM-based agent supervisor graph.
 * Uses the canonical LangGraph pattern — append-only message reducers,
 * replace-last-wins for routing decisions.
 *
 * This replaces the keyword-based routing in supervisor.ts with
 * LLM-driven semantic routing that understands clinical/ops/content
 * intent from natural language input.
 *
 * @module lib/agents/supervisor-state
 */

import { Annotation } from '@langchain/langgraph';
import type { BaseMessage } from '@langchain/core/messages';

// ─── Agent Capability Descriptor ───────────────────────────────────────────

/**
 * Describes an agent's capabilities for the LLM router.
 * The LLM uses these descriptions to decide which agent to route to.
 */
export interface AgentCapability {
  /** Agent name (kebab-case, matches registry) */
  name: string;
  /** Human-readable description of what this agent does */
  description: string;
  /** Keywords/topics this agent handles (helps the LLM route) */
  capabilities: string[];
  /** Example inputs this agent would handle well */
  examples: string[];
}

// ─── State Schema ──────────────────────────────────────────────────────────

export const SupervisorState = Annotation.Root({
  /** The original user input/message */
  messages: Annotation<BaseMessage[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),

  /** Available agents with their capabilities */
  availableAgents: Annotation<AgentCapability[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),

  /** The agent selected by the LLM router */
  selectedAgent: Annotation<string | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),

  /** Routing confidence (0-1) from the LLM */
  routingConfidence: Annotation<number>({
    reducer: (_prev, next) => next,
    default: () => 0,
  }),

  /** Routing reasoning from the LLM (for debugging/tracing) */
  routingReasoning: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => '',
  }),

  /** The output from the selected agent */
  agentOutput: Annotation<unknown>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),

  /** Execution status */
  status: Annotation<'idle' | 'routing' | 'executing' | 'complete' | 'error'>({
    reducer: (_prev, next) => next,
    default: () => 'idle',
  }),

  /** Error message if status is 'error' */
  error: Annotation<string | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),

  /** Supervisor name for tracing */
  supervisorName: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => 'default',
  }),

  /** Metadata for LangSmith tracing */
  metadata: Annotation<Record<string, unknown>>({
    reducer: (_prev, next) => next,
    default: () => ({}),
  }),
});

export type SupervisorStateType = typeof SupervisorState.State;
