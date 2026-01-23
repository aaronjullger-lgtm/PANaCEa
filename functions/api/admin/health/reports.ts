/**
 * API: Get content health reports
 * GET /api/admin/health/reports
 *
 * Query parameters:
 * - latest: Get only the latest report (default true)
 * - limit: Number of reports to return (default 10)
 */

import {
  authenticateRequest,
  createErrorResponse,
  createSuccessResponse,
  handleCorsOptions,
  type Env,
} from '../../_shared/auth';
import { canViewCMS, type UserRole } from '../../_shared/rbac';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';

export async function onRequestGet(context: { request: Request; env: Env }) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return handleCorsOptions();
  }

  const authContext = await authenticateRequest(request, env);
  if (!authContext) {
    return createErrorResponse('Unauthorized', 401);
  }

  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const user = await prisma.user.findUnique({
      where: { clerkId: authContext.clerkId },
      select: { role: true },
    });

    if (!user || !canViewCMS(user.role as UserRole)) {
      return createErrorResponse('Forbidden: Insufficient permissions', 403);
    }

    const url = new URL(request.url);
    const latest = url.searchParams.get('latest') !== 'false';
    const limit = parseInt(url.searchParams.get('limit') || '10', 10);

    if (latest) {
      // Get only the latest report
      const report = await prisma.contentHealthReport.findFirst({
        orderBy: { timestamp: 'desc' },
      });

      if (!report) {
        return createErrorResponse('No health reports found', 404);
      }

      return createSuccessResponse(report);
    } else {
      // Get multiple reports
      const reports = await prisma.contentHealthReport.findMany({
        orderBy: { timestamp: 'desc' },
        take: limit,
      });

      return createSuccessResponse({
        reports,
        count: reports.length,
      });
    }
  } catch (error: any) {
    console.error('Error fetching health reports:', error);
    return createErrorResponse('Failed to fetch health reports', 500);
  } finally {
    await safePrismaDisconnect(prisma);
  }
}
