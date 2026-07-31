/**
 * Cost Guardrail System Tests
 *
 * Verifies the budget enforcement, circuit breaker, cost tracking,
 * and request-scoped context that prevent runaway AI spending.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  DEFAULT_COST_GUARDRAIL_CONFIG,
  estimateCallCost,
  getTodayKey,
  costKey,
} from '../lib/ai/costGuardrail';
import { createCostTracker } from '../lib/ai/costTracker';
import { createCircuitBreaker } from '../lib/ai/circuitBreaker';
import {
  setRequestCostGuardrails,
  clearRequestCostGuardrails,
  getRequestCostGuardrails,
} from '../lib/ai/costGuardrailContext';

// ─── Helpers ────────────────────────────────────────────────────────────────

function mockKV() {
  const store = new Map<string, string>();
  return {
    store,
    get: vi.fn(async (key: string, type?: string) => {
      const raw = store.get(key);
      if (!raw) return null;
      if (type === 'json') return JSON.parse(raw);
      return raw;
    }),
    put: vi.fn(async (key: string, value: string, _opts?: unknown) => {
      store.set(key, value);
    }),
  };
}

// ─── Cost Estimation ────────────────────────────────────────────────────────

describe('Cost Estimation', () => {
  it('should calculate cost correctly', () => {
    const cost = estimateCallCost(1000, 500, 0.5, 1.5);
    // (1000/1M)*0.5 + (500/1M)*1.5 = 0.0005 + 0.00075 = 0.00125
    expect(cost).toBeCloseTo(0.00125, 8);
  });

  it('should return 0 for zero tokens', () => {
    expect(estimateCallCost(0, 0, 1.0, 1.0)).toBe(0);
  });

  it('should handle large token counts', () => {
    const cost = estimateCallCost(100_000, 50_000, 2.0, 8.0);
    // 0.1*2.0 + 0.05*8.0 = 0.2 + 0.4 = 0.6
    expect(cost).toBeCloseTo(0.6, 6);
  });
});

// ─── Key Generation ─────────────────────────────────────────────────────────

describe('Key Generation', () => {
  it('should generate YYYY-MM-DD format', () => {
    const key = getTodayKey();
    expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('should create scoped cost keys', () => {
    const key = costKey('provider', 'gemini', '2026-07-29');
    expect(key).toBe('cost:provider:gemini:2026-07-29');
  });

  it('should use today when no date passed', () => {
    const key = costKey('global', 'all');
    expect(key).toContain('cost:global:all:');
  });
});

// ─── Cost Tracker ───────────────────────────────────────────────────────────

describe('CostTracker', () => {
  let kv: ReturnType<typeof mockKV>;
  let tracker: ReturnType<typeof createCostTracker>;

  beforeEach(() => {
    kv = mockKV();
    tracker = createCostTracker({ RATE_LIMIT_KV: kv as any });
  });

  it('should record cost and increment counters', async () => {
    const result = await tracker.recordCost({
      provider: 'gemini',
      modelName: 'gemini-2.5-flash',
      userId: 'user-1',
      inputTokens: 1000,
      outputTokens: 500,
      inputCostPer1M: 0.15,
      outputCostPer1M: 0.60,
    });

    expect(result.actualCostUsd).toBeGreaterThan(0);
    // Three KV writes: provider, global, user
    expect(kv.put).toHaveBeenCalledTimes(3);
  });

  it('should allow calls within budget', async () => {
    const result = await tracker.checkBudget({
      provider: 'gemini',
      userId: 'user-1',
      estimatedInputTokens: 1000,
      estimatedOutputTokens: 500,
      inputCostPer1M: 0.15,
      outputCostPer1M: 0.60,
    });

    expect(result.allowed).toBe(true);
    expect(result.estimatedCostUsd).toBeGreaterThan(0);
  });

  it('should block calls exceeding per-call cap', async () => {
    const result = await tracker.checkBudget({
      provider: 'gemini',
      userId: 'user-1',
      estimatedInputTokens: 10_000_000,
      estimatedOutputTokens: 10_000_000,
      inputCostPer1M: 100,
      outputCostPer1M: 100,
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('per-call cap');
  });

  it('should block when provider budget exhausted', async () => {
    // Exhaust gemini budget ($5 default)
    const expensiveInput = 3_000_000;
    const expensiveOutput = 3_000_000;
    const costPer1M = 2.0;

    // Record enough cost to exhaust the budget
    for (let i = 0; i < 5; i++) {
      await tracker.recordCost({
        provider: 'gemini',
        modelName: 'gemini-2.5-flash',
        inputTokens: expensiveInput,
        outputTokens: expensiveOutput,
        inputCostPer1M: costPer1M,
        outputCostPer1M: costPer1M,
      });
    }

    // Now a new call should be blocked
    const result = await tracker.checkBudget({
      provider: 'gemini',
      userId: 'user-1',
      estimatedInputTokens: 1000,
      estimatedOutputTokens: 1000,
      inputCostPer1M: costPer1M,
      outputCostPer1M: costPer1M,
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('budget exhausted');
  });

  it('should get today summary', async () => {
    await tracker.recordCost({
      provider: 'openai',
      modelName: 'gpt-4o',
      inputTokens: 500,
      outputTokens: 200,
      inputCostPer1M: 2.5,
      outputCostPer1M: 10,
    });

    const summary = await tracker.getTodaySummary();
    expect(summary.provider.openai.callCount).toBe(1);
    expect(summary.totalUsd).toBeGreaterThan(0);
  });

  it('should return empty record for unused providers', async () => {
    const record = await tracker.getDailySpend('provider', 'anthropic');
    expect(record.totalUsd).toBe(0);
    expect(record.callCount).toBe(0);
  });
});

// ─── Circuit Breaker ────────────────────────────────────────────────────────

describe('CircuitBreaker', () => {
  let cb: ReturnType<typeof createCircuitBreaker>;

  beforeEach(() => {
    cb = createCircuitBreaker();
  });

  it('should start in closed state (available)', () => {
    expect(cb.isAvailable('gemini')).toBe(true);
    expect(cb.getState('gemini').state).toBe('closed');
  });

  it('should open circuit on budget trip', () => {
    cb.tripForBudget('deepseek');
    expect(cb.isAvailable('deepseek')).toBe(false);
    expect(cb.getState('deepseek').state).toBe('open');
  });

  it('should still allow other providers when one is tripped', () => {
    cb.tripForBudget('deepseek');
    expect(cb.isAvailable('gemini')).toBe(true);
    expect(cb.isAvailable('openai')).toBe(true);
  });

  it('should transition to half-open after cooldown', () => {
    // Create breaker with short cooldown for testing
    const shortCb = createCircuitBreaker({
      ...DEFAULT_COST_GUARDRAIL_CONFIG,
      circuitBreakerCooldownMs: 1, // 1ms cooldown
    });

    shortCb.tripForBudget('deepinfra');
    expect(shortCb.isAvailable('deepinfra')).toBe(false);

    // Wait for cooldown
    return new Promise((resolve) => setTimeout(resolve, 10)).then(() => {
      // Should now be half-open (available for test call)
      expect(shortCb.isAvailable('deepinfra')).toBe(true);
      expect(shortCb.getState('deepinfra').state).toBe('half-open');
    });
  });

  it('should close circuit after successful half-open call', () => {
    const shortCb = createCircuitBreaker({
      ...DEFAULT_COST_GUARDRAIL_CONFIG,
      circuitBreakerCooldownMs: 1,
    });

    shortCb.tripForBudget('anthropic');
    return new Promise((resolve) => setTimeout(resolve, 10)).then(() => {
      shortCb.isAvailable('anthropic'); // transition to half-open
      shortCb.recordSuccess('anthropic');
      expect(shortCb.getState('anthropic').state).toBe('closed');
    });
  });

  it('should re-open circuit after failed half-open call', () => {
    const shortCb = createCircuitBreaker({
      ...DEFAULT_COST_GUARDRAIL_CONFIG,
      circuitBreakerCooldownMs: 1,
    });

    shortCb.tripForBudget('anthropic');
    return new Promise((resolve) => setTimeout(resolve, 10)).then(() => {
      shortCb.isAvailable('anthropic'); // transition to half-open
      shortCb.recordFailure('anthropic');
      expect(shortCb.getState('anthropic').state).toBe('open');
    });
  });

  it('should reset a circuit', () => {
    cb.tripForBudget('gemini');
    expect(cb.isAvailable('gemini')).toBe(false);
    cb.reset('gemini');
    expect(cb.isAvailable('gemini')).toBe(true);
    expect(cb.getState('gemini').state).toBe('closed');
  });

  it('should return all provider states', () => {
    cb.tripForBudget('deepseek');
    const all = cb.getAllStates();
    expect(all.deepseek.state).toBe('open');
    expect(all.gemini.state).toBe('closed');
    expect(all.openai.state).toBe('closed');
  });
});

// ─── Request-Scoped Context ─────────────────────────────────────────────────

describe('CostGuardrailContext', () => {
  beforeEach(() => {
    clearRequestCostGuardrails();
  });

  it('should return undefined when no guardrails set', () => {
    const ctx = getRequestCostGuardrails();
    expect(ctx.costTracker).toBeUndefined();
    expect(ctx.circuitBreaker).toBeUndefined();
    expect(ctx.userId).toBeUndefined();
  });

  it('should set and read guardrails', () => {
    const kv = mockKV();
    const tracker = createCostTracker({ RATE_LIMIT_KV: kv as any });
    const cb = createCircuitBreaker();

    setRequestCostGuardrails({
      costTracker: tracker,
      circuitBreaker: cb,
      userId: 'test-user-123',
    });

    const ctx = getRequestCostGuardrails();
    expect(ctx.costTracker).toBe(tracker);
    expect(ctx.circuitBreaker).toBe(cb);
    expect(ctx.userId).toBe('test-user-123');
  });

  it('should clear guardrails', () => {
    setRequestCostGuardrails({ userId: 'user' });
    expect(getRequestCostGuardrails().userId).toBe('user');

    clearRequestCostGuardrails();
    expect(getRequestCostGuardrails().userId).toBeUndefined();
  });

  it('should handle partial guardrails (only userId)', () => {
    setRequestCostGuardrails({ userId: 'partial-user' });
    const ctx = getRequestCostGuardrails();
    expect(ctx.userId).toBe('partial-user');
    expect(ctx.costTracker).toBeUndefined();
    expect(ctx.circuitBreaker).toBeUndefined();
  });
});

// ─── Default Config ─────────────────────────────────────────────────────────

describe('Default Cost Guardrail Config', () => {
  it('should have reasonable budget limits', () => {
    expect(DEFAULT_COST_GUARDRAIL_CONFIG.globalDailyBudgetUsd).toBe(25);
    expect(DEFAULT_COST_GUARDRAIL_CONFIG.userDailyBudgetUsd).toBe(10);
    expect(DEFAULT_COST_GUARDRAIL_CONFIG.maxCostPerCallUsd).toBe(1);
    expect(DEFAULT_COST_GUARDRAIL_CONFIG.maxTokensPerCall).toBe(8192);
  });

  it('should have all providers budgeted', () => {
    const providers = ['gemini', 'openai', 'anthropic', 'deepseek', 'deepinfra', 'openrouter'];
    for (const p of providers) {
      expect(DEFAULT_COST_GUARDRAIL_CONFIG.providerDailyBudgetUsd[p as keyof typeof DEFAULT_COST_GUARDRAIL_CONFIG.providerDailyBudgetUsd]).toBeGreaterThan(0);
    }
  });

  it('should have thresholds between 0 and 1', () => {
    expect(DEFAULT_COST_GUARDRAIL_CONFIG.warningThreshold).toBeGreaterThan(0);
    expect(DEFAULT_COST_GUARDRAIL_CONFIG.warningThreshold).toBeLessThan(1);
    expect(DEFAULT_COST_GUARDRAIL_CONFIG.emergencyThreshold).toBeGreaterThan(DEFAULT_COST_GUARDRAIL_CONFIG.warningThreshold);
    expect(DEFAULT_COST_GUARDRAIL_CONFIG.emergencyThreshold).toBeLessThan(1);
  });

  it('should have non-zero cooldown', () => {
    expect(DEFAULT_COST_GUARDRAIL_CONFIG.circuitBreakerCooldownMs).toBeGreaterThan(0);
  });
});
