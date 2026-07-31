/**
 * GET /api/ai/costs
 *
 * Returns today's AI spending summary across all providers, broken down
 * by provider and by model. Used by the admin dashboard to display
 * cost guardrail status and budget utilization.
 *
 * Security:
 *   - Authenticated endpoint (Clerk)
 *   - Read-only — no budget mutations
 *   - No sensitive key material exposed
 *
 * @module functions/api/ai/costs
 */

import { z } from 'zod';
import { authenticatedEndpoint, type AuthenticatedContext } from '../_shared/middleware';
import { createCostTracker } from '@/lib/ai/costTracker';
import { createCircuitBreaker } from '@/lib/ai/circuitBreaker';
import { DEFAULT_COST_GUARDRAIL_CONFIG } from '@/lib/ai/costGuardrail';

export const onRequestGet = authenticatedEndpoint(
  z.object({}),
  async (context: AuthenticatedContext) => {
    const { env } = context;

    const costTracker = createCostTracker({ RATE_LIMIT_KV: env.RATE_LIMIT_KV });
    const circuitBreaker = createCircuitBreaker();

    const summary = await costTracker.getTodaySummary();
    const circuitStates = circuitBreaker.getAllStates();
    const config = DEFAULT_COST_GUARDRAIL_CONFIG;

    // Build per-provider budget utilization
    const providers = Object.entries(summary.provider).map(([name, record]) => {
      const budget = config.providerDailyBudgetUsd[name as keyof typeof config.providerDailyBudgetUsd] ?? 0;
      const used = record.totalUsd;
      const remaining = Math.max(0, budget - used);
      const utilizationPct = budget > 0 ? (used / budget) * 100 : 0;

      return {
        provider: name,
        budgetUsd: budget,
        spentUsd: Number(used.toFixed(4)),
        remainingUsd: Number(remaining.toFixed(4)),
        utilizationPct: Number(utilizationPct.toFixed(1)),
        callCount: record.callCount,
        byModel: record.byModel,
        circuitState: circuitStates[name as keyof typeof circuitStates]?.state ?? 'closed',
      };
    });

    const globalBudget = config.globalDailyBudgetUsd;
    const globalSpent = summary.totalUsd;
    const globalRemaining = Math.max(0, globalBudget - globalSpent);
    const globalUtilPct = globalBudget > 0 ? (globalSpent / globalBudget) * 100 : 0;

    return {
      data: {
        date: new Date().toISOString().slice(0, 10),
        global: {
          budgetUsd: globalBudget,
          spentUsd: Number(globalSpent.toFixed(4)),
          remainingUsd: Number(globalRemaining.toFixed(4)),
          utilizationPct: Number(globalUtilPct.toFixed(1)),
          callCount: summary.global.callCount,
        },
        providers,
        config: {
          warningThreshold: config.warningThreshold,
          emergencyThreshold: config.emergencyThreshold,
          maxCostPerCallUsd: config.maxCostPerCallUsd,
          maxTokensPerCall: config.maxTokensPerCall,
          circuitBreakerCooldownMs: config.circuitBreakerCooldownMs,
        },
      },
    };
  },
);
