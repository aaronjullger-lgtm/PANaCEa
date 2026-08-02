/**
 * AI Gateway — Task contracts and shared types.
 *
 * Each task type (grading, tutoring, generation, extraction, enrichment)
 * gets its own request/response shape and Zod schema. Every call through
 * the gateway must declare its task; the gateway uses the task to pick
 * a model tier, a fallback chain, and an output validator.
 *
 * This file is the single source of truth for task semantics. Schemas
 * live in ./schemas/*.ts so they can be imported by callers and tests
 * without pulling in the full gateway.
 */

import type { ZodSchema } from 'zod';

// ─── Task types ────────────────────────────────────────────────────────────

export type GatewayTask =
  | 'grading' // Ghost Grader, SOAP grading, elaboration, OSCE grading
  | 'tutoring' // Socratic tutor, coaching chat, streaming dialogue
  | 'generation' // New question generation, content drafts, mnemonics
  | 'extraction' // Vision analysis, PDF extraction, clinical fact extraction
  | 'enrichment' // Condition/drug/guideline enrichment, summarization
  | 'embedding'; // text-embedding-005

// ─── Model tiers ───────────────────────────────────────────────────────────

/**
 * Abstract tier → concrete model resolved in aiGateway.ts based on task.
 * Callers specify a tier ("I need fast") rather than a model string
 * ("gemini-2.0-flash") so model upgrades happen in one place.
 */
export type ModelTier = 'fast' | 'balanced' | 'powerful' | 'audio' | 'embedding';

export type FallbackStrategy =
  | 'none' // No fallback; fail fast
  | 'same_provider' // Try next Gemini model in tier
  | 'cross_provider' // Try OpenAI / Anthropic / DeepSeek via LangChain
  | 'schema_repair_only'; // Don't fall back on failure, but do repair malformed JSON once

// ─── Request types ─────────────────────────────────────────────────────────

export interface GatewayRequestBase {
  /** Task type drives model selection, timeout, retry budget. */
  task: GatewayTask;
  /** Optional tier override; gateway has a default per task. */
  tier?: ModelTier;
  /** Explicit model override (discouraged; used for A/B and vision). */
  model?: string;
  /** System prompt (persona, rules, output format). */
  systemPrompt?: string;
  /** User prompt (what the model should actually do). */
  userPrompt: string;
  /** Temperature etc. — gateway has sensible defaults per task. */
  temperature?: number;
  maxOutputTokens?: number;
  thinkingBudget?: 'minimal' | 'low' | 'medium' | 'high';
  /**
   * Raw thinking-budget token count (Gemini 3 only). When set, takes precedence
   * over `thinkingBudget` enum. Use for fine-grained reasoning-effort control
   * in tutor/OSCE endpoints that expose a user-facing "Deep Think" toggle.
   */
  thinkingBudgetTokens?: number;
  /**
   * Optional multi-turn conversation history. When provided, the gateway builds
   * a multi-turn `contents` array (history + userPrompt) instead of the default
   * single-turn shape. Only the `user` and `model` roles are valid — map any
   * client-side "tutor"/"assistant" aliases before calling.
   *
   * `thoughtSignature` is a Gemini 3 feature: when a prior model turn returned
   * a signature, re-sending it on the next turn preserves the model's reasoning
   * thread. The gateway applies it as an extra part on the history turn (only
   * meaningful on `role: 'model'`); extra signatures on `role: 'user'` turns are
   * accepted for typing convenience but have no effect.
   */
  history?: Array<{ role: 'user' | 'model'; text: string; thoughtSignature?: string }>;
  /**
   * Thought signatures emitted by a prior model turn that the caller wants to
   * re-send on the current user turn. Gemini 3 uses these to preserve reasoning
   * across turns when the full `history` isn't available (e.g., streaming
   * endpoints that only round-trip signatures, not text). Applied as extra
   * parts on the outgoing user turn after the text part.
   */
  previousThoughtSignatures?: string[];
  /**
   * Gemini tools (e.g., `[{ googleSearch: {} }]` for grounded search, or
   * function-calling declarations). Opaque to the gateway — passed through as-is.
   * Callers are responsible for tool schema correctness.
   */
  tools?: Array<Record<string, unknown>>;
  /**
   * Pre-created cached content reference (`cachedContents/{id}`). Cache creation
   * itself is NOT part of the gateway — callers create/refresh caches via the
   * cachedContents helper and pass the resulting name through here.
   */
  cachedContent?: string;
  /** Endpoint/caller identifier for telemetry. */
  endpoint: string;
  /** Fallback strategy. Default depends on task. */
  fallback?: FallbackStrategy;
  /** Abort signal from the caller. */
  signal?: AbortSignal;
  /** Trace correlation: pass in an existing trace ID to link calls. */
  parentTraceId?: string;
  /** Enable Google Search grounding (Vertex AI) for clinical accuracy. */
  grounded?: boolean;
  /** Inline image parts for vision requests (optional on all modes for flexibility). */
  imageParts?: Array<{ mimeType: string; data: string }>;
}

