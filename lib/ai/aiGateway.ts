/**
 * AI Gateway — Unified entry point for every AI model call in PANaCEa.
 *
 * Every Gemini / OpenAI / Anthropic / DeepSeek call in the codebase MUST go
 * through this gateway. Direct use of GoogleGenerativeAI, raw fetch to
 * generativelanguage.googleapis.com, or ad-hoc JSON.parse on model output
 * is forbidden.
 *
 * Responsibilities:
 *   1. Task-based model tier selection (no hardcoded model strings in callers).
 *   2. Deterministic JSON parsing + Zod validation for every structured task.
 *   3. Exactly one schema-repair pass on JSON/schema failure before giving up.
 *   4. Retryable network-error fallback — same-provider tier bump or
 *      cross-provider routing via LangChain.
 *   5. Request IDs, trace IDs, cost estimation, and latency buckets on every
 *      response (success or failure).
 *   6. Process-local fallback-frequency counters for /api/admin observability.
 *
 * Architecture:
 *   The gateway delegates the raw model invocation to
 *   `functions/api/_shared/ai-service.ts` (callGemini, callAIMultiProvider,
 *   streamGemini) so existing token tracking and
 *   Cloudflare AI Gateway routing keep working during incremental migration.
 */

import {
  callGemini,
  callAIMultiProvider,
  streamGemini,
  GeminiModel,
  thinkingBudget as thinkingBudgetTokens,
  type GeminiModelId,
  type GeminiRequestOptions,
  type GeminiResponse,
  type GeminiContent,
} from '@/functions/api/_shared/ai-service';

import {
  bucketLatency,
  estimateCost,
  newRequestId,
  recordAttempt,
  recordFallback,
  recordPrimaryFailure,
  recordSchemaRepair,
  recordTotalFailure,
} from './telemetry';

import { parseStructured, buildRepairPrompt } from './jsonParser';



import {
  GatewayError,
  type FallbackStrategy,
  type GatewayFailureCode,
  type GatewayRequest,
  type GatewayRequestBase,
  type GatewayResponse,
  type GatewayStreamRequest,
  type GatewayStreamResponse,
  type GatewayStructuredRequest,
  type GatewayStructuredResponse,
  type GatewayTask,
  type GatewayTelemetry,
  type GatewayTextRequest,
  type GatewayTextResponse,
  type GatewayUsage,
  type GatewayVisionRequest,
  type ModelTier,
} from './contracts';

// ─── Context type ─────────────────────────────────────────────────────────

/**
 * Cloudflare Pages Function context shape the gateway expects. Mirrors the
 * internal AIServiceContext in ai-service.ts; re-declared here so callers
 * don't have to reach across files for the type.
 */
export interface GatewayContext {
  env: {
    GEMINI_API_KEY: string;
    DATABASE_URL?: string;
    [key: string]: unknown;
  };
  auth?: { userId?: string };
  waitUntil?: (p: Promise<unknown>) => void;
}

/**
 * Narrow a Cloudflare Pages Function `AuthenticatedContext` (or any compatible
 * shape) down to the fields the gateway actually uses. Preferred over the
 * `ctx as unknown as GatewayContext` cast that was used in early migrations —
 * this keeps the call-site type-safe and makes it impossible for gateway code
 * to accidentally reach into request/params internals.
 */
export function toGatewayContext(ctx: {
  env: unknown;
  auth?: { userId?: string } | null;
  waitUntil?: (p: Promise<unknown>) => void;
}): GatewayContext {
  return {
    env: ctx.env as GatewayContext['env'],
    auth: ctx.auth ? { userId: ctx.auth.userId } : undefined,
    waitUntil: ctx.waitUntil,
  };
}

// ─── Defaults keyed by task ───────────────────────────────────────────────

const TIER_TO_MODEL: Record<ModelTier, GeminiModelId> = {
  fast: GeminiModel.FLASH_2_0,
  balanced: GeminiModel.FLASH_2_5,
  powerful: GeminiModel.PRO_2_5,
  audio: GeminiModel.FLASH_AUDIO_PREVIEW,
  embedding: GeminiModel.EMBEDDING_005,
};

const TASK_DEFAULT_TIER: Record<GatewayTask, ModelTier> = {
  grading: 'balanced',
  tutoring: 'balanced',
  generation: 'powerful',
  extraction: 'balanced',
  enrichment: 'balanced',
  embedding: 'embedding',
};

const TASK_DEFAULT_FALLBACK: Record<GatewayTask, FallbackStrategy> = {
  grading: 'schema_repair_only',
  tutoring: 'same_provider',
  generation: 'same_provider',
  extraction: 'schema_repair_only',
  enrichment: 'same_provider',
  embedding: 'none',
};

