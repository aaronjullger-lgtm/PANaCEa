/**
 * Unified AI Service Layer
 *
 * Centralizes Gemini API client creation, model routing, response parsing,
 * and error handling for all PANaCEa AI endpoints. Created as part of
 * Phase 1 foundation sprint to reduce duplication across ai/, gemini/,
 * intelligence/, vision/, osce/, and clinical-eye/ directories.
 *
 * Usage:
 *   import { callGemini, streamGemini, GeminiModel } from '../_shared/ai-service';
 *
 *   // Simple generation
 *   const result = await callGemini(context, {
 *     model: GeminiModel.FLASH_2_0,
 *     systemInstruction: 'You are a medical education assistant.',
 *     prompt: 'Generate a mnemonic for...',
 *     generationConfig: { temperature: 0.7, maxOutputTokens: 512 },
 *     endpoint: '/api/ai/generate-mnemonic',
 *   });
 *
 *   // Streaming
 *   return streamGemini(context, { ... });
 *
 * @module functions/api/_shared/ai-service
 */

import { trackTokenUsage, type TokenUsageMetadata } from './tokenTracking';
import { routeTask, type RouteOptions, type RouteResult } from '@/lib/langchain/router';
import { fromCloudflareEnv } from '@/lib/langchain/envAdapter';
import { configureLangSmithEnv } from '@/lib/langchain/tracing';
import type { TaskType } from '@/lib/langchain/config';

// ─── Constants ──────────────────────────────────────────────────────────────

export const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com';
export const GEMINI_API_VERSION = 'v1beta';

/**
 * Canonical model identifiers. Use these instead of hardcoded strings
 * to ensure consistent model selection across all endpoints.
 *
 * Update this enum when new models are available or old ones are deprecated.
 */
export const GeminiModel = {
  /** Fast, cost-effective. Best for: mnemonics, simple generation, media analysis. */
  FLASH_2_0: 'gemini-2.0-flash',
  /** Advanced reasoning + thinking. Best for: tutoring, Socratic remediation, complex analysis. */
  FLASH_2_5: 'gemini-2.5-flash',
  /** Highest quality. Best for: OSCE grading, enhanced question generation, clinical review. */
  PRO_2_5: 'gemini-2.5-pro',
  /** Native audio support. Best for: live OSCE simulation. */
  FLASH_AUDIO_PREVIEW: 'gemini-2.5-flash-native-audio-preview-12-2025',
  /** Text embeddings. Best for: semantic search, content deduplication. */
  EMBEDDING_005: 'text-embedding-005',
} as const;

export type GeminiModelId = (typeof GeminiModel)[keyof typeof GeminiModel] | string;

// ─── Types ──────────────────────────────────────────────────────────────────

export interface GeminiContent {
  role: 'user' | 'model';
  parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>;
}

export interface GeminiGenerationConfig {
  temperature?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
  responseMimeType?: string;
  responseSchema?: Record<string, unknown>;
  thinkingConfig?: {
    thinkingBudget?: number;
  };
}

export interface GeminiRequestOptions {
  /** Which model to use. Defaults to FLASH_2_5 */
  model?: GeminiModelId;
  /** System instruction text */
  systemInstruction?: string;
  /** User prompt (for single-turn). Mutually exclusive with `contents`. */
  prompt?: string;
  /** Multi-turn conversation history. Mutually exclusive with `prompt`. */
  contents?: GeminiContent[];
  /** Generation configuration (temperature, maxOutputTokens, etc.) */
  generationConfig?: GeminiGenerationConfig;
  /** Optional tools (e.g., Google Search grounding) */
  tools?: Array<Record<string, unknown>>;
  /** Optional tool configuration */
  toolConfig?: Record<string, unknown>;
  /** Pre-created cached content reference */
  cachedContent?: string;
  /** Endpoint name for token tracking (e.g., '/api/ai/tutor/chat') */
  endpoint?: string;
  /** Abort signal for request cancellation */
  signal?: AbortSignal;
}

export interface GeminiResponse {
  /** Parsed text from the first candidate */
  text: string;
  /** Raw Gemini API response data */
  raw: any;
  /** Token usage metadata */
  usage: TokenUsageMetadata;
  /** Whether the response was blocked by safety filters */
  blocked: boolean;
  /** Block reason if applicable */
  blockReason?: string;
  /** Grounding metadata (when Google Search is used) */
  groundingMetadata?: any;
  /** Thinking content from extended thinking models */
  thinkingContent?: string;
}

