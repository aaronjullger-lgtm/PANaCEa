/**
 * Vertex AI Backend — Routes Gemini model calls through Google Cloud Vertex AI.
 *
 * Same request/response format as the Generative Language API (generativelanguage.googleapis.com),
 * but through Vertex AI (aiplatform.googleapis.com) for:
 *   - Higher rate limits (enterprise quotas with Pro subscription)
 *   - Built-in cost tracking and project-level billing attribution
 *   - Access to Model Garden (Claude, Llama, etc. via one API)
 *   - Grounding with Google Search for clinical accuracy
 *   - Batch prediction for bulk question generation
 *
 * Env vars (all optional — falls back to direct Gemini API when unset):
 *   VERTEX_AI_PROJECT    — Google Cloud project ID
 *   VERTEX_AI_LOCATION   — e.g., 'us-central1' (default: 'us-central1')
 *   VERTEX_AI_API_KEY    — API key for Vertex AI auth
 *
 * Edge-safe: uses fetch() only, no Node-only APIs.
 */

import type {
  GeminiContent,
  GeminiGenerationConfig,
  GeminiRequestOptions,
  GeminiResponse,
} from '@/functions/api/_shared/ai-service';

import type { GeminiError } from '@/functions/api/_shared/ai-service';

// ─── Config ──────────────────────────────────────────────────────────────────

interface VertexConfig {
  project: string;
  location: string;
  apiKey: string;
}

let _cachedConfig: VertexConfig | null | undefined;

function getVertexConfig(env?: Record<string, unknown>): VertexConfig | null {
  if (_cachedConfig !== undefined) return _cachedConfig;

  const project = (env?.VERTEX_AI_PROJECT as string) ?? process.env?.VERTEX_AI_PROJECT;
  const location = (env?.VERTEX_AI_LOCATION as string) ?? process.env?.VERTEX_AI_LOCATION ?? 'us-central1';
  const apiKey = (env?.VERTEX_AI_API_KEY as string) ?? process.env?.VERTEX_AI_API_KEY;

  if (project && apiKey) {
    _cachedConfig = { project, location, apiKey };
  } else {
    _cachedConfig = null;
  }
  return _cachedConfig;
}

/** Check if Vertex AI is configured and should be used. */
export function isVertexAvailable(env?: Record<string, unknown>): boolean {
  return getVertexConfig(env) !== null;
}

// ─── URL builder ──────────────────────────────────────────────────────────────

function buildVertexUrl(model: string, config: VertexConfig, stream: boolean = false): string {
  const endpoint = config.location === 'global'
    ? 'aiplatform.googleapis.com'
    : `${config.location}-aiplatform.googleapis.com`;
  const method = stream ? 'streamGenerateContent' : 'generateContent';
  return `https://${endpoint}/v1/projects/${config.project}/locations/${config.location}/publishers/google/models/${model}:${method}`;
}

// ─── Core call ────────────────────────────────────────────────────────────────

/**
 * Call a Gemini model through Vertex AI.
 *
 * Has the same interface as callGemini in ai-service.ts.
 * Returns a GeminiResponse so the gateway can treat it identically.
 */
export async function callVertexGemini(
  options: GeminiRequestOptions,
  env?: Record<string, unknown>,
): Promise<GeminiResponse> {
  const config = getVertexConfig(env);
  if (!config) {
    throw {
      status: 500,
      error: 'Vertex AI not configured. Set VERTEX_AI_PROJECT and VERTEX_AI_API_KEY.',
      code: 'VERTEX_NOT_CONFIGURED',
      retryable: false,
    } satisfies GeminiError;
  }

  const model = options.model ?? 'gemini-2.0-flash';
  const url = buildVertexUrl(model, config);

  const body = buildRequestBody(options);

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': config.apiKey,
    },
    body: JSON.stringify(body),
    signal: options.signal,
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    const retryable = resp.status === 429 || resp.status === 503;
    throw {
      status: resp.status,
      error: `Vertex AI ${resp.status}: ${text.slice(0, 500)}`,
      code: retryable ? 'VERTEX_RATE_LIMITED' : 'VERTEX_ERROR',
      retryable,
    } satisfies GeminiError;
  }

  return parseVertexResponse(await resp.json() as Record<string, unknown>);
}

// ─── Streaming ────────────────────────────────────────────────────────────────

/**
 * Stream a Gemini model through Vertex AI.
 * Returns an async generator yielding text chunks.
 */
export async function* streamVertexGemini(
  options: GeminiRequestOptions,
  env?: Record<string, unknown>,
): AsyncGenerator<string, void, unknown> {
  const config = getVertexConfig(env);
  if (!config) {
    throw {
      status: 500,
      error: 'Vertex AI not configured',
      code: 'VERTEX_NOT_CONFIGURED',
      retryable: false,
    } satisfies GeminiError;
  }

  const model = options.model ?? 'gemini-2.0-flash';
  const url = buildVertexUrl(model, config, true) + '?alt=sse';
  const body = buildRequestBody(options);

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': config.apiKey,
    },
    body: JSON.stringify(body),
    signal: options.signal,
  });

  if (!resp.ok || !resp.body) {
    const text = await resp.text().catch(() => '');
    throw {
      status: resp.status,
      error: `Vertex AI stream ${resp.status}: ${text.slice(0, 500)}`,
      code: 'VERTEX_STREAM_ERROR',
      retryable: resp.status === 429 || resp.status === 503,
    } satisfies GeminiError;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const jsonStr = line.slice(6).trim();
      if (!jsonStr) continue;

      try {
        const chunk = JSON.parse(jsonStr) as Record<string, unknown>;
        const text = extractTextFromCandidate(chunk);
        if (text) yield text;
      } catch {
        // Skip malformed SSE lines
      }
    }
  }
}

