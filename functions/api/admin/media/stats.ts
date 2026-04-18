/**
 * Media Stats API Endpoint
 *
 * GET /api/admin/media/stats
 * Returns statistics about media approval workflow.
 *
 * Security: adminEndpoint() middleware with rate limiting, auth, and logging
 */

import { z } from 'zod';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';
import { logger } from '../../_shared/secureLogger';
import { adminAuthenticatedEndpoint } from '../../_shared/middleware';

export const onRequestGet = adminAuthenticatedEndpoint(
  z.object({}).passthrough(),
  async (context) => {
    const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

    try {
      // Fetch counts by status
      const [pending, approved, rejected, total] = await Promise.all([
        prisma.mediaAsset.count({ where: { approvalStatus: 'pending' } }),
        prisma.mediaAsset.count({ where: { approvalStatus: 'approved' } }),
        prisma.mediaAsset.count({ where: { approvalStatus: 'rejected' } }),
        prisma.mediaAsset.count(),
      ]);

      // Fetch counts by category/type
      const byCategory = await prisma.mediaAsset.groupBy({
        by: ['type'],
        _count: { id: true },
      });

      // Recent activity (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const recentApprovals = await prisma.mediaAsset.count({
        where: {
          approvalStatus: 'approved',
          approvedAt: { gte: sevenDaysAgo },
        },
      });

      const recentUploads = await prisma.mediaAsset.count({
        where: {
          createdAt: { gte: sevenDaysAgo },
        },
      });

      logger.info('Media stats fetched', {
        userId: context.auth.userId,
        total,
        pending,
      });

      return {
        data: {
          success: true,
          stats: {
            pending,
            approved,
            rejected,
            total,
            approvalRate: total > 0 ? Math.round((approved / total) * 100) : 0,
            byCategory: byCategory.map((c: (typeof byCategory)[0]) => ({
              category: c.type,
              count: c._count.id,
            })),
            recentActivity: {
              approvals: recentApprovals,
              uploads: recentUploads,
            },
          },
        },
      };
    } catch (error) {
      logger.error('Media stats error', error, {
        userId: context.auth.userId,
      });
      return { status: 500, error: 'Failed to fetch media stats' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { source: 'query', requestsPerMinute: 60 }
);
