/**
 * GET /api/analytics/blueprint-coverage
 *
 * Returns a full blueprint coverage report for the authenticated user,
 * comparing their MAIN-session attempt distribution against the 2025
 * PANCE or family-medicine EOR blueprint weights.
 *
 * Query params:
 *   - rotation: 'pance' (default) | 'family_medicine'
 */

import { z } from 'zod';
import { authenticatedEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { getCoverageReport } from '../../../lib/services/blueprintCoverageService';

const BlueprintCoverageSchema = z.object({
  rotation: z.enum(['pance', 'family_medicine']).optional().default('pance'),
});

export const onRequestGet = authenticatedEndpoint(
  BlueprintCoverageSchema,
  async (context) => {
    const { env, auth, validated } = context;
    const logger = createEndpointLogger('/api/analytics/blueprint-coverage');
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      // Resolve internal userId from Clerk ID
      const user = await prisma.user.findUnique({
        where: { clerkId: auth.userId },
        select: { id: true },
      });

      if (!user) {
        return { status: 404, error: 'User not found' };
      }

      const coverageReport = await getCoverageReport(
        prisma as Parameters<typeof getCoverageReport>[0],
        user.id,
        validated.rotation
      );

      return {
        data: {
          coverageReport,
          // Surface top-level fields for dashboard quick-access
          underCoveredSystems: coverageReport.underCoveredSystems,
          topPriorityGap: coverageReport.topPriorityGap,
        },
        headers: { 'Cache-Control': 'public, max-age=300' },
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('Blueprint coverage query failed', { error: msg });
      return { status: 503, error: 'Analytics temporarily unavailable' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { source: 'query' }
);
