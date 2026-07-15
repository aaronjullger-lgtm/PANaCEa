/**
 * Learner Agent observability helpers.
 */

const SENSITIVE_KEYS = ['token', 'password', 'secret', 'authorization', 'cookie', 'apikey'];

export function createCorrelationId(): string {
  return `corr_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

export function correlationFromRequest(request: Request): string {
  return (
    request.headers.get('x-correlation-id') ??
    request.headers.get('cf-ray') ??
    createCorrelationId()
  );
}

export function redactForLogs(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[MAX_DEPTH]';
  if (value == null) return value;
  if (typeof value === 'string') {
    if (value.length > 200) return value.slice(0, 200) + '…';
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((v) => redactForLogs(v, depth + 1));
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const keyLower = k.toLowerCase();
      if (SENSITIVE_KEYS.some((s) => keyLower.includes(s))) {
        out[k] = '[REDACTED]';
      } else {
        out[k] = redactForLogs(v, depth + 1);
      }
    }
    return out;
  }
  return value;
}

export interface LearnerAgentTelemetryEvent {
  correlationId: string;
  userId: string;
  event:
    | 'recommendation_shown'
    | 'recommendation_accepted'
    | 'recommendation_deferred'
    | 'recommendation_rejected'
    | 'session_started'
    | 'session_completed'
    | 'tool_error'
    | 'reconnect'
    | 'memory_proposed'
    | 'memory_confirmed';
  metadata?: Record<string, unknown>;
}

export function buildTelemetryEvent(
  base: Omit<LearnerAgentTelemetryEvent, 'metadata'> & { metadata?: Record<string, unknown> }
): LearnerAgentTelemetryEvent {
  return {
    ...base,
    metadata: base.metadata ? (redactForLogs(base.metadata) as Record<string, unknown>) : undefined,
  };
}
