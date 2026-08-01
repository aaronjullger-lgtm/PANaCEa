/**
 * Shared helpers for orchestrator flow strategies (`lib/agents/strategies/`).
 *
 * Strategies wrap existing endpoint flows (generate-enhanced, live-engine) so
 * they can be registered as orchestrator agents. They share one logging
 * contract so endpoints and agents emit the same structured log shape.
 *
 * @module lib/agents/strategies/shared
 */

import type { AgentContext } from '../shared/types';

/** Structured logger contract used by flow strategies (matches endpoint loggers and ctx.log). */
export interface FlowLogger {
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, data?: unknown): void;
}

/**
 * Adapt an `AgentContext.log` hook to a `FlowLogger` so strategy agents can
 * reuse the same flow functions the endpoints call (standard logging).
 */
export function loggerFrom(log: AgentContext['log']): FlowLogger {
  return {
    info: (message, data) => log?.('info', message, data),
    warn: (message, data) => log?.('warn', message, data),
    error: (message, data) => log?.('error', message, data),
  };
}