const TASK_DEFAULT_TEMPERATURE: Record<GatewayTask, number> = {
  grading: 0.2,
  tutoring: 0.6,
  generation: 0.75,
  extraction: 0.2,
  enrichment: 0.4,
  embedding: 0,
};

const TASK_DEFAULT_MAX_OUTPUT_TOKENS: Record<GatewayTask, number> = {
  grading: 2048,
  tutoring: 2048,
  generation: 4096,
  extraction: 3072,
  enrichment: 3072,
  embedding: 1,
};

/**
 * Within-provider tier bump ladder used when FallbackStrategy = 'same_provider'.
 * Each tier maps to the next-hotter tier to try if the primary fails with a
 * retryable error.
 */
const TIER_BUMP_LADDER: Record<ModelTier, ModelTier | null> = {
  fast: 'balanced',
  balanced: 'powerful',
  powerful: null, // already the strongest text model
  audio: 'balanced',
  embedding: null,
};

// ─── Helpers ──────────────────────────────────────────────────────────────

function resolveModel(
  explicitModel: string | undefined,
  tier: ModelTier,
): GeminiModelId {
  if (explicitModel) return explicitModel;
  return TIER_TO_MODEL[tier];
}

/** Translate usage from Gemini shape to gateway shape. */
function normalizeUsage(raw: GeminiResponse['usage'] | undefined): GatewayUsage {
  const promptTokens = (raw as { promptTokenCount?: number })?.promptTokenCount ?? 0;
  const completionTokens =
    (raw as { candidatesTokenCount?: number })?.candidatesTokenCount ?? 0;
  const totalTokens =
    (raw as { totalTokenCount?: number })?.totalTokenCount ??
    promptTokens + completionTokens;
  return {
    inputTokens: promptTokens,
    outputTokens: completionTokens,
    totalTokens,
  };
}

/** Map a caught error from callGemini / callAIMultiProvider to a GatewayError. */
function toGatewayError(
  err: unknown,
  args: {
    requestId: string;
    traceId: string;
    task: GatewayTask;
    context?: Record<string, unknown>;
  },
): GatewayError {
  const e = err as {
    code?: string;
    status?: number;
    error?: string;
    message?: string;
    retryable?: boolean;
  };
  let code: GatewayFailureCode = 'UNKNOWN';
  if (e?.code === 'MISSING_KEY') code = 'MISSING_API_KEY';
  else if (e?.code === 'RATE_LIMITED') code = 'RATE_LIMITED';
  else if (e?.code === 'SERVER_ERROR') code = 'SERVER_ERROR';
  else if (e?.code === 'BAD_REQUEST') code = 'BAD_REQUEST';
  else if (e?.code === 'UNAUTHORIZED') code = 'UNAUTHORIZED';
  else if (e?.code === 'ALL_PROVIDERS_FAILED') code = 'ALL_PROVIDERS_FAILED';
  else if (e?.status === 408 || String(e?.message ?? '').includes('timeout'))
    code = 'TIMEOUT';

  return new GatewayError({
    code,
    message: e?.error ?? e?.message ?? 'Unknown model error',
    retryable: Boolean(e?.retryable),
    requestId: args.requestId,
    traceId: args.traceId,
    task: args.task,
    context: args.context,
  });
}