export interface GatewayTextRequest extends GatewayRequestBase {
  mode: 'text';
}

export interface GatewayStructuredRequest<T> extends GatewayRequestBase {
  mode: 'structured';
  /** Zod schema the model output must validate against. */
  schema: ZodSchema<T>;
  /** Human-readable description of the schema, used in the repair prompt. */
  schemaDescription: string;
  /** Whether to attempt a single repair pass on schema failure. Default: true. */
  repairOnSchemaFailure?: boolean;
}

export interface GatewayStreamRequest extends GatewayRequestBase {
  mode: 'stream';
}

export interface GatewayVisionRequest<T = string>
  extends GatewayRequestBase {
  mode: 'vision' | 'vision-structured';
  /** Inline image data: { mimeType, base64 }. */
  images: Array<{ mimeType: string; data: string }>;
  schema?: ZodSchema<T>;
  schemaDescription?: string;
}

export type GatewayRequest<T = unknown> =
  | GatewayTextRequest
  | GatewayStructuredRequest<T>
  | GatewayStreamRequest
  | GatewayVisionRequest<T>;

// ─── Response types ────────────────────────────────────────────────────────

export interface GatewayUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface GatewayTelemetry {
  requestId: string;
  traceId: string;
  task: GatewayTask;
  modelUsed: string;
  provider: string;
  endpoint: string;
  latencyMs: number;
  latencyBucket:
    | 'under_100ms'
    | 'under_500ms'
    | 'under_1s'
    | 'under_3s'
    | 'under_10s'
    | 'under_30s'
    | 'over_30s';
  attempts: number;
  fallbackUsed: boolean;
  schemaRepairUsed: boolean;
  costUsd: number;
  costModelFound: boolean;
}

export interface GatewayTextResponse {
  mode: 'text';
  text: string;
  usage: GatewayUsage;
  telemetry: GatewayTelemetry;
  blocked: boolean;
  blockReason?: string;
  thinkingContent?: string;
  groundingMetadata?: unknown;
  /**
   * Raw provider response. Exposed so that tutor/OSCE endpoints can extract
   * Gemini-specific fields that don't have a first-class place on the response
   * (e.g. `candidates[0].content.parts[n].thoughtSignature` for Gemini 3
   * multi-turn reasoning preservation). New callers should prefer explicit
   * fields on GatewayTextResponse before reaching for `raw`.
   */
  raw?: unknown;
}

export interface GatewayStructuredResponse<T> {
  mode: 'structured';
  /** Validated, typed output. */
  data: T;
  /** Raw text for debugging / replay. */
  rawText: string;
  usage: GatewayUsage;
  telemetry: GatewayTelemetry;
}

export interface GatewayStreamResponse {
  mode: 'stream';
  /** Ready-to-return SSE Response for Cloudflare endpoint handlers. */
  response: Response;
  telemetry: Pick<GatewayTelemetry, 'requestId' | 'traceId' | 'modelUsed' | 'provider' | 'endpoint' | 'task'>;
}

export type GatewayResponse<T = string> =
  | GatewayTextResponse
  | GatewayStructuredResponse<T>
  | GatewayStreamResponse;

// ─── Error type ────────────────────────────────────────────────────────────

export type GatewayFailureCode =
  | 'MISSING_API_KEY'
  | 'RATE_LIMITED'
  | 'SERVER_ERROR'
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'TIMEOUT'
  | 'SCHEMA_INVALID_AFTER_REPAIR'
  | 'ALL_PROVIDERS_FAILED'
  | 'SAFETY_BLOCKED'
  | 'UNKNOWN';

export class GatewayError extends Error {
  readonly code: GatewayFailureCode;
  readonly retryable: boolean;
  readonly requestId: string;
  readonly traceId: string;
  readonly task: GatewayTask;
  readonly context?: Record<string, unknown>;

  constructor(args: {
    code: GatewayFailureCode;
    message: string;
    retryable: boolean;
    requestId: string;
    traceId: string;
    task: GatewayTask;
    context?: Record<string, unknown>;
  }) {
    super(args.message);
    this.name = 'GatewayError';
    this.code = args.code;
    this.retryable = args.retryable;
    this.requestId = args.requestId;
    this.traceId = args.traceId;
    this.task = args.task;
    this.context = args.context;
  }
}

// ─── Helper type: infer schema output ──────────────────────────────────────

export type InferSchema<S> = S extends ZodSchema<infer T> ? T : never;
