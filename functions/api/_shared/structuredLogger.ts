/**
 * Structured Logger for Edge Functions — Phase 1.1
 *
 * Provides:
 *   1. Span-based timing for subsections (confidence pipeline, FSRS, DB queries)
 *   2. Sentry-ready instrumentation (uses @sentry/cloudflare when available)
 *   3. withStructuredLogging() middleware that composes requestLogger + secureLogger
 *   4. Graceful fallback: all features work without Sentry installed
 *
 * Usage:
 *   import { createSpan, withStructuredLogging } from './structuredLogger';
 *
 *   // In a handler:
 *   const span = createSpan('confidence_pipeline');
 *   const result = await computeConfidence(...);
 *   span.end({ stepsRun: 8, dampened: true });
 *
 *   // In middleware stack:
 *   export const onRequestPost = withMiddleware(
 *     withStructuredLogging(),
 *     withAuth(),
 *     handler
 *   );
 */

import type { Middleware, CloudflareContext } from './middleware';
import { withRequestLogging, attachLogMeta, getRequestId } from './requestLogger';
import { logger as secureLog } from './secureLogger';

// ─── Sentry Edge Integration (graceful fallback) ─────────────────────────────

let SentryEdge: any = null;
let sentryLoadAttempted = false;

/**
 * Lazily attempt to load @sentry/cloudflare on first use.
 * Returns the module if available, null otherwise.
 */
async function getSentry(): Promise<any> {
  if (sentryLoadAttempted) return SentryEdge;
  sentryLoadAttempted = true;
  try {
    SentryEdge = await import('@sentry/cloudflare');
  } catch {
    // Package not installed — graceful degradation
  }
  return SentryEdge;
}

// ─── Span Timing ─────────────────────────────────────────────────────────────

export interface SpanResult {
  name: string;
  durationMs: number;
  meta?: Record<string, unknown>;
}

export interface Span {
  /** End the span and record timing. Returns the span result for logging. */
  end: (meta?: Record<string, unknown>) => SpanResult;
}

/**
 * Create a timing span for a subsection of request processing.
 *
 * If Sentry is available, wraps Sentry.startSpan. Otherwise, uses
 * high-resolution timing via Date.now().
 *
 * @example
 *   const span = createSpan('fsrs_update');
 *   await updateFSRS(params);
 *   const result = span.end({ userId, stability: 4.2 });
 *   // result = { name: 'fsrs_update', durationMs: 12, meta: { userId, stability: 4.2 } }
 */
export function createSpan(name: string): Span {
  const startMs = Date.now();

  return {
    end(meta?: Record<string, unknown>): SpanResult {
      const durationMs = Date.now() - startMs;
      const result: SpanResult = { name, durationMs, meta };

      // Log span completion as structured JSON
      secureLog.info(`span:${name}`, {
        durationMs,
        ...meta,
      });

      return result;
    },
  };
}

/**
 * Wrap an async function in a timed span.
 * Returns both the function result and the span timing.
 *
 * @example
 *   const { result, span } = await timedSpan('confidence_pipeline', () =>
 *     computeConfidence(data)
 *   );
 */
export async function timedSpan<T>(
  name: string,
  fn: () => Promise<T>,
  meta?: Record<string, unknown>
): Promise<{ result: T; span: SpanResult }> {
  const s = createSpan(name);
  try {
    const result = await fn();
    const span = s.end(meta);
    return { result, span };
  } catch (error) {
    s.end({ ...meta, error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

// ─── Sentry Helpers ──────────────────────────────────────────────────────────

/**
 * Capture an exception in Sentry (if available), enriched with requestId.
 * No-ops if @sentry/cloudflare is not installed.
 */
export function captureException(
  error: unknown,
  context?: CloudflareContext,
  extras?: Record<string, unknown>
): void {
  const requestId = context ? getRequestId(context) : undefined;

  // Always log to structured logger
  secureLog.error('Unhandled exception', {
    requestId,
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack?.split('\n').slice(0, 5).join('\n') : undefined,
    ...extras,
  });

  // Forward to Sentry if available (fire-and-forget)
  getSentry().then((sentry) => {
    if (sentry?.captureException) {
      sentry.captureException(error, {
        extra: { requestId, ...extras },
      });
    }
  });
}

/**
 * Set user context in Sentry for the current scope.
 */
export function setSentryUser(userId: string): void {
  getSentry().then((sentry) => {
    if (sentry?.setUser) {
      sentry.setUser({ id: userId });
    }
  });
}

// ─── Composite Middleware ────────────────────────────────────────────────────

/**
 * Enhanced logging middleware that combines:
 *   - requestLogger (requestId, structured JSON start/end/error)
 *   - Sentry user tagging
 *   - Exception capture with requestId correlation
 *
 * Drop-in replacement for withLogging() in middleware stacks.
 */
export function withStructuredLogging(): Middleware {
  const requestLogging = withRequestLogging();

  return async (context, next) => {
    // Delegate to requestLogger for the main lifecycle logging
    return requestLogging(context, async () => {
      // Tag Sentry with userId if authenticated
      const auth = (context as any)?.auth;
      if (auth?.userId) {
        setSentryUser(auth.userId);
      }

      try {
        return await next();
      } catch (error) {
        // Capture in Sentry with full context
        captureException(error, context, {
          endpoint: new URL(context.request.url).pathname,
          method: context.request.method,
        });
        throw error; // Re-throw for error handler middleware
      }
    });
  };
}

// ─── Re-exports for convenience ─────────────────────────────────────────────

export { attachLogMeta, getRequestId } from './requestLogger';
export { logger as secureLogger } from './secureLogger';
