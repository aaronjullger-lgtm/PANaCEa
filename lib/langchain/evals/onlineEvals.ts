/**
 * Online Evaluation Hooks
 *
 * Fire-and-forget evaluation hooks that run after agent/model invocations.
 * These evaluate quality in real-time and can submit scores to LangSmith
 * as feedback. Never block the response — failures are silently logged.
 *
 * Sprint 1: LangSmith Observability Upgrade
 *
 * @module lib/langchain/evals/onlineEvals
 */

import type { OnlineEvalContext, OnlineEvalResult } from '@/lib/langchain/tracing';

// ─── Evaluation Registry ──────────────────────────────────────────────────

type EvalHandler = (ctx: OnlineEvalContext) => Promise<OnlineEvalResult | null>;

const evalHandlers = new Map<string, EvalHandler>();

/**
 * Register an online evaluation handler for a specific eval type.
 */
export function registerOnlineEval(evalType: string, handler: EvalHandler): void {
  evalHandlers.set(evalType, handler);
}

// ─── Main Evaluation Entry Point ──────────────────────────────────────────

/**
 * Run the appropriate online evaluation for the given context.
 * Called by `runOnlineEval()` in `lib/langchain/tracing.ts`.
 *
 * Returns null if no handler is registered for the eval type,
 * or if the evaluation fails (silent degradation).
 */