// ─── Grounding with Google Search ─────────────────────────────────────────────

/**
 * Call Gemini with Google Search grounding enabled.
 * Returns the text response plus grounding metadata (sources, search queries).
 *
 * This is the key feature for clinical accuracy — grounds responses in real
 * medical sources, reducing hallucination risk.
 */
export async function callVertexGrounded(
  options: GeminiRequestOptions,
  env?: Record<string, unknown>,
): Promise<GeminiResponse & { groundingMetadata?: unknown }> {
  const config = getVertexConfig(env);
  if (!config) {
    throw {
      status: 500,
      error: 'Vertex AI not configured',
      code: 'VERTEX_NOT_CONFIGURED',
      retryable: false,
    } satisfies GeminiError;
  }

  const model = options.model ?? 'gemini-2.0-flash';
  const url = buildVertexUrl(model, config);
  const body = buildRequestBody({
    ...options,
    // Add Google Search grounding tool
    tools: [...(options.tools ?? []), { googleSearch: {} }],
  });

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': config.apiKey,
    },
    body: JSON.stringify(body),
    signal: options.signal,
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw {
      status: resp.status,
      error: `Vertex AI grounded ${resp.status}: ${text.slice(0, 500)}`,
      code: 'VERTEX_GROUNDED_ERROR',
      retryable: resp.status === 429 || resp.status === 503,
    } satisfies GeminiError;
  }

  const data = await resp.json() as Record<string, unknown>;
  const parsed = parseVertexResponse(data);
  const groundingMetadata = extractGroundingMetadata(data);
  return { ...parsed, groundingMetadata };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildRequestBody(options: GeminiRequestOptions): Record<string, unknown> {
  const body: Record<string, unknown> = {};

  // System instruction
  if (options.systemInstruction) {
    body.systemInstruction = {
      parts: [{ text: options.systemInstruction }],
    };
  }

  // Contents (multi-turn or single-turn)
  if (options.contents) {
    body.contents = options.contents;
  } else if (options.prompt) {
    body.contents = [
      {
        role: 'user',
        parts: [{ text: options.prompt }],
      },
    ];
  }

  // Generation config
  if (options.generationConfig) {
    body.generationConfig = options.generationConfig;
  }

  // Tools
  if (options.tools) {
    body.tools = options.tools;
  }

  if (options.toolConfig) {
    body.toolConfig = options.toolConfig;
  }

  if (options.cachedContent) {
    body.cachedContent = options.cachedContent;
  }

  return body;
}

function extractTextFromCandidate(chunk: Record<string, unknown>): string | null {
  const candidates = chunk.candidates as Array<Record<string, unknown>> | undefined;
  if (!candidates?.length) return null;
  const content = candidates[0]?.content as Record<string, unknown> | undefined;
  const parts = content?.parts as Array<Record<string, unknown>> | undefined;
  if (!parts?.length) return null;
  const text = parts[0]?.text as string | undefined;
  return text ?? null;
}

function extractGroundingMetadata(data: Record<string, unknown>): unknown {
  const candidates = data.candidates as Array<Record<string, unknown>> | undefined;
  if (!candidates?.length) return undefined;
  return candidates[0]?.groundingMetadata;
}

function parseVertexResponse(data: Record<string, unknown>): GeminiResponse {
  const candidates = data.candidates as Array<Record<string, unknown>> | undefined;
  const firstCandidate = candidates?.[0];

  // Extract text
  const content = firstCandidate?.content as Record<string, unknown> | undefined;
  const parts = content?.parts as Array<Record<string, unknown>> | undefined;
  const text = (parts?.[0]?.text as string) ?? '';

  // Extract thinking content
  const thinkingContent = parts
    ?.find((p) => p.thought === true)
    ?.text as string | undefined;

  // Check for blocking
  const finishReason = firstCandidate?.finishReason as string | undefined;
  const blocked = finishReason === 'SAFETY' || finishReason === 'RECITATION';
  const blockReason = blocked ? finishReason : undefined;

  // Extract usage
  const usageMetadata = data.usageMetadata as Record<string, number> | undefined;
  const usage = {
    promptTokenCount: usageMetadata?.promptTokenCount ?? 0,
    candidatesTokenCount: usageMetadata?.candidatesTokenCount ?? 0,
    totalTokenCount: usageMetadata?.totalTokenCount ?? 0,
  };

  // Extract grounding metadata
  const groundingMetadata = firstCandidate?.groundingMetadata;

  return {
    text,
    raw: data,
    usage,
    blocked,
    blockReason,
    groundingMetadata,
    thinkingContent,
  };
}

// ─── Provider selection ───────────────────────────────────────────────────────

/**
 * Smart provider selection: use Vertex AI when available, fall back to direct Gemini.
 *
 * The gateway calls this to decide which backend to use for each request.
 * Vertex is preferred when configured because it has:
 *   - Higher rate limits
 *   - Better cost tracking
 *   - Grounding support
 */
export function shouldUseVertex(
  env?: Record<string, unknown>,
  preferGrounding: boolean = false,
): boolean {
  if (!isVertexAvailable(env)) return false;
  // Always prefer Vertex when available — it has better quotas
  return true;
}