/** Build Gemini options for a non-streaming text/structured call. */
function buildGeminiOptions(args: {
  model: GeminiModelId;
  systemPrompt?: string;
  userPrompt: string;
  temperature: number;
  maxOutputTokens: number;
  thinkingBudget?: 'minimal' | 'low' | 'medium' | 'high';
  thinkingBudgetTokens?: number;
  history?: Array<{ role: 'user' | 'model'; text: string; thoughtSignature?: string }>;
  previousThoughtSignatures?: string[];
  tools?: Array<Record<string, unknown>>;
  cachedContent?: string;
  structured: boolean;
  endpoint: string;
  signal?: AbortSignal;
  imageParts?: Array<{ mimeType: string; data: string }>;
  grounded?: boolean;
}): GeminiRequestOptions {
  const contents: GeminiContent[] = [];

  // Prior turns (tutor chat, multi-turn OSCE) go in first. For Gemini 3
  // reasoning preservation, attach any thoughtSignature from a previous model
  // turn as an extra part alongside the text.
  if (args.history && args.history.length > 0) {
    for (const turn of args.history) {
      const parts: GeminiContent['parts'] = [{ text: turn.text }];
      if (turn.thoughtSignature && turn.role === 'model') {
        parts.push({ thoughtSignature: turn.thoughtSignature });
      }
      contents.push({ role: turn.role, parts });
    }
  }

  if (args.imageParts && args.imageParts.length > 0) {
    const parts: GeminiContent['parts'] = [
      { text: args.userPrompt },
      ...args.imageParts.map((img) => ({
        inlineData: { mimeType: img.mimeType, data: img.data },
      })),
    ];
    // Thought signatures from the previous model turn can also ride on the
    // current user turn (used by the streaming chat endpoint's signature
    // round-trip protocol).
    if (args.previousThoughtSignatures && args.previousThoughtSignatures.length > 0) {
      for (const sig of args.previousThoughtSignatures) {
        parts.push({ thoughtSignature: sig });
      }
    }
    contents.push({ role: 'user', parts });
  } else {
    const parts: GeminiContent['parts'] = [{ text: args.userPrompt }];
    if (args.previousThoughtSignatures && args.previousThoughtSignatures.length > 0) {
      for (const sig of args.previousThoughtSignatures) {
        parts.push({ thoughtSignature: sig });
      }
    }
    contents.push({ role: 'user', parts });
  }

  const generationConfig: GeminiRequestOptions['generationConfig'] = {
    temperature: args.temperature,
    maxOutputTokens: args.maxOutputTokens,
  };
  if (args.structured) {
    generationConfig.responseMimeType = 'application/json';
  }
  // Raw token budget takes precedence over the enum hint.
  if (typeof args.thinkingBudgetTokens === 'number') {
    generationConfig.thinkingConfig = {
      thinkingBudget: args.thinkingBudgetTokens,
    };
  } else if (args.thinkingBudget) {
    generationConfig.thinkingConfig = {
      thinkingBudget: thinkingBudgetTokens(args.thinkingBudget),
    };
  }

  const tools = args.grounded
    ? [...(args.tools ?? []), { googleSearch: {} }]
    : args.tools;

  return {
    model: args.model,
    systemInstruction: args.systemPrompt,
    contents,
    generationConfig,
    tools,
    cachedContent: args.cachedContent,
    endpoint: args.endpoint,
    signal: args.signal,
  };
}

/**
 * Single model invocation — returns the GeminiResponse plus the concrete
 * model/provider used, or throws a GatewayError.
 *
 * This is the only place in the gateway that touches ai-service.ts directly.
 */
async function invokeModel(
  context: GatewayContext,
  options: GeminiRequestOptions,
  strategy: FallbackStrategy,
  args: {
    task: GatewayTask;
    requestId: string;
    traceId: string;
  },
): Promise<{ response: GeminiResponse; modelUsed: string; provider: string }> {
  try {
    if (strategy === 'cross_provider') {
      const resp = await callAIMultiProvider(context, {
        ...options,
        langchainTask: inferLangChainTask(args.task),
        geminiiFallback: true,
      });
      const providerFromRaw =
        (resp.raw as { provider?: string })?.provider ?? 'gemini';
      const modelFromRaw =
        (resp.raw as { model?: string })?.model ?? String(options.model);
      return { response: resp, modelUsed: modelFromRaw, provider: providerFromRaw };
    }

    const resp = await callGemini(context, options);
    return { response: resp, modelUsed: String(options.model), provider: 'gemini' };
  } catch (err) {
    throw toGatewayError(err, {
      requestId: args.requestId,
      traceId: args.traceId,
      task: args.task,
      context: { model: options.model, endpoint: options.endpoint },
    });
  }
}

/** Pick a reasonable LangChain task label for cross-provider routing. */
function inferLangChainTask(task: GatewayTask): string {
  switch (task) {
    case 'tutoring':
      return 'osce-chat';
    case 'generation':
      return 'question-generation';
    case 'grading':
    case 'extraction':
    case 'enrichment':
      return 'clinical-reasoning';
    case 'embedding':
      return 'embedding';
    default:
      return 'content-generation';
  }
}

/** Build a telemetry record from a successful (or repaired) call. */
function buildTelemetry(args: {
  requestId: string;
  traceId: string;
  task: GatewayTask;
  modelUsed: string;
  provider: string;
  endpoint: string;
  startMs: number;
  attempts: number;
  fallbackUsed: boolean;
  schemaRepairUsed: boolean;
  usage: GatewayUsage;
}): GatewayTelemetry {
  const latencyMs = Date.now() - args.startMs;
  const cost = estimateCost(args.modelUsed, args.usage);
  return {
    requestId: args.requestId,
    traceId: args.traceId,
    task: args.task,
    modelUsed: args.modelUsed,
    provider: args.provider,
    endpoint: args.endpoint,
    latencyMs,
    latencyBucket: bucketLatency(latencyMs),
    attempts: args.attempts,
    fallbackUsed: args.fallbackUsed,
    schemaRepairUsed: args.schemaRepairUsed,
    costUsd: cost.totalUsd,
    costModelFound: cost.modelFound,
  };
}

type GatewayRequestForTrace = Pick<
  GatewayRequestBase,
  | 'task'
  | 'endpoint'
  | 'userPrompt'
  | 'systemPrompt'
  | 'temperature'
  | 'maxOutputTokens'
>;