export interface GeminiError {
  status: number;
  error: string;
  code?: string;
  retryable: boolean;
}

// ─── Context Type ───────────────────────────────────────────────────────────

interface AIServiceContext {
  env: {
    GEMINI_API_KEY: string;
    DATABASE_URL?: string;
    [key: string]: any;
  };
  auth?: { userId?: string };
  waitUntil?: (p: Promise<any>) => void;
}

// ─── Core Functions ─────────────────────────────────────────────────────────

/**
 * Build the full Gemini API URL for a given model and action.
 */
export function buildGeminiUrl(
  apiKey: string,
  model: string,
  action: 'generateContent' | 'streamGenerateContent' | 'embedContent' = 'generateContent'
): string {
  return `${GEMINI_BASE_URL}/${GEMINI_API_VERSION}/models/${model}:${action}?key=${apiKey}`;
}

/**
 * Build the request body for a Gemini API call.
 */
function buildRequestBody(options: GeminiRequestOptions): Record<string, unknown> {
  const body: Record<string, unknown> = {};

  // System instruction
  if (options.systemInstruction) {
    body.systemInstruction = {
      parts: [{ text: options.systemInstruction }],
    };
  }

  // Contents: either from prompt (single-turn) or explicit contents (multi-turn)
  if (options.prompt) {
    body.contents = [{ role: 'user', parts: [{ text: options.prompt }] }];
  } else if (options.contents) {
    body.contents = options.contents;
  }

  // Generation config
  if (options.generationConfig) {
    body.generationConfig = options.generationConfig;
  }

  // Tools (Google Search, code execution, etc.)
  if (options.tools) {
    body.tools = options.tools;
  }

  // Tool config
  if (options.toolConfig) {
    body.toolConfig = options.toolConfig;
  }

  // Cached content reference
  if (options.cachedContent) {
    body.cachedContent = options.cachedContent;
  }

  return body;
}

/**
 * Parse a Gemini API response into a structured GeminiResponse.
 */
function parseGeminiResponse(data: any): GeminiResponse {
  // Check for content safety blocks
  const blockReason = data.promptFeedback?.blockReason;
  if (blockReason) {
    return {
      text: '',
      raw: data,
      usage: data.usageMetadata ?? {},
      blocked: true,
      blockReason,
    };
  }

  const candidate = data.candidates?.[0];
  if (!candidate) {
    return {
      text: '',
      raw: data,
      usage: data.usageMetadata ?? {},
      blocked: false,
    };
  }

  // Extract text from parts, handling thinking content separately
  let text = '';
  let thinkingContent = '';
  const parts = candidate.content?.parts ?? [];

  for (const part of parts) {
    if (part.thought) {
      thinkingContent += part.text ?? '';
    } else if (part.text) {
      text += part.text;
    }
  }

  return {
    text,
    raw: data,
    usage: data.usageMetadata ?? {},
    blocked: false,
    groundingMetadata: candidate.groundingMetadata,
    thinkingContent: thinkingContent || undefined,
  };
}

/**
 * Classify a Gemini API error into a structured GeminiError.
 */
function classifyError(status: number, body: any): GeminiError {
  const message =
    body?.error?.message ?? body?.error ?? `Gemini API returned HTTP ${status}`;

  if (status === 429) {
    return { status: 429, error: 'Rate limited by Gemini API. Please try again shortly.', code: 'RATE_LIMITED', retryable: true };
  }
  if (status === 503 || status === 500) {
    return { status, error: message, code: 'SERVER_ERROR', retryable: true };
  }
  if (status === 400) {
    return { status: 400, error: message, code: 'BAD_REQUEST', retryable: false };
  }
  if (status === 403) {
    return { status: 403, error: 'Gemini API key unauthorized.', code: 'UNAUTHORIZED', retryable: false };
  }

  return { status, error: message, code: 'UNKNOWN', retryable: false };
}

/**
 * Call the Gemini API and return a parsed response.
 *
 * Handles: URL construction, request building, error classification,
 * response parsing, and automatic token tracking.
 *
 * @throws {GeminiError} When the API returns a non-200 status
 */
