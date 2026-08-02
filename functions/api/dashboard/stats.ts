/**
 * Dashboard Stats API
 *
 * GET /api/dashboard/stats
 *
 * Returns compact dashboard metrics derived from user-owned database rows.
 */

import { z } from 'zod';
import { authenticatedEndpoint } from '../_shared/middleware';
import {
  createEdgePrismaClient,
  safePrismaDisconnect,
  type EdgePrismaClient,
} from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { resolveOrCreateUserId } from '../_shared/user-resolver';
import { d1GetOrSet } from '../_shared/d1-cache';
import { NCCPA_2025_BLUEPRINT_PERCENT } from '../../../lib/constants/blueprint';
import { getUserDashboardSummary } from '../../../lib/services/dashboardAnalyticsService';

const StatsSchema = z.object({});

function computePredictedPassChance(osceScores: number[], quizAccuracy?: number): number {
  if (osceScores.length > 0) {
    const avg = osceScores.reduce((a, b) => a + b, 0) / osceScores.length;
    if (avg >= 80) return Math.min(95, Math.round(75 + (avg - 80) * 0.5));
    if (avg >= 70) return Math.round(65 + (avg - 70));
    if (avg >= 60) return Math.round(50 + (avg - 60) * 1.5);
    if (avg >= 50) return Math.round(35 + (avg - 50) * 1.5);
    return Math.max(10, Math.round(avg * 0.6));
  }
  if (typeof quizAccuracy === 'number' && quizAccuracy >= 0) {
    return Math.round(35 + quizAccuracy * 0.5);
  }
  return 50;
}

export const onRequestGet = authenticatedEndpoint(StatsSchema, async (context) => {
  const { env, auth } = context;
  const log = createEndpointLogger('/api/dashboard/stats', auth.userId);
  let prisma: EdgePrismaClient | null = null;

  try {
    const cacheKey = `dashboard:stats:${auth.userId}`;

    const payload = await d1GetOrSet(
      env.EDGE_DB,
      cacheKey,
      async () => {
        prisma = createEdgePrismaClient(env.DATABASE_URL);
        const userId = await resolveOrCreateUserId(prisma, auth.userId);
        const [summary, prefs, osceResults] = await Promise.all([
          getUserDashboardSummary(prisma as any, userId),
          prisma.userPreferences.findUnique({
            where: { userId },
            select: { streakGoalDays: true, streakFreezes: true, userCoins: true },
          }),
          prisma.patientEncounterSession.findMany({
            where: { userId },
            include: { OsceResult: true },
            orderBy: { startTime: 'desc' },
            take: 20,
          }),
        ]);

        const weakest = summary.stats.weakAreas[0];
        const weakestSystem = weakest
          ? `${weakest.system} (${(NCCPA_2025_BLUEPRINT_PERCENT as Record<string, number>)[weakest.system] ?? 2}% of PANCE)`
          : 'N/A';
        const osceScores = osceResults
          .filter((session) => session.OsceResult)
          .map((session) => (session.OsceResult!.score + session.OsceResult!.clinicalReasoningScore) / 2);
        const predictedPassChance = computePredictedPassChance(
          osceScores,
          summary.stats.overall.totalAttempts > 0 ? summary.stats.overall.accuracy : undefined
        );
        const streakGoalDays = prefs?.streakGoalDays === 'weekdays' ? 'weekdays' : 'all';

        return {
          currentStreak: summary.stats.overall.currentStreak,
          weakestSystem,
          predictedPassChance,
          streakFreezes: prefs?.streakFreezes ?? 0,
          userCoins: prefs?.userCoins ?? 0,
          streakGoalDays,
          reviewQueueStats: summary.stats.reviewQueueStats,
          studyPlanProgress: summary.stats.studyPlanProgress,
        };
      },
      120,
    );

    log.info('Dashboard stats served', {
      userId: auth.userId,
      currentStreak: payload.currentStreak,
    });

    return { data: payload };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error('Dashboard stats error', { error: errorMessage });
    const includeDetails = (env as { NODE_ENV?: string }).NODE_ENV === 'development';
    return {
      status: 500,
      data: {
        success: false,
        error: 'Internal server error',
        details: includeDetails ? errorMessage : undefined,
      },
    };
  } finally {
    if (prisma) await safePrismaDisconnect(prisma);
  }
}, { source: 'query', requestsPerMinute: 60 });
