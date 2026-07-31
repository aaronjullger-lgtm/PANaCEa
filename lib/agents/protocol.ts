/**
 * Agent Protocol Types
 *
 * Standardized message protocol for agent communication, inspired by
 * the Agent Protocol (github.com/langchain-ai/agent-protocol) but adapted
 * for PANaCEa's existing AgentDefinition + InvokeResult types.
 *
 * Goals:
 * - Every agent speaks the same message format
 * - Capability discovery is built into the protocol
 * - Task lifecycle is explicit (created → running → completed → failed)
 * - Errors are structured and machine-readable
 * - Streaming events follow a consistent shape
 *
 * @module lib/agents/protocol
 */

// ─── Message Types ──────────────────────────────────────────────────────────

/**
 * Standard agent message — every agent invocation starts with an AgentRequest
 * and ends with an AgentResponse.
 */
export interface AgentRequest {
  /** Unique request ID (UUID v4) */
  requestId: string;
  /** Agent name to invoke */
  agent: string;
  /** Task type — maps to agent capability */
  task: string;
  /** Input payload — agent-specific shape */
  input: unknown;
  /** Request metadata */
  metadata?: AgentRequestMetadata;
}

export interface AgentRequestMetadata {
  /** Clerk user ID (null for ops agents) */
  userId?: string | null;
  /** Session ID for grouping related requests */
  sessionId?: string;
  /** Trace ID for distributed tracing */
  traceId?: string;
  /** Tags for filtering in LangSmith/Langfuse */
  tags?: string[];
  /** Arbitrary key-value metadata */
  extra?: Record<string, unknown>;
}

/**
 * Standard agent response — every agent invocation produces an AgentResponse.
 */
export interface AgentResponse {
  /** Echoes the request ID */
  requestId: string;
  /** Agent that handled the request */
  agent: string;
  /** Task status */
  status: AgentTaskStatus;
  /** Output payload — agent-specific shape, null on error */
  output: unknown | null;
  /** Error details — null on success */
  error: AgentProtocolError | null;
  /** Wall-clock duration in ms */
  durationMs: number;
  /** Telemetry surface */
  telemetry?: AgentTelemetry;
}

export type AgentTaskStatus =
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'rate_limited'
  | 'safety_blocked'
  | 'invalid_input';

// ─── Error Types ────────────────────────────────────────────────────────────

export interface AgentProtocolError {
  /** Machine-readable error code */
  code: AgentErrorCode;
  /** Human-readable error message */
  message: string;
  /** Optional structured error details */
  details?: Record<string, unknown>;
  /** Optional upstream error cause */
  cause?: string;
}

export type AgentErrorCode =
  | 'AGENT_NOT_FOUND'
  | 'INVALID_INPUT'
  | 'RATE_LIMITED'
  | 'SAFETY_BLOCKED'
  | 'ENV_MISSING'
  | 'TOOL_ERROR'
  | 'MODEL_ERROR'
  | 'TIMEOUT'
  | 'INTERNAL_ERROR';

// ─── Telemetry ──────────────────────────────────────────────────────────────

export interface AgentTelemetry {
  /** Model used (e.g., "gemini-2.0-flash") */
  model?: string;
  /** Total tokens consumed */
  tokensUsed?: number;
  /** Prompt tokens */
  promptTokens?: number;
  /** Completion tokens */
  completionTokens?: number;
  /** Number of tool calls made */
  toolCalls?: number;
  /** Tools invoked */
  toolsUsed?: string[];
  /** Agent tier */
  agentTier?: string;
  /** Custom telemetry fields */
  extra?: Record<string, unknown>;
}

// ─── Streaming Events ───────────────────────────────────────────────────────

/**
 * Streaming event types — emitted during agent execution.
 * Follows LangGraph streamEvents v2 shape for compatibility.
 */
export type AgentStreamEvent =
  | AgentStreamStartEvent
  | AgentStreamTokenEvent
  | AgentStreamToolStartEvent
  | AgentStreamToolEndEvent
  | AgentStreamCompleteEvent
  | AgentStreamErrorEvent;

export interface AgentStreamStartEvent {
  event: 'agent_start';
  requestId: string;
  agent: string;
  timestamp: string;
}

export interface AgentStreamTokenEvent {
  event: 'token';
  requestId: string;
  agent: string;
  token: string;
  timestamp: string;
}

export interface AgentStreamToolStartEvent {
  event: 'tool_start';
  requestId: string;
  agent: string;
  tool: string;
  input: unknown;
  timestamp: string;
}

