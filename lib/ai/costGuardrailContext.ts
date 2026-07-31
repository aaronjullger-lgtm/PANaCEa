/**
 * Request-scoped cost guardrail context for Cloudflare Edge.
 *
 * Cloudflare Pages Functions run one request per isolate, so module-level
 * state is effectively request-scoped and never leaks between requests.
 * The invoke endpoint sets guardrails before dispatching to agents, and
 * the LangChain router reads them as a fallback when callers don't pass
 * them explicitly via RouteOptions.
 *
 * @module lib/ai/costGuardrailContext
 */

import type { CostTracker } from './costTracker';
import type { CircuitBreaker } from './circuitBreaker';

let _costTracker: CostTracker | undefined;
let _circuitBreaker: CircuitBreaker | undefined;
let _userId: string | undefined;

/** Set guardrails for the current request. Call in invoke.ts before dispatch. */
export function setRequestCostGuardrails(opts: {
  costTracker?: CostTracker;
  circuitBreaker?: CircuitBreaker;
  userId?: string;
}): void {
  _costTracker = opts.costTracker;
  _circuitBreaker = opts.circuitBreaker;
  _userId = opts.userId;
}

/** Clear guardrails after request completes. */
export function clearRequestCostGuardrails(): void {
  _costTracker = undefined;
  _circuitBreaker = undefined;
  _userId = undefined;
}

/** Read guardrails for the current request. Used by the LangChain router. */
export function getRequestCostGuardrails(): {
  costTracker: CostTracker | undefined;
  circuitBreaker: CircuitBreaker | undefined;
  userId: string | undefined;
} {
  return {
    costTracker: _costTracker,
    circuitBreaker: _circuitBreaker,
    userId: _userId,
  };
}
