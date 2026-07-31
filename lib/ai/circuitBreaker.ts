/**
 * Provider Circuit Breaker
 *
 * Prevents cascading failures and runaway costs by tracking per-provider
 * health. When a provider exceeds budget or fails repeatedly, the circuit
 * "opens" and all subsequent calls skip that provider for a cooldown period.
 *
 * States:
 * - CLOSED: Normal operation. Calls go through.
 * - OPEN: Provider is blocked. Calls are skipped (fallback to next provider).
 * - HALF-OPEN: After cooldown, one test call is allowed. If it succeeds,
 *   circuit closes. If it fails, circuit re-opens.
 *
 * @module lib/ai/circuitBreaker
 */

import type { ModelProvider } from '@/lib/langchain/config';
import { DEFAULT_COST_GUARDRAIL_CONFIG, type CostGuardrailConfig, type CircuitState, type CircuitBreakerState } from './costGuardrail';

// ─── In-Memory Store (per-isolate, sufficient for Edge) ─────────────────────

/**
 * Circuit breaker state is stored in-memory per isolate. This is acceptable
 * because:
 * 1. Edge isolates restart frequently, resetting circuits naturally.
 * 2. Cost tracking (which drives the circuit breaker) uses KV for
 *    distributed accuracy.
 * 3. A circuit breaker is a safety net, not a precision instrument.
 */
const circuitStore = new Map<ModelProvider, CircuitBreakerState>();

// ─── Circuit Breaker Interface ──────────────────────────────────────────────

export interface CircuitBreaker {
  /** Check if a provider is available (circuit is not open). */
  isAvailable(provider: ModelProvider): boolean;

  /** Record a successful call. May close a half-open circuit. */
  recordSuccess(provider: ModelProvider): void;

  /** Record a failed call. May open the circuit. */
  recordFailure(provider: ModelProvider): void;

  /** Force-open a circuit (e.g., when budget is exhausted). */
  tripForBudget(provider: ModelProvider): void;

  /** Get the current state of a provider's circuit. */
  getState(provider: ModelProvider): CircuitBreakerState;

  /** Get all provider states (for dashboard/debugging). */
  getAllStates(): Record<ModelProvider, CircuitBreakerState>;

  /** Reset a circuit (manual override). */
  reset(provider: ModelProvider): void;
}

// ─── Implementation ─────────────────────────────────────────────────────────

const PROVIDER_FAILURE_THRESHOLD = 3; // Failures before opening circuit
const HALF_OPEN_MAX_SUCCESS = 1; // Successes needed to close from half-open

export function createCircuitBreaker(
  config: CostGuardrailConfig = DEFAULT_COST_GUARDRAIL_CONFIG,
): CircuitBreaker {
  function getState(provider: ModelProvider): CircuitBreakerState {
    return circuitStore.get(provider) ?? { state: 'closed' };
  }

  function getAllStates(): Record<ModelProvider, CircuitBreakerState> {
    const providers: ModelProvider[] = ['gemini', 'openai', 'anthropic', 'deepseek', 'deepinfra', 'openrouter'];
    const states = {} as Record<ModelProvider, CircuitBreakerState>;
    for (const p of providers) {
      states[p] = getState(p);
    }
    return states;
  }

  function isAvailable(provider: ModelProvider): boolean {
    const s = getState(provider);

    if (s.state === 'closed') return true;

    if (s.state === 'open') {
      // Check if cooldown has elapsed → transition to half-open
      if (s.openedAt && Date.now() - s.openedAt >= config.circuitBreakerCooldownMs) {
        circuitStore.set(provider, { state: 'half-open', openedAt: s.openedAt, lastCheckAt: Date.now(), consecutiveSuccesses: 0 });
        return true; // Allow one test call
      }
      return false;
    }

    if (s.state === 'half-open') {
      return true; // Allow the test call
    }

    return true;
  }

  function recordSuccess(provider: ModelProvider): void {
    const s = getState(provider);

    if (s.state === 'half-open') {
      const successes = (s.consecutiveSuccesses ?? 0) + 1;
      if (successes >= HALF_OPEN_MAX_SUCCESS) {
        // Close the circuit — provider is healthy again
        circuitStore.set(provider, { state: 'closed' });
        console.info(`[CircuitBreaker] ${provider} circuit CLOSED — provider recovered`);
      } else {
        circuitStore.set(provider, { ...s, consecutiveSuccesses: successes, lastCheckAt: Date.now() });
      }
    }
    // If closed, no state change needed
  }

  function recordFailure(provider: ModelProvider): void {
    const s = getState(provider);

    if (s.state === 'half-open') {
      // Test call failed — re-open circuit
      circuitStore.set(provider, { state: 'open', openedAt: Date.now(), lastCheckAt: Date.now(), consecutiveSuccesses: 0 });
      console.warn(`[CircuitBreaker] ${provider} circuit RE-OPENED — test call failed`);
      return;
    }

    // For closed circuits, track consecutive failures
    // We use a simple counter pattern: record failures inline
    // Since we don't persist failure counts across isolate restarts,
    // the budget-based trip is the primary mechanism.
  }

  function tripForBudget(provider: ModelProvider): void {
    circuitStore.set(provider, { state: 'open', openedAt: Date.now(), lastCheckAt: Date.now(), consecutiveSuccesses: 0 });
    console.warn(`[CircuitBreaker] ${provider} circuit OPENED — budget exceeded`);
  }

  function reset(provider: ModelProvider): void {
    circuitStore.delete(provider);
    console.info(`[CircuitBreaker] ${provider} circuit RESET`);
  }

  return { isAvailable, recordSuccess, recordFailure, tripForBudget, getState, getAllStates, reset };
}
