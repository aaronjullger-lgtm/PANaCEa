/**
 * Agent Telemetry Logger
 *
 * Lightweight telemetry wrapper for agent endpoint handlers.
 * Logs structured data to console (captured by Sentry/wrangler)
 * for every agent run — success, failure, tool errors, token costs.
 *
 * Design: console-only, zero dependencies, Edge-safe.
 * No database writes — avoids schema changes and keeps
 * agent endpoints fast.
 */

export interface AgentTelemetryEntry {
  endpoint: string;
  action: string;
  userId: string;
  stopReason: string;
  iterations: number;
  tokensUsed: { input: number; output: number; total: number };
  durationMs: number;
  errorCode?: string;
  errorMessage?: string;
  timestamp: string;
}

/**
 * Log an agent run result as structured telemetry.
 * Call this at the end of every agent endpoint handler,
 * after the agent run completes.
 */
export function logAgentTelemetry(entry: AgentTelemetryEntry): void {
  const logLine = JSON.stringify({
    _type: 'agent_telemetry',
    ...entry,
  });

  // Use console.log for wrangler/Sentry capture.
  // Severity based on stop reason:
  //   completed → info
  //   tool_error, model_error, safety_block → error
  //   max_iterations, aborted → warn
  switch (entry.stopReason) {
    case 'completed':
      console.log(logLine);
      break;
    case 'tool_error':
    case 'model_error':
    case 'safety_block':
      console.error(logLine);
      break;
    default:
      console.warn(logLine);
  }
}

/**
 * Generate a summary of recent agent telemetry.
 * Placeholder for future aggregation — currently returns
 * the entry as-is since we don't have a telemetry store.
 */
export function summarizeTelemetry(
  entries: AgentTelemetryEntry[]
): { total: number; completed: number; failed: number; avgDurationMs: number } {
  const total = entries.length;
  const completed = entries.filter((e) => e.stopReason === 'completed').length;
  const failed = entries.filter(
    (e) => e.stopReason !== 'completed' && e.stopReason !== 'aborted'
  ).length;
  const avgDurationMs = total > 0
    ? Math.round(entries.reduce((s, e) => s + e.durationMs, 0) / total)
    : 0;

  return { total, completed, failed, avgDurationMs };
}