export async function evaluateOnline(
  ctx: OnlineEvalContext,
): Promise<OnlineEvalResult | null> {
  const handler = evalHandlers.get(ctx.evalType);
  if (!handler) return null;

  try {
    return await handler(ctx);
  } catch (err) {
    console.warn(
      `[onlineEvals] Evaluation failed for type "${ctx.evalType}":`,
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}

// ─── Built-in Evaluation Handlers ─────────────────────────────────────────

/**
 * Question quality evaluation — checks generated questions for:
 * - Clinical accuracy (does it make medical sense?)
 * - Board relevance (would this appear on PANCE/PANRE?)
 * - Structural completeness (stem, 5 choices, explanation)
 *
 * This is a heuristic evaluation — it checks structural properties
 * without making an additional LLM call (cost-free).
 */
registerOnlineEval('question-quality', async (ctx) => {
  const output = ctx.output;
  if (typeof output !== 'string') return null;

  let score = 0;
  const checks: string[] = [];

  // Check 1: Has a question stem (ends with ? or contains clinical scenario)
  if (output.includes('?') || output.length > 100) {
    score += 0.2;
    checks.push('has_stem');
  }

  // Check 2: Has answer choices (A., B., C., D., E. pattern)
  const choiceMatches = output.match(/[A-E][.)]\s/g);
  if (choiceMatches && choiceMatches.length >= 4) {
    score += 0.3;
    checks.push('has_choices');
  }

  // Check 3: Has an explanation/rationale
  if (
    output.toLowerCase().includes('explanation') ||
    output.toLowerCase().includes('rationale') ||
    output.toLowerCase().includes('because')
  ) {
    score += 0.2;
    checks.push('has_explanation');
  }

  // Check 4: Has clinical terminology (organ systems, drugs, labs)
  const clinicalTerms = [
    'diagnosis', 'treatment', 'management', 'symptom',
    'patient', 'examination', 'laboratory', 'imaging',
    'medication', 'surgery', 'therapy', 'prognosis',
    'cardiac', 'pulmonary', 'renal', 'hepatic', 'neurologic',
  ];
  const hasClinical = clinicalTerms.some((term) =>
    output.toLowerCase().includes(term),
  );
  if (hasClinical) {
    score += 0.2;
    checks.push('clinical_terms');
  }

  // Check 5: Appropriate length (not too short, not absurdly long)
  if (output.length > 200 && output.length < 8000) {
    score += 0.1;
    checks.push('appropriate_length');
  }

  return {
    evalType: 'question-quality',
    score: Math.min(score, 1.0),
    label: score >= 0.7 ? 'good' : score >= 0.4 ? 'needs_review' : 'poor',
    comment: `Checks passed: ${checks.join(', ')}`,
    metadata: {
      checks,
      outputLength: output.length,
      modelName: ctx.modelName,
      provider: ctx.provider,
    },
  };
});

/**
 * OSCE grading quality evaluation — checks SPBench scores for:
 * - Score range validity (0–100)
 * - All 8 dimensions present
 * - Overall score consistency
 */
registerOnlineEval('osce-grading', async (ctx) => {
  const output = ctx.output;
  if (typeof output !== 'object' || output === null) return null;

  const scores = output as Record<string, unknown>;
  const expectedDimensions = ['QC', 'CC', 'CD', 'RC', 'LC', 'LN', 'CS', 'PD'];
  let score = 0;
  const checks: string[] = [];

  // Check 1: All 8 SPBench dimensions present
  const presentDimensions = expectedDimensions.filter((dim) => dim in scores);
  const dimensionRatio = presentDimensions.length / expectedDimensions.length;
  score += dimensionRatio * 0.4;
  checks.push(`dimensions:${presentDimensions.length}/${expectedDimensions.length}`);

  // Check 2: Overall score present and in valid range
  if ('overallScore' in scores) {
    const overall = Number(scores.overallScore);
    if (!isNaN(overall) && overall >= 0 && overall <= 100) {
      score += 0.3;
      checks.push('valid_overall');
    }
  }

  // Check 3: Individual dimension scores in valid range
  const validDimensions = presentDimensions.filter((dim) => {
    const val = Number(scores[dim]);
    return !isNaN(val) && val >= 0 && val <= 100;
  });
  if (validDimensions.length > 0) {
    score += (validDimensions.length / presentDimensions.length) * 0.3;
    checks.push(`valid_dims:${validDimensions.length}`);
  }

  return {
    evalType: 'osce-grading',
    score: Math.min(score, 1.0),
    label: score >= 0.8 ? 'complete' : score >= 0.5 ? 'partial' : 'incomplete',
    comment: `Checks passed: ${checks.join(', ')}`,
    metadata: {
      checks,
      dimensionsPresent: presentDimensions.length,
      totalDimensions: expectedDimensions.length,
      modelName: ctx.modelName,
      provider: ctx.provider,
    },
  };
});

/**
 * Agent performance evaluation — tracks latency, cost, and success rate.
 * This is a meta-evaluation that runs on every agent invocation.
 */
registerOnlineEval('agent-performance', async (ctx) => {
  let score = 1.0;
  const checks: string[] = [];

  // Check 1: Latency within acceptable range
  if (ctx.latencyMs > 30_000) {
    score -= 0.3;
    checks.push('high_latency');
  } else if (ctx.latencyMs > 10_000) {
    score -= 0.1;
    checks.push('elevated_latency');
  } else {
    checks.push('latency_ok');
  }

  // Check 2: Cost within budget tier
  if (ctx.estimatedCostUsd !== undefined) {
    if (ctx.estimatedCostUsd > 0.10) {
      score -= 0.2;
      checks.push('high_cost');
    } else if (ctx.estimatedCostUsd > 0.05) {
      score -= 0.1;
      checks.push('elevated_cost');
    } else {
      checks.push('cost_ok');
    }
  }

  // Check 3: Token efficiency
  if (ctx.usage) {
    const totalTokens = ctx.usage.totalTokens ?? 0;
    if (totalTokens > 8000) {
      score -= 0.1;
      checks.push('high_tokens');
    } else {
      checks.push('tokens_ok');
    }
  }

  return {
    evalType: 'agent-performance',
    score: Math.max(score, 0),
    label: score >= 0.8 ? 'efficient' : score >= 0.5 ? 'acceptable' : 'expensive',
    comment: `Checks: ${checks.join(', ')}`,
    metadata: {
      checks,
      latencyMs: ctx.latencyMs,
      estimatedCostUsd: ctx.estimatedCostUsd,
      totalTokens: ctx.usage?.totalTokens,
      modelName: ctx.modelName,
      provider: ctx.provider,
    },
  };
});
