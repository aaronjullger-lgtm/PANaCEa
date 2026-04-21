/**
 * Admin: Reservoir Health Dashboard
 *
 * GET /api/admin/reservoir-health
 *
 * Returns comprehensive metrics about the question reservoir's health:
 *   - Queue depth distribution across users
 *   - Refill job success/failure rates (last 24h)
 *   - Expiration and consumption rates
 *   - Users at risk (empty or low reservoir)
 *
 * Auth: Requires admin role (adminAuthenticatedEndpoint).
 * Sprint: Admin Safety Sprint — April 2026
 */

import { z } from 'zod';
import { adminAuthenticatedEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { RESERVOIR_POLICY } from '../../../lib/services/reservoir';

const ReservoirHealthSchema = z.object({}).optional();

export const onRequestGet = adminAuthenticatedEndpoint(
  ReservoirHealthSchema,
  async (context) => {
    const { env } = context;
    let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;

    try {
      prisma = createEdgePrismaClient(env.DATABASE_URL);

      const twentyFourHoursAgo = new Date(Date.now() - 86400_000);

      // ── Query 1: Queue depth distribution ──
      const queueStats: any[] = await prisma.$queryRawUnsafe(`
        SELECT
          COUNT(DISTINCT "userId") as total_users,
          COUNT(DISTINCT "userId") FILTER (
            WHERE queued_count >= $1
          ) as healthy_users,
          COUNT(DISTINCT "userId") FILTER (
            WHERE queued_count < $2 AND queued_count > 0
          ) as low_users,
          COUNT(DISTINCT "userId") FILTER (
            WHERE queued_count = 0
          ) as empty_users,
          COALESCE(AVG(queued_count), 0) as avg_depth,
          COALESCE(SUM(queued_count), 0) as total_items
        FROM (
          SELECT "userId",
            COUNT(*) FILTER (WHERE "status" = 'queued' AND "expiresAt" > NOW()) as queued_count
          FROM "StudentReservoirItem"
          GROUP BY "userId"
        ) q
      `, RESERVOIR_POLICY.HIGH_WATER_MARK, RESERVOIR_POLICY.LOW_WATER_MARK);

      // ── Query 2: Status distribution ──
      const statusCounts = await prisma.studentReservoirItem.groupBy({
        by: ['status'],
        _count: true,
      });

      // ── Query 3: Refill job health (last 24h) ──
      const jobStats = await prisma.backgroundJob.groupBy({
        by: ['status'],
        where: {
          jobType: 'generate_questions',
          createdAt: { gte: twentyFourHoursAgo },
        },
        _count: true,
      });

      // ── Query 4: Recent expiration rate ──
      const recentExpired = await prisma.studentReservoirItem.count({
        where: {
          status: 'expired',
          createdAt: { gte: twentyFourHoursAgo },
        },
      });
      const recentCreated = await prisma.studentReservoirItem.count({
        where: {
          createdAt: { gte: twentyFourHoursAgo },
        },
      });

      // ── Query 5: Top 10 users by deficit ──
      const lowUsers: any[] = await prisma.$queryRawUnsafe(`
        SELECT "userId", "scope",
          COUNT(*) FILTER (WHERE "status" = 'queued' AND "expiresAt" > NOW()) as queued_count
        FROM "StudentReservoirItem"
        GROUP BY "userId", "scope"
        HAVING COUNT(*) FILTER (WHERE "status" = 'queued' AND "expiresAt" > NOW()) < $1
        ORDER BY queued_count ASC
        LIMIT 10
      `, RESERVOIR_POLICY.LOW_WATER_MARK);

      const stats = queueStats[0] || {
        total_users: 0,
        healthy_users: 0,
        low_users: 0,
        empty_users: 0,
        avg_depth: 0,
        total_items: 0,
      };

      return {
        data: {
          overview: {
            totalUsers: Number(stats.total_users),
            healthyUsers: Number(stats.healthy_users),
            lowUsers: Number(stats.low_users),
            emptyUsers: Number(stats.empty_users),
            avgQueueDepth: Number(Number(stats.avg_depth).toFixed(1)),
            totalItems: Number(stats.total_items),
          },
          statusDistribution: Object.fromEntries(
            statusCounts.map((s: any) => [s.status, s._count])
          ),
          refillJobs24h: Object.fromEntries(
            jobStats.map((s: any) => [s.status, s._count])
          ),
          freshness: {
            expirationRate: recentCreated > 0
              ? Number((recentExpired / recentCreated).toFixed(3))
              : 0,
            expiredLast24h: recentExpired,
            createdLast24h: recentCreated,
          },
          atRiskUsers: lowUsers.map((u: any) => ({
            userId: u.userId,
            scope: u.scope,
            queuedCount: Number(u.queued_count),
            deficit: RESERVOIR_POLICY.HIGH_WATER_MARK - Number(u.queued_count),
          })),
          thresholds: {
            lowWaterMark: RESERVOIR_POLICY.LOW_WATER_MARK,
            highWaterMark: RESERVOIR_POLICY.HIGH_WATER_MARK,
            itemTtlHours: RESERVOIR_POLICY.ITEM_TTL_HOURS,
            reviewTtlHours: RESERVOIR_POLICY.REVIEW_ITEM_TTL_HOURS,
          },
          timestamp: new Date().toISOString(),
        },
      };
    } catch (err: any) {
      return { status: 500, error: err.message ?? 'Health check failed' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
