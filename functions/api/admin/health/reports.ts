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
import { validateFunctionEnv, MissingEnvError } from '../../_shared/env-validation';
import { canViewCMS, type UserRole } from '../../_shared/rbac';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';

export async function onRequestGet(context: { request: Request; env: Env }) {
  const { request, env } = context;

  try {
    validateFunctionEnv(env as Record<string, unknown>, ['DATABASE_URL', 'CLERK_SECRET_KEY']);
  } catch (e) {
    if (e instanceof MissingEnvError) return e.toResponse();
    throw e;
  }

  if (request.method === 'OPTIONS') {
    return handleCorsOptions(context);
  }

  const authContext = await authenticateRequest(request, env);
  if (!authContext) {
    return createErrorResponse(request, 'Unauthorized', 401, undefined, env);
  }

  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const user = await prisma.user.findUnique({
      where: { clerkId: authContext.clerkId },
      select: { role: true },
    });

    if (!user || !canViewCMS(user.role as UserRole)) {
      return createErrorResponse(request, 'Forbidden: Insufficient permissions', 403, undefined, env);
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
        return createErrorResponse(request, 'No health reports found', 404, undefined, env);
      }

      return createSuccessResponse(request, report, 200, 0, env);
    } else {
      // Get multiple reports
      const reports = await prisma.contentHealthReport.findMany({
        orderBy: { timestamp: 'desc' },
        take: limit,
      });

      return createSuccessResponse(
        request,
        {
          reports,
          count: reports.length,
        },
        200,
        0,
        env
      );
    }
  } catch (error: any) {
    console.error('Error fetching health reports:', error);
    return createErrorResponse(request, 'Failed to fetch health reports', 500, undefined, env);
  } finally {
    await safePrismaDisconnect(prisma);
  }
}
