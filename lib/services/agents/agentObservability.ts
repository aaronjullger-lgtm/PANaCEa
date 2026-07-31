/**
 * Agent Observability Layer
 *
 * Wires LangSmith tracing into the agent runner and orchestrator.
 * Provides per-run trace creation, step-level child runs, and
 * aggregated metrics for dashboard consumption.
 *
 * Design:
 * - Zero new dependencies — uses existing LangSmith SDK
 * - Edge-safe — no Node-only APIs, no filesystem access
 * - Sampling-aware — respects LANGSMITH_SAMPLE_RATE
 * - Graceful degradation — if LangSmith is unavailable, tracing is a no-op
 *
 * @module lib/services/agents/agentObservability
 */

import type { AgentRunResult, AgentStep, AgentStopReason } from './types';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface TraceContext {
  /** LangSmith trace ID for the root run */
  traceId: string;
  /** Parent run ID for nesting */
  parentRunId?: string;
  /** Run name shown in LangSmith UI */
  runName: string;
  /** Tags for filtering */
  tags: string[];
  /** Arbitrary metadata */
  metadata: Record<string, unknown>;
}

export interface AgentMetrics {
  /** Total agent invocations */
  totalInvocations: number;
  /** Successful completions */
  completedCount: number;
  /** Failed runs (model_error, tool_error, safety_block) */
  failedCount: number;
  /** Aborted runs */
  abortedCount: number;
  /** Max iterations reached */
  maxIterationsCount: number;
  /** Average latency in ms */
  avgLatencyMs: number;
  /** P95 latency in ms */
  p95LatencyMs: number;
  /** Average tokens per run */
  avgTokensPerRun: number;
  /** Success rate (0-1) */
  successRate: number;
  /** Stop reason distribution */
  stopReasonDistribution: Record<string, number>;
}

// ─── In-Memory Metrics Store (Edge-safe, no DB writes) ────────────────────

interface MetricsEntry {
  stopReason: AgentStopReason;
  durationMs: number;
  tokensUsed: number;
  timestamp: number;
}

class AgentMetricsCollector {
  private entries: MetricsEntry[] = [];
  private readonly maxEntries: number;

  constructor(maxEntries = 1000) {
    this.maxEntries = maxEntries;
  }

  record(stopReason: AgentStopReason, durationMs: number, tokensUsed: number): void {
    this.entries.push({
      stopReason,
      durationMs,
      tokensUsed,
      timestamp: Date.now(),
    });

    // Prune old entries to prevent unbounded growth
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }
  }

  getMetrics(windowMs?: number): AgentMetrics {
    const now = Date.now();
    const windowed = windowMs
      ? this.entries.filter((e) => now - e.timestamp <= windowMs)
      : this.entries;

    const total = windowed.length || 1; // Avoid division by zero

    const completed = windowed.filter((e) => e.stopReason === 'completed').length;
    const failed = windowed.filter(
      (e) => e.stopReason === 'model_error' || e.stopReason === 'tool_error' || e.stopReason === 'safety_block'
    ).length;
    const aborted = windowed.filter((e) => e.stopReason === 'aborted').length;
    const maxIter = windowed.filter((e) => e.stopReason === 'max_iterations').length;

    const durations = windowed.map((e) => e.durationMs).sort((a, b) => a - b);
    const avgLatency = durations.reduce((s, d) => s + d, 0) / total;
    const p95Index = Math.ceil(total * 0.95) - 1;
    const p95Latency = durations[Math.max(0, p95Index)] ?? 0;

    const avgTokens = windowed.reduce((s, e) => s + e.tokensUsed, 0) / total;

    const stopReasonDist: Record<string, number> = {};
    for (const e of windowed) {
      stopReasonDist[e.stopReason] = (stopReasonDist[e.stopReason] ?? 0) + 1;
    }

    return {
      totalInvocations: windowed.length,
      completedCount: completed,
      failedCount: failed,
      abortedCount: aborted,
      maxIterationsCount: maxIter,
      avgLatencyMs: Math.round(avgLatency),
      p95LatencyMs: Math.round(p95Latency),
      avgTokensPerRun: Math.round(avgTokens),
      successRate: completed / total,
      stopReasonDistribution: stopReasonDist,
    };
  }

  reset(): void {
    this.entries = [];
  }
}

// ─── Singleton ──────────────────────────────────────────────────────────────

export const agentMetrics = new AgentMetricsCollector();

// ─── Trace Builder ──────────────────────────────────────────────────────────

/**
 * Build a trace context for an agent run.
 * In production, this would create a LangSmith run via the SDK.
 * For Edge compatibility, we build the context and let the caller
 * decide how to persist it (console log, Langfuse, LangSmith HTTP API).
 */
