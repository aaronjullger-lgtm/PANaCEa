/**
 * Platform Statistics API
 * GET /api/admin/platform-stats
 *
 * Returns aggregated platform-wide statistics with optional date range filtering.
 * Admin-only endpoint.
 *
 * Query params:
 * - start: Start date (YYYY-MM-DD)
 * - end: End date (YYYY-MM-DD)
 * - limit: Number of days to return (default 30)
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { isAdmin, type UserRole } from '../_shared/rbac';

const PlatformStatsSchema = z.object({
  query: z
    .object({
      start: z.string().optional(),
      end: z.string().optional(),
      limit: z.string().optional(),
    })
    .optional(),
});

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(PlatformStatsSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/admin/platform-stats');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { clerkId: auth.userId },
      select: { role: true, id: true },
    });

    const role = String(user?.role).toLowerCase() as UserRole | undefined;

    if (!user || !role || !isAdmin(role)) {
      logger.warn('Non-admin attempted to access platform stats', {
        userId: auth.userId,
        role: user?.role,
      });

      return {
        data: { error: 'Admin access required' },
        status: 403,
      };
    }

    // Parse query parameters
    const startParam = validated.query?.start;
    const endParam = validated.query?.end;
    const limitParam = validated.query?.limit;

    const limit = limitParam ? parseInt(limitParam) : 30;

    const endDate = endParam ? new Date(endParam) : new Date();
    endDate.setUTCHours(23, 59, 59, 999);

    const startDate = startParam
      ? new Date(startParam)
      : new Date(endDate.getTime() - limit * 24 * 60 * 60 * 1000);
    startDate.setUTCHours(0, 0, 0, 0);

    // Query platform statistics
    const stats = await prisma.platformStatistics.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: {
        date: 'desc',
      },
      take: limit,
    });

    // Calculate summary metrics
    const summary =
      stats.length > 0
        ? {
            totalDays: stats.length,
            avgDAU: Math.round(
              stats.reduce((sum: number, s: (typeof stats)[0]) => sum + s.dau, 0) / stats.length
            ),
            avgWAU: Math.round(
              stats.reduce((sum: number, s: (typeof stats)[0]) => sum + s.wau, 0) / stats.length
            ),
            avgMAU: Math.round(
              stats.reduce((sum: number, s: (typeof stats)[0]) => sum + s.mau, 0) / stats.length
            ),
            totalQuestionsAnswered: stats.reduce(
              (sum: number, s: (typeof stats)[0]) => sum + s.questionsAnswered,
              0
            ),
            avgAccuracy: stats
              .filter((s: (typeof stats)[0]) => s.averageAccuracy !== null)
              .reduce(
                (sum: number, s: (typeof stats)[0], _: number, arr: typeof stats) =>
                  sum + Number(s.averageAccuracy) / arr.length,
                0
              ),
            totalNewUsers: stats.reduce((sum: number, s: (typeof stats)[0]) => sum + s.newUsers, 0),
            avgRetention7Day: stats
              .filter((s: (typeof stats)[0]) => s.retention7Day !== null)
              .reduce(
                (sum: number, s: (typeof stats)[0], _: number, arr: typeof stats) =>
                  sum + Number(s.retention7Day) / arr.length,
                0
              ),
            avgRetention30Day: stats
              .filter((s: (typeof stats)[0]) => s.retention30Day !== null)
              .reduce(
                (sum: number, s: (typeof stats)[0], _: number, arr: typeof stats) =>
                  sum + Number(s.retention30Day) / arr.length,
                0
              ),
          }
        : null;

    logger.info('Platform statistics retrieved', {
      userId: user.id,
      daysReturned: stats.length,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    });

    return {
      data: {
        success: true,
        data: stats,
        summary,
        dateRange: {
          start: startDate.toISOString().split('T')[0],
          end: endDate.toISOString().split('T')[0],
        },
      },
    };
  } catch (error) {
    logger.error('Error fetching platform statistics', {
      error: error instanceof Error ? error.message : String(error),
      userId: auth.userId,
    });
    throw new Error('Failed to fetch platform statistics');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
