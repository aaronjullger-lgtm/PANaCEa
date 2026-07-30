/**
 * LangSmith Trace Groups
 *
 * Provides trace grouping for multi-agent workflows using LangSmith.
 * Complements Langfuse tracing with LangSmith-specific features like
 * dataset linking, feedback collection, and model evaluation.
 *
 * @module lib/agents/langsmith-tracing
 */

// ─── Types ─────────────────────────────────────────────────────────────────

export interface TraceGroupConfig {
  name: string;
  projectName?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
  sessionId?: string;
}

export interface AgentTraceGroup {
  groupName: string;
  projectName: string;
  traces: Array<{
    agentName: string;
    traceId: string;
    startTime: Date;
    endTime?: Date;
    status: 'pending' | 'running' | 'completed' | 'error';
    input?: unknown;
    output?: unknown;
    error?: string;
  }>;
  metadata: Record<string, unknown>;
}

// ─── Trace Group Registry ───────────────────────────────────────────────────

const traceGroupRegistry = new Map<string, AgentTraceGroup>();

/**
 * Create a new trace group for a multi-agent workflow.
 */
export function createTraceGroup(config: TraceGroupConfig): AgentTraceGroup {
  const group: AgentTraceGroup = {
    groupName: config.name,
    projectName: config.projectName ?? 'panacea-agents',
    traces: [],
    metadata: {
      ...config.metadata,
      createdAt: new Date().toISOString(),
    },
  };

  traceGroupRegistry.set(config.name, group);
  return group;
}

/**
 * Get an existing trace group.
 */
export function getTraceGroup(name: string): AgentTraceGroup | undefined {
  return traceGroupRegistry.get(name);
}

/**
 * Add a trace to a group.
 */
export function addTraceToGroup(
  groupName: string,
  agentName: string,
  traceId: string,
  input?: unknown,
): void {
  const group = traceGroupRegistry.get(groupName);
  if (!group) {
    console.warn(`[langsmith-tracing] Trace group not found: ${groupName}`);
    return;
  }

  group.traces.push({
    agentName,
    traceId,
    startTime: new Date(),
    status: 'running',
    input,
  });
}

/**
 * Complete a trace in a group.
 */
export function completeTraceInGroup(
  groupName: string,
  traceId: string,
  output?: unknown,
  error?: string,
): void {
  const group = traceGroupRegistry.get(groupName);
  if (!group) {
    console.warn(`[langsmith-tracing] Trace group not found: ${groupName}`);
    return;
  }

  const trace = group.traces.find((t) => t.traceId === traceId);
  if (!trace) {
    console.warn(`[langsmith-tracing] Trace not found in group: ${traceId}`);
    return;
  }

  trace.endTime = new Date();
  trace.status = error ? 'error' : 'completed';
  trace.output = output;
  trace.error = error;
}

/**
 * Get all trace groups.
 */
export function listTraceGroups(): Array<{
  name: string;
  projectName: string;
  traceCount: number;
  completedCount: number;
  errorCount: number;
}> {
  return Array.from(traceGroupRegistry.values()).map((group) => ({
    name: group.groupName,
    projectName: group.projectName,
    traceCount: group.traces.length,
    completedCount: group.traces.filter((t) => t.status === 'completed').length,
    errorCount: group.traces.filter((t) => t.status === 'error').length,
  }));
}

/**
 * Calculate group statistics.
 */
export function getGroupStats(groupName: string): {
  totalDurationMs: number;
  averageDurationMs: number;
  successRate: number;
  agentBreakdown: Record<string, { count: number; successCount: number; avgDurationMs: number }>;
} | null {
  const group = traceGroupRegistry.get(groupName);
  if (!group) return null;

  let totalDurationMs = 0;
  let successCount = 0;
  const agentBreakdown: Record<string, { count: number; successCount: number; totalDurationMs: number }> = {};

  for (const trace of group.traces) {
    if (trace.startTime && trace.endTime) {
      const duration = trace.endTime.getTime() - trace.startTime.getTime();
      totalDurationMs += duration;

      const agentStats = agentBreakdown[trace.agentName] ?? { count: 0, successCount: 0, totalDurationMs: 0 };
      agentStats.count++;
      agentStats.totalDurationMs += duration;
      agentBreakdown[trace.agentName] = agentStats;

      if (trace.status === 'completed') {
        successCount++;
        agentStats.successCount++;
      }
    }
  }

  const traceCount = group.traces.length || 1;

  return {
    totalDurationMs,
    averageDurationMs: totalDurationMs / traceCount,
    successRate: successCount / traceCount,
    agentBreakdown: Object.fromEntries(
      Object.entries(agentBreakdown).map(([agent, stats]) => [
        agent,
        {
          count: stats.count,
          successCount: stats.successCount,
          avgDurationMs: stats.totalDurationMs / (stats.count || 1),
        },
      ]),
    ),
  };
}

/**
 * Clear completed trace groups (cleanup).
 */
export function clearCompletedGroups(): number {
  let cleared = 0;
  for (const [name, group] of traceGroupRegistry) {
    const allCompleted = group.traces.every(
      (t) => t.status === 'completed' || t.status === 'error',
    );
    if (allCompleted) {
      traceGroupRegistry.delete(name);
      cleared++;
    }
  }
  return cleared;
}
