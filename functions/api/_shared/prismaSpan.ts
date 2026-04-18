/**
 * Prisma query-level timing extension.
 *
 * Wraps every Prisma operation in a span so each DB call emits a structured
 * `prisma_span` log line containing `{ model, operation, durationMs, success }`.
 * Slow queries (>SLOW_QUERY_MS) additionally emit a `prisma_slow_query` warning.
 * Errors surface with model + operation attached so failed queries are
 * correlatable back to the originating request via the request id already
 * present on the log meta (set by `withRequestLogging` / `attachLogMeta`).
 *
 * Edge-safe: no Node-only APIs, no heavy deps, no Sentry dependency.
 *
 * Usage: applied in `createEdgePrismaClient` after `withAccelerate()`:
 *
 *     const extended = baseClient
 *       .$extends(withAccelerate())
 *       .$extends(withPrismaSpan());
 *
 * Keeping this as a standalone extension (not inlined in `prisma-edge.ts`)
 * means it can be enabled/disabled independently and unit-tested in isolation
 * without spinning up a real Prisma client.
 */

import { Prisma } from '@prisma/client/edge';

/** Query time threshold (ms) above which a slow-query warning is emitted. */
export const SLOW_QUERY_MS = 500;

/** Shape of the structured log record emitted per Prisma query. */
export interface PrismaSpanRecord {
  event: 'prisma_span' | 'prisma_slow_query' | 'prisma_error';
  timestamp: string;
  model: string;
  operation: string;
  durationMs: number;
  success: boolean;
  error?: string;
}

/**
 * Emit a structured JSON record — picked up by Cloudflare Workers Logs.
 *
 * We deliberately use a standalone emitter here instead of importing the
 * SecureLogger so this extension can be applied in contexts where the
 * SecureLogger isn't available (e.g., cron jobs, script runners).
 */
function emit(record: PrismaSpanRecord): void {
  try {
    // Warnings use console.warn so Workers Logs pick up the higher severity.
    if (record.event === 'prisma_slow_query' || record.event === 'prisma_error') {
      console.warn(JSON.stringify(record));
    } else {
      console.log(JSON.stringify(record));
    }
  } catch {
    // If JSON.stringify fails (circular ref, etc.), fall back silently —
    // logging must never fail the underlying DB call.
  }
}

/**
 * Build the Prisma client extension. Exposed as a factory so callers can
 * compose it with other `$extends` calls.
 */
export function withPrismaSpan() {
  return Prisma.defineExtension((client) => {
    return client.$extends({
      name: 'panacea-prisma-span',
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            const startMs = Date.now();
            try {
              const result = await query(args);
              const durationMs = Date.now() - startMs;

              emit({
                event: 'prisma_span',
                timestamp: new Date().toISOString(),
                model: model ?? 'unknown',
                operation,
                durationMs,
                success: true,
              });

              if (durationMs >= SLOW_QUERY_MS) {
                emit({
                  event: 'prisma_slow_query',
                  timestamp: new Date().toISOString(),
                  model: model ?? 'unknown',
                  operation,
                  durationMs,
                  success: true,
                });
              }

              return result;
            } catch (error) {
              const durationMs = Date.now() - startMs;
              const message = error instanceof Error ? error.message : String(error);

              emit({
                event: 'prisma_error',
                timestamp: new Date().toISOString(),
                model: model ?? 'unknown',
                operation,
                durationMs,
                success: false,
                error: message.slice(0, 300),
              });

              throw error;
            }
          },
        },
      },
    });
  });
}
