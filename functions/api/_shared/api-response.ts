/**
 * Unified API Response Envelope for PANaCEa
 *
 * SINGLE SOURCE OF TRUTH for every non-streaming response.
 * Replaces the five scattered helpers (response.ts::jsonSuccess/jsonError,
 * types.ts::jsonResponse/errorResponse, auth.ts::createSuccessResponse/
 * createErrorResponse, error-handler.ts::formatErrorResponse, and
 * middleware.ts::toResponse).
 *
 * Envelope shape (frozen contract):
 *   Success → { success: true,  data, traceId, timestamp, message? }
 *   Error   → { success: false, error, code, traceId, timestamp, message, details? }
 *
 * Usage:
 *   return ok(payload);                              // 200 OK
 *   return ok(payload, { status: 201 });             // 201 Created
 *   return fail(ErrorCode.UNAUTHORIZED);             // 401 + default msg
 *   return fail(ErrorCode.VALIDATION_FAILED, { details: zodErrors });
 *   return fail(ErrorCode.RATE_LIMITED, { retryAfterSeconds: 30 });
 *
 * Trace propagation:
 *   - traceId appears in the JSON body AND as `X-Request-ID` + `X-Trace-ID`
 *     response headers, so consumers can correlate failures without parsing
 *     the body on network errors.
 *   - If the request has a `sentry-trace` header, it's forwarded back so the
 *     same trace is visible in Sentry.
 */

import { getCorsHeaders } from './cors';
import {
  ErrorCode,
  getCatalogEntry,
  isKnownErrorCode,
  codeFromStatus,
  type ErrorCatalogEntry,
} from './error-catalog';

// ─── Envelope types ──────────────────────────────────────────────────────────

export interface ApiSuccessEnvelope<T = unknown> {
  success: true;
  data: T;
  message?: string;
  traceId: string;
  timestamp: string;
}

export interface ApiErrorEnvelope {
  success: false;
  /** Stable error code — part of public contract */
  error: ErrorCode;
  /** Alias for error, kept for backward-compat with the `code` field */
  code: ErrorCode;
  /** Human-readable message (may be overridden per-call) */
  message: string;
  /** Optional structured details (zod issues, etc.) */
  details?: unknown;
  traceId: string;
  timestamp: string;
}

export type ApiEnvelope<T = unknown> = ApiSuccessEnvelope<T> | ApiErrorEnvelope;

// ─── Options ─────────────────────────────────────────────────────────────────

export interface OkOptions {
  /** HTTP status code (default 200) */
  status?: number;
  /** Optional success message */
  message?: string;
  /** Extra response headers */
  headers?: Record<string, string>;
  /** The incoming request — used to derive CORS + sentry-trace forwarding */
  request?: Request;
  /** Explicit trace id (otherwise auto-generated) */
  traceId?: string;
}

export interface FailOptions {
  /** Override the catalog's default message */
  message?: string;
  /** Override the catalog's default status code */
  status?: number;
  /** Structured details (e.g. ZodIssue[]) */
  details?: unknown;
  /** Extra response headers */
  headers?: Record<string, string>;
  /** The incoming request — used to derive CORS + sentry-trace forwarding */
  request?: Request;
  /** Explicit trace id (otherwise auto-generated) */
  traceId?: string;
  /** For 429 — sets `Retry-After` header (seconds) */
  retryAfterSeconds?: number;
}

// ─── Internal helpers ────────────────────────────────────────────────────────

