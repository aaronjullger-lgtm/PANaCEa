/**
 * Admin API - Get platform statistics
 * GET /api/admin/stats
 * Requires: admin or superadmin role
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

const AdminStatsSchema = z.object({
  query: z.object({}).optional(),
});

export const onRequestOptions = withCors();

/**
 * GET: Fetch platform statistics (admin only)
 */
export const onRequestGet = authenticatedEndpoint(AdminStatsSchema, async (context) => {
  const { env, auth } = context;
  const logger = createEndpointLogger('/api/admin/stats');
  
  // If no DATABASE_URL, return placeholder data
  if (!env.DATABASE_URL) {
    logger.warn('Database not configured', { userId: auth.userId });
    
    return {
      data: {
        success: true,
        data: {
          totalUsers: 0,
          activeUsersToday: 0,
          totalStudySessions: 0,
          averageAccuracy: 0,
          popularSystems: [],
          pendingFlags: 0,
        },
        note: 'Database not configured',
      },
    };
  }

  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { clerkId: auth.userId },
      select: { role: true, id: true },
    });

    if (user?.role !== 'admin' && user?.role !== 'superadmin') {
      logger.warn('Non-admin attempted to access admin stats', {
        userId: auth.userId,
        role: user?.role,
      });

      return {
        data: { error: 'Admin access required' },
        status: 403,
      };
    }

    // Calculate today's start for active users
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Fetch real stats from database
    const [
      totalUsers,
      activeUsersToday,
      totalAttempts,
      correctAttempts,
      pendingFlags,
      systemStats,
    ] = await Promise.all([
      // Total users
      prisma.user.count(),

      // Active users today (distinct users with attempts today)
      prisma.questionAttempt
        .groupBy({
          by: ['userId'],
          where: {
            attemptedAt: { gte: todayStart },
          },
        })
        .then((results: { userId: string }[]) => results.length),

      // Total question attempts
      prisma.questionAttempt.count(),

      // Correct attempts for accuracy calculation
      prisma.questionAttempt.count({
        where: { wasCorrect: true },
      }),

      // Pending question flags
      prisma.questionFlag.count({
        where: { status: 'pending' },
      }),

      // Popular systems
      prisma.questionAttempt.groupBy({
        by: ['system'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      }),
    ]);

    // Calculate average accuracy
    const averageAccuracy =
      totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100 * 10) / 10 : 0;

    // Format popular systems
    const popularSystems = systemStats
      .filter((s: typeof systemStats[0]) => s.system)
      .map((s: typeof systemStats[0]) => ({
        system: s.system,
        count: s._count.id,
      }));

    logger.info('Admin stats retrieved', {
      userId: user.id,
      totalUsers,
      activeUsersToday,
    });

    return {
      data: {
        success: true,
        data: {
          totalUsers,
          activeUsersToday,
          totalStudySessions: totalAttempts,
          averageAccuracy,
          popularSystems,
          pendingFlags,
        },
      },
    };
  } catch (error) {
    logger.error('Admin stats error', {
      error: error instanceof Error ? error.message : String(error),
      userId: auth.userId,
    });
    throw new Error('Failed to fetch admin stats');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});