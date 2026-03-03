/**
 * GET /api/mapping-enrichment/audit-logs
 * Retrieve mapping audit logs with optional filtering and pagination.
 * Admin role required.
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { getAuditLogs, type AuditLogQuery } from '@/services/domain/audit/mappingAuditLogger';

const AuditLogsQuerySchema = z.object({
  query: z.object({
    taxonomyCode: z.string().optional(),
    systemCode: z.string().optional(),
    action: z.enum(['APPROVE', 'REJECT', 'IGNORE', 'MANUAL_ADD', 'MANUAL_REMOVE', 'PREVIEW']).optional(),
    userId: z.string().optional(),
    startDate: z.string().datetime().optional().transform((val) => val ? new Date(val) : undefined),
    endDate: z.string().datetime().optional().transform((val) => val ? new Date(val) : undefined),
    limit: z.coerce.number().int().positive().max(100).default(50),
    offset: z.coerce.number().int().nonnegative().default(0),
  }),
});

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(
  AuditLogsQuerySchema,
  async (context) => {
    const { env, auth, validated } = context;
    const query = validated.query;
    const logger = createEndpointLogger('/api/mapping-enrichment/audit-logs');

    let prisma = null;
    try {
      prisma = createEdgePrismaClient(env.DATABASE_URL);

      // Optionally check admin role (same as other mapping-enrichment endpoints)
      const user = await prisma.user.findUnique({
        where: { clerkId: auth.userId },
        select: { role: true, id: true },
      });

      if (user?.role !== 'ADMIN' && user?.role !== 'SUPERADMIN') {
        logger.warn('Non-admin attempted to fetch audit logs', {
          userId: auth.userId,
          role: user?.role,
        });
        return new Response(JSON.stringify({ error: 'Insufficient permissions' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const auditLogQuery: AuditLogQuery = {
        taxonomyCode: query.taxonomyCode,
        systemCode: query.systemCode,
        action: query.action,
        userId: query.userId,
        startDate: query.startDate,
        endDate: query.endDate,
        limit: query.limit,
        offset: query.offset,
      };

      const { logs, total } = await getAuditLogs(prisma, auditLogQuery);

      return new Response(JSON.stringify({ logs, total }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      logger.error('Failed to fetch audit logs', { error: error instanceof Error ? error.message : String(error) });
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    } finally {
      if (prisma) {
        await safePrismaDisconnect(prisma);
      }
    }
  }
);