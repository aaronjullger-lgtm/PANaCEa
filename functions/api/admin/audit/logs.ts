/**
 * API: Get audit logs
 * GET /api/admin/audit/logs
 *
 * Requires: admin role (tightened from viewer — audit logs are sensitive).
 * Includes: rate limiting (60 req/min), structured logging, audit trail.
 *
 * Query parameters:
 * - contentId: Filter by content ID
 * - userId: Filter by user ID
 * - changeType: Filter by change type
 * - startDate: Start date for filtering
 * - endDate: End date for filtering
 * - limit: Number of records (default 50, max 100)
 * - offset: Pagination offset
 * - format: 'json' (default) or 'csv'
 */

import { z } from 'zod';
import { adminAuthenticatedEndpoint, withCors } from '../../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';
import { createEndpointLogger } from '../../_shared/secureLogger';
import { auditLog } from '../../_shared/auditLog';
import { AuditLogQuerySchema } from '../../_shared/schemas';
import { exportAuditLogsToCsv } from '../../../../lib/services/cms/auditLogger';
import { getCorsHeaders } from '../../_shared/cors';

const logger = createEndpointLogger('/api/admin/audit/logs');

export const onRequestOptions = withCors();

export const onRequestGet = adminAuthenticatedEndpoint(
  z.object({
    query: AuditLogQuerySchema,
  }),
  async (context) => {
    const { env, auth } = context;
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      // Parse query params directly (validated schema ensures defaults)
      const url = new URL(context.request.url);
      const contentId = url.searchParams.get('contentId') || undefined;
      const userId = url.searchParams.get('userId') || undefined;
      const changeType = url.searchParams.get('changeType') || undefined;
      const startDate = url.searchParams.get('startDate') || undefined;
      const endDate = url.searchParams.get('endDate') || undefined;
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100);
      const offset = parseInt(url.searchParams.get('offset') || '0', 10);
      const format = url.searchParams.get('format') || 'json';

      // Audit the access itself (sensitive data)
      auditLog('admin_audit_log_access', {
        adminClerkId: auth.userId,
        filters: { contentId, userId, changeType, startDate, endDate },
      });

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
        const corsHeaders = getCorsHeaders(context.request) || {};
        return new Response(csv, {
          status: 200,
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': 'attachment; filename="audit-log.csv"',
            ...corsHeaders,
          },
        });
      }

      logger.info('Audit logs retrieved', { total, limit, offset });

      return {
        data: {
          logs,
          pagination: {
            limit,
            offset,
            total,
            hasMore: offset + logs.length < total,
          },
        },
      };
    } catch (error) {
      logger.error('Error fetching audit logs', error);
      return { status: 500, error: 'Failed to fetch audit logs' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { source: 'query' }
);
