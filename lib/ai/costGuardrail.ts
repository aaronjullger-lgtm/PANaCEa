/**
 * AI Cost Guardrail System
 *
 * Prevents runaway AI spending by enforcing:
 * - Per-provider daily budget limits
 * - Per-user daily budget limits
 * - Global daily budget limits
 * - Per-call token caps
 * - Pre-call cost estimation
 * - Circuit breaker for providers that exceed thresholds
 *
 * Background: A $50 accidental spend on DeepSeek V3 during Langfuse
 * configuration motivated this guardrail system. The goal is to make
 * it structurally impossible for any single run or misconfiguration
 * to burn through the budget undetected.
 *
 * @module lib/ai/costGuardrail
 */

import type { ModelProvider } from '@/lib/langchain/config';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CostGuardrailConfig {
  /** Per-provider daily budget in USD. Providers exceeding this are circuit-broken. */
  providerDailyBudgetUsd: Record<ModelProvider, number>;

  /** Per-user daily budget in USD. Users exceeding this get blocked. */
  userDailyBudgetUsd: number;

  /** Global daily budget in USD. System-wide hard stop. */
  globalDailyBudgetUsd: number;

  /** Maximum output tokens allowed per single LLM call */
  maxTokensPerCall: number;

  /** Maximum input tokens allowed per single LLM call */
  maxInputTokensPerCall: number;

  /**
   * Warning threshold as fraction of budget (0-1).
   * When spending exceeds this fraction, warnings are logged.
   */
  warningThreshold: number;

  /**
   * Emergency threshold as fraction of budget (0-1).
   * When spending exceeds this fraction, the provider is circuit-broken.
   */
  emergencyThreshold: number;

  /**
   * Hard cap: absolute maximum USD per single LLM call.
   * If estimated cost exceeds this, the call is blocked regardless of budget.
   */
  maxCostPerCallUsd: number;

  /**
   * Cooldown period in ms after circuit breaker opens.
   * After this period, the circuit transitions to half-open.
   */
  circuitBreakerCooldownMs: number;
}

export interface CostCheckResult {
  allowed: boolean;
  reason?: string;
  provider?: ModelProvider;
  estimatedCostUsd?: number;
  remainingBudgetUsd?: number;
  dailySpendUsd?: number;
}

export interface CostRecord {
  totalUsd: number;
  callCount: number;
  lastUpdated: number;
  /** Breakdown by model name */
  byModel: Record<string, { usd: number; calls: number; tokens: number }>;
}

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerState {
  state: CircuitState;
  openedAt?: number;
  lastCheckAt?: number;
  consecutiveSuccesses?: number;
}

// ─── Default Configuration ──────────────────────────────────────────────────

/**
 * Default guardrail configuration — conservative defaults that prevent
 * accidental high spending while allowing normal operation.
 *
 * These are tuned for a solo-developer PA student budget.
 */
export const DEFAULT_COST_GUARDRAIL_CONFIG: CostGuardrailConfig = {
  // Per-provider daily budgets (USD)
  providerDailyBudgetUsd: {
    gemini: 5.00,       // Primary — cheapest for most tasks
    openai: 5.00,       // Mid-tier — used for tutoring
    anthropic: 5.00,    // Premium — clinical-critical only
    deepseek: 2.00,     // Budget — bulk enrichment only
    deepinfra: 1.00,    // Ultra-cheap — dev/testing
    openrouter: 0.50,   // Free tier — dev only
  },

  // Per-user daily budget (USD) — $10/day per student is generous
  userDailyBudgetUsd: 10.00,

  // Global daily budget (USD) — hard ceiling
  globalDailyBudgetUsd: 25.00,

  // Token caps per call
  maxTokensPerCall: 8192,
  maxInputTokensPerCall: 32000,

  // Thresholds
  warningThreshold: 0.70,    // Warn at 70% of budget
  emergencyThreshold: 0.90,  // Circuit-break at 90%

  // Per-call hard cap — no single call should cost more than $1
  maxCostPerCallUsd: 1.00,

  // Circuit breaker cooldown — 1 hour before retrying
  circuitBreakerCooldownMs: 60 * 60 * 1000,
};

// ─── Cost Estimation ────────────────────────────────────────────────────────

/**
 * Estimate the cost of a call before making it.
 * Used for pre-call budget checking.
 *
 * @param inputTokens - Estimated input tokens (or max input if unknown)
 * @param outputTokens - Estimated output tokens (or max output if unknown)
 * @param inputCostPer1M - Cost per 1M input tokens
 * @param outputCostPer1M - Cost per 1M output tokens
 * @returns Estimated cost in USD
 */
export function estimateCallCost(
  inputTokens: number,
  outputTokens: number,
  inputCostPer1M: number,
  outputCostPer1M: number,
): number {
  return (
    (inputTokens / 1_000_000) * inputCostPer1M +
    (outputTokens / 1_000_000) * outputCostPer1M
  );
}

/**
 * Get today's date as a string key for cost tracking.
 * Uses UTC to ensure consistency across edge isolates.
 */
export function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

/**
 * Generate a KV key for cost tracking.
 */
export function costKey(scope: 'provider' | 'user' | 'global', identifier: string, date?: string): string {
  const d = date ?? getTodayKey();
  return `cost:${scope}:${identifier}:${d}`;
}