function emitGatewayTrace(
  _context: GatewayContext,
  _request: GatewayRequestForTrace,
  _ids: { traceId: string; requestId: string; startMs: number },
  _outcome:
    | {
        kind: 'success';
        modelUsed: string;
        provider: string;
        usage: GatewayUsage;
        output?: string;
        attempts: number;
        fallbackUsed: boolean;
        schemaRepairUsed: boolean;
      }
    | {
        kind: 'failure';
        modelUsed: string;
        provider: string;
        error: string;
        errorCode?: string;
      },
): void {
  // Langfuse removed — LangSmith is the sole observability path.
}

// ─── Core execution ───────────────────────────────────────────────────────

/**
 * Execute a non-streaming (text or structured) call with fallback + repair.
 * Returns the raw Gemini-shaped response along with the bookkeeping counters.
 */
async function executeCore<T>(
  context: GatewayContext,
  args: {
    task: GatewayTask;
    tier: ModelTier;
    explicitModel?: string;
    systemPrompt?: string;
    userPrompt: string;
    temperature: number;
    maxOutputTokens: number;
    thinkingBudget?: 'minimal' | 'low' | 'medium' | 'high';
    thinkingBudgetTokens?: number;
    history?: Array<{ role: 'user' | 'model'; text: string; thoughtSignature?: string }>;
    previousThoughtSignatures?: string[];
    tools?: Array<Record<string, unknown>>;
    cachedContent?: string;
    structured: boolean;
    schema?: GatewayStructuredRequest<T>['schema'];
    schemaDescription?: string;
    repairOnSchemaFailure: boolean;
    strategy: FallbackStrategy;
    endpoint: string;
    signal?: AbortSignal;
    imageParts?: Array<{ mimeType: string; data: string }>;
    grounded?: boolean;
    requestId: string;
    traceId: string;
    startMs: number;
  },
): Promise<{
  response: GeminiResponse;
  validated?: T;
  modelUsed: string;
  provider: string;
  attempts: number;
  fallbackUsed: boolean;
  schemaRepairUsed: boolean;
}> {
  let currentTier = args.tier;
  let attempts = 0;
  let fallbackUsed = false;
  let schemaRepairUsed = false;
  let lastError: GatewayError | null = null;

  // ── Attempt 1: primary model ──
  while (true) {
    attempts += 1;
    const model = resolveModel(args.explicitModel, currentTier);
    const geminiOpts = buildGeminiOptions({
      model,
      systemPrompt: args.systemPrompt,
      userPrompt: args.userPrompt,
      temperature: args.temperature,
      maxOutputTokens: args.maxOutputTokens,
      thinkingBudget: args.thinkingBudget,
      thinkingBudgetTokens: args.thinkingBudgetTokens,
      history: args.history,
      previousThoughtSignatures: args.previousThoughtSignatures,
      tools: args.tools,
      cachedContent: args.cachedContent,
      structured: args.structured,
      endpoint: args.endpoint,
      signal: args.signal,
      imageParts: args.imageParts,
      grounded: args.grounded,
    });

    let invokeResult: Awaited<ReturnType<typeof invokeModel>>;
    try {
      invokeResult = await invokeModel(context, geminiOpts, args.strategy, {
        task: args.task,
        requestId: args.requestId,
        traceId: args.traceId,
      });
    } catch (err) {
      lastError = err as GatewayError;
      recordPrimaryFailure(args.task);

      const shouldNetworkFallback =
        args.strategy === 'same_provider' && lastError.retryable;
      const nextTier = shouldNetworkFallback ? TIER_BUMP_LADDER[currentTier] : null;

      if (shouldNetworkFallback && nextTier) {
        recordFallback(args.task);
        fallbackUsed = true;
        currentTier = nextTier;
        continue; // retry loop with bumped tier
      }

      if (args.strategy === 'cross_provider') {
        // callAIMultiProvider already handled multi-provider fallback internally;
        // if it threw, there's nothing left to try.
      }

      recordTotalFailure(args.task);
      throw lastError;
    }

    // Safety-blocked responses are an explicit failure; no retry.
    if (invokeResult.response.blocked) {
      recordTotalFailure(args.task);
      throw new GatewayError({
        code: 'SAFETY_BLOCKED',
        message: `Model refused request: ${invokeResult.response.blockReason ?? 'safety filter'}`,
        retryable: false,
        requestId: args.requestId,
        traceId: args.traceId,
        task: args.task,
        context: {
          modelUsed: invokeResult.modelUsed,
          blockReason: invokeResult.response.blockReason,
        },
      });
    }

    // ── Non-structured: return immediately ──
    if (!args.structured || !args.schema) {
      return {
        response: invokeResult.response,
        modelUsed: invokeResult.modelUsed,
        provider: invokeResult.provider,
        attempts,
        fallbackUsed,
        schemaRepairUsed,
      };
    }

    // ── Structured: parse + validate ──
    const parse = parseStructured<T>(invokeResult.response.text, args.schema);
    if (parse.ok === true) {
      return {
        response: invokeResult.response,
        validated: parse.data,
        modelUsed: invokeResult.modelUsed,
        provider: invokeResult.provider,
        attempts,
        fallbackUsed,
        schemaRepairUsed,
      };
    }

    // ── Schema failed: at most one repair pass ──
    if (!args.repairOnSchemaFailure || schemaRepairUsed) {
      recordTotalFailure(args.task);
      throw new GatewayError({
        code: 'SCHEMA_INVALID_AFTER_REPAIR',
        message: `Model output failed schema validation (${parse.stage}): ${parse.errorMessage}`,
        retryable: false,
        requestId: args.requestId,
        traceId: args.traceId,
        task: args.task,
        context: {
          modelUsed: invokeResult.modelUsed,
          stage: parse.stage,
          extractedJson: parse.extractedJson,
          zodIssues: parse.zodIssues,
        },
      });
    }

    // Build the repair prompt and retry ONCE at the same tier.
    schemaRepairUsed = true;
    recordSchemaRepair(args.task);
    args.userPrompt = buildRepairPrompt(
      args.userPrompt,
      parse,
      args.schemaDescription ?? '(schema description not provided)',
    );
    attempts += 1;

    const repairOpts = buildGeminiOptions({
      model,
      systemPrompt: args.systemPrompt,
      userPrompt: args.userPrompt,
      temperature: Math.min(args.temperature, 0.2), // dampen for repair
      maxOutputTokens: args.maxOutputTokens,
      thinkingBudget: args.thinkingBudget,
      thinkingBudgetTokens: args.thinkingBudgetTokens,
      // Deliberately omit history/tools/cachedContent on repair — repair is a
      // surgical "just return valid JSON" nudge; reintroducing tools would
      // re-ground on web content the model already saw in attempt 1.
      structured: true,
      endpoint: args.endpoint,
      signal: args.signal,
      imageParts: args.imageParts,
    });

    let repaired: Awaited<ReturnType<typeof invokeModel>>;
    try {
      repaired = await invokeModel(context, repairOpts, 'none', {
        task: args.task,
        requestId: args.requestId,
        traceId: args.traceId,
      });
    } catch (err) {
      recordTotalFailure(args.task);
      throw err;
    }

    const reparse = parseStructured<T>(repaired.response.text, args.schema);
      if (reparse.ok === true) {
      return {
        response: repaired.response,
        validated: reparse.data,
        modelUsed: repaired.modelUsed,
        provider: repaired.provider,
        attempts,
        fallbackUsed,
        schemaRepairUsed: true,
      };
    }

    recordTotalFailure(args.task);
    throw new GatewayError({
      code: 'SCHEMA_INVALID_AFTER_REPAIR',
      message: `Schema still invalid after repair pass (${reparse.stage}): ${reparse.errorMessage}`,
      retryable: false,
      requestId: args.requestId,
      traceId: args.traceId,
      task: args.task,
      context: {
        modelUsed: repaired.modelUsed,
        stage: reparse.stage,
        zodIssues: reparse.zodIssues,
      },
    });
  }
}