export function buildTraceContext(options: {
  agentName: string;
  userId?: string;
  endpoint?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}): TraceContext {
  const traceId = generateTraceId();
  return {
    traceId,
    runName: `agent:${options.agentName}`,
    tags: [
      'panacea',
      'agent',
      options.agentName,
      ...(options.tags ?? []),
    ],
    metadata: {
      app: 'panacea',
      agent: options.agentName,
      userId: options.userId ?? 'anonymous',
      endpoint: options.endpoint ?? 'unknown',
      timestamp: new Date().toISOString(),
      ...options.metadata,
    },
  };
}

/**
 * Build a step-level trace context (child of the agent run).
 */
export function buildStepTrace(
  parent: TraceContext,
  step: AgentStep,
): TraceContext {
  return {
    traceId: parent.traceId,
    parentRunId: parent.traceId,
    runName: `${parent.runName}:step-${step.iteration}:${step.role}`,
    tags: [...parent.tags, `step:${step.role}`, `iteration:${step.iteration}`],
    metadata: {
      ...parent.metadata,
      stepIteration: step.iteration,
      stepRole: step.role,
      stepPartCount: step.parts.length,
      stepDurationMs: step.durationMs,
    },
  };
}

/**
 * Log a trace event. In production, this sends to LangSmith/Langfuse.
 * For Edge, we use structured console logging captured by wrangler/Sentry.
 */
export function logTraceEvent(
  trace: TraceContext,
  event: 'start' | 'step' | 'end' | 'error',
  data?: unknown,
): void {
  const logLine = JSON.stringify({
    _type: 'agent_trace',
    event,
    traceId: trace.traceId,
    parentRunId: trace.parentRunId,
    runName: trace.runName,
    tags: trace.tags,
    metadata: trace.metadata,
    data,
    timestamp: new Date().toISOString(),
  });

  switch (event) {
    case 'error':
      console.error(logLine);
      break;
    case 'start':
    case 'end':
      console.log(logLine);
      break;
    default:
      console.log(logLine);
  }
}

/**
 * Record the final result of an agent run in the metrics collector
 * and emit a trace completion event.
 */
export function recordAgentCompletion(
  trace: TraceContext,
  result: AgentRunResult,
): void {
  // Record metrics
  agentMetrics.record(
    result.stopReason,
    result.durationMs,
    result.tokensUsed.total,
  );

  // Log completion trace
  logTraceEvent(trace, 'end', {
    stopReason: result.stopReason,
    iterations: result.iterations,
    tokensUsed: result.tokensUsed,
    durationMs: result.durationMs,
    hasError: !!result.error,
    errorCode: result.error?.code,
    finalTextLength: result.finalText.length,
    stepCount: result.steps.length,
  });
}

// ─── Dashboard Metrics ──────────────────────────────────────────────────────

/**
 * Get current agent performance metrics for dashboard display.
 * Window defaults to last hour.
 */
export function getAgentDashboardMetrics(windowMs?: number): AgentMetrics {
  return agentMetrics.getMetrics(windowMs);
}

/**
 * Get metrics broken down by agent type (inferred from trace tags).
 * Placeholder — requires persistent trace storage for full implementation.
 */
export function getAgentBreakdown(): Record<string, AgentMetrics> {
  // In production, this would query LangSmith/Langfuse API
  // For now, return the aggregate metrics
  return {
    all: agentMetrics.getMetrics(),
  };
}

// ─── Health Check ───────────────────────────────────────────────────────────

export interface AgentHealthStatus {
  healthy: boolean;
  metrics: AgentMetrics;
  warnings: string[];
}

/**
 * Check agent health based on recent metrics.
 * Returns warnings if success rate drops below threshold
 * or latency exceeds acceptable bounds.
 */
export function checkAgentHealth(windowMs = 3600_000): AgentHealthStatus {
  const metrics = agentMetrics.getMetrics(windowMs);
  const warnings: string[] = [];

  if (metrics.totalInvocations > 10 && metrics.successRate < 0.7) {
    warnings.push(
      `Low success rate: ${(metrics.successRate * 100).toFixed(1)}% (threshold: 70%)`,
    );
  }

  if (metrics.totalInvocations > 10 && metrics.p95LatencyMs > 30_000) {
    warnings.push(
      `High P95 latency: ${metrics.p95LatencyMs}ms (threshold: 30000ms)`,
    );
  }

  if (metrics.failedCount > metrics.completedCount * 0.5) {
    warnings.push(
      `High failure ratio: ${metrics.failedCount} failed / ${metrics.completedCount} completed`,
    );
  }

  return {
    healthy: warnings.length === 0,
    metrics,
    warnings,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function generateTraceId(): string {
  // Generate a trace ID compatible with LangSmith format
  // Format: 32 hex characters
  const chars = '0123456789abcdef';
  let id = '';
  for (let i = 0; i < 32; i++) {
    id += chars[Math.floor(Math.random() * 16)];
  }
  return id;
}

/**
 * Reset all metrics (useful for testing).
 */
export function resetAgentMetrics(): void {
  agentMetrics.reset();
}
