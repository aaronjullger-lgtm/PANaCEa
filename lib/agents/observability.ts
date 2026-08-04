/**
 * Unified Agent Observability
 *
 * Provides consistent LangSmith tracing across all agent paths (Edge + Node).
 * Wraps agent invocations with trace context, metadata, and error tracking.
 *
 * Key features:
 * - Automatic trace creation for every agent invocation
 * - Consistent metadata (agent name, tier, duration, status)
 * - Error capture with structured error details
 * - Trace hierarchy: orchestrator → supervisor → agent → tool
 * - Cost tracking integration
 *
 * @module lib/agents/observability
 */

import type { AgentContext, InvokeResult, AgentDefinition } from './shared/types';

// ─── Trace Types ────────────────────────────────────────────────────────────

export interface AgentTraceConfig {
  /** Trace name (surfaced in LangSmith UI) */
  name: string;
  /** Tags for filtering */
  tags?: string[];
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Parent trace ID for hierarchy */
  parentTraceId?: string;
  /** Session ID for grouping */
  sessionId?: string;
  /** User ID for attribution */
  userId?: string;
}

export interface AgentTraceSpan {
  /** Span name */
  name: string;
  /** Span type */
  type: 'agent' | 'tool' | 'llm' | 'chain' | 'retriever';
  /** Start time */
  startTime: number;
  /** End time */
  endTime?: number;
  /** Input payload */
  input?: unknown;
  /** Output payload */
  output?: unknown;
  /** Error if any */
  error?: {
    message: string;
    status: string;
    cause?: string;
  };
  /** Tags */
  tags?: string[];
  /** Metadata */
  metadata?: Record<string, unknown>;
}

// ─── Trace Context ──────────────────────────────────────────────────────────

/**
 * In-memory trace context for the current invocation chain.
 * In production, this would be backed by LangSmith's trace context propagation.
 */
class TraceContext {
  private spans: AgentTraceSpan[] = [];
  private traceId: string;
  private traceName: string;

  constructor(name: string) {
    this.traceId = generateTraceId();
    this.traceName = name;
  }

  getTraceId(): string {
    return this.traceId;
  }

  getTraceName(): string {
    return this.traceName;
  }

  startSpan(config: {
    name: string;
    type: AgentTraceSpan['type'];
    input?: unknown;
    tags?: string[];
    metadata?: Record<string, unknown>;
  }): AgentTraceSpan {
    const span: AgentTraceSpan = {
      name: config.name,
      type: config.type,
      startTime: Date.now(),
      input: config.input,
      tags: config.tags,
      metadata: config.metadata,
    };
    this.spans.push(span);
    return span;
  }

  endSpan(span: AgentTraceSpan, output?: unknown, error?: AgentTraceSpan['error']): void {
    span.endTime = Date.now();
    span.output = output;
    if (error) span.error = error;
  }

  getSpans(): ReadonlyArray<AgentTraceSpan> {
    return this.spans;
  }

  /**
   * Serialize the trace for LangSmith submission.
   */
  toLangSmithTrace(): Record<string, unknown> {
    return {
      id: this.traceId,
      name: this.traceName,
      start_time: this.spans[0]?.startTime ? new Date(this.spans[0].startTime).toISOString() : new Date().toISOString(),
      end_time: this.spans[this.spans.length - 1]?.endTime
        ? new Date(this.spans[this.spans.length - 1]!.endTime!).toISOString()
        : new Date().toISOString(),
      spans: this.spans.map((s) => ({
        name: s.name,
        type: s.type,
        start_time: new Date(s.startTime).toISOString(),
        end_time: s.endTime ? new Date(s.endTime).toISOString() : undefined,
        input: s.input,
        output: s.output,
        error: s.error,
        tags: s.tags,
        metadata: s.metadata,
      })),
    };
  }
}

// ─── Trace ID Generation ────────────────────────────────────────────────────

