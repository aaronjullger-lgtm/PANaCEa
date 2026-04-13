/**
 * AI Token Usage Tracking
 *
 * Phase 1.1: Persist Gemini API token usage to the database for cost observability.
 * Replaces console.log-only tracking with durable storage + structured logging.
 *
 * Design principles:
 * - Non-blocking: token tracking never delays the user's response
 * - Fail-silent: tracking errors are logged but never propagate
 * - Cost-aware: estimates USD cost per call using model pricing table
 *
 * Usage:
 *   // In any Gemini endpoint, after receiving the response:
 *   trackTokenUsage(context, {
 *     endpoint: '/api/gemini',
 *     model: 'gemini-2.5-flash',
 *     usage: responseData.usageMetadata,
 *     latencyMs: elapsed,
 *     statusCode: 200,
 *     cacheHit: false,
 *   });
 */

import { createEdgePrismaClient, safePrismaDisconnect } from './prisma-edge';

// ── Model Pricing (per 1M tokens, as of 2026-04) ──────────────────────────
// Source: Google AI pricing page. Update these when pricing changes.
// Keys are model name prefixes; we match the longest prefix first.
const MODEL_PRICING: Record<string, { inputPer1M: number; outputPer1M: number }> = {
  // ── Gemini ──
  'gemini-2.5-pro': { inputPer1M: 1.25, outputPer1M: 10.0 },
  'gemini-2.5-flash': { inputPer1M: 0.15, outputPer1M: 0.60 },
  'gemini-2.0-flash': { inputPer1M: 0.10, outputPer1M: 0.40 },
  'gemini-1.5-pro': { inputPer1M: 1.25, outputPer1M: 5.0 },
  'gemini-1.5-flash': { inputPer1M: 0.075, outputPer1M: 0.30 },
  'text-embedding-005': { inputPer1M: 0.025, outputPer1M: 0.0 },
  // ── OpenAI (via LangChain multi-provider) ──
  'openai/gpt-4o-mini': { inputPer1M: 0.15, outputPer1M: 0.60 },
  'openai/gpt-4o': { inputPer1M: 2.50, outputPer1M: 10.0 },
  'openai/o3-mini': { inputPer1M: 1.10, outputPer1M: 4.40 },
  // ── Anthropic (via LangChain multi-provider) ──
  'anthropic/claude-sonnet-4': { inputPer1M: 3.00, outputPer1M: 15.0 },
  'anthropic/claude-haiku-3.5': { inputPer1M: 0.80, outputPer1M: 4.0 },
  // ── DeepSeek (via LangChain multi-provider) ──
  'deepseek/deepseek-chat': { inputPer1M: 0.14, outputPer1M: 0.28 },
};

export interface TokenUsageMetadata {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
}

export interface TrackTokenUsageParams {
  endpoint: string;
  model: string;
  usage?: TokenUsageMetadata | null;
  latencyMs?: number;
  statusCode?: number;
  cacheHit?: boolean;
}

/**
 * Estimate cost in USD for a given model + token counts
 */
export function estimateCostUsd(
  model: string,
  promptTokens: number,
  candidatesTokens: number
): number {
  // Find the best matching pricing entry (longest prefix match)
  let bestMatch = '';
  for (const key of Object.keys(MODEL_PRICING)) {
    if (model.startsWith(key) && key.length > bestMatch.length) {
      bestMatch = key;
    }
  }

  if (!bestMatch) {
    // Unknown model — use gemini-2.5-flash as conservative default
    bestMatch = 'gemini-2.5-flash';
  }

  // Non-null assertion is safe: bestMatch is either a validated prefix match above
  // or the hardcoded fallback 'gemini-2.5-flash' — both guaranteed to be keys.
  const pricing = MODEL_PRICING[bestMatch]!;
  const inputCost = (promptTokens / 1_000_000) * pricing.inputPer1M;
  const outputCost = (candidatesTokens / 1_000_000) * pricing.outputPer1M;
  return inputCost + outputCost;
}

/**
 * Track token usage — fire-and-forget, non-blocking.
 *
 * Call this from any Gemini endpoint handler. It writes to AITokenUsage table
 * and emits a structured log. Errors are caught and logged silently.
 *
 * If `context.waitUntil` is available (Cloudflare Workers), uses it to
 * keep the isolate alive for the DB write without blocking the response.
 */
