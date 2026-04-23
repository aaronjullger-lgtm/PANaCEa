import { z } from 'zod';
import { adminEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

const logger = createEndpointLogger('/api/admin/health-report');

/**
 * GET /api/admin/health-report/latest
 * Get the most recent health report snapshot
 */
const HealthReportSchema = z.object({
  query: z.object({
    days: z.coerce.number().min(1).max(365).optional().default(7),
  }).optional(),
});

export const onRequestGet = adminEndpoint(HealthReportSchema, async (context) => {
  const { env, validated } = context;
  const prisma = createEdgePrismaClient(env.DATABASE_URL);
  const days = validated?.query?.days ?? 7;

  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const reports = await prisma.contentHealthReport.findMany({
      where: {
        timestamp: { gte: startDate },
      },
      orderBy: { timestamp: 'desc' },
      take: 50,
    });

    if (!reports.length) {
      return {
        status: 404,
        data: { message: 'No health reports available yet' },
      };
    }

    // Extract trend data
    const trends = reports.map((r) => ({
      timestamp: r.timestamp,
      totalContent: r.totalContent,
      invalidFields: r.invalidFields,
      reportData: r.reportData,
    }));

    logger.info('Health reports fetched', { days, reportCount: reports.length });

    return {
      data: { days, reportCount: reports.length, trends },
    };
  } catch (error) {
    logger.error('Failed to fetch health reports', {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      status: 500,
      data: { error: 'Failed to fetch health reports' },
    };
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