// ─── Public API ───────────────────────────────────────────────────────────

async function callText(
  context: GatewayContext,
  request: GatewayTextRequest,
): Promise<GatewayTextResponse> {
  const requestId = newRequestId();
  const traceId = request.parentTraceId ?? requestId;
  const startMs = Date.now();
  const tier = request.tier ?? TASK_DEFAULT_TIER[request.task];
  const strategy = request.fallback ?? TASK_DEFAULT_FALLBACK[request.task];

  recordAttempt(request.task);

  let result;
  try {
    result = await executeCore<string>(context, {
      task: request.task,
      tier,
      explicitModel: request.model,
      systemPrompt: request.systemPrompt,
      userPrompt: request.userPrompt,
      temperature: request.temperature ?? TASK_DEFAULT_TEMPERATURE[request.task],
      maxOutputTokens:
        request.maxOutputTokens ?? TASK_DEFAULT_MAX_OUTPUT_TOKENS[request.task],
      thinkingBudget: request.thinkingBudget,
      thinkingBudgetTokens: request.thinkingBudgetTokens,
      history: request.history,
      previousThoughtSignatures: request.previousThoughtSignatures,
      tools: request.tools,
      cachedContent: request.cachedContent,
      structured: false,
      repairOnSchemaFailure: false,
      strategy,
      endpoint: request.endpoint,
      signal: request.signal,
      grounded: request.grounded,
      imageParts: request.imageParts,
      requestId,
      traceId,
      startMs,
    });
  } catch (err) {
    emitGatewayTrace(
      context,
      request,
      { traceId, requestId, startMs },
      {
        kind: 'failure',
        modelUsed: resolveModel(request.model, tier),
        provider: 'gemini',
        error: err instanceof Error ? err.message : String(err),
        errorCode: err instanceof GatewayError ? err.code : undefined,
      },
    );
    throw err;
  }

  const usage = normalizeUsage(result.response.usage);
  emitGatewayTrace(
    context,
    request,
    { traceId, requestId, startMs },
    {
      kind: 'success',
      modelUsed: result.modelUsed,
      provider: result.provider,
      usage,
      output: result.response.text ?? undefined,
      attempts: result.attempts,
      fallbackUsed: result.fallbackUsed,
      schemaRepairUsed: result.schemaRepairUsed,
    },
  );
  return {
    mode: 'text',
    text: result.response.text,
    usage,
    blocked: result.response.blocked,
    blockReason: result.response.blockReason,
    thinkingContent: result.response.thinkingContent,
    groundingMetadata: result.response.groundingMetadata,
    raw: result.response.raw,
    telemetry: buildTelemetry({
      requestId,
      traceId,
      task: request.task,
      modelUsed: result.modelUsed,
      provider: result.provider,
      endpoint: request.endpoint,
      startMs,
      attempts: result.attempts,
      fallbackUsed: result.fallbackUsed,
      schemaRepairUsed: result.schemaRepairUsed,
      usage,
    }),
  };
}

