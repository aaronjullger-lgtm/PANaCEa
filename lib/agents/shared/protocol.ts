/**
 * Shared Agent Protocol Types — Edge↔Node Bridge
 *
 * Defines the canonical types for agent discovery, invocation, and health
 * across the Edge runtime (lib/agents/) and the Node runtime
 * (packages/agent-orchestrator/). Both sides speak this protocol.
 *
 * @module lib/agents/shared/protocol
 */

// ─── Agent Identity ──────────────────────────────────────────────────────

export type AgentTier = 'encounter' | 'ops' | 'orchestrator' | 'content';

export interface AgentIdentity {
  /** Stable unique name — kebab-case */
  name: string;
  /** One-line human-readable purpose */
  description: string;
  /** Execution tier */
  tier: AgentTier;
  /** Runtime environment */
  runtime: 'edge' | 'node';
  /** Semantic version */
  version: string;
  /** Capability tags for discovery */
  tags: string[];
}

// ─── Agent Health ────────────────────────────────────────────────────────

export interface AgentHealth {
  identity: AgentIdentity;
  status: 'healthy' | 'degraded' | 'unavailable';
  lastHeartbeat: string;
  uptimeMs: number;
  metrics: {
    totalInvocations: number;
    errorRate: number;
    avgLatencyMs: number;
    lastError?: string;
  };
}

// ─── Registry Discovery ──────────────────────────────────────────────────

export interface RegistryManifest {
  /** Registry source */
  source: 'edge' | 'node';
  /** Base URL for HTTP-based registries */
  baseUrl?: string;
  /** All registered agents */
  agents: AgentIdentity[];
  /** Registry health */
  health: 'ok' | 'degraded' | 'unavailable';
  /** Last updated timestamp */
  updatedAt: string;
}

// ─── Invocation Protocol ─────────────────────────────────────────────────

export type AgentStatus =
  | 'ok'
  | 'no_input'
  | 'rate_limited'
  | 'safety_blocked'
  | 'schema_invalid'
  | 'env_missing'
  | 'internal_error'
  | 'not_found';

export interface AgentError {
  status: Exclude<AgentStatus, 'ok'>;
  message: string;
  cause?: string;
}

export interface InvokeResult<O = unknown> {
  status: AgentStatus;
  output: O | null;
  error: AgentError | null;
  agent: string;
  durationMs: number;
  telemetry?: Record<string, unknown>;
}

export interface InvokeRequest<I = unknown> {
  /** Target agent name */
  agent: string;
  /** Input payload */
  input: I;
  /** Optional trace context for distributed tracing */
  trace?: {
    traceId: string;
    parentSpanId?: string;
    tags?: string[];
    metadata?: Record<string, unknown>;
  };
}

// ─── Agent Context (shared across runtimes) ──────────────────────────────

export interface AgentContext {
  /** Authenticated user ID (null for ops agents) */
  userId?: string | null;
  /** Optional abort signal */
  signal?: AbortSignal;
  /** Structured logger hook */
  log?: (level: 'info' | 'warn' | 'error', message: string, data?: unknown) => void;
  /** Trace context for distributed tracing */
  traceContext?: {
    traceId: string;
    parentSpanId?: string;
  };
}

// ─── Registry Client Interface ───────────────────────────────────────────

export interface RegistryClient {
  /** Discover all agents in this registry */
  discover(): Promise<RegistryManifest>;
  /** Check health of a specific agent */
  health(agentName: string): Promise<AgentHealth>;
  /** Invoke an agent in this registry */
  invoke<I, O>(request: InvokeRequest<I>, ctx: AgentContext): Promise<InvokeResult<O>>;
}

// ─── Agent Definition (shared shape) ─────────────────────────────────────

export interface AgentDefinition<I = unknown, O = unknown> {
  identity: AgentIdentity;
  /** Zod schema for input validation */
  inputSchema?: unknown;
  /** Zod schema for output validation */
  outputSchema?: unknown;
  /** Invoke the agent — must never throw */
  invoke(input: I, ctx: AgentContext): Promise<InvokeResult<O>>;
}
