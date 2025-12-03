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
import { isAdmin } from '../_shared/rbac';

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

    // Note: In a real implementation, we'd fetch the user's role from the database
    // For now, this is a placeholder. In production:
    // const user = await prisma.user.findUnique({
    //   where: { clerkId: authContext.userId },
    //   select: { role: true }
    // });
    //
    // if (!user || !isAdmin(user.role as any)) {
    //   return createErrorResponse('Forbidden', 403);
    // }

    // Placeholder check - in production this would verify actual role from DB
    // For now, we'll return stats for any authenticated user
    // TODO: Add proper role checking when database is connected

    // Note: In Cloudflare Workers/Pages Functions, we can't use Prisma directly
    // In production, you'd use Prisma Data Proxy or D1 to query:
    // const [totalUsers, activeToday, totalSessions] = await Promise.all([
    //   prisma.user.count(),
    //   prisma.dailyStreak.count({
    //     where: { date: new Date().toISOString().split('T')[0] }
    //   }),
    //   prisma.performanceRecord.count()
    // ]);

    const response = {
      success: true,
      data: {
        totalUsers: 0,
        activeUsersToday: 0,
        totalStudySessions: 0,
        averageAccuracy: 0,
        popularSystems: [],
      },
    };

    return createSuccessResponse(response);
  } catch (error) {
    console.error('Admin stats error:', error);
    return createErrorResponse('Internal server error', 500);
  }
}
