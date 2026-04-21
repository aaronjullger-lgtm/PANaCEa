/**
 * Cron: Reservoir Maintenance
 *
 * Runs every 2 hours (externally triggered via cron-job.org or GitHub Actions).
 * POST /api/cron/reservoir-maintenance
 *
 * Responsibilities:
 *   1. Expire stale queued items past TTL
 *   2. Release abandoned reservations (reserved > 30 min, never consumed)
 *   3. Hard-delete old consumed/expired/failed items (> 7 days)
 *   4. Trigger refills for users below low water mark
 *
 * Auth: Requires CRON_SECRET bearer token (via cronEndpoint timing-safe check).
 */

import { cronEndpoint, ok } from '../_shared/endpoint';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { runMaintenance, triggerRefillsForLowUsers } from '../../../lib/services/reservoir';
import { analyzeAndTriggerGeneration } from '../../../lib/services/reservoir/blueprintGapAnalyzer';

export const onRequestPost = cronEndpoint({
  handler: async (context) => {
    const { env } = context;
    let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;

    try {
      prisma = createEdgePrismaClient(env.DATABASE_URL);
      const startTime = Date.now();

      const maintenance = await runMaintenance(prisma);
      const refills = await triggerRefillsForLowUsers(prisma);

      let blueprintGap: Awaited<ReturnType<typeof analyzeAndTriggerGeneration>> | null = null;
      try {
        blueprintGap = await analyzeAndTriggerGeneration(prisma, env);
      } catch (gapErr: unknown) {
        console.warn('[Cron] Blueprint gap analysis error:', gapErr instanceof Error ? gapErr.message : gapErr);
      }

      let mvRefreshed = 0;
      try {
        const mvNames = [
          'user_blueprint_coverage_mv',
          'system_accuracy_trend_mv',
          'daily_activity_summary_mv',
        ];
        for (const mv of mvNames) {
          await prisma.$executeRawUnsafe(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${mv}`);
          mvRefreshed++;
        }
      } catch (mvErr: unknown) {
        console.warn('[Cron] MV refresh error:', mvErr instanceof Error ? mvErr.message : mvErr);
      }

      const durationMs = Date.now() - startTime;

      try {
        await prisma.auditLog.create({
          data: {
            id: crypto.randomUUID(),
            action: 'RESERVOIR_MAINTENANCE',
            performedBy: 'system:cron',
            metadata: {
              expired: maintenance.expired,
              released: maintenance.released,
              deleted: maintenance.deleted,
              refillsChecked: refills.checked,
              refillsTriggered: refills.triggered,
              refillsSkipped: refills.skipped,
              blueprintGaps: blueprintGap?.gappedSystems.length ?? 0,
              blueprintGenerated: blueprintGap?.generatedCounts ?? {},
              mvRefreshed,
              durationMs,
            },
          },
        });
      } catch (auditErr) {
        console.warn('[reservoir-maintenance] Audit log write failed (non-critical):', auditErr instanceof Error ? auditErr.message : String(auditErr));
      }

      return ok({
        maintenance,
        refills,
        blueprintGap: blueprintGap ? {
          totalUnused: blueprintGap.totalUnused,
          gappedSystems: blueprintGap.gappedSystems.map((g) => g.system),
          generationTriggered: blueprintGap.generationTriggered,
          generatedCounts: blueprintGap.generatedCounts,
          errors: blueprintGap.errors,
        } : null,
        mvRefreshed,
        durationMs,
      });
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
});
