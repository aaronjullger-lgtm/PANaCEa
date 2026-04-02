/**
 * Question Pool Health API — Admin Endpoint
 *
 * Returns per-system coverage stats: how many conditions are healthy (>=3
 * questions), thin (1-2), or empty (0). Used by admin dashboard to
 * monitor content coverage and trigger targeted variant generation.
 *
 * GET /api/admin/pool-health
 * GET /api/admin/pool-health?system=cardiovascular
 *
 * Sprint 1D — April 2026
 */

import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { assessPoolHealth } from '../../../lib/services/batchVariantService';

export const onRequestGet: PagesFunction = async (context) => {
  let prisma;
  try {
    prisma = createEdgePrismaClient();
    const health = await assessPoolHealth(prisma);

    const url = new URL(context.request.url);
    const systemFilter = url.searchParams.get('system');

    // If system filter, narrow the thin conditions list
    const thinList = systemFilter
      ? health.thinConditionsList.filter(c => c.system === systemFilter)
      : health.thinConditionsList.slice(0, 100); // Cap for response size

    return new Response(
      JSON.stringify({
        totalConditions: health.totalConditions,
        healthyConditions: health.healthyConditions,
        thinConditions: health.thinConditions,
        emptyConditions: health.emptyConditions,
        coverageBySystem: health.coverageBySystem,
        thinConditionsList: thinList,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Pool health check failed:', error);
    return new Response(
      JSON.stringify({ error: 'Pool health check failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  } finally {
    if (prisma) await safePrismaDisconnect(prisma);
  }
};