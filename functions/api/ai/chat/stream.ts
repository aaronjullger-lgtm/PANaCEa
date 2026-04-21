// functions/api/ai/chat/stream.ts
// Edge-compatible streaming endpoint for Gemini AI responses.
// Uses Web Streams API (not Node.js streams) for Cloudflare Pages Functions compatibility.
//
// Auth / rate-limit / env stack is supplied by `aiStreamingEndpoint`:
//   - 401 envelope on unauthenticated requests
//   - 429 envelope + rate-limit headers on budget exhaustion (bucket: 'gemini')
//   - 500 envelope on missing GEMINI_API_KEY or CLERK_SECRET_KEY
//   - Passes a 2xx SSE Response through untouched so frames stream intact
//
// Sprint 5c migration notes (AI Gateway):
//   - Direct `fetch` to `generativelanguage.googleapis.com` + manual URL /
//     payload construction replaced by a single `gateway.stream()` call.
//   - The gateway surfaces optional `tools`, `cachedContent`, `history` (with
//     per-turn `thoughtSignature`), and `previousThoughtSignatures` — so this
//     endpoint no longer needs to hand-roll a `contents` array.
//   - Thought-signature extraction + the terminal `{ thoughtSignatures }` SSE
//     frame stay endpoint-local: the gateway yields a raw SSE Response and has
//     no opinion about what goes in or comes out of the wire. Same for token
//     usage tracking, which reads the gateway's downstream SSE frames.
//   - `GatewayError` is translated to the existing `AppError` envelope so the
//     client-side error UI keeps working without changes.

import {
  ApiError,
  ExternalServiceError,
  RateLimitError,
  TimeoutError,
  ValidationError,
  type AppError,
  isAppError,
} from '../../../../lib/errors/types';
import { logError, addBreadcrumb } from '../../../../lib/errors/errorLogger';
import { getCorsHeaders } from '../../_shared/cors';
import { geminiStreamRequestSchema, enforcePayloadSize } from '../../_shared/zodSchemas';
import { trackTokenUsage } from '../../_shared/tokenTracking';
import { aiStreamingEndpoint } from '../../_shared/endpoint';
import { gateway, GatewayError, toGatewayContext } from '@/lib/ai/aiGateway';

interface Env {
  GEMINI_API_KEY: string;
  CLERK_SECRET_KEY?: string;
  RATE_LIMIT_KV?: unknown;
  PANCE_BLUEPRINT_CACHE_NAME?: string;
}

const CATEGORY_TO_HTTP_STATUS: Record<string, number> = {
  rate_limit: 429,
  validation: 400,
  authentication: 401,
  authorization: 403,
  timeout: 408,
  configuration: 500,
};

/**
 * Convert AppError to JSON response with retry metadata
 */
function errorToResponse(error: AppError, corsHeaders: Record<string, string> = {}): Response {
  const status = CATEGORY_TO_HTTP_STATUS[error.category] ?? 503;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...corsHeaders,
  };
  if (error.retryMetadata.retryAfterMs) {
    headers['Retry-After'] = Math.ceil(error.retryMetadata.retryAfterMs / 1000).toString();
  }
  return new Response(
    JSON.stringify({
      error: error.message,
      errorId: error.errorId,
      category: error.category,
      retryable: error.retryMetadata.retryable,
      retryAfterMs: error.retryMetadata.retryAfterMs,
      timestamp: error.timestamp,
    }),
    { status, headers }
  );
}

/**
 * Translate a GatewayError to the AppError hierarchy this endpoint already
 * speaks. Callers (client SDK, toast UI) expect `{ error, category, retryable,
 * retryAfterMs }`, so we preserve that contract even though the gateway
 * speaks its own failure vocabulary.
 */
function gatewayErrorToAppError(err: GatewayError): AppError {
  const ctx = {
    service: 'gemini' as const,
    gatewayCode: err.code,
    requestId: err.requestId,
    traceId: err.traceId,
    task: err.task,
    ...(err.context ?? {}),
  };
  switch (err.code) {
    case 'RATE_LIMITED':
      return new RateLimitError('Gemini API rate limit exceeded', 60, ctx);
    case 'TIMEOUT':
      return new TimeoutError('Gemini API request timed out', 30000, ctx);
    case 'SERVER_ERROR':
    case 'ALL_PROVIDERS_FAILED':
    case 'UNKNOWN':
      return new ExternalServiceError(err.message, 'gemini', undefined, ctx);
    case 'SAFETY_BLOCKED':
      return new ExternalServiceError(err.message, 'gemini', 422, ctx);
    case 'BAD_REQUEST':
    case 'UNAUTHORIZED':
    case 'MISSING_API_KEY':
    case 'SCHEMA_INVALID_AFTER_REPAIR':
      return new ApiError(err.message, 400, '/api/gemini/stream', ctx);
    default:
      return new ExternalServiceError(err.message, 'gemini', undefined, ctx);
  }
}

