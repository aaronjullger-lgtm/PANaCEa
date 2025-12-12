/**
 * API: Get audit logs
 * GET /api/admin/audit/logs
 * 
 * Query parameters:
 * - contentId: Filter by content ID
 * - userId: Filter by user ID
 * - changeType: Filter by change type
 * - startDate: Start date for filtering
 * - endDate: End date for filtering
 * - limit: Number of records (default 50, max 100)
 * - offset: Pagination offset
 */

import { authenticateRequest, createErrorResponse, createSuccessResponse, handleCorsOptions, type Env } from '../../_shared/auth';
import { canViewCMS, type UserRole } from '../../_shared/rbac';
import { exportAuditLogsToCsv } from '../../../../lib/services/cms/auditLogger';
import { createEdgePrismaClient } from '../../_shared/prisma-edge';

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
      select: { role: true }
    });

    if (!user || !canViewCMS(user.role as UserRole)) {
      return createErrorResponse('Forbidden: Insufficient permissions', 403);
    }

    const url = new URL(request.url);
    const contentId = url.searchParams.get('contentId') || undefined;
    const userId = url.searchParams.get('userId') || undefined;
    const changeType = url.searchParams.get('changeType') || undefined;
    const startDate = url.searchParams.get('startDate') || undefined;
    const endDate = url.searchParams.get('endDate') || undefined;
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);
    const format = url.searchParams.get('format') || 'json'; // 'json' or 'csv'

    // Build where clause
    const where: any = {};
    if (contentId) where.contentId = contentId;
    if (userId) where.changedBy = userId;
    if (changeType) where.changeType = changeType;
    
    if (startDate || endDate) {
      where.changedAt = {};
      if (startDate) where.changedAt.gte = new Date(startDate);
      if (endDate) where.changedAt.lte = new Date(endDate);
    }

    // Get logs
    const logs = await prisma.contentAuditLog.findMany({
      where,
      orderBy: { changedAt: 'desc' },
      take: limit,
      skip: offset,
    });

    // Get total count for pagination
    const total = await prisma.contentAuditLog.count({ where });

    // Return CSV format if requested
    if (format === 'csv') {
      const csv = exportAuditLogsToCsv(logs);
      return new Response(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="audit-log.csv"',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // Return JSON format
    return createSuccessResponse({
      logs,
      pagination: {
        limit,
        offset,
        total,
        hasMore: offset + logs.length < total,
      },
    });
  } catch (error: any) {
    console.error('Error fetching audit logs:', error);
    return createErrorResponse('Failed to fetch audit logs', 500);
  } finally {
    await prisma.$disconnect();
  }
}
