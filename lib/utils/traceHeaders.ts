/**
 * Client-side trace header helpers.
 *
 * Generates a stable client trace id per outgoing API request and attaches it
 * as the `X-Request-ID` header so the edge function's `resolveRequestId()`
 * middleware picks it up and threads the same id through request_start log
 * entries, the response envelope body, and the X-Trace-ID / X-Request-ID
 * response headers.
 *
 * Pairs with `functions/api/_shared/requestLogger.ts::resolveRequestId`.
 *
 * Use from `fetchWithAuth`, `apiFetch`, `safeFetch`, and any other fetch
 * wrapper the app has. Direct `fetch()` calls in service code are expected to
 * pass through one of those wrappers — they should not call fetch directly.
 */

/**
 * Generate a UUID compatible with `X-Request-ID`.
 * Falls back to a best-effort string when `crypto.randomUUID` is unavailable
 * (ancient browsers, worker contexts without crypto).
 */
export function generateClientTraceId(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof (crypto as Crypto & { randomUUID?: () => string }).randomUUID === 'function'
  ) {
    try {
      return crypto.randomUUID();
    } catch {
      // fall through to fallback
    }
  }
  return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Merge an `X-Request-ID` header into the provided HeadersInit, preserving an
 * existing one if the caller already supplied it (e.g. for retry correlation).
 *
 * Returns the merged headers as a plain `Record<string, string>` (easy to spread
 * into `RequestInit.headers`) and the trace id that was used, so callers can
 * log it, surface it in error UIs, or attach it to Sentry breadcrumbs.
 */
export function withTraceHeaders(
  headers: HeadersInit | undefined,
  explicitTraceId?: string
): { headers: Record<string, string>; traceId: string } {
  const merged: Record<string, string> = {};

  // Normalize HeadersInit (Headers, array-of-tuples, or plain object) into a
  // flat record so the caller can spread it trivially.
  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      merged[key] = value;
    });
  } else if (Array.isArray(headers)) {
    for (const [key, value] of headers) {
      merged[key] = value;
    }
  } else if (headers && typeof headers === 'object') {
    Object.assign(merged, headers);
  }

  // Prefer explicit id, then any caller-supplied header, then generate new.
  const existing =
    merged['X-Request-ID'] ?? merged['x-request-id'] ?? merged['X-REQUEST-ID'];
  const traceId = explicitTraceId ?? existing ?? generateClientTraceId();

  merged['X-Request-ID'] = traceId;

  return { headers: merged, traceId };
}

/**
 * Read the trace id the server chose from a Response.
 * Checks `X-Request-ID` first (our canonical header), falls back to
 * `X-Trace-ID` (alias set by the envelope helpers).
 */
export function getResponseTraceId(response: Response): string | null {
  return (
    response.headers.get('X-Request-ID') ??
    response.headers.get('X-Trace-ID') ??
    null
  );
}
