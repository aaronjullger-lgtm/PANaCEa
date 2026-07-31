/**
 * KV-backed Cost Tracker
 *
 * Tracks AI API spending across providers, users, and days using
 * Cloudflare KV (RATE_LIMIT_KV) for distributed tracking, with
 * in-memory fallback for local dev.
 *
 * Key design: Every LLM call records its cost atomically. The tracker
 * sums costs per provider, per user, and globally for the day. The
 * router checks these totals BEFORE making the next call to prevent
 * budget overruns.
 *
 * @module lib/ai/costTracker
 */

import type { ModelProvider } from '@/lib/langchain/config';
import {
  DEFAULT_COST_GUARDRAIL_CONFIG,
  type CostGuardrailConfig,
  type CostRecord,
  type CostCheckResult,
  costKey,
  getTodayKey,
  estimateCallCost,
} from './costGuardrail';

// ─── In-Memory Store (local dev fallback) ───────────────────────────────────

const memoryStore = new Map<string, CostRecord>();

function getMemoryRecord(key: string): CostRecord {
  let record = memoryStore.get(key);
  if (!record) {
    record = { totalUsd: 0, callCount: 0, lastUpdated: Date.now(), byModel: {} };
    memoryStore.set(key, record);
  }
  return record;
}

// ─── Cost Tracker Interface ─────────────────────────────────────────────────

export interface CostTracker {
  /**
   * Pre-call check: Is this call allowed given current budgets?
   * Returns allowed + details about remaining budget.
   */
  checkBudget(params: {
    provider: ModelProvider;
    userId?: string;
    estimatedInputTokens: number;
    estimatedOutputTokens: number;
    inputCostPer1M: number;
    outputCostPer1M: number;
  }): Promise<CostCheckResult>;

  /**
   * Post-call record: Record the actual cost of a completed call.
   */
  recordCost(params: {
    provider: ModelProvider;
    modelName: string;
    userId?: string;
    inputTokens: number;
    outputTokens: number;
    inputCostPer1M: number;
    outputCostPer1M: number;
  }): Promise<{ actualCostUsd: number }>;

  /**
   * Get current daily spend for a scope.
   */
  getDailySpend(scope: 'provider' | 'user' | 'global', identifier: string): Promise<CostRecord>;

  /**
   * Get today's full cost summary across all providers.
   */
  getTodaySummary(): Promise<{
    provider: Record<ModelProvider, CostRecord>;
    global: CostRecord;
    totalUsd: number;
  }>;
}

// ─── KV Implementation ──────────────────────────────────────────────────────

interface CostTrackerEnv {
  RATE_LIMIT_KV?: { get(key: string, type?: string): Promise<unknown>; put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void> };
}

function emptyRecord(): CostRecord {
  return { totalUsd: 0, callCount: 0, lastUpdated: Date.now(), byModel: {} };
}

function mergeRecord(existing: CostRecord | null, addition: Partial<CostRecord>): CostRecord {
  const base = existing ?? emptyRecord();
  return {
    totalUsd: base.totalUsd + (addition.totalUsd ?? 0),
    callCount: base.callCount + (addition.callCount ?? 0),
    lastUpdated: Date.now(),
    byModel: { ...base.byModel, ...(addition.byModel ?? {}) },
  };
}

