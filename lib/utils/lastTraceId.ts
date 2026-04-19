/**
 * Client-side trace id memory — records the trace id of the most recent
 * successful response from the edge API so error boundaries, toasts, and
 * bug-report surfaces can display it alongside a client error id.
 *
 * Without this glue, the "error id" a user copy-pastes into a support email
 * is an opaque client-side UUID that doesn't match anything in Workers Logs
 * or Sentry. With it, every support report arrives with the corresponding
 * server trace id attached, making incident triage dramatically faster.
 *
 * Populated by `safeFetch`/`fetchWithAuth` on every response via
 * `setLastApiTraceId(getResponseTraceId(res))`. Consumed by
 * `ErrorBoundary.componentDidCatch` and surfaced in the user-visible fallback.
 *
 * Intentionally a module-level variable (not a React context) because we need
 * the value to be reachable from class components, plain utilities, and
 * unhandled-error hooks — not just React subtrees.
 */

/** The most recent server trace id seen on an API response. */
let lastApiTraceId: string | null = null;

/** Timestamp (ms) of the last update — helps callers decide if a stored id is stale. */
let lastApiTraceIdAt = 0;

/**
 * Record the server trace id from an API response. Called by fetch wrappers.
 *
 * @param traceId - The `X-Request-ID` / `X-Trace-ID` header value from the response
 */
export function setLastApiTraceId(traceId: string | null | undefined): void {
  if (!traceId || typeof traceId !== 'string') return;
  lastApiTraceId = traceId;
  lastApiTraceIdAt = Date.now();
}

/**
 * Read the most recent server trace id (or null if none captured yet).
 *
 * @param maxAgeMs - If provided, return null if the stored id is older than this.
 *                   Useful for callers who only care about "recent enough" traces
 *                   (e.g., an error that fires 10 minutes after the last API call
 *                   probably isn't related to that request).
 */
export function getLastApiTraceId(maxAgeMs?: number): string | null {
  if (!lastApiTraceId) return null;
  if (typeof maxAgeMs === 'number' && maxAgeMs > 0) {
    const age = Date.now() - lastApiTraceIdAt;
    if (age > maxAgeMs) return null;
  }
  return lastApiTraceId;
}

/** Clear the stored trace id. Exposed primarily for tests. */
export function resetLastApiTraceId(): void {
  lastApiTraceId = null;
  lastApiTraceIdAt = 0;
}