async function callStructured<T>(
  context: GatewayContext,
  request: GatewayStructuredRequest<T>,
): Promise<GatewayStructuredResponse<T>> {
  const requestId = newRequestId();
  const traceId = request.parentTraceId ?? requestId;
  const startMs = Date.now();
  const tier = request.tier ?? TASK_DEFAULT_TIER[request.task];
  const strategy = request.fallback ?? TASK_DEFAULT_FALLBACK[request.task];

  recordAttempt(request.task);

  let result;
  try {
    result = await executeCore<T>(context, {
      task: request.task,
      tier,
      explicitModel: request.model,
      systemPrompt: request.systemPrompt,
      userPrompt: request.userPrompt,
      temperature: request.temperature ?? TASK_DEFAULT_TEMPERATURE[request.task],
      maxOutputTokens:
        request.maxOutputTokens ?? TASK_DEFAULT_MAX_OUTPUT_TOKENS[request.task],
      thinkingBudget: request.thinkingBudget,
      thinkingBudgetTokens: request.thinkingBudgetTokens,
      history: request.history,
      previousThoughtSignatures: request.previousThoughtSignatures,
      tools: request.tools,
      cachedContent: request.cachedContent,
      structured: true,
      schema: request.schema,
      schemaDescription: request.schemaDescription,
      repairOnSchemaFailure: request.repairOnSchemaFailure ?? true,
      strategy,
      endpoint: request.endpoint,
      signal: request.signal,
      grounded: request.grounded,
      imageParts: request.imageParts,
      requestId,
      traceId,
      startMs,
    });
  } catch (err) {
    emitGatewayTrace(
      context,
      request,
      { traceId, requestId, startMs },
      {
        kind: 'failure',
        modelUsed: resolveModel(request.model, tier),
        provider: 'gemini',
        error: err instanceof Error ? err.message : String(err),
        errorCode: err instanceof GatewayError ? err.code : undefined,
      },
    );
    throw err;
  }

  if (result.validated === undefined) {
    // Should be unreachable: executeCore throws on structured failure.
    throw new GatewayError({
      code: 'UNKNOWN',
      message: 'Structured call returned without validated data',
      retryable: false,
      requestId,
      traceId,
      task: request.task,
    });
  }

  const usage = normalizeUsage(result.response.usage);
  emitGatewayTrace(
    context,
    request,
    { traceId, requestId, startMs },
    {
      kind: 'success',
      modelUsed: result.modelUsed,
      provider: result.provider,
      usage,
      output: result.response.text ?? undefined,
      attempts: result.attempts,
      fallbackUsed: result.fallbackUsed,
      schemaRepairUsed: result.schemaRepairUsed,
    },
  );
  return {
    mode: 'structured',
    data: result.validated,
    rawText: result.response.text,
    usage,
    telemetry: buildTelemetry({
      requestId,
      traceId,
      task: request.task,
      modelUsed: result.modelUsed,
      provider: result.provider,
      endpoint: request.endpoint,
      startMs,
      attempts: result.attempts,
      fallbackUsed: result.fallbackUsed,
      schemaRepairUsed: result.schemaRepairUsed,
      usage,
    }),
  };
}

