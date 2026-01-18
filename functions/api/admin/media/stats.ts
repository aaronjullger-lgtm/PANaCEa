/**
 * Media Stats API Endpoint
 *
 * GET /api/admin/media/stats
 * Returns statistics about media approval workflow.
 */

import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';
import {
  authenticateRequest,
  createErrorResponse,
  createSuccessResponse,
} from '../../_shared/auth';

interface Env {
  DATABASE_URL: string;
  CLERK_SECRET_KEY: string;
}

export const onRequestGet = async (context: { request: Request; env: Env }) => {
  const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

  try {
    // Authenticate - require admin role
    const auth = await authenticateRequest(context.request, context.env);
    if (!auth) {
      return createErrorResponse('Unauthorized', 401);
    }

    const user = await prisma.user.findUnique({
      where: { clerkId: auth.clerkId },
      select: { role: true },
    });

    if (!user || user.role !== 'admin') {
      return createErrorResponse('Admin access required', 403);
    }

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

    return createSuccessResponse({
      success: true,
      stats: {
        pending,
        approved,
        rejected,
        total,
        approvalRate: total > 0 ? Math.round((approved / total) * 100) : 0,
        byCategory: byCategory.map((c) => ({
          category: c.type,
          count: c._count.id,
        })),
        recentActivity: {
          approvals: recentApprovals,
          uploads: recentUploads,
        },
      },
    });
  } catch (error) {
    console.error('Media stats error:', error);
    return createErrorResponse('Failed to fetch media stats', 500);
  } finally {
    await safePrismaDisconnect(prisma);
  }
};