export interface AgentStreamToolEndEvent {
  event: 'tool_end';
  requestId: string;
  agent: string;
  tool: string;
  output: unknown;
  durationMs: number;
  timestamp: string;
}

export interface AgentStreamCompleteEvent {
  event: 'complete';
  requestId: string;
  agent: string;
  output: unknown;
  durationMs: number;
  timestamp: string;
}

export interface AgentStreamErrorEvent {
  event: 'error';
  requestId: string;
  agent: string;
  error: AgentProtocolError;
  timestamp: string;
}

// ─── Capability Discovery ───────────────────────────────────────────────────

/**
 * Agent capability advertisement — what an agent can do.
 * Returned by the capability discovery endpoint.
 */
export interface AgentCapability {
  /** Agent name */
  name: string;
  /** Human-readable description */
  description: string;
  /** Supported tasks */
  tasks: string[];
  /** Input schema (JSON Schema) */
  inputSchema?: Record<string, unknown>;
  /** Output schema (JSON Schema) */
  outputSchema?: Record<string, unknown>;
  /** Available tools */
  tools: string[];
  /** Whether streaming is supported */
  supportsStreaming: boolean;
  /** Whether the agent is production-ready */
  productionReady: boolean;
  /** Agent version */
  version: string;
}

/**
 * Full capability discovery response.
 */
export interface CapabilityDiscovery {
  /** All registered agents */
  agents: AgentCapability[];
  /** Protocol version */
  protocolVersion: string;
  /** Server timestamp */
  timestamp: string;
}

// ─── Conversion Helpers ─────────────────────────────────────────────────────

import type { InvokeResult, AgentStatus } from './shared/types';

/**
 * Convert a PANaCEa AgentStatus to an Agent Protocol task status.
 */
export function toTaskStatus(status: AgentStatus): AgentTaskStatus {
  switch (status) {
    case 'ok':
      return 'completed';
    case 'no_input':
    case 'schema_invalid':
      return 'invalid_input';
    case 'rate_limited':
      return 'rate_limited';
    case 'safety_blocked':
      return 'safety_blocked';
    case 'env_missing':
    case 'internal_error':
      return 'failed';
    default:
      return 'failed';
  }
}

/**
 * Convert a PANaCEa AgentStatus to an Agent Protocol error code.
 */
export function toErrorCode(status: Exclude<AgentStatus, 'ok'>): AgentErrorCode {
  switch (status) {
    case 'no_input':
    case 'schema_invalid':
      return 'INVALID_INPUT';
    case 'rate_limited':
      return 'RATE_LIMITED';
    case 'safety_blocked':
      return 'SAFETY_BLOCKED';
    case 'env_missing':
      return 'ENV_MISSING';
    case 'internal_error':
      return 'INTERNAL_ERROR';
    default:
      return 'INTERNAL_ERROR';
  }
}

/**
 * Wrap a PANaCEa InvokeResult into an Agent Protocol response.
 */
export function toAgentResponse(
  requestId: string,
  result: InvokeResult<unknown>,
): AgentResponse {
  return {
    requestId,
    agent: result.agent,
    status: toTaskStatus(result.status),
    output: result.output,
    error: result.error
      ? {
          code: toErrorCode(result.error.status),
          message: result.error.message,
          cause: result.error.cause,
        }
      : null,
    durationMs: result.durationMs,
    telemetry: result.telemetry
      ? {
          model: result.telemetry.model as string | undefined,
          tokensUsed: result.telemetry.tokensUsed as number | undefined,
          toolCalls: result.telemetry.toolCalls as number | undefined,
          toolsUsed: result.telemetry.toolsUsed as string[] | undefined,
          agentTier: result.telemetry.agentTier as string | undefined,
          extra: result.telemetry as Record<string, unknown>,
        }
      : undefined,
  };
}

/**
 * Generate a unique request ID (UUID v4).
 */
export function generateRequestId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ─── Protocol Adapter ───────────────────────────────────────────────────────

import type { AgentContext } from './shared/types';
import { invokeUnifiedAgent } from './unified';

export interface ProtocolAdapterConfig {
  agentName: string;
  agentVersion?: string;
  tier?: 'encounter' | 'ops' | 'orchestrator';
  defaultTarget?: string;
}

