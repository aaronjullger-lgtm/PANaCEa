/**
 * API: Get content health reports
 * GET /api/admin/health/reports
 *
 * Security: cmsEndpoint() middleware — requires editor+ role.
 * Audit: Logs access via auditLog('admin_health_report_access').
 *
 * Query parameters:
 * - latest: Get only the latest report (default true)
 * - limit: Number of reports to return (default 10)
 */

import { z } from 'zod';
import { cmsEndpoint } from '../../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';
import { auditLog } from '../../_shared/auditLog';

const HealthReportsSchema = z.object({
  latest: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v !== 'false'),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
});

export const onRequestGet = cmsEndpoint(
  HealthReportsSchema,
  async (context) => {
    const { env, auth, validated } = context;
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      const { latest, limit } = validated;

      if (latest) {
        const report = await prisma.contentHealthReport.findFirst({
          orderBy: { timestamp: 'desc' },
        });

        if (!report) {
          return { status: 404, error: 'No health reports found' };
        }

        auditLog('admin_health_report_access', {
          userId: auth.userId,
          mode: 'latest',
        });

        return { data: report };
      } else {
        const reports = await prisma.contentHealthReport.findMany({
          orderBy: { timestamp: 'desc' },
          take: limit,
        });

        auditLog('admin_health_report_access', {
          userId: auth.userId,
          mode: 'list',
          count: reports.length,
        });

        return { data: { reports, count: reports.length } };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      auditLog('admin_health_report_access', {
        userId: auth.userId,
        error: message,
      });
      return { status: 500, error: 'Failed to fetch health reports' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { source: 'query' }
);
