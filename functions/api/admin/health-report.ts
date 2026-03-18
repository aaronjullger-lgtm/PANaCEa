import { Request } from '@cloudflare/workers-types';
import { requireAuth } from '../_shared/auth';
import { errorHandler } from '../_shared/error-handler';
import { prisma } from '../_shared/prisma-edge';

/**
 * GET /api/admin/health-report/latest
 * Get the most recent health report snapshot
 */
export async function onRequestGet(request: Request): Promise<Response> {
  try {
    await requireAuth(request, 'ADMIN');

    const report = await prisma.contentHealthReport.findFirst({
      orderBy: { timestamp: 'desc' },
      take: 1,
    });

    if (!report) {
      return new Response(
        JSON.stringify({ message: 'No health reports available yet' }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(JSON.stringify(report), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return errorHandler(error);
  }
}

/**
 * GET /api/admin/health-report/history?days=7
 * Get health report history for the past N days
 */
export async function onRequestGetHistory(request: Request): Promise<Response> {
  try {
    await requireAuth(request, 'ADMIN');

    const url = new URL(request.url);
    const days = parseInt(url.searchParams.get('days') || '7', 10);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const reports = await prisma.contentHealthReport.findMany({
      where: {
        timestamp: { gte: startDate },
      },
      orderBy: { timestamp: 'desc' },
      take: 50,
    });

    // Extract trend data
    const trends = reports.map((r) => ({
      timestamp: r.timestamp,
      totalContent: r.totalContent,
      invalidFields: r.invalidFields,
      reportData: r.reportData,
    }));

    return new Response(JSON.stringify({ days, reportCount: reports.length, trends }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return errorHandler(error);
  }
}