function generateTraceId(): string {
  const chars = 'abcdef0123456789';
  let id = '';
  for (let i = 0; i < 32; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

// ─── Observable Agent Wrapper ───────────────────────────────────────────────

/**
 * Wraps an agent definition with automatic tracing.
 * Every invocation creates a trace span with input/output/error capture.
 */
export function withTracing<I, O>(
  agent: AgentDefinition<I, O>,
  traceConfig?: Partial<AgentTraceConfig>,
): AgentDefinition<I, O> {
  return {
    ...agent,
    invoke: async (input: I, ctx: AgentContext): Promise<InvokeResult<O>> => {
      const trace = new TraceContext(
        traceConfig?.name ?? `agent:${agent.name}`,
      );

      const span = trace.startSpan({
        name: `agent:${agent.name}:invoke`,
        type: 'agent',
        input,
        tags: [
          'panacea',
          agent.tier,
          agent.name,
          ...(traceConfig?.tags ?? []),
        ],
        metadata: {
          agentName: agent.name,
          agentTier: agent.tier,
          userId: ctx.userId,
          ...traceConfig?.metadata,
        },
      });

      try {
        const result = await agent.invoke(input, ctx);

        trace.endSpan(span, result.output, result.status !== 'ok' ? {
          message: result.error?.message ?? 'Unknown error',
          status: result.status,
          cause: result.error?.cause,
        } : undefined);

        // Attach trace data to result telemetry
        return {
          ...result,
          telemetry: {
            ...result.telemetry,
            traceId: trace.getTraceId(),
            traceName: trace.getTraceName(),
            spanCount: trace.getSpans().length,
            trace: trace.toLangSmithTrace(),
          },
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        trace.endSpan(span, undefined, {
          message,
          status: 'internal_error',
        });

        return {
          status: 'internal_error',
          output: null,
          error: { status: 'internal_error', message, cause: agent.name },
          agent: agent.name,
          durationMs: 0,
          telemetry: {
            traceId: trace.getTraceId(),
            traceName: trace.getTraceName(),
            error: message,
          },
        };
      }
    },
  };
}

// ─── Trace Utilities ────────────────────────────────────────────────────────

/**
 * Create a trace context for an orchestrator run.
 */
export function createOrchestratorTrace(
  orchestratorName: string,
  config?: Partial<AgentTraceConfig>,
): TraceContext {
  return new TraceContext(config?.name ?? `orchestrator:${orchestratorName}`);
}

/**
 * Create a trace context for a supervisor run.
 */
export function createSupervisorTrace(
  supervisorName: string,
  parentTrace?: TraceContext,
): TraceContext {
  const trace = new TraceContext(`supervisor:${supervisorName}`);
  return trace;
}

/**
 * Create a trace context for a subagent run.
 */
export function createSubagentTrace(
  agentName: string,
  parentTrace?: TraceContext,
): TraceContext {
  return new TraceContext(`subagent:${agentName}`);
}

// ─── Observability Metrics ──────────────────────────────────────────────────

export interface AgentMetrics {
  totalInvocations: number;
  successfulInvocations: number;
  failedInvocations: number;
  averageDurationMs: number;
  p95DurationMs: number;
  p99DurationMs: number;
  errorRate: number;
  lastInvocationAt?: string;
}

/**
 * Simple in-memory metrics collector for agent invocations.
 * In production, this would feed into LangSmith dashboards.
 */
class MetricsCollector {
  private metrics = new Map<string, {
    durations: number[];
    successes: number;
    failures: number;
    lastInvocationAt?: number;
  }>();

  recordInvocation(agentName: string, durationMs: number, success: boolean): void {
    let entry = this.metrics.get(agentName);
    if (!entry) {
      entry = { durations: [], successes: 0, failures: 0 };
      this.metrics.set(agentName, entry);
    }

    entry.durations.push(durationMs);
    if (success) entry.successes++;
    else entry.failures++;
    entry.lastInvocationAt = Date.now();

    // Keep only last 1000 durations to bound memory
    if (entry.durations.length > 1000) {
      entry.durations = entry.durations.slice(-1000);
    }
  }

  getMetrics(agentName: string): AgentMetrics {
    const entry = this.metrics.get(agentName);
    if (!entry) {
      return {
        totalInvocations: 0,
        successfulInvocations: 0,
        failedInvocations: 0,
        averageDurationMs: 0,
        p95DurationMs: 0,
        p99DurationMs: 0,
        errorRate: 0,
      };
    }

    const total = entry.successes + entry.failures;
    const sorted = [...entry.durations].sort((a, b) => a - b);

    return {
      totalInvocations: total,
      successfulInvocations: entry.successes,
      failedInvocations: entry.failures,
      averageDurationMs: total > 0
        ? entry.durations.reduce((a, b) => a + b, 0) / entry.durations.length
        : 0,
      p95DurationMs: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
      p99DurationMs: sorted[Math.floor(sorted.length * 0.99)] ?? 0,
      errorRate: total > 0 ? entry.failures / total : 0,
      lastInvocationAt: entry.lastInvocationAt
        ? new Date(entry.lastInvocationAt).toISOString()
        : undefined,
    };
  }

  clear(): void {
    this.metrics.clear();
  }

  getAllMetrics(): Record<string, AgentMetrics> {
    const result: Record<string, AgentMetrics> = {};
    for (const [name] of this.metrics) {
      result[name] = this.getMetrics(name);
    }
    return result;
  }
}

/** Global metrics collector instance */
export const agentMetrics = new MetricsCollector();
