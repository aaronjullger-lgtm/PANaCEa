// functions/api/gemini/stream.ts
// Edge-compatible streaming endpoint for Gemini AI responses
// Uses Web Streams API (not Node.js streams) for Cloudflare Pages Functions compatibility

import {
  ApiError,
  ExternalServiceError,
  RateLimitError,
  TimeoutError,
  ValidationError,
  type AppError,
  isAppError,
} from '../../../lib/errors/types';
import { logError, addBreadcrumb } from '../../../lib/errors/errorLogger';
import { validateFunctionEnv, MissingEnvError } from '../_shared/env-validation';
import { withRateLimit, getRateLimitIdentifier } from '../_shared/rateLimiter';
import { authenticateRequest } from '../_shared/auth';
import { getCorsHeaders, handleCorsPreflightSecure } from '../_shared/cors';
import { geminiStreamRequestSchema, enforcePayloadSize } from '../_shared/zodSchemas';

interface Env {
  GEMINI_API_KEY: string;
  CLERK_SECRET_KEY?: string;
  RATE_LIMIT_KV?: unknown;
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
 * Build an AppError from a non-OK Gemini API response
 */
function geminiErrorFromResponse(
  statusCode: number,
  errorText: string,
  geminiUrl: string
): AppError {
  if (statusCode === 429) {
    return new RateLimitError('Gemini API rate limit exceeded', 60, {
      service: 'gemini',
      endpoint: geminiUrl,
      statusCode,
      response: errorText,
    });
  }
  if (statusCode === 408) {
    return new TimeoutError('Gemini API request timed out', 30000, {
      service: 'gemini',
      endpoint: geminiUrl,
      statusCode,
      response: errorText,
    });
  }
  if (statusCode >= 500) {
    return new ExternalServiceError(
      `Gemini API server error: ${statusCode}`,
      'gemini',
      statusCode,
      { endpoint: geminiUrl, response: errorText }
    );
  }
  return new ApiError(`Gemini API error: ${statusCode}`, statusCode, geminiUrl, {
    response: errorText,
  });
}

/**
 * Consume Gemini SSE stream and write parsed text chunks to the given writer
 */
async function processGeminiStream(
  geminiStream: ReadableStream<Uint8Array>,
  writer: WritableStreamDefaultWriter<Uint8Array>,
  encoder: TextEncoder
): Promise<{ chunksReceived: number; error?: AppError }> {
  let chunksReceived = 0;
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
          const text =
            data.candidates?.[0]?.content?.parts?.[0]?.text || data.candidates?.[0]?.output || '';
          if (text) {
            chunksReceived++;
            await writer.write(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
          }
        } catch (parseError) {
          addBreadcrumb('JSON parse error in stream', 'gemini-stream', 'warning', {
            line: jsonStr.slice(0, 100),
            error: parseError instanceof Error ? parseError.message : String(parseError),
          });
        }
      }
    }
    await writer.write(encoder.encode('data: [DONE]\n\n'));
    await writer.close();
    addBreadcrumb('Gemini stream completed', 'gemini-stream', 'info', { chunksReceived });
    return { chunksReceived };
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
    return { chunksReceived, error: streamError };
  }
}

/**
 * Cloudflare Pages Function for streaming Gemini responses
 * Returns Server-Sent Events (SSE) stream
 */
export async function onRequestPost(context: { request: Request; env: Env }): Promise<Response> {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request) || {};

  try {
    // Require authentication (high-cost AI endpoint)
    const auth = await authenticateRequest(request, env);
    if (!auth) {
      return new Response(
        JSON.stringify({
          error: 'Authentication required',
          message: 'Please sign in to use AI features',
          category: 'authentication',
          retryable: false,
          timestamp: new Date().toISOString(),
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    // Validate required environment variables early (JSON 500 instead of HTML fallback)
    try {
      validateFunctionEnv(env as unknown as Record<string, unknown>, 'GEMINI');
    } catch (error) {
      if (error instanceof MissingEnvError) {
        return error.toResponse();
      }
      throw error;
    }

    // Rate limit AI requests (user ID if available, else IP)
    const identifier = getRateLimitIdentifier(request);
    const { response: rateLimitResponse, headers: rateLimitHeaders } = await withRateLimit(
      env as Parameters<typeof withRateLimit>[0],
      identifier,
      'gemini'
    );
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Add breadcrumb for request start
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
          headers: { 'Content-Type': 'application/json' },
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
      const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
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

    const { modelName, prompt, temperature } = parsed.data;
    const apiKey = env.GEMINI_API_KEY;

    addBreadcrumb('Request validated, calling Gemini API', 'gemini-stream', 'info', {
      modelName,
      promptLength: prompt.length,
      temperature,
    });

    // Construct Gemini API URL for streaming
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:streamGenerateContent?key=${apiKey}&alt=sse`;
    // Redacted URL for logging (never log the real API key)
    const geminiUrlRedacted = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:streamGenerateContent?key=[REDACTED]&alt=sse`;

    // Call Gemini with streaming enabled
    let geminiResponse: Response;
    try {
      geminiResponse = await fetch(geminiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
          },
        }),
      });
    } catch (fetchError) {
      const networkError = new ExternalServiceError(
        'Failed to connect to Gemini API',
        'gemini',
        undefined,
        {
          modelName,
          url: geminiUrlRedacted,
          originalError: fetchError instanceof Error ? fetchError.message : String(fetchError),
        }
      );

      addBreadcrumb('Network error calling Gemini', 'gemini-stream', 'error', {
        error: fetchError instanceof Error ? fetchError.message : String(fetchError),
      });

      logError(networkError, {
        endpoint: '/api/gemini/stream',
        modelName,
        promptLength: prompt.length,
      });

      return errorToResponse(networkError);
    }

    // Handle non-OK responses
    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      const statusCode = geminiResponse.status;
      const apiError = geminiErrorFromResponse(statusCode, errorText, geminiUrl);
      addBreadcrumb(
        'Gemini API error response',
        'gemini-stream',
        statusCode >= 500 ? 'error' : 'warning',
        { statusCode }
      );
      logError(apiError, {
        endpoint: '/api/gemini/stream',
        modelName,
        promptLength: prompt.length,
        statusCode,
        responseText: errorText.slice(0, 500),
      });
      return errorToResponse(apiError, corsHeaders);
    }

    // Verify stream exists
    const geminiStream = geminiResponse.body;
    if (!geminiStream) {
      const serviceError = new ExternalServiceError(
        'Gemini API returned no response stream',
        'gemini',
        200,
        { endpoint: geminiUrlRedacted }
      );

      addBreadcrumb('No stream from Gemini', 'gemini-stream', 'error');

      logError(serviceError, {
        endpoint: '/api/gemini/stream',
        modelName,
      });

      return errorToResponse(serviceError);
    }

    addBreadcrumb('Gemini stream started', 'gemini-stream', 'info');

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();
    processGeminiStream(geminiStream, writer, encoder);

    // Return SSE stream to client (include CORS and rate limit headers)
    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        ...corsHeaders,
        ...rateLimitHeaders,
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

    return errorToResponse(appError, getCorsHeaders(context.request) || {});
  }
}

/**
 * OPTIONS handler for CORS preflight
 */
export async function onRequestOptions(context: { request: Request; env: Env }): Promise<Response> {
  return handleCorsPreflightSecure(context.request, context.env);
}
