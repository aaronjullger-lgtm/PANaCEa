/**
 * AI Gateway — Telemetry primitives.
 *
 * Provides deterministic request IDs, latency bucketing, cost estimation,
 * and a process-local fallback-frequency counter. All AI traffic routed
 * through aiGateway surfaces these in the response metadata.
 *
 * Edge-safe: no Node-only APIs. Uses crypto.randomUUID when available,
 * falls back to a pseudo-random shim.
 */

export type LatencyBucket =
  | 'under_100ms'
  | 'under_500ms'
  | 'under_1s'
  | 'under_3s'
  | 'under_10s'
  | 'under_30s'
  | 'over_30s';

export function bucketLatency(ms: number): LatencyBucket {
  if (ms < 100) return 'under_100ms';
  if (ms < 500) return 'under_500ms';
  if (ms < 1000) return 'under_1s';
  if (ms < 3000) return 'under_3s';
  if (ms < 10_000) return 'under_10s';
  if (ms < 30_000) return 'under_30s';
  return 'over_30s';
}

export function newRequestId(): string {
  const g = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (g?.randomUUID) return g.randomUUID();
  // Last-resort shim (not crypto-strong, but fine for trace IDs)
  return 'req_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * Very rough $ per 1M tokens, used only for display/alerting — not billing.
 * Source: Google pricing page, Oct 2025. Keep conservative (round up).
 */
const COST_TABLE_USD_PER_MTOK: Record<string, { input: number; output: number }> = {
  'gemini-2.0-flash': { input: 0.1, output: 0.4 },
  'gemini-2.5-flash': { input: 0.3, output: 2.5 },
  'gemini-2.5-pro': { input: 1.25, output: 10 },
  'gemini-2.5-flash-native-audio-preview-12-2025': { input: 0.5, output: 3.0 },
  'text-embedding-005': { input: 0.025, output: 0 },
  // Non-Gemini providers (LangChain fallback paths)
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4o': { input: 2.5, output: 10 },
  'claude-3-5-haiku-20241022': { input: 0.8, output: 4 },
  'claude-3-5-sonnet-20241022': { input: 3, output: 15 },
  'deepseek-chat': { input: 0.14, output: 0.28 },
};

export interface UsageCounts {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface CostEstimate {
  inputUsd: number;
  outputUsd: number;
  totalUsd: number;
  modelFound: boolean;
}

/**
 * Estimate USD cost of a single call. Returns modelFound=false if the model
 * string isn't in the pricing table (e.g. a preview model) — caller can log
 * a warning so the table gets updated.
 */
export function estimateCost(model: string, usage: UsageCounts | undefined): CostEstimate {
  const row = COST_TABLE_USD_PER_MTOK[model];
  const inputTokens = usage?.inputTokens ?? 0;
  const outputTokens = usage?.outputTokens ?? 0;
  if (!row) {
    return { inputUsd: 0, outputUsd: 0, totalUsd: 0, modelFound: false };
  }
  const inputUsd = (inputTokens / 1_000_000) * row.input;
  const outputUsd = (outputTokens / 1_000_000) * row.output;
  return {
    inputUsd,
    outputUsd,
    totalUsd: inputUsd + outputUsd,
    modelFound: true,
  };
}

// ─── Fallback-frequency counter (process-local) ────────────────────────────

interface FallbackBucket {
  attempts: number;
  primaryFailures: number;
  fallbackInvocations: number;
  schemaRepairInvocations: number;
  totalFailures: number;
}

const FALLBACK_STATS: Map<string, FallbackBucket> = new Map();

function bucketFor(task: string): FallbackBucket {
  let b = FALLBACK_STATS.get(task);
  if (!b) {
    b = {
      attempts: 0,
      primaryFailures: 0,
      fallbackInvocations: 0,
      schemaRepairInvocations: 0,
      totalFailures: 0,
    };
    FALLBACK_STATS.set(task, b);
  }
  return b;
}

export function recordAttempt(task: string): void {
  bucketFor(task).attempts += 1;
}

export function recordPrimaryFailure(task: string): void {
  bucketFor(task).primaryFailures += 1;
}

export function recordFallback(task: string): void {
  bucketFor(task).fallbackInvocations += 1;
}

export function recordSchemaRepair(task: string): void {
  bucketFor(task).schemaRepairInvocations += 1;
}

export function recordTotalFailure(task: string): void {
  bucketFor(task).totalFailures += 1;
}

export interface FallbackSnapshot {
  task: string;
  attempts: number;
  primaryFailureRate: number;
  fallbackRate: number;
  schemaRepairRate: number;
  totalFailureRate: number;
}

export function snapshotFallbackStats(): FallbackSnapshot[] {
  const out: FallbackSnapshot[] = [];
  for (const [task, b] of FALLBACK_STATS) {
    const n = Math.max(b.attempts, 1);
    out.push({
      task,
      attempts: b.attempts,
      primaryFailureRate: b.primaryFailures / n,
      fallbackRate: b.fallbackInvocations / n,
      schemaRepairRate: b.schemaRepairInvocations / n,
      totalFailureRate: b.totalFailures / n,
    });
  }
  return out;
}

export function resetFallbackStats(): void {
  FALLBACK_STATS.clear();
}