/**
 * Map client-supplied thinkingLevel (uppercase: MINIMAL|LOW|MEDIUM|HIGH) to
 * the gateway's lowercase enum. The gateway's `thinkingBudget` helper converts
 * the enum to a concrete token count downstream.
 */
function normalizeThinkingLevel(
  level: 'MINIMAL' | 'LOW' | 'MEDIUM' | 'HIGH' | undefined
): 'minimal' | 'low' | 'medium' | 'high' | undefined {
  if (!level) return undefined;
  return level.toLowerCase() as 'minimal' | 'low' | 'medium' | 'high';
}

/**
 * Consume Gemini SSE stream and write parsed text chunks + thought signatures to the given writer.
 * Accumulates thoughtSignature from parts so the client can pass them back in the next request.
 */
async function processGeminiStream(
  geminiStream: ReadableStream<Uint8Array>,
  writer: WritableStreamDefaultWriter<Uint8Array>,
  encoder: TextEncoder
): Promise<{ chunksReceived: number; thoughtSignatures: string[]; error?: AppError; usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number } }> {
  let chunksReceived = 0;
  const thoughtSignatures: string[] = [];
  let usageMetadata: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number } | undefined;
  const reader = geminiStream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const jsonStr = line.slice(6).trim();
        if (jsonStr === '[DONE]') continue;

        try {
          const data = JSON.parse(jsonStr);
          // Capture usageMetadata from the last chunk that includes it
          if (data.usageMetadata) {
            usageMetadata = data.usageMetadata;
          }
          const parts = data.candidates?.[0]?.content?.parts ?? [];
          for (const p of parts) {
            if (p?.text) {
              chunksReceived++;
              await writer.write(encoder.encode(`data: ${JSON.stringify({ text: p.text })}\n\n`));
            }
            if (p?.thoughtSignature && typeof p.thoughtSignature === 'string') {
              thoughtSignatures.push(p.thoughtSignature);
            }
          }
          // Fallback: single text part at index 0 (older chunk shape)
          if (parts.length === 0) {
            const text =
              data.candidates?.[0]?.content?.parts?.[0]?.text || data.candidates?.[0]?.output || '';
            if (text) {
              chunksReceived++;
              await writer.write(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
            }
          }
        } catch (parseError) {
          addBreadcrumb('JSON parse error in stream', 'gemini-stream', 'warning', {
            line: jsonStr.slice(0, 100),
            error: parseError instanceof Error ? parseError.message : String(parseError),
          });
        }
      }
    }
    if (thoughtSignatures.length > 0) {
      await writer.write(encoder.encode(`data: ${JSON.stringify({ thoughtSignatures })}\n\n`));
    }
    await writer.write(encoder.encode('data: [DONE]\n\n'));
    await writer.close();
    addBreadcrumb('Gemini stream completed', 'gemini-stream', 'info', {
      chunksReceived,
      thoughtSignatureCount: thoughtSignatures.length,
    });
    return { chunksReceived, thoughtSignatures, usageMetadata };
  } catch (error) {
    const streamError = new ExternalServiceError(
      'Stream processing interrupted',
      'gemini',
      undefined,
      {
        chunksReceived,
        error: error instanceof Error ? error.message : String(error),
      }
    );
    addBreadcrumb('Stream processing error', 'gemini-stream', 'error', {
      chunksReceived,
      error: error instanceof Error ? error.message : String(error),
    });
    logError(streamError, { endpoint: '/api/gemini/stream', chunksReceived });
    try {
      const errorData = isAppError(streamError)
        ? {
            error: streamError.message,
            errorId: streamError.errorId,
            retryable: streamError.retryMetadata.retryable,
          }
        : { error: 'Stream interrupted' };
      await writer.write(encoder.encode(`data: ${JSON.stringify(errorData)}\n\n`));
      await writer.close();
    } catch {
      // Writer may already be closed
    }
    return { chunksReceived, thoughtSignatures: [], error: streamError, usageMetadata };
  }
}