export async function callGemini(
  context: AIServiceContext,
  options: GeminiRequestOptions
): Promise<GeminiResponse> {
  const model = options.model ?? GeminiModel.FLASH_2_5;
  const apiKey = context.env.GEMINI_API_KEY;
  const startMs = Date.now();

  if (!apiKey) {
    throw { status: 500, error: 'GEMINI_API_KEY not configured', code: 'MISSING_KEY', retryable: false } satisfies GeminiError;
  }

  const url = buildGeminiUrl(apiKey, model);
  const body = buildRequestBody(options);

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: options.signal,
  });

  const latencyMs = Date.now() - startMs;

  if (!response.ok) {
    let errorBody: any;
    try {
      errorBody = await response.json();
    } catch {
      errorBody = { error: `HTTP ${response.status}` };
    }

    // Track failed call
    trackTokenUsage(context, {
      endpoint: options.endpoint ?? 'unknown',
      model,
      usage: null,
      latencyMs,
      statusCode: response.status,
      cacheHit: false,
    });

    throw classifyError(response.status, errorBody);
  }

  const data = await response.json();
  const result = parseGeminiResponse(data);

  // Track successful call
  trackTokenUsage(context, {
    endpoint: options.endpoint ?? 'unknown',
    model,
    usage: result.usage,
    latencyMs,
    statusCode: 200,
    cacheHit: false,
  });

  return result;
}

/**
 * Call Gemini with streaming (Server-Sent Events).
 *
 * Returns a Response object with an SSE stream that can be returned
 * directly from an endpoint handler.
 */
