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
import {
  calculateConceptGaps,
} from '../intelligence/profile';
import { NCCPA_2025_BLUEPRINT_PERCENT } from '../../../lib/constants/blueprint';

// ============================================================================
// Validation
// ============================================================================

const StatsSchema = z.object({});

// ============================================================================
// Helpers
// ============================================================================

function computeCurrentStreak(
  dates: { date: Date }[],
  today: Date
): number {
  if (dates.length === 0) return 0;

  const sorted = [...dates].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  let streak = 0;
  const todayStart = new Date(today);
  todayStart.setHours(0, 0, 0, 0);

  const lastDate = new Date(sorted[0]!.date);
  lastDate.setHours(0, 0, 0, 0);

  if (lastDate.getTime() < todayStart.getTime() - 86400000) {
    return 0;
  }

  let expected = new Date(lastDate);
  expected.setHours(0, 0, 0, 0);

  for (const entry of sorted) {
    const d = new Date(entry.date);
    d.setHours(0, 0, 0, 0);
    if (d.getTime() === expected.getTime()) {
      streak++;
      expected.setDate(expected.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

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

    const today = new Date();

    // DailyStreak uses Clerk ID (auth.userId), not internal User.id
    const [streakRows, conceptGaps, osceResults, quizStats] = await Promise.all([
      prisma.dailyStreak.findMany({
        where: { userId: auth.userId },
        select: { date: true },
        orderBy: { date: 'desc' },
        take: 365,
      }),
      calculateConceptGaps(prisma, userId),
      prisma.patientEncounterSession.findMany({
        where: { userId },
        include: { OsceResult: true },
        orderBy: { startTime: 'desc' },
        take: 20,
      }),
      prisma.questionAttempt.groupBy({
        by: ['wasCorrect'],
        where: { userId },
        _count: true,
      }),
    ]);

    const totalAttempts = quizStats.reduce((s, g) => s + g._count, 0);
    const correctAttempts = quizStats.find((g) => g.wasCorrect)?._count ?? 0;
    const quizAccuracy = totalAttempts > 0 ? (correctAttempts / totalAttempts) * 100 : undefined;

    const currentStreak = computeCurrentStreak(
      streakRows.map((r) => ({ date: r.date })),
      today
    );

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
    };

    log.info('Dashboard stats computed', { currentStreak, weakestSystem });

    return {
      data: payload,
    };
  } catch (error) {
    log.error('Dashboard stats error', { error });
    return {
      status: 500,
      error: 'Internal server error',
    };
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