async function callVision<T>(
  context: GatewayContext,
  request: GatewayVisionRequest<T>,
): Promise<GatewayTextResponse | GatewayStructuredResponse<T>> {
  const requestId = newRequestId();
  const traceId = request.parentTraceId ?? requestId;
  const startMs = Date.now();
  // Vision defaults to balanced for cost; caller may bump via tier/model.
  const tier = request.tier ?? 'balanced';
  const strategy = request.fallback ?? 'schema_repair_only';

  recordAttempt(request.task);

  const structured = request.mode === 'vision-structured' && !!request.schema;

  let result;
  try {
    result = await executeCore<T>(context, {
      task: request.task,
      tier,
      explicitModel: request.model,
      systemPrompt: request.systemPrompt,
      userPrompt: request.userPrompt,
      temperature: request.temperature ?? TASK_DEFAULT_TEMPERATURE[request.task],
      maxOutputTokens:
        request.maxOutputTokens ?? TASK_DEFAULT_MAX_OUTPUT_TOKENS[request.task],
      thinkingBudget: request.thinkingBudget,
      thinkingBudgetTokens: request.thinkingBudgetTokens,
      history: request.history,
      previousThoughtSignatures: request.previousThoughtSignatures,
      tools: request.tools,
      cachedContent: request.cachedContent,
      structured,
      schema: request.schema,
      schemaDescription: request.schemaDescription,
      repairOnSchemaFailure: structured,
      strategy,
      endpoint: request.endpoint,
      signal: request.signal,
      imageParts: request.images,
      requestId,
      traceId,
      startMs,
    });
  } catch (err) {
    emitGatewayTrace(
      context,
      request,
      { traceId, requestId, startMs },
      {
        kind: 'failure',
        modelUsed: resolveModel(request.model, tier),
        provider: 'gemini',
        error: err instanceof Error ? err.message : String(err),
        errorCode: err instanceof GatewayError ? err.code : undefined,
      },
    );
    throw err;
  }

  const usage = normalizeUsage(result.response.usage);
  emitGatewayTrace(
    context,
    request,
    { traceId, requestId, startMs },
    {
      kind: 'success',
      modelUsed: result.modelUsed,
      provider: result.provider,
      usage,
      output: result.response.text ?? undefined,
      attempts: result.attempts,
      fallbackUsed: result.fallbackUsed,
      schemaRepairUsed: result.schemaRepairUsed,
    },
  );
  const telemetry = buildTelemetry({
    requestId,
    traceId,
    task: request.task,
    modelUsed: result.modelUsed,
    provider: result.provider,
    endpoint: request.endpoint,
    startMs,
    attempts: result.attempts,
    fallbackUsed: result.fallbackUsed,
    schemaRepairUsed: result.schemaRepairUsed,
    usage,
  });

  if (structured && result.validated !== undefined) {
    return {
      mode: 'structured',
      data: result.validated,
      rawText: result.response.text,
      usage,
      telemetry,
    };
  }

  return {
    mode: 'text',
    text: result.response.text,
    usage,
    blocked: result.response.blocked,
    blockReason: result.response.blockReason,
    telemetry,
  };
}

async function callStream(
  context: GatewayContext,
  request: GatewayStreamRequest,
): Promise<GatewayStreamResponse> {
  const requestId = newRequestId();
  const traceId = request.parentTraceId ?? requestId;
  const tier = request.tier ?? TASK_DEFAULT_TIER[request.task];
  const model = resolveModel(request.model, tier);

  recordAttempt(request.task);

  const geminiOpts = buildGeminiOptions({
    model,
    systemPrompt: request.systemPrompt,
    userPrompt: request.userPrompt,
    temperature: request.temperature ?? TASK_DEFAULT_TEMPERATURE[request.task],
    maxOutputTokens:
      request.maxOutputTokens ?? TASK_DEFAULT_MAX_OUTPUT_TOKENS[request.task],
    thinkingBudget: request.thinkingBudget,
    thinkingBudgetTokens: request.thinkingBudgetTokens,
    history: request.history,
    previousThoughtSignatures: request.previousThoughtSignatures,
    tools: request.tools,
    cachedContent: request.cachedContent,
    structured: false,
    endpoint: request.endpoint,
    signal: request.signal,
  });

  let response: Response;
  try {
    response = await streamGemini(context, geminiOpts);
  } catch (err) {
    recordTotalFailure(request.task);
    const gwErr = toGatewayError(err, {
      requestId,
      traceId,
      task: request.task,
      context: { model, endpoint: request.endpoint },
    });
    emitGatewayTrace(
      context,
      request,
      { traceId, requestId, startMs: Date.now() },
      {
        kind: 'failure',
        modelUsed: String(model),
        provider: 'gemini',
        error: gwErr.message,
        errorCode: gwErr.code,
      },
    );
    throw gwErr;
  }

  // Streaming traces emit input only; capturing stream output requires a
  // TransformStream tap and is tracked as a fast-follow.
  emitGatewayTrace(
    context,
    request,
    { traceId, requestId, startMs: Date.now() },
    {
      kind: 'success',
      modelUsed: String(model),
      provider: 'gemini',
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      attempts: 1,
      fallbackUsed: false,
      schemaRepairUsed: false,
    },
  );

  return {
    mode: 'stream',
    response,
    telemetry: {
      requestId,
      traceId,
      task: request.task,
      modelUsed: String(model),
      provider: 'gemini',
      endpoint: request.endpoint,
    },
  };
}