export class AgentProtocolAdapter {
  private agentName: string;
  private agentVersion: string;
  private tier: string;
  private defaultTarget: string;
  private pendingRequests = new Map<string, {
    resolve: (value: AgentResponse) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }>();
  private messageTimeoutMs: number;
  private startTime: number;

  constructor(config: ProtocolAdapterConfig, messageTimeoutMs = 30_000) {
    this.agentName = config.agentName;
    this.agentVersion = config.agentVersion ?? '1.0';
    this.tier = config.tier ?? 'encounter';
    this.defaultTarget = config.defaultTarget ?? 'orchestrator';
    this.messageTimeoutMs = messageTimeoutMs;
    this.startTime = Date.now();
  }

  async invoke(
    targetAgent: string,
    input: unknown,
    ctx: AgentContext,
    task = 'default',
  ): Promise<AgentResponse> {
    const requestId = generateRequestId();

    const request: AgentRequest = {
      requestId,
      agent: targetAgent,
      task,
      input,
      metadata: {
        userId: ctx.userId ?? undefined,
        traceId: `protocol_${requestId}`,
        tags: ['agent-protocol', this.agentName, targetAgent],
      },
    };

    return new Promise<AgentResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Protocol timeout: no response for ${requestId} within ${this.messageTimeoutMs}ms`));
      }, this.messageTimeoutMs);

      this.pendingRequests.set(requestId, { resolve, reject, timer });

      this.dispatchRequest(request, ctx).catch((err) => {
        clearTimeout(timer);
        this.pendingRequests.delete(requestId);
        reject(err);
      });
    });
  }

  handleResponse(response: AgentResponse): void {
    const pending = this.pendingRequests.get(response.requestId);
    if (!pending) {
      console.warn(`[agent-protocol] No pending request for ${response.requestId}`);
      return;
    }

    clearTimeout(pending.timer);
    this.pendingRequests.delete(response.requestId);
    pending.resolve(response);
  }

  private async dispatchRequest(
    request: AgentRequest,
    ctx: AgentContext,
  ): Promise<void> {
    const result = await invokeUnifiedAgent({
      name: request.agent,
      input: request.input,
      ctx,
      trace: {
        name: `protocol/${this.agentName}→${request.agent}`,
        tags: request.metadata?.tags ?? ['agent-protocol'],
        metadata: {
          requestId: request.requestId,
          task: request.task,
        },
      },
    });

    const response = toAgentResponse(request.requestId, result);
    this.handleResponse(response);
  }

  getUptimeMs(): number {
    return Date.now() - this.startTime;
  }

  getPendingCount(): number {
    return this.pendingRequests.size;
  }

  destroy(): void {
    for (const [requestId, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(new Error(`Adapter destroyed — request ${requestId} cancelled`));
    }
    this.pendingRequests.clear();
  }
}

// ─── Protocol Registry ──────────────────────────────────────────────────────

const adapterRegistry = new Map<string, AgentProtocolAdapter>();

export function registerProtocolAdapter(
  agentName: string,
  adapter: AgentProtocolAdapter,
): void {
  adapterRegistry.set(agentName, adapter);
}

export function getProtocolAdapter(
  agentName: string,
): AgentProtocolAdapter | undefined {
  return adapterRegistry.get(agentName);
}

export function listProtocolAdapters(): Array<{
  agentName: string;
  pendingCount: number;
  uptimeMs: number;
}> {
  return Array.from(adapterRegistry.entries()).map(([name, adapter]) => ({
    agentName: name,
    pendingCount: adapter.getPendingCount(),
    uptimeMs: adapter.getUptimeMs(),
  }));
}

export function destroyAllAdapters(): void {
  for (const adapter of adapterRegistry.values()) {
    adapter.destroy();
  }
  adapterRegistry.clear();
}

// ─── Serialization ──────────────────────────────────────────────────────────

export function serializeRequest(request: AgentRequest): string {
  return JSON.stringify(request);
}

export function deserializeRequest(raw: string): AgentRequest {
  const parsed = JSON.parse(raw) as AgentRequest;
  if (!parsed.requestId || !parsed.agent) {
    throw new Error('Invalid AgentRequest: missing required fields');
  }
  return parsed;
}

export function serializeResponse(response: AgentResponse): string {
  return JSON.stringify(response);
}

export function deserializeResponse(raw: string): AgentResponse {
  const parsed = JSON.parse(raw) as AgentResponse;
  if (!parsed.requestId || !parsed.status) {
    throw new Error('Invalid AgentResponse: missing required fields');
  }
  return parsed;
}
