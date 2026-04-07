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
 * Auth: Requires CRON_SECRET bearer token.
 */

import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { withCors } from '../_shared/middleware';
import { runMaintenance, triggerRefillsForLowUsers } from '../../../lib/services/reservoir';
import { analyzeAndTriggerGeneration } from '../../../lib/services/reservoir/blueprintGapAnalyzer';

export const onRequestOptions = withCors();

export const onRequestPost: PagesFunction<any> = async (context) => {
  const { env, request } = context;

  // Auth check
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;

  try {
    prisma = createEdgePrismaClient(env.DATABASE_URL);
    const startTime = Date.now();

    // Step 1-3: Maintenance sweep
    const maintenance = await runMaintenance(prisma);

    // Step 4: Trigger refills for low users
    const refills = await triggerRefillsForLowUsers(prisma);

    // Step 5: Blueprint gap analysis + generation trigger (Sprint 3)
    // Checks pool distribution vs NCCPA blueprint weights and generates
    // questions for under-represented systems.
    let blueprintGap: Awaited<ReturnType<typeof analyzeAndTriggerGeneration>> | null = null;
    try {
      blueprintGap = await analyzeAndTriggerGeneration(prisma, env);
    } catch (gapErr: any) {
      console.warn('[Cron] Blueprint gap analysis error:', gapErr?.message ?? gapErr);
    }

    // Step 6: Refresh materialized views (Phase 5)
    // CONCURRENTLY allows reads during refresh. Non-blocking.
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
    } catch (mvErr: any) {
      // MV refresh failure is non-critical — views may not exist yet
      console.warn('[Cron] MV refresh error:', mvErr?.message ?? mvErr);
    }

    const durationMs = Date.now() - startTime;

    // Audit log
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
      // Audit log failure is non-critical — cron result was already committed
      console.warn('[reservoir-maintenance] Audit log write failed (non-critical):', auditErr instanceof Error ? auditErr.message : String(auditErr));
    }

    return new Response(
      JSON.stringify({
        success: true,
        maintenance,
        refills,
        blueprintGap: blueprintGap ? {
          totalUnused: blueprintGap.totalUnused,
          gappedSystems: blueprintGap.gappedSystems.map(g => g.system),
          generationTriggered: blueprintGap.generationTriggered,
          generatedCounts: blueprintGap.generatedCounts,
          errors: blueprintGap.errors,
        } : null,
        mvRefreshed,
        durationMs,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message ?? 'Reservoir maintenance failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  } finally {
    await safePrismaDisconnect(prisma);
  }
};
