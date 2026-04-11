/**
 * Dashboard Stats API
 *
 * GET /api/dashboard/stats
 *
 * Returns aggregated dashboard metrics:
 * - currentStreak: Consecutive days with study activity
 * - weakestSystem: e.g., "Pulmonary (9% of PANCE)"
 * - predictedPassChance: Heuristic score from recent OSCE performance
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import {
  createEdgePrismaClient,
  safePrismaDisconnect,
  type EdgePrismaClient,
} from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { resolveUserId } from '../_shared/user-resolver';
import { calculateConceptGaps } from '../ai/learning/profile-crud';
import { NCCPA_2025_BLUEPRINT_PERCENT } from '../../../lib/constants/blueprint';
import { computeCurrentStreak as calcStreak, type StreakGoalDays } from '../../../lib/streakCalc';

// ============================================================================
// Validation
// ============================================================================

const StatsSchema = z.object({});

function computePredictedPassChance(osceScores: number[], quizAccuracy?: number): number {
  if (osceScores.length > 0) {
    const avg = osceScores.reduce((a, b) => a + b, 0) / osceScores.length;
    if (avg >= 80) return Math.min(95, 75 + (avg - 80) * 0.5);
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

// ============================================================================
// Handler
// ============================================================================

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(StatsSchema, async (context) => {
  const { env, auth } = context;
  const log = createEndpointLogger('/api/dashboard/stats', auth.userId);
  let prisma: EdgePrismaClient | null = null;

  try {
    prisma = createEdgePrismaClient(env.DATABASE_URL);
    const userId = await resolveUserId(prisma, auth.userId);
    if (!userId) {
      return { status: 404, error: 'User not found' };
    }

    const today = new Date(
      Date.UTC(
        new Date().getUTCFullYear(),
        new Date().getUTCMonth(),
        new Date().getUTCDate(),
        0,
        0,
        0,
        0
      )
    );

    // DailyStreak and StreakFreezeUse use Clerk ID (auth.userId)
    const [streakRows, freezeRows, prefs, conceptGaps, osceResults, quizStats] = await Promise.all([
      prisma.dailyStreak.findMany({
        where: { userId: auth.userId },
        select: { date: true },
        orderBy: { date: 'desc' },
        take: 365,
      }),
      prisma.streakFreezeUse.findMany({
        where: { userId: auth.userId },
        select: { date: true },
      }),
      prisma.userPreferences.findUnique({
        where: { userId: auth.userId },
        select: { streakGoalDays: true, streakFreezes: true, userCoins: true },
      }),
      calculateConceptGaps(prisma, userId),
      prisma.patientEncounterSession.findMany({
        where: { userId },
        include: { OsceResult: true },
        orderBy: { startTime: 'desc' },
        take: 20,
      }),
      // Readiness accuracy: only MAIN/DRILL sessions (TARGETED/CRAM/RAPID_RECALL excluded)
      prisma.questionAttempt.groupBy({
        by: ['wasCorrect'],
        where: { userId, isMainSession: true },
        _count: true,
      }),
    ]);

    const totalAttempts = quizStats.reduce((s, g) => s + g._count, 0);
    const correctAttempts = quizStats.find((g) => g.wasCorrect)?._count ?? 0;
    const quizAccuracy = totalAttempts > 0 ? (correctAttempts / totalAttempts) * 100 : undefined;

    const streakGoalDays: StreakGoalDays =
      prefs?.streakGoalDays === 'weekdays' ? 'weekdays' : 'all';
    const activityDates = streakRows.map((r) => new Date(r.date));
    const frozenDates = freezeRows.map((r) => new Date(r.date));
    const { currentStreak } = calcStreak({
      activityDates,
      frozenDates,
      today,
      streakGoalDays,
    });

    let weakestSystem = 'N/A';
    const bySystemEntries = Object.entries(conceptGaps.bySystem);
    if (bySystemEntries.length > 0) {
      const sorted = bySystemEntries
        .map(([system, data]) => ({
          system,
          failureRate: data.failures / Math.max(1, data.total),
        }))
        .sort((a, b) => b.failureRate - a.failureRate);

      const weakest = sorted[0];
      if (weakest) {
        const pancePct =
          (NCCPA_2025_BLUEPRINT_PERCENT as Record<string, number>)[weakest.system] ?? 2;
        weakestSystem = `${weakest.system} (${pancePct}% of PANCE)`;
      }
    }

    const osceScores = osceResults
      .filter((s) => s.OsceResult)
      .map((s) => (s.OsceResult!.score + s.OsceResult!.clinicalReasoningScore) / 2);
    const predictedPassChance = computePredictedPassChance(osceScores, quizAccuracy);

    const payload = {
      currentStreak,
      weakestSystem,
      predictedPassChance,
      streakFreezes: prefs?.streakFreezes ?? 0,
      userCoins: prefs?.userCoins ?? 0,
      streakGoalDays,
    };

    log.info('Dashboard stats computed', { currentStreak, weakestSystem });

    return {
      data: payload,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    log.error('Dashboard stats error', { error: errorMessage, stack: errorStack });
    const includeDetails = (env as { NODE_ENV?: string }).NODE_ENV === 'development';
    return {
      status: 500,
      data: {
        success: false,
        error: 'Internal server error',
        details: includeDetails ? errorMessage : undefined
      },
    };
  } finally {
    if (prisma) await safePrismaDisconnect(prisma);
  }
});
