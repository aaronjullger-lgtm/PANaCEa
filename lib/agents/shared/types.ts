/**
 * LangGraph runtime agent types.
 *
 * Shared shape every agent in `lib/agents/` exposes — independent of whether
 * the agent is a single-call wrapper or a multi-node graph with checkpoints.
 * Caller code talks only to `AgentDefinition<I, O>` and never to LangGraph
 * directly.
 *
 * @module lib/agents/shared/types
 */

import type { AIEnvKeys } from '@/lib/langchain/models';

export type AgentTier = 'encounter' | 'ops';

export type AgentStatus =
  | 'ok'
  | 'no_input'
  | 'rate_limited'
  | 'safety_blocked'
  | 'schema_invalid'
  | 'env_missing'
  | 'internal_error';

export interface AgentError {
  status: Exclude<AgentStatus, 'ok'>;
  message: string;
  /** Optional upstream error reason, not surfaced to the learner but kept for telemetry. */
  cause?: string;
}

export interface InvokeResult<O> {
  status: AgentStatus;
  output: O | null;
  error: AgentError | null;
  /** Name of the agent that handled the invocation. */
  agent: string;
  /** Wall-clock duration of the agent run, in ms. */
  durationMs: number;
  /** Telemetry surface — populated by each agent as needed (model used, tokens, etc.). */
  telemetry?: Record<string, unknown>;
}

export interface AgentContext {
  /** Cloudflare env (or test env) containing AI keys. Required by all real agents. */
  env: AIEnvKeys;
  /** Authenticated Clerk user ID — null/undefined for ops agents run with no user. */
  userId?: string | null;
  /** Optional abort signal — agents that call `routeTask` fan it through. */
  signal?: AbortSignal;
  /** Optional structured-logger hook. */
  log?: (level: 'info' | 'warn' | 'error', message: string, data?: unknown) => void;
}

export interface AgentDefinition<I = unknown, O = unknown> {
  /** Stable unique name keyed in the registry — kebab-case. */
  name: string;
  /** One-line human-readable purpose. */
  description: string;
  tier: AgentTier;
  /** Zod schema used to validate inbound input before `invoke` runs. */
  inputSchema?: unknown;
  /** Zod schema used to validate outbound output before returning. */
  outputSchema?: unknown;
  /** Invoke the agent. MUST never throw — wrap failures in `InvokeResult.error`. */
  invoke(input: I, ctx: AgentContext): Promise<InvokeResult<O>>;
}

export type AnyAgentDefinition = AgentDefinition<any, any>;

export interface RegisteredAgent {
  def: AnyAgentDefinition;
}