/**
 * Main dispatch — delegates to the mode-specific executor. Callers that
 * don't care about sugar can use this; convenience methods wrap it.
 */
async function call<T = string>(
  context: GatewayContext,
  request: GatewayRequest<T>,
): Promise<GatewayResponse<T>> {
  switch (request.mode) {
    case 'text':
      return callText(context, request) as Promise<GatewayResponse<T>>;
    case 'structured':
      return callStructured<T>(context, request);
    case 'stream':
      return callStream(context, request) as Promise<GatewayResponse<T>>;
    case 'vision':
    case 'vision-structured':
      return callVision<T>(context, request) as Promise<GatewayResponse<T>>;
    default: {
      // Exhaustiveness check
      const _never: never = request;
      throw new Error(`Unknown gateway mode: ${String(_never)}`);
    }
  }
}

// ─── Task-specific sugar ──────────────────────────────────────────────────

type TaskConvenienceArgs<T> = Omit<
  GatewayStructuredRequest<T>,
  'mode' | 'task'
>;

type TextConvenienceArgs = Omit<GatewayTextRequest, 'mode' | 'task'>;

type StreamConvenienceArgs = Omit<GatewayStreamRequest, 'mode' | 'task'>;

async function grade<T>(
  context: GatewayContext,
  args: TaskConvenienceArgs<T>,
): Promise<GatewayStructuredResponse<T>> {
  return callStructured<T>(context, { ...args, mode: 'structured', task: 'grading' });
}

async function tutor(
  context: GatewayContext,
  args: TextConvenienceArgs,
): Promise<GatewayTextResponse> {
  return callText(context, { ...args, mode: 'text', task: 'tutoring' });
}

async function tutorStructured<T>(
  context: GatewayContext,
  args: TaskConvenienceArgs<T>,
): Promise<GatewayStructuredResponse<T>> {
  return callStructured<T>(context, { ...args, mode: 'structured', task: 'tutoring' });
}

async function generate<T>(
  context: GatewayContext,
  args: TaskConvenienceArgs<T>,
): Promise<GatewayStructuredResponse<T>> {
  return callStructured<T>(context, { ...args, mode: 'structured', task: 'generation' });
}

async function extract<T>(
  context: GatewayContext,
  args: TaskConvenienceArgs<T>,
): Promise<GatewayStructuredResponse<T>> {
  return callStructured<T>(context, { ...args, mode: 'structured', task: 'extraction' });
}

async function enrich<T>(
  context: GatewayContext,
  args: TaskConvenienceArgs<T>,
): Promise<GatewayStructuredResponse<T>> {
  return callStructured<T>(context, { ...args, mode: 'structured', task: 'enrichment' });
}

async function stream(
  context: GatewayContext,
  args: StreamConvenienceArgs & { task?: GatewayTask },
): Promise<GatewayStreamResponse> {
  return callStream(context, {
    ...args,
    mode: 'stream',
    task: args.task ?? 'tutoring',
  });
}

// ─── Exported gateway object ──────────────────────────────────────────────

export const gateway = {
  /** Low-level: dispatch on mode. Prefer the task-specific methods below. */
  call,
  /** Structured clinical/SOAP/OSCE/elaboration grading. */
  grade,
  /** Streaming-or-text Socratic tutor / coaching turn. */
  tutor,
  /** Structured Socratic tutor turn (when forcing one question at a time). */
  tutorStructured,
  /** New question, mnemonic, or content draft generation. */
  generate,
  /** Vision/PDF/clinical-fact extraction into a Zod schema. */
  extract,
  /** Condition/drug/guideline enrichment. */
  enrich,
  /** Streaming dialogue (SSE Response for CF edge endpoints). */
  stream,
  /** Low-level structured call (when the task needs a non-default tier). */
  callStructured,
  /** Low-level text call. */
  callText,
  /** Low-level vision call. */
  callVision,
} as const;

export type Gateway = typeof gateway;

// Re-export for convenience so callers can import types from one place.
export type {
  GatewayTask,
  ModelTier,
  FallbackStrategy,
  GatewayRequest,
  GatewayResponse,
  GatewayTextResponse,
  GatewayStructuredResponse,
  GatewayStreamResponse,
  GatewayTelemetry,
  GatewayUsage,
} from './contracts';
export { GatewayError } from './contracts';
