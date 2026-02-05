/**
 * User Analytics API
 * Comprehensive analytics endpoint for user performance
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

const AnalyticsSchema = z.object({
  query: z.object({
    range: z.string().optional(),
  }),
});

interface UserAnalytics {
  overall: {
    totalQuestions: number;
    correctAnswers: number;
    accuracy: number;
    totalTimeMs: number;
    avgTimePerQuestion: number;
    currentStreak: number;
    longestStreak: number;
    questionsToday: number;
    questionsThisWeek: number;
  };
  systemPerformance: Array<{
    system: string;
    total: number;
    correct: number;
    accuracy: number;
    avgTimeMs: number;
    trend: 'improving' | 'declining' | 'stable';
  }>;
  conditionMastery: Array<{
    conditionId: string;
    conditionName: string;
    system: string;
    total: number;
    correct: number;
    accuracy: number;
    masteryLevel: 'novice' | 'developing' | 'proficient' | 'mastered';
  }>;
  weakAreas: Array<{
    type: 'system' | 'condition';
    id: string;
    name: string;
    accuracy: number;
    attempts: number;
    recommendedPriority: 'high' | 'medium' | 'low';
  }>;
  recentActivity: Array<{ date: string; questions: number; correct: number; accuracy: number }>;
  srsStats: {
    totalItems: number;
    dueToday: number;
    overdue: number;
    avgEasiness: number;
    avgInterval: number;
  };
}

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(AnalyticsSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/user/analytics');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const timeRange = validated.query?.range || '30d';
    const analytics = await buildUserAnalytics(prisma, auth.userId, timeRange);
    logger.info('Fetched user analytics', { userId: auth.userId, range: timeRange });
    return { data: analytics };
  } catch (error) {
    logger.error('Error fetching analytics', {
      error: error instanceof Error ? error.message : String(error),
      userId: auth.userId,
    });
    throw new Error('Failed to fetch analytics');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});

async function buildUserAnalytics(
  prisma: ReturnType<typeof createEdgePrismaClient>,
  userId: string,
  timeRange: string
): Promise<UserAnalytics> {
  const now = new Date();
  const rangeStart = getTimeRangeStart(now, timeRange);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - 7);

  const attempts = await prisma.questionAttempt.findMany({
    where: { userId, createdAt: { gte: rangeStart } },
    orderBy: { createdAt: 'desc' },
  });

  const totalQuestions = attempts.length;
  const correctAnswers = attempts.filter((a: (typeof attempts)[0]) => a.wasCorrect).length;
  const accuracy = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;
  const totalTimeMs = attempts.reduce(
    (sum: number, a: (typeof attempts)[0]) => sum + (a.timeSpentMs || 0),
    0
  );
  const avgTimePerQuestion = totalQuestions > 0 ? totalTimeMs / totalQuestions : 0;
  const questionsToday = attempts.filter(
    (a: (typeof attempts)[0]) => new Date(a.createdAt) >= todayStart
  ).length;
  const questionsThisWeek = attempts.filter(
    (a: (typeof attempts)[0]) => new Date(a.createdAt) >= weekStart
  ).length;
  const streaks = await calculateStreaks(prisma, userId);
  const systemPerformance = calculateSystemPerformance(attempts);
  const conditionMastery = await calculateConditionMastery(prisma, attempts);
  const weakAreas = identifyWeakAreas(systemPerformance, conditionMastery);
  const recentActivity = calculateRecentActivity(attempts);
  const srsStats = await getSRSStats(prisma, userId);

  return {
    overall: {
      totalQuestions,
      correctAnswers,
      accuracy,
      totalTimeMs,
      avgTimePerQuestion,
      currentStreak: streaks.current,
      longestStreak: streaks.longest,
      questionsToday,
      questionsThisWeek,
    },
    systemPerformance,
    conditionMastery,
    weakAreas,
    recentActivity,
    srsStats,
  };
}

function getTimeRangeStart(now: Date, range: string): Date {
  const date = new Date(now);
  switch (range) {
    case '7d':
      date.setDate(date.getDate() - 7);
      break;
    case '30d':
      date.setDate(date.getDate() - 30);
      break;
    case '90d':
      date.setDate(date.getDate() - 90);
      break;
    case 'all':
      return new Date(0);
    default:
      date.setDate(date.getDate() - 30);
  }
  return date;
}

async function calculateStreaks(
  prisma: ReturnType<typeof createEdgePrismaClient>,
  userId: string
): Promise<{ current: number; longest: number }> {
  const allStreaks = await prisma.dailyStreak.findMany({
    where: { userId },
    orderBy: { date: 'asc' },
  });
  if (allStreaks.length === 0) return { current: 0, longest: 0 };

  let longest = 0,
    current = 0;
  let lastDate: Date | null = null;

  for (const streak of allStreaks) {
    const streakDate = new Date(streak.date);
    if (lastDate) {
      const dayDiff = Math.floor(
        (streakDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      current = dayDiff === 1 ? current + 1 : 1;
    } else {
      current = 1;
    }
    longest = Math.max(longest, current);
    lastDate = streakDate;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (lastDate) {
    lastDate.setHours(0, 0, 0, 0);
    if (lastDate < yesterday) current = 0;
  }

  return { current, longest };
}

function calculateSystemPerformance(
  attempts: Array<{ system?: string; wasCorrect: boolean; timeSpentMs?: number | null }>
): UserAnalytics['systemPerformance'] {
  const systemMap = new Map<string, { correct: number; total: number; times: number[] }>();
  for (const attempt of attempts) {
    const system = attempt.system || 'Unknown';
    if (!systemMap.has(system)) systemMap.set(system, { correct: 0, total: 0, times: [] });
    const stats = systemMap.get(system)!;
    stats.total++;
    if (attempt.wasCorrect) stats.correct++;
    if (attempt.timeSpentMs) stats.times.push(attempt.timeSpentMs);
  }

  const results: UserAnalytics['systemPerformance'] = [];
  for (const [system, stats] of systemMap.entries()) {
    const accuracy = stats.total > 0 ? (stats.correct / stats.total) * 100 : 0;
    const avgTimeMs =
      stats.times.length > 0 ? stats.times.reduce((a, b) => a + b, 0) / stats.times.length : 0;
    let trend: 'improving' | 'declining' | 'stable' = 'stable';
    if (stats.total >= 10) {
      const midpoint = Math.floor(stats.times.length / 2);
      const firstHalf = attempts
        .filter((a: (typeof attempts)[0]) => a.system === system)
        .slice(0, midpoint);
      const secondHalf = attempts
        .filter((a: (typeof attempts)[0]) => a.system === system)
        .slice(midpoint);
      const firstAcc =
        firstHalf.filter((a: (typeof firstHalf)[0]) => a.wasCorrect).length / firstHalf.length;
      const secondAcc =
        secondHalf.filter((a: (typeof secondHalf)[0]) => a.wasCorrect).length / secondHalf.length;
      if (secondAcc > firstAcc + 0.05) trend = 'improving';
      else if (secondAcc < firstAcc - 0.05) trend = 'declining';
    }
    results.push({
      system,
      total: stats.total,
      correct: stats.correct,
      accuracy,
      avgTimeMs,
      trend,
    });
  }
  return results.sort((a, b) => b.total - a.total);
}

async function calculateConditionMastery(
  prisma: ReturnType<typeof createEdgePrismaClient>,
  attempts: Array<{ conditionId?: string | null; system?: string; wasCorrect: boolean }>
): Promise<UserAnalytics['conditionMastery']> {
  const conditionMap = new Map<string, { correct: number; total: number; system: string }>();
  for (const attempt of attempts) {
    if (!attempt.conditionId) continue;
    if (!conditionMap.has(attempt.conditionId))
      conditionMap.set(attempt.conditionId, {
        correct: 0,
        total: 0,
        system: attempt.system || 'Unknown',
      });
    const stats = conditionMap.get(attempt.conditionId)!;
    stats.total++;
    if (attempt.wasCorrect) stats.correct++;
  }

  const conditionIds = Array.from(conditionMap.keys());
  const conditions =
    conditionIds.length > 0
      ? await prisma.condition.findMany({
          where: { id: { in: conditionIds } },
          select: { id: true, name: true },
        })
      : [];
  const conditionNames = new Map<string, string>(
    conditions.map((c: (typeof conditions)[0]) => [c.id, c.name])
  );

  const results: UserAnalytics['conditionMastery'] = [];
  for (const [conditionId, stats] of conditionMap.entries()) {
    const accuracy = stats.total > 0 ? (stats.correct / stats.total) * 100 : 0;
    let masteryLevel: 'novice' | 'developing' | 'proficient' | 'mastered' = 'novice';
    if (stats.total >= 5) {
      if (accuracy >= 90) masteryLevel = 'mastered';
      else if (accuracy >= 75) masteryLevel = 'proficient';
      else if (accuracy >= 50) masteryLevel = 'developing';
    }
    results.push({
      conditionId,
      conditionName: conditionNames.get(conditionId) || 'Unknown',
      system: stats.system,
      total: stats.total,
      correct: stats.correct,
      accuracy,
      masteryLevel,
    });
  }
  return results.sort((a, b) => b.total - a.total).slice(0, 50);
}

function identifyWeakAreas(
  systemPerf: UserAnalytics['systemPerformance'],
  conditionMastery: UserAnalytics['conditionMastery']
): UserAnalytics['weakAreas'] {
  const weakAreas: UserAnalytics['weakAreas'] = [];
  for (const system of systemPerf) {
    if (system.total >= 5 && system.accuracy < 60) {
      weakAreas.push({
        type: 'system',
        id: system.system,
        name: system.system,
        accuracy: system.accuracy,
        attempts: system.total,
        recommendedPriority:
          system.accuracy < 40 ? 'high' : system.accuracy < 50 ? 'medium' : 'low',
      });
    }
  }
  for (const condition of conditionMastery) {
    if (condition.total >= 3 && condition.accuracy < 50) {
      weakAreas.push({
        type: 'condition',
        id: condition.conditionId,
        name: condition.conditionName,
        accuracy: condition.accuracy,
        attempts: condition.total,
        recommendedPriority: condition.accuracy < 30 ? 'high' : 'medium',
      });
    }
  }
  return weakAreas
    .sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.recommendedPriority] - priorityOrder[b.recommendedPriority];
    })
    .slice(0, 20);
}

function calculateRecentActivity(
  attempts: Array<{ createdAt: Date | string; wasCorrect: boolean }>
): UserAnalytics['recentActivity'] {
  const activityMap = new Map<string, { questions: number; correct: number }>();
  const now = new Date();
  for (let i = 0; i < 14; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    activityMap.set(date.toISOString().split('T')[0], { questions: 0, correct: 0 });
  }
  for (const attempt of attempts) {
    const dateStr = new Date(attempt.createdAt).toISOString().split('T')[0] as string;
    if (activityMap.has(dateStr)) {
      const stats = activityMap.get(dateStr)!;
      stats.questions++;
      if (attempt.wasCorrect) stats.correct++;
    }
  }
  return Array.from(activityMap.entries())
    .map(([date, stats]: [string, { questions: number; correct: number }]) => ({
      date,
      questions: stats.questions,
      correct: stats.correct,
      accuracy: stats.questions > 0 ? (stats.correct / stats.questions) * 100 : 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Legacy SRS stats from SRSItem (SM-2). FSRS-based stats (UserProgress, due counts)
 * are available via GET /api/user/stats and stability-trend; this block remains
 * for backward compatibility until full migration to FSRS-only analytics.
 */
async function getSRSStats(
  prisma: ReturnType<typeof createEdgePrismaClient>,
  userId: string
): Promise<UserAnalytics['srsStats']> {
  const now = new Date();
  const srsItems = await prisma.sRSItem.findMany({ where: { userId } });
  const totalItems = srsItems.length;
  const dueToday = srsItems.filter(
    (item: (typeof srsItems)[0]) => new Date(item.dueDate) <= now
  ).length;
  const overdue = srsItems.filter((item: (typeof srsItems)[0]) => {
    const dueDate = new Date(item.dueDate);
    dueDate.setDate(dueDate.getDate() + 1);
    return dueDate < now;
  }).length;
  const avgEasiness =
    srsItems.length > 0
      ? srsItems.reduce((sum: number, item: (typeof srsItems)[0]) => sum + item.easiness, 0) /
        srsItems.length
      : 2.5;
  const avgInterval =
    srsItems.length > 0
      ? srsItems.reduce((sum: number, item: (typeof srsItems)[0]) => sum + item.interval, 0) /
        srsItems.length
      : 1;
  return { totalItems, dueToday, overdue, avgEasiness, avgInterval };
}
