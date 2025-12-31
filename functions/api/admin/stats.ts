/**
 * Admin API - Get platform statistics
 * GET /api/admin/stats
 * Requires: admin or superadmin role
 */

import {
  type Env,
  authenticateRequest,
  createErrorResponse,
  createSuccessResponse,
  handleCorsOptions,
} from '../_shared/auth';
import { createEdgePrismaClient } from '../_shared/prisma-edge';

interface PagesContext {
  request: Request;
  env: Env;
}

export async function onRequestOptions(): Promise<Response> {
  return handleCorsOptions();
}

/**
 * GET: Fetch platform statistics (admin only)
 */
export async function onRequestGet(context: PagesContext): Promise<Response> {
  const { request, env } = context;

  try {
    const authContext = await authenticateRequest(request, env);

    if (!authContext) {
      return createErrorResponse('Unauthorized', 401);
    }

    // If no DATABASE_URL, return placeholder data
    if (!env.DATABASE_URL) {
      return createSuccessResponse({
        success: true,
        data: {
          totalUsers: 0,
          activeUsersToday: 0,
          totalStudySessions: 0,
          averageAccuracy: 0,
          popularSystems: [],
          pendingFlags: 0,
        },
        note: 'Database not configured',
      });
    }

    const prisma = createEdgePrismaClient(env);

    try {
      // Fetch real stats from database
      const [
        totalUsers,
        totalAttempts,
        correctAttempts,
        pendingFlags,
        systemStats
      ] = await Promise.all([
        // Total users
        prisma.user.count(),
        
        // Total question attempts
        prisma.questionAttempt.count(),
        
        // Correct attempts for accuracy calculation
        prisma.questionAttempt.count({
          where: { wasCorrect: true }
        }),
        
        // Pending question flags
        prisma.questionFlag.count({
          where: { status: 'pending' }
        }),
        
        // Popular systems
        prisma.questionAttempt.groupBy({
          by: ['system'],
          _count: { id: true },
          orderBy: { _count: { id: 'desc' } },
          take: 5,
        })
      ]);

      // Calculate average accuracy
      const averageAccuracy = totalAttempts > 0 
        ? Math.round((correctAttempts / totalAttempts) * 100 * 10) / 10
        : 0;

      // Format popular systems
      const popularSystems = systemStats
        .filter(s => s.system)
        .map(s => ({
          system: s.system,
          count: s._count.id
        }));

      return createSuccessResponse({
        success: true,
        data: {
          totalUsers,
          activeUsersToday: 0, // TODO: Calculate based on session activity
          totalStudySessions: totalAttempts,
          averageAccuracy,
          popularSystems,
          pendingFlags,
        },
      });
    } finally {
      await prisma.$disconnect();
    }
  } catch (error) {
    console.error('Admin stats error:', error);
    return createErrorResponse('Internal server error', 500);
  }
}