/**
 * Cloudflare Pages Function for streaming Gemini responses.
 * Returns Server-Sent Events (SSE) stream. Auth + rate-limit + env checks run
 * inside `aiStreamingEndpoint`; this handler is only reached for authenticated
 * callers within budget.
 */
export const onRequestOptions = withCors();

export const onRequestPost = aiStreamingEndpoint(
  async (context) => {
    const { request, auth } = context;
    const env = context.env as Env;
    const corsHeaders = getCorsHeaders(request) || {};

    try {
      addBreadcrumb('Gemini stream request started', 'gemini-stream', 'info');

      const rawBody = await request.text();
      try {
        enforcePayloadSize(rawBody, '/api/gemini/stream');
      } catch (sizeError) {
        const message = sizeError instanceof Error ? sizeError.message : 'Payload too large';
        const validationError = new ValidationError(message, 'body', undefined, {
          endpoint: '/api/gemini/stream',
        });
        logError(validationError, { endpoint: '/api/gemini/stream' });
        return new Response(
          JSON.stringify({
            error: message,
            category: 'validation',
            retryable: false,
            timestamp: new Date().toISOString(),
          }),
          {
            status: 413,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          }
        );
      }

      let body: unknown;
      try {
        body = JSON.parse(rawBody);
      } catch {
        const validationError = new ValidationError('Invalid JSON body', 'body', undefined, {
          endpoint: '/api/gemini/stream',
        });
        addBreadcrumb('Invalid JSON in stream request', 'gemini-stream', 'warning');
        logError(validationError, { endpoint: '/api/gemini/stream' });
        return errorToResponse(validationError, corsHeaders);
      }

      // For visual drills (ECG/imaging/derm), body can be extended with imageParts (inlineData base64)
      // so the model can describe findings; keep request size within Edge limits (~4MB).

      const parsed = geminiStreamRequestSchema.safeParse(body);
      if (!parsed.success) {
        const issues = parsed.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; ');
        const validationError = new ValidationError(`Validation failed: ${issues}`, 'body', body, {
          issues: parsed.error.issues,
        });
        addBreadcrumb('Stream request validation failed', 'gemini-stream', 'warning', {
          issues: issues.slice(0, 200),
        });
        logError(validationError, {
          endpoint: '/api/gemini/stream',
          requestBody: { modelName: (body as { modelName?: string }).modelName },
        });
        return errorToResponse(validationError, corsHeaders);
      }

      const {
        modelName,
        prompt,
        temperature,
        cachedContent: clientCachedContent,
        thinkingLevel = 'HIGH',
      } = parsed.data;

      // Context cache: prefer client-provided cachedContent, else env PANCE_BLUEPRINT_CACHE_NAME.
      // Env cache is set server-side at deploy time (pre-baked PANCE blueprint vector cache).
      const envCache = env.PANCE_BLUEPRINT_CACHE_NAME;
      const cachedContent =
        clientCachedContent ?? (typeof envCache === 'string' ? envCache : undefined);

      // System instruction: PANaCEa Deep Think tutor (differentials, pathophysiology of error).
      // The schema doesn't yet surface a client override, so this is a pure server-side prompt.
      const systemInstruction =
        'You are PANaCEa. Before answering, internally rank the top 3 differentials. If the user is wrong, explain the pathophysiology of their error. Be concise but rigorous.';

      addBreadcrumb('Request validated, calling AI Gateway', 'gemini-stream', 'info', {
        modelName,
        promptLength: prompt.length,
        temperature,
        hasCachedContent: !!cachedContent,
        thinkingLevel,
      });

      // Route through the AI Gateway. The gateway returns a 2xx SSE Response
      // on success (streamGemini pipes the original Gemini body through) or
      // throws a GatewayError on a network/auth/rate-limit failure.
      let streamResponse: Response;
      try {
        const gatewayResult = await gateway.stream(toGatewayContext(context), {
          task: 'tutoring',
          endpoint: '/api/gemini/stream',
          model: modelName,
          systemPrompt: systemInstruction,
          userPrompt: prompt,
          temperature,
          maxOutputTokens: 2048,
          thinkingBudget: normalizeThinkingLevel(thinkingLevel),
          cachedContent,
        });
        streamResponse = gatewayResult.response;
      } catch (err) {
        if (err instanceof GatewayError) {
          const appError = gatewayErrorToAppError(err);
          addBreadcrumb('Gateway error before stream start', 'gemini-stream', 'error', {
            code: err.code,
            requestId: err.requestId,
          });
          logError(appError, {
            endpoint: '/api/gemini/stream',
            modelName,
            promptLength: prompt.length,
            gatewayCode: err.code,
          });
          return errorToResponse(appError, corsHeaders);
        }
        // Unknown shape — surface as an ExternalServiceError so the client
        // still sees a structured envelope.
        const networkError = new ExternalServiceError(
          'Failed to reach Gemini via AI Gateway',
          'gemini',
          undefined,
          {
            modelName,
            originalError: err instanceof Error ? err.message : String(err),
          }
        );
        addBreadcrumb('Unexpected gateway error', 'gemini-stream', 'error', {
          error: err instanceof Error ? err.message : String(err),
        });
        logError(networkError, {
          endpoint: '/api/gemini/stream',
          modelName,
          promptLength: prompt.length,
        });
        return errorToResponse(networkError, corsHeaders);
      }

      // The gateway's streamGemini swallows Gemini-side non-2xx responses and
      // returns a JSON error body with the original status code. Detect that
      // before we try to parse it as SSE.
      if (!streamResponse.ok) {
        let errorDetail = '';
        try {
          errorDetail = await streamResponse.text();
        } catch {
          /* ignore read failure */
        }
        const statusCode = streamResponse.status;
        let apiError: AppError;
        if (statusCode === 429) {
          apiError = new RateLimitError('Gemini API rate limit exceeded', 60, {
            service: 'gemini',
            statusCode,
            response: errorDetail.slice(0, 500),
          });
        } else if (statusCode >= 500) {
          apiError = new ExternalServiceError(
            `Gemini API server error: ${statusCode}`,
            'gemini',
            statusCode,
            { response: errorDetail.slice(0, 500) }
          );
        } else {
          apiError = new ApiError(
            `Gemini API error: ${statusCode}`,
            statusCode,
            '/api/gemini/stream',
            { response: errorDetail.slice(0, 500) }
          );
        }
        addBreadcrumb('Gateway returned non-OK response', 'gemini-stream', 'error', {
          statusCode,
        });
        logError(apiError, {
          endpoint: '/api/gemini/stream',
          modelName,
          promptLength: prompt.length,
          statusCode,
        });
        return errorToResponse(apiError, corsHeaders);
      }

      const geminiStream = streamResponse.body;
      if (!geminiStream) {
        const serviceError = new ExternalServiceError(
          'Gemini API returned no response stream',
          'gemini',
          200,
          { endpoint: '/api/gemini/stream' }
        );
        addBreadcrumb('No stream from Gemini', 'gemini-stream', 'error');
        logError(serviceError, { endpoint: '/api/gemini/stream', modelName });
        return errorToResponse(serviceError, corsHeaders);
      }

      addBreadcrumb('Gemini stream started', 'gemini-stream', 'info');

      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const encoder = new TextEncoder();
      const streamPromise = processGeminiStream(geminiStream, writer, encoder);

      // Track token usage after stream completes: structured log + DB persistence (non-blocking)
      streamPromise
        .then((result) => {
          trackTokenUsage(
            {
              env,
              waitUntil: context.waitUntil,
              auth: { userId: auth.userId, clerkId: auth.clerkId },
            },
            {
              endpoint: '/api/gemini/stream',
              model: modelName,
              usage: result.usageMetadata,
              statusCode: result.error ? 500 : 200,
              cacheHit: false,
            }
          );
        })
        .catch(() => {
          // Tracking failure should not affect the stream
        });

      // Return SSE stream to client (include CORS headers)
      return new Response(readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
          ...corsHeaders,
        },
      });
    } catch (error) {
      // Catch-all for unexpected errors
      const appError = isAppError(error)
        ? error
        : new ExternalServiceError('Unexpected error in streaming endpoint', 'gemini', undefined, {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          });

      addBreadcrumb('Unexpected streaming error', 'gemini-stream', 'error', {
        errorType: error instanceof Error ? error.name : typeof error,
        errorMessage: error instanceof Error ? error.message : String(error),
      });

      logError(appError, {
        endpoint: '/api/gemini/stream',
        unexpected: true,
      });

      return errorToResponse(appError, corsHeaders);
    }
  }
);