export async function streamGemini(
  context: AIServiceContext,
  options: GeminiRequestOptions
): Promise<Response> {
  const model = options.model ?? GeminiModel.FLASH_2_5;
  const apiKey = context.env.GEMINI_API_KEY;

  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'GEMINI_API_KEY not configured' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const url = buildGeminiUrl(apiKey, model, 'streamGenerateContent') + '&alt=sse';
  const body = buildRequestBody(options);

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: options.signal,
  });

  if (!response.ok || !response.body) {
    const errorText = await response.text();
    return new Response(
      JSON.stringify({ error: `Gemini streaming error: ${response.status}`, details: errorText }),
      { status: response.status, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Pipe the SSE stream through
  return new Response(response.body, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

// ─── Model Routing Helpers ──────────────────────────────────────────────────

export type AITaskType =
  | 'mnemonic'
  | 'tutor'
  | 'socratic'
  | 'session-analysis'
  | 'question-generation'
  | 'osce-grading'
  | 'vision-analysis'
  | 'embedding'
  | 'general';

/**
 * Select the appropriate model for a given task type.
 * Centralizes model routing decisions so they can be tuned in one place.
 */
export function selectModel(task: AITaskType): GeminiModelId {
  switch (task) {
    case 'mnemonic':
      return GeminiModel.FLASH_2_0;
    case 'tutor':
    case 'socratic':
    case 'session-analysis':
    case 'vision-analysis':
      return GeminiModel.FLASH_2_5;
    case 'question-generation':
    case 'osce-grading':
      return GeminiModel.PRO_2_5;
    case 'embedding':
      return GeminiModel.EMBEDDING_005;
    case 'general':
    default:
      return GeminiModel.FLASH_2_5;
  }
}

/**
 * Check if a model supports extended thinking features.
 */
export function supportsThinking(model: GeminiModelId): boolean {
  return model.includes('2.5') || model.includes('3');
}

/**
 * Map a thinking level string to a token budget for thinkingConfig.
 */
export function thinkingBudget(level: 'minimal' | 'low' | 'medium' | 'high'): number {
  switch (level) {
    case 'minimal':
      return 2048;
    case 'low':
      return 4096;
    case 'medium':
      return 8192;
    case 'high':
      return 24576;
  }
}

// ─── Multi-Provider Bridge ────────────────────────────────────────────────

/**
 * Map an AITaskType (used by existing endpoints) to a LangChain TaskType.
 */
function mapToLangChainTask(task: AITaskType): TaskType | string {
  switch (task) {
    case 'mnemonic':
    case 'general':
      return 'content-generation';
    case 'tutor':
    case 'socratic':
      return 'osce-chat'; // conversational tasks
    case 'session-analysis':
    case 'vision-analysis':
      return 'clinical-reasoning';
    case 'question-generation':
      return 'question-generation';
    case 'osce-grading':
      return 'clinical-reasoning';
    default:
      return 'content-generation';
  }
}

export interface MultiProviderOptions extends GeminiRequestOptions {
  /** Task type for LangChain model routing. If omitted, inferred from the Gemini model. */
  langchainTask?: AITaskType | string;
  /** If true, fall back to callGemini when LangChain fails (default: true) */
  geminiiFallback?: boolean;
}

/**
 * Call AI with multi-provider fallback via LangChain router.
 *
 * Drop-in enhancement over callGemini: same GeminiRequestOptions input,
 * same GeminiResponse output shape. Uses LangChain router for multi-provider
 * failover (Gemini → OpenAI → Anthropic → DeepSeek), then falls back to
 * direct Gemini if LangChain routing fails entirely.
 *
 * Migration: Replace `callGemini(context, opts)` with
 * `callAIMultiProvider(context, { ...opts, langchainTask: 'content-generation' })`
 *
 * @example
 * ```ts
 * const result = await callAIMultiProvider(context, {
 *   langchainTask: 'content-generation',
 *   systemInstruction: 'You are a medical education assistant.',
 *   prompt: 'Generate a mnemonic for CHF...',
 *   generationConfig: { temperature: 0.7, maxOutputTokens: 512 },
 *   endpoint: '/api/ai/generate-mnemonic',
 * });
 * ```
 */
export async function callAIMultiProvider(
  context: AIServiceContext,
  options: MultiProviderOptions
): Promise<GeminiResponse> {
  const startMs = Date.now();
  const model = options.model ?? GeminiModel.FLASH_2_5;
  const shouldFallback = options.geminiiFallback !== false;

  // Determine LangChain task type
  const task: string = options.langchainTask
    ? (typeof options.langchainTask === 'string'
        ? options.langchainTask
        : mapToLangChainTask(options.langchainTask as AITaskType))
    : 'content-generation';

  try {
    // Extract AI keys from Cloudflare env
    const aiEnv = fromCloudflareEnv(context.env);

    // Configure LangSmith tracing if available
    configureLangSmithEnv(context.env as Record<string, string | undefined>);

    // Build user prompt from either prompt or contents
    let userPrompt = '';
    if (options.prompt) {
      userPrompt = options.prompt;
    } else if (options.contents) {
      userPrompt = options.contents
        .filter((c) => c.role === 'user')
        .flatMap((c) => c.parts.filter((p) => p.text).map((p) => p.text!))
        .join('\n\n');
    }

    if (!userPrompt) {
      // No prompt extractable — fall through to direct Gemini
      if (shouldFallback) return callGemini(context, options);
      throw { status: 400, error: 'No prompt provided', code: 'BAD_REQUEST', retryable: false } satisfies GeminiError;
    }

    const routeOpts: RouteOptions = {
      temperature: options.generationConfig?.temperature,
      maxOutputTokens: options.generationConfig?.maxOutputTokens,
      runName: options.endpoint ? `panacea:${options.endpoint}` : undefined,
      metadata: { endpoint: options.endpoint },
    };

    const result: RouteResult<string> = await routeTask(
      task,
      aiEnv,
      {
        systemPrompt: options.systemInstruction,
        userPrompt,
      },
      routeOpts
    );

    const latencyMs = Date.now() - startMs;

    // Map RouteResult → GeminiResponse shape
    const geminiResponse: GeminiResponse = {
      text: result.output,
      raw: {
        langchain: true,
        model: result.model,
        provider: result.provider,
        attempts: result.attempts,
      },
      usage: {
        promptTokenCount: result.usage?.inputTokens,
        candidatesTokenCount: result.usage?.outputTokens,
        totalTokenCount: result.usage?.totalTokens,
      },
      blocked: false,
    };

    // Track via existing token tracking system
    trackTokenUsage(context, {
      endpoint: options.endpoint ?? 'unknown',
      model: `${result.provider}/${result.model}`,
      usage: geminiResponse.usage,
      latencyMs,
      statusCode: 200,
      cacheHit: false,
    });

    return geminiResponse;
  } catch (lcError) {
    console.warn(
      `[callAIMultiProvider] LangChain routing failed for task "${task}":`,
      lcError instanceof Error ? lcError.message : String(lcError)
    );

    // Fall back to direct Gemini call
    if (shouldFallback) {
      console.info('[callAIMultiProvider] Falling back to direct Gemini call');
      return callGemini(context, options);
    }

    // Re-throw as GeminiError shape for consistency
    throw {
      status: 503,
      error: `Multi-provider routing failed: ${lcError instanceof Error ? lcError.message : String(lcError)}`,
      code: 'ALL_PROVIDERS_FAILED',
      retryable: true,
    } satisfies GeminiError;
  }
}