function generateTraceId(): string {
  // crypto.randomUUID is available in Edge runtime
  try {
    return crypto.randomUUID();
  } catch {
    // Fallback for unusual environments
    return `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

function buildHeaders(
  request: Request | undefined,
  traceId: string,
  extra?: Record<string, string>
): Headers {
  const headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8' });
  headers.set('X-Request-ID', traceId);
  headers.set('X-Trace-ID', traceId);

  // Forward Sentry trace so failed requests can be found by trace id
  const sentryTrace = request?.headers.get('sentry-trace');
  if (sentryTrace) headers.set('Sentry-Trace', sentryTrace);

  // Best-effort CORS — middleware layers may also add these, but doing it here
  // means helpers used outside the middleware stack still get CORS right.
  if (request) {
    const corsHeaders = getCorsHeaders(request);
    if (corsHeaders) {
      for (const [k, v] of Object.entries(corsHeaders)) {
        if (!headers.has(k)) headers.set(k, v);
      }
    }
  }

  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      headers.set(k, v);
    }
  }

  return headers;
}

// ─── Public helpers ──────────────────────────────────────────────────────────

/**
 * Build a 2xx JSON Response with the unified envelope.
 */
export function ok<T>(data: T, options: OkOptions = {}): Response {
  const traceId = options.traceId ?? generateTraceId();
  const body: ApiSuccessEnvelope<T> = {
    success: true,
    data,
    traceId,
    timestamp: new Date().toISOString(),
  };
  if (options.message) body.message = options.message;

  const headers = buildHeaders(options.request, traceId, options.headers);
  return new Response(JSON.stringify(body), {
    status: options.status ?? 200,
    headers,
  });
}

/**
 * Build a non-2xx JSON Response with the unified envelope.
 * Code is looked up in the catalog for status + default message.
 */
export function fail(
  code: ErrorCode | string,
  options: FailOptions = {}
): Response {
  const resolvedCode: ErrorCode = isKnownErrorCode(code) ? code : ErrorCode.ERROR;
  const entry: ErrorCatalogEntry = getCatalogEntry(resolvedCode);
  const traceId = options.traceId ?? generateTraceId();

  const body: ApiErrorEnvelope = {
    success: false,
    error: resolvedCode,
    code: resolvedCode,
    message: options.message ?? entry.defaultMessage,
    traceId,
    timestamp: new Date().toISOString(),
  };
  if (options.details !== undefined) body.details = options.details;

  const extraHeaders: Record<string, string> = { ...(options.headers ?? {}) };
  if (options.retryAfterSeconds != null && options.retryAfterSeconds >= 0) {
    extraHeaders['Retry-After'] = String(Math.ceil(options.retryAfterSeconds));
  }

  const headers = buildHeaders(options.request, traceId, extraHeaders);
  return new Response(JSON.stringify(body), {
    status: options.status ?? entry.status,
    headers,
  });
}

// ─── Adapters (legacy & middleware) ──────────────────────────────────────────

/**
 * Convert a legacy { status, data, error } handler result into a unified
 * envelope Response. Used by middleware.ts::toResponse().
 */
export function envelopeFromHandlerResult(
  result: { status?: number; data?: unknown; error?: string } | Response,
  request: Request,
  traceId?: string
): Response {
  if (result instanceof Response) {
    // Passthrough: just ensure X-Request-ID / X-Trace-ID / sentry-trace land
    const headers = new Headers(result.headers);
    const id = traceId ?? headers.get('X-Request-ID') ?? generateTraceId();
    headers.set('X-Request-ID', id);
    headers.set('X-Trace-ID', id);
    const sentryTrace = request.headers.get('sentry-trace');
    if (sentryTrace && !headers.has('Sentry-Trace')) {
      headers.set('Sentry-Trace', sentryTrace);
    }
    return new Response(result.body, {
      status: result.status,
      statusText: result.statusText,
      headers,
    });
  }

  const status = result.status ?? 200;

  if (result.error != null) {
    return fail(codeFromStatus(status), {
      status,
      message: result.error,
      request,
      traceId,
    });
  }

  return ok(result.data ?? null, {
    status,
    request,
    traceId,
  });
}

/**
 * Build a generic 500 envelope for uncaught middleware errors.
 */
export function envelopeInternalError(
  request: Request,
  traceId?: string,
  message = 'Internal server error'
): Response {
  return fail(ErrorCode.INTERNAL_ERROR, { message, request, traceId });
}

// ─── Backward-compatible aliases ─────────────────────────────────────────────

/**
 * @deprecated Use `ok()` instead. Kept so existing call sites keep working.
 */
export function jsonSuccess<T>(
  data: T,
  options?: { status?: number; message?: string; headers?: Record<string, string> }
): Response {
  return ok(data, options);
}

/**
 * @deprecated Use `fail(ErrorCode.*, ...)` instead. Kept so existing call sites
 * keep working while the fleet migrates.
 */
export function jsonError(
  message: string,
  status = 500,
  options?: { code?: string; details?: unknown; headers?: Record<string, string> }
): Response {
  const code: ErrorCode = options?.code && isKnownErrorCode(options.code)
    ? options.code
    : codeFromStatus(status);

  return fail(code, {
    status,
    message,
    details: options?.details,
    headers: options?.headers,
  });
}

// ─── Exported types from catalog (re-export for convenience) ─────────────────

export { ErrorCode } from './error-catalog';