export function trackTokenUsage(
  context: { env?: any; waitUntil?: (p: Promise<any>) => void; auth?: { userId?: string } },
  params: TrackTokenUsageParams
): void {
  const { endpoint, model, usage, latencyMs, statusCode, cacheHit = false } = params;
  const promptTokenCount = usage?.promptTokenCount ?? 0;
  const candidatesTokenCount = usage?.candidatesTokenCount ?? 0;
  const totalTokenCount = usage?.totalTokenCount ?? promptTokenCount + candidatesTokenCount;

  const estimatedCost = estimateCostUsd(model, promptTokenCount, candidatesTokenCount);
  const userId = context.auth?.userId ?? null;

  // Structured log (always — even if DB write fails)
  console.log(
    JSON.stringify({
      event: 'ai_token_usage',
      endpoint,
      model,
      promptTokenCount,
      candidatesTokenCount,
      totalTokenCount,
      estimatedCostUsd: Math.round(estimatedCost * 1_000_000) / 1_000_000, // 6 decimal places
      latencyMs,
      statusCode,
      cacheHit,
      userId,
    })
  );

  // Persist to database (non-blocking)
  const dbUrl = context.env?.DATABASE_URL;
  if (!dbUrl) return; // No DB URL → skip persistence (local dev without DB)

  const writePromise = persistTokenUsage(dbUrl, {
    userId,
    endpoint,
    model,
    promptTokenCount,
    candidatesTokenCount,
    totalTokenCount,
    estimatedCostUsd: estimatedCost,
    latencyMs: latencyMs ?? null,
    statusCode: statusCode ?? null,
    cacheHit,
  });

  // Use waitUntil if available (keeps isolate alive for async write)
  if (context.waitUntil) {
    context.waitUntil(writePromise);
  }
  // Otherwise, fire-and-forget (write may be cut short if isolate terminates)
}

/**
 * Internal: persist a single token usage record to the database.
 * Uses a dedicated Prisma client to avoid interfering with request-scoped clients.
 */
async function persistTokenUsage(
  dbUrl: string,
  data: {
    userId: string | null;
    endpoint: string;
    model: string;
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
    estimatedCostUsd: number;
    latencyMs: number | null;
    statusCode: number | null;
    cacheHit: boolean;
  }
): Promise<void> {
  let prisma: any;
  try {
    prisma = createEdgePrismaClient(dbUrl);
    await prisma.aITokenUsage.create({
      data: {
        userId: data.userId,
        endpoint: data.endpoint,
        model: data.model,
        promptTokenCount: data.promptTokenCount,
        candidatesTokenCount: data.candidatesTokenCount,
        totalTokenCount: data.totalTokenCount,
        estimatedCostUsd: data.estimatedCostUsd,
        latencyMs: data.latencyMs,
        statusCode: data.statusCode,
        cacheHit: data.cacheHit,
      },
    });
  } catch (error) {
    // Never let tracking errors propagate
    console.error('[tokenTracking] DB write failed:', error instanceof Error ? error.message : error);
  } finally {
    if (prisma) {
      await safePrismaDisconnect(prisma);
    }
  }
}

/**
 * Helper: get aggregated token usage stats for a user.
 * Useful for admin dashboards and per-user quota enforcement.
 */
export async function getUserTokenUsageSummary(
  prisma: any,
  userId: string,
  since?: Date
): Promise<{
  totalTokens: number;
  totalCostUsd: number;
  callCount: number;
  byModel: Record<string, { tokens: number; cost: number; calls: number }>;
  byEndpoint: Record<string, { tokens: number; cost: number; calls: number }>;
}> {
  const where: any = { userId };
  if (since) {
    where.createdAt = { gte: since };
  }

  const records = await prisma.aITokenUsage.findMany({
    where,
    select: {
      model: true,
      endpoint: true,
      totalTokenCount: true,
      estimatedCostUsd: true,
    },
  });

  const byModel: Record<string, { tokens: number; cost: number; calls: number }> = {};
  const byEndpoint: Record<string, { tokens: number; cost: number; calls: number }> = {};
  let totalTokens = 0;
  let totalCostUsd = 0;

  for (const r of records) {
    totalTokens += r.totalTokenCount;
    totalCostUsd += r.estimatedCostUsd ?? 0;

    const modelEntry = (byModel[r.model] ??= { tokens: 0, cost: 0, calls: 0 });
    modelEntry.tokens += r.totalTokenCount;
    modelEntry.cost += r.estimatedCostUsd ?? 0;
    modelEntry.calls += 1;

    const endpointEntry = (byEndpoint[r.endpoint] ??= { tokens: 0, cost: 0, calls: 0 });
    endpointEntry.tokens += r.totalTokenCount;
    endpointEntry.cost += r.estimatedCostUsd ?? 0;
    endpointEntry.calls += 1;
  }

  return { totalTokens, totalCostUsd, callCount: records.length, byModel, byEndpoint };
}