export function createCostTracker(
  env: CostTrackerEnv,
  config: CostGuardrailConfig = DEFAULT_COST_GUARDRAIL_CONFIG,
): CostTracker {
  const useKV = !!env.RATE_LIMIT_KV;
  const KV_TTL = 48 * 60 * 60; // 48 hours

  async function readRecord(key: string): Promise<CostRecord> {
    if (useKV && env.RATE_LIMIT_KV) {
      const raw = await env.RATE_LIMIT_KV.get(key, 'json');
      return (raw as CostRecord) ?? emptyRecord();
    }
    return getMemoryRecord(key);
  }

  async function writeRecord(key: string, record: CostRecord): Promise<void> {
    if (useKV && env.RATE_LIMIT_KV) {
      await env.RATE_LIMIT_KV.put(key, JSON.stringify(record), { expirationTtl: KV_TTL });
    } else {
      memoryStore.set(key, record);
    }
  }

  async function incrementRecord(
    key: string,
    costUsd: number,
    modelName: string,
    inputTokens: number,
    outputTokens: number,
  ): Promise<CostRecord> {
    const existing = await readRecord(key);
    const modelEntry = existing.byModel[modelName] ?? { usd: 0, calls: 0, tokens: 0 };
    modelEntry.usd += costUsd;
    modelEntry.calls += 1;
    modelEntry.tokens += inputTokens + outputTokens;

    const updated = mergeRecord(existing, {
      totalUsd: costUsd,
      callCount: 1,
      byModel: { [modelName]: modelEntry },
    });

    await writeRecord(key, updated);
    return updated;
  }

  return {
    async checkBudget({ provider, userId, estimatedInputTokens, estimatedOutputTokens, inputCostPer1M, outputCostPer1M }) {
      const estimatedCost = estimateCallCost(
        estimatedInputTokens, estimatedOutputTokens, inputCostPer1M, outputCostPer1M,
      );

      // 1. Hard per-call cap
      if (estimatedCost > config.maxCostPerCallUsd) {
        return {
          allowed: false,
          reason: `Estimated cost $${estimatedCost.toFixed(4)} exceeds per-call cap $${config.maxCostPerCallUsd}`,
          provider,
          estimatedCostUsd: estimatedCost,
        };
      }

      // 2. Global daily budget
      const globalRecord = await readRecord(costKey('global', 'all'));
      const globalRemaining = config.globalDailyBudgetUsd - globalRecord.totalUsd;
      if (globalRemaining <= 0) {
        return {
          allowed: false,
          reason: `Global daily budget exhausted: $${globalRecord.totalUsd.toFixed(2)} / $${config.globalDailyBudgetUsd}`,
          provider,
          estimatedCostUsd: estimatedCost,
          remainingBudgetUsd: 0,
          dailySpendUsd: globalRecord.totalUsd,
        };
      }
      if (globalRecord.totalUsd + estimatedCost > config.globalDailyBudgetUsd) {
        return {
          allowed: false,
          reason: `Global daily budget would be exceeded: $${globalRecord.totalUsd.toFixed(2)} + $${estimatedCost.toFixed(4)} > $${config.globalDailyBudgetUsd}`,
          provider,
          estimatedCostUsd: estimatedCost,
          remainingBudgetUsd: globalRemaining,
          dailySpendUsd: globalRecord.totalUsd,
        };
      }

      // 3. Per-provider daily budget
      const providerRecord = await readRecord(costKey('provider', provider));
      const providerBudget = config.providerDailyBudgetUsd[provider] ?? 10;
      if (providerRecord.totalUsd >= providerBudget) {
        return {
          allowed: false,
          reason: `Provider ${provider} daily budget exhausted: $${providerRecord.totalUsd.toFixed(2)} / $${providerBudget}`,
          provider,
          estimatedCostUsd: estimatedCost,
          remainingBudgetUsd: 0,
          dailySpendUsd: providerRecord.totalUsd,
        };
      }
      if (providerRecord.totalUsd + estimatedCost > providerBudget) {
        return {
          allowed: false,
          reason: `Provider ${provider} budget would be exceeded: $${providerRecord.totalUsd.toFixed(2)} + $${estimatedCost.toFixed(4)} > $${providerBudget}`,
          provider,
          estimatedCostUsd: estimatedCost,
          remainingBudgetUsd: providerBudget - providerRecord.totalUsd,
          dailySpendUsd: providerRecord.totalUsd,
        };
      }

      // 4. Per-user daily budget (if userId provided)
      if (userId) {
        const userRecord = await readRecord(costKey('user', userId));
        if (userRecord.totalUsd >= config.userDailyBudgetUsd) {
          return {
            allowed: false,
            reason: `User daily budget exhausted: $${userRecord.totalUsd.toFixed(2)} / $${config.userDailyBudgetUsd}`,
            provider,
            estimatedCostUsd: estimatedCost,
            remainingBudgetUsd: 0,
            dailySpendUsd: userRecord.totalUsd,
          };
        }
        if (userRecord.totalUsd + estimatedCost > config.userDailyBudgetUsd) {
          return {
            allowed: false,
            reason: `User budget would be exceeded: $${userRecord.totalUsd.toFixed(2)} + $${estimatedCost.toFixed(4)} > $${config.userDailyBudgetUsd}`,
            provider,
            estimatedCostUsd: estimatedCost,
            remainingBudgetUsd: config.userDailyBudgetUsd - userRecord.totalUsd,
            dailySpendUsd: userRecord.totalUsd,
          };
        }
      }

      // 5. Warning checks (log but allow)
      const providerFraction = providerRecord.totalUsd / providerBudget;
      const globalFraction = globalRecord.totalUsd / config.globalDailyBudgetUsd;
      if (providerFraction >= config.warningThreshold || globalFraction >= config.warningThreshold) {
        const warning = `[CostGuardrail] APPROACHING BUDGET — Provider ${provider}: $${providerRecord.totalUsd.toFixed(2)}/${providerBudget} (${(providerFraction * 100).toFixed(0)}%), Global: $${globalRecord.totalUsd.toFixed(2)}/${config.globalDailyBudgetUsd} (${(globalFraction * 100).toFixed(0)}%)`;
        console.warn(warning);
      }

      return {
        allowed: true,
        provider,
        estimatedCostUsd: estimatedCost,
        remainingBudgetUsd: globalRemaining - estimatedCost,
        dailySpendUsd: globalRecord.totalUsd,
      };
    },

    async recordCost({ provider, modelName, userId, inputTokens, outputTokens, inputCostPer1M, outputCostPer1M }) {
      const actualCost = estimateCallCost(inputTokens, outputTokens, inputCostPer1M, outputCostPer1M);

      // Record at all three scopes
      await incrementRecord(costKey('provider', provider), actualCost, modelName, inputTokens, outputTokens);
      await incrementRecord(costKey('global', 'all'), actualCost, modelName, inputTokens, outputTokens);
      if (userId) {
        await incrementRecord(costKey('user', userId), actualCost, modelName, inputTokens, outputTokens);
      }

      // Check emergency thresholds and log
      const providerRecord = await readRecord(costKey('provider', provider));
      const providerBudget = config.providerDailyBudgetUsd[provider] ?? 10;
      const providerFraction = providerRecord.totalUsd / providerBudget;

      if (providerFraction >= config.emergencyThreshold) {
        console.warn(
          `[CostGuardrail] EMERGENCY — Provider ${provider} at ${(providerFraction * 100).toFixed(0)}% of daily budget ($${providerRecord.totalUsd.toFixed(2)} / $${providerBudget}). Circuit breaker should activate.`
        );
      }

      return { actualCostUsd: actualCost };
    },

    async getDailySpend(scope, identifier) {
      return readRecord(costKey(scope, identifier));
    },

    async getTodaySummary() {
      const providers: ModelProvider[] = ['gemini', 'openai', 'anthropic', 'deepseek', 'deepinfra', 'openrouter'];
      const providerRecords: Record<string, CostRecord> = {};
      let totalUsd = 0;

      for (const p of providers) {
        const record = await readRecord(costKey('provider', p));
        providerRecords[p] = record;
        totalUsd += record.totalUsd;
      }

      const globalRecord = await readRecord(costKey('global', 'all'));

      return {
        provider: providerRecords as Record<ModelProvider, CostRecord>,
        global: globalRecord,
        totalUsd,
      };
    },
  };
}
