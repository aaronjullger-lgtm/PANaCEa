/**
 * Edge Function Request Logger Middleware
 *
 * Emits structured JSON logs for every edge function request.
 * Hooks into the existing withMiddleware pattern (middleware.ts).
 *
 * Produces:
 *   - Request start log: { event: "request_start", requestId, endpoint, method, userId }
 *   - Request end log:   { event: "request_end",   requestId, endpoint, latencyMs, status }
 *   - Error log:         { event: "request_error",  requestId, endpoint, error, stack }
 *
 * Usage:
 *   import { withRequestLogging } from './requestLogger';
 *
 *   export const onRequestPost = withMiddleware(
 *     withRequestLogging(),
 *     withAuth(),
 *     async (context) => { ... }
 *   );
 *
 * Or use the pre-composed helper:
 *   export const onRequestPost = loggedAuthenticatedEndpoint(schema, handler, options);
 *
 * Phase 1 Audit Improvement #2: Structured Observability for Edge Functions
 */

import type { Middleware, CloudflareContext, AuthenticatedContext } from './middleware';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RequestLogEntry {
  event: 'request_start' | 'request_end' | 'request_error';
  timestamp: string;
  requestId: string;
  endpoint: string;
  method: string;
  userId?: string;
  latencyMs?: number;
  status?: number;
  error?: string;
  stack?: string;
  /** Custom metadata from the handler (e.g., confidencePipelineMs) */
  meta?: Record<string, unknown>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Extract endpoint path from request URL, stripping query params */
function extractEndpoint(request: Request): string {
  try {
    const url = new URL(request.url);
    return url.pathname;
  } catch {
    return 'unknown';
  }
}

/** Extract userId from auth context if available */
function extractUserId(context: CloudflareContext): string | undefined {
  return (context as AuthenticatedContext)?.auth?.userId;
}

/** Emit a structured JSON log line to stdout (picked up by Cloudflare Workers Logs) */
function emitLog(entry: RequestLogEntry): void {
  // JSON.stringify produces a single-line log that Cloudflare Workers Logs
  // can index and filter by any field.
  console.log(JSON.stringify(entry));
}

// ─── Middleware ────────────────────────────────────────────────────────────────

/**
 * Composable middleware that logs request start/end with timing.
 * Place FIRST in the middleware chain to capture full request lifecycle.
 *
 * Reads requestId from X-Request-ID header if present (set by upstream proxy),
 * otherwise generates one. Stores requestId on context for downstream use.
 */
export function withRequestLogging(): Middleware {
  return async (context, next) => {
    const startTime = Date.now();
    const endpoint = extractEndpoint(context.request);
    const method = context.request.method;

    // Use existing requestId from header or generate one
    const requestId =
      context.request.headers.get('X-Request-ID') ?? crypto.randomUUID();

    // Attach requestId to context for downstream middleware/handlers
    (context as any)._requestId = requestId;

    emitLog({
      event: 'request_start',
      timestamp: new Date().toISOString(),
      requestId,
      endpoint,
      method,
      userId: extractUserId(context),
    });

    try {
      const result = await next();
      const latencyMs = Date.now() - startTime;

      // Extract status from result
      const status = result instanceof Response
        ? result.status
        : (result as any)?.status ?? 200;

      emitLog({
        event: 'request_end',
        timestamp: new Date().toISOString(),
        requestId,
        endpoint,
        method,
        userId: extractUserId(context),
        latencyMs,
        status,
        meta: (context as any)._logMeta,
      });

      return result;
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const err = error instanceof Error ? error : new Error(String(error));

      emitLog({
        event: 'request_error',
        timestamp: new Date().toISOString(),
        requestId,
        endpoint,
        method,
        userId: extractUserId(context),
        latencyMs,
        status: 500,
        error: err.message,
        stack: err.stack?.split('\n').slice(0, 5).join('\n'),
      });

      throw error; // Re-throw for error handler middleware to catch
    }
  };
}

/**
 * Attach custom metadata to the request log (e.g., confidence pipeline timing).
 * Call from within a handler to enrich the request_end log.
 *
 * Usage:
 *   attachLogMeta(context, { confidencePipelineMs: 42, questionsProcessed: 5 });
 */
export function attachLogMeta(
  context: CloudflareContext,
  meta: Record<string, unknown>
): void {
  const existing = (context as any)._logMeta ?? {};
  (context as any)._logMeta = { ...existing, ...meta };
}

/**
 * Get the requestId from context (set by withRequestLogging).
 */
export function getRequestId(context: CloudflareContext): string | undefined {
  return (context as any)?._requestId;
}
