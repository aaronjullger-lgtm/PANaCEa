/**
 * GET /api/mapping-enrichment/audit-logs
 * Retrieve mapping audit logs with optional filtering and pagination.
 * Admin role required.
 */

import { z } from 'zod';
import { adminAuthenticatedEndpoint } from '../_shared/middleware';
import { ok, fail, ErrorCode } from '../_shared/endpoint';
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

export const onRequestGet = adminAuthenticatedEndpoint(
  AuditLogsQuerySchema,
  async (context) => {
    const { env, validated } = context;
    const query = validated.query;
    const logger = createEndpointLogger('/api/mapping-enrichment/audit-logs');

    let prisma = null;
    try {
      prisma = createEdgePrismaClient(env.DATABASE_URL);

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
      return ok({ logs, total });
    } catch (error) {
      logger.error('Failed to fetch audit logs', { error: error instanceof Error ? error.message : String(error) });
      return fail(ErrorCode.INTERNAL_ERROR, { message: 'Internal server error' });
    } finally {
      if (prisma) {
        await safePrismaDisconnect(prisma);
      }
    }
  }
);
