/**
 * Structured observability events for Builder Agent.
 */

export type BuilderEventType =
  | 'agent.connected'
  | 'run.created'
  | 'state.transition'
  | 'workflow.phase'
  | 'tool.invoked'
  | 'approval.requested'
  | 'approval.resolved'
  | 'retry'
  | 'test.result'
  | 'pr.created'
  | 'ci.result'
  | 'run.failed'
  | 'run.canceled';

export interface BuilderEvent {
  type: BuilderEventType;
  at: string;
  correlationId: string;
  runId?: string;
  workspaceId?: string;
  data?: Record<string, unknown>;
}

export interface EventSink {
  emit(event: BuilderEvent): void | Promise<void>;
}

export class CollectingEventSink implements EventSink {
  readonly events: BuilderEvent[] = [];

  emit(event: BuilderEvent): void {
    this.events.push(event);
  }
}

export function createEvent(
  type: BuilderEventType,
  correlationId: string,
  data?: Record<string, unknown>,
  opts?: { runId?: string; workspaceId?: string }
): BuilderEvent {
  return {
    type,
    at: new Date().toISOString(),
    correlationId,
    runId: opts?.runId,
    workspaceId: opts?.workspaceId,
    data,
  };
}

/**
 * Sentry-safe payload — strips sensitive fields before external reporting.
 */
export function toSentryContext(event: BuilderEvent): Record<string, string> {
  return {
    event_type: event.type,
    correlation_id: event.correlationId,
    ...(event.runId ? { run_id: event.runId } : {}),
    ...(event.workspaceId ? { workspace_id: event.workspaceId } : {}),
  };
}
