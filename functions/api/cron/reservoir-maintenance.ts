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
            durationMs,
          },
        },
      });
    } catch {
      // Audit log failure is non-critical
    }

    return new Response(
      JSON.stringify({
        success: true,
        maintenance,
        refills,
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
