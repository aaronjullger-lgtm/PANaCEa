/**
 * Prisma Client Extension: Mutation Audit Logging
 *
 * Automatically logs all create, update, and delete operations to a
 * structured audit trail. Integrates with the existing secureLogger
 * (console-based) and optionally persists to a DataMutationAudit table
 * when available.
 *
 * This complements the manual `auditLog()` calls in admin endpoints by
 * providing automatic coverage for ALL data mutations — catching mutations
 * that individual endpoints might forget to log.
 *
 * Usage:
 *   import { withMutationAudit } from '../_shared/prisma-audit-extension';
 *
 *   // Apply to any Prisma client:
 *   const auditedPrisma = baseClient.$extends(withMutationAudit({
 *     userId: auth.userId,
 *     endpoint: '/api/drills/submit-review',
 *     requestId: context.requestId,
 *   }));
 *
 * What gets logged:
 * - Model name, operation type (create/update/delete)
 * - UserId who performed the mutation
 * - Endpoint that triggered it
 * - Request ID for correlation
 * - Timestamp
 * - Record ID (when available in the result)
 *
 * What does NOT get logged (privacy):
 * - Full record data (too large, may contain PII)
 * - Query arguments (may contain sensitive filters)
 *
 * @module functions/api/_shared/prisma-audit-extension
 */

import { Prisma } from '@prisma/client/edge';
import { logger } from './secureLogger';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface MutationAuditContext {
  /** The authenticated user performing the mutation */
  userId?: string;
  /** The API endpoint that triggered the mutation */
  endpoint?: string;
  /** Request correlation ID */
  requestId?: string;
}

// ─── Configuration ──────────────────────────────────────────────────────────

/** Operations that constitute a data mutation */
const MUTATION_OPERATIONS = new Set([
  'create',
  'createMany',
  'createManyAndReturn',
  'update',
  'updateMany',
  'upsert',
  'delete',
  'deleteMany',
]);

/** Models excluded from audit logging (high-frequency, low-value) */
const EXCLUDED_MODELS = new Set([
  'AITokenUsage',        // Already tracked by tokenTracking.ts
  'SyncQueue',           // High-frequency sync coordination, internal plumbing
  'BehaviorLog',         // Created per question attempt — telemetry, not mutations
  'DailyUserAnalytics',  // Batch daily aggregation, not individual user actions
]);

// ─── Extension ──────────────────────────────────────────────────────────────

/**
 * Create a Prisma Client Extension that logs all data mutations.
 *
 * Logs are emitted via the secure logger (non-blocking, non-throwing).
 * Audit failures never prevent the actual database operation.
 */
export function withMutationAudit(context: MutationAuditContext) {
  return Prisma.defineExtension({
    name: 'mutation-audit',
    query: {
      $allOperations({ model, operation, args, query }) {
        // Only audit mutation operations on non-excluded models
        if (
          !MUTATION_OPERATIONS.has(operation) ||
          !model ||
          EXCLUDED_MODELS.has(model)
        ) {
          return query(args);
        }

        const startMs = Date.now();

        // Execute the query, then audit success or failure (non-blocking)
        return query(args)
          .then((result) => {
            try {
              const durationMs = Date.now() - startMs;

              // Extract record ID from result if available
              let recordId: string | null = null;
              if (result && typeof result === 'object' && 'id' in result) {
                recordId = String((result as any).id);
              }

              const entry = {
                event: 'data_mutation',
                model: model,
                operation,
                userId: context.userId,
                endpoint: context.endpoint ?? 'unknown',
                requestId: context.requestId ?? 'no-request-id',
                recordId,
                timestamp: new Date().toISOString(),
                duration: durationMs,
              };

              // Log via secure logger (console-based, non-blocking)
              logger.info('mutation_audit', entry);
            } catch {
              // Audit logging must never fail the mutation
            }

            return result;
          })
          .catch((error: unknown) => {
            // Log the failed mutation attempt for the audit trail
            try {
              const durationMs = Date.now() - startMs;
              logger.warn('mutation_audit', {
                event: 'data_mutation',
                model: model,
                operation,
                userId: context.userId,
                endpoint: context.endpoint ?? 'unknown',
                requestId: context.requestId ?? 'no-request-id',
                recordId: null,
                timestamp: new Date().toISOString(),
                duration: durationMs,
                failed: true,
                errorMessage:
                  error instanceof Error ? error.message : 'Unknown error',
              });
            } catch {
              // Audit logging must never fail the mutation
            }
            // Re-throw the original error so callers see it
            throw error;
          });
      },
    },
  });
}
