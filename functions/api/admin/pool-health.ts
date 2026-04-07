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
 * Auth: Requires admin role (adminAuthenticatedEndpoint).
 * Sprint: Admin Safety Sprint — April 2026
 */

import { z } from 'zod';
import { adminAuthenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { assessPoolHealth } from '../../../lib/services/batchVariantService';

const PoolHealthSchema = z.object({
  query: z.object({
    system: z.string().optional(),
  }).optional(),
});

export const onRequestOptions = withCors();

export const onRequestGet = adminAuthenticatedEndpoint(
  PoolHealthSchema,
  async (context) => {
    const { env, request } = context;
    let prisma;

    try {
      prisma = createEdgePrismaClient(env.DATABASE_URL);
      const health = await assessPoolHealth(prisma);

      const url = new URL(request.url);
      const systemFilter = url.searchParams.get('system');

      // If system filter, narrow the thin conditions list
      const thinList = systemFilter
        ? health.thinConditionsList.filter(c => c.system === systemFilter)
        : health.thinConditionsList.slice(0, 100); // Cap for response size

      return {
        data: {
          totalConditions: health.totalConditions,
          healthyConditions: health.healthyConditions,
          thinConditions: health.thinConditions,
          emptyConditions: health.emptyConditions,
          coverageBySystem: health.coverageBySystem,
          thinConditionsList: thinList,
        },
      };
    } catch (error) {
      console.error('Pool health check failed:', error);
      return { status: 500, error: 'Pool health check failed' };
    } finally {
      if (prisma) await safePrismaDisconnect(prisma);
    }
  },
  { source: 'query' }
);
