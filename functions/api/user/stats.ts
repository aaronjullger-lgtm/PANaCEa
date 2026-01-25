/**
 * API Endpoint: /api/user/stats
 *
 * Get comprehensive user statistics for analytics and FSRS tuning.
 * Returns per-system accuracy, trends, weak areas, and study recommendations.
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import {
  getFromCache,
  setInCache,
  getUserStatsCacheKey,
  CACHE_CONFIG,
  isKVAvailable,
} from '../_shared/cache';

const UserStatsSchema = z.object({
  query: z.object({}).optional(), // No query params for this endpoint
});

const SYSTEMS = [
  'CV',
  'PULM',
  'GI',
  'NEURO',
  'MSK',
  'DERM',
  'HEME',
  'ENDO',
  'HEENT',
  'RENAL',
  'REPRO',
  'PSYCH',
  'ID',
  'GU',
];

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(UserStatsSchema, async (context) => {
  const { env, auth } = context;
  const logger = createEndpointLogger('/api/user/stats');
  let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;

  try {
    const userId = auth.userId;

    // Check cache first if KV is available
    if (isKVAvailable(env.CACHE)) {
      const cacheKey = getUserStatsCacheKey(userId);
      const cached = await getFromCache(env.CACHE, cacheKey);

      if (cached) {
        logger.info('Cache hit for user stats', { userId });
        return {
          data: cached,
          headers: { 'X-Cache': 'HIT' },
        };
      }
    }

    prisma = createEdgePrismaClient(env.DATABASE_URL);

    // Get all attempts for this user
    const allAttempts = await prisma.questionAttempt.findMany({
      where: { userId },
      select: {
        wasCorrect: true,
        system: true,
        conditionId: true,
        mode: true,
        timeSpentMs: true,
        answerChangedCount: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate overall stats
    const totalAttempts = allAttempts.length;
    const correctAttempts = allAttempts.filter((a: (typeof allAttempts)[0]) => a.wasCorrect).length;
    const overallAccuracy =
      totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 0;

    // Calculate average time metrics
    const attemptsWithTime = allAttempts.filter(
      (a: (typeof allAttempts)[0]) => a.timeSpentMs && a.timeSpentMs > 0
    );
    const avgTimeMs =
      attemptsWithTime.length > 0
        ? Math.round(
            attemptsWithTime.reduce(
              (sum: number, a: (typeof attemptsWithTime)[0]) => sum + (a.timeSpentMs || 0),
              0
            ) / attemptsWithTime.length
          )
        : null;
    const avgAnswerChanges =
      attemptsWithTime.length > 0
        ? +(
            attemptsWithTime.reduce(
              (sum: number, a: (typeof attemptsWithTime)[0]) => sum + (a.answerChangedCount || 0),
              0
            ) / attemptsWithTime.length
          ).toFixed(2)
        : null;

    // Calculate per-system stats
    const systemStats: Record<
      string,
      {
        total: number;
        correct: number;
        accuracy: number;
        trend: 'improving' | 'declining' | 'neutral';
        avgTimeMs: number | null;
        lastAttempt: string | null;
      }
    > = {};

    for (const system of SYSTEMS) {
      const systemAttempts = allAttempts.filter(
        (a: (typeof allAttempts)[0]) => a.system === system
      );
      const total = systemAttempts.length;
      const correct = systemAttempts.filter((a: (typeof systemAttempts)[0]) => a.wasCorrect).length;
      const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

      // Calculate trend
      let trend: 'improving' | 'declining' | 'neutral' = 'neutral';
      if (systemAttempts.length >= 10) {
        const recent5 = systemAttempts.slice(0, 5);
        const previous5 = systemAttempts.slice(5, 10);
        const recentAcc = recent5.filter((a: (typeof recent5)[0]) => a.wasCorrect).length / 5;
        const prevAcc = previous5.filter((a: (typeof previous5)[0]) => a.wasCorrect).length / 5;

        if (recentAcc > prevAcc + 0.15) trend = 'improving';
        else if (recentAcc < prevAcc - 0.15) trend = 'declining';
      }

      // Calculate average time for this system
      const systemWithTime = systemAttempts.filter(
        (a: (typeof systemAttempts)[0]) => a.timeSpentMs && a.timeSpentMs > 0
      );
      const sysAvgTime =
        systemWithTime.length > 0
          ? Math.round(
              systemWithTime.reduce(
                (sum: number, a: (typeof systemWithTime)[0]) => sum + (a.timeSpentMs || 0),
                0
              ) / systemWithTime.length
            )
          : null;

      systemStats[system] = {
        total,
        correct,
        accuracy,
        trend,
        avgTimeMs: sysAvgTime,
        lastAttempt: systemAttempts[0]?.createdAt?.toISOString() || null,
      };
    }

    // Identify weak areas (systems with accuracy < 70% and at least 5 attempts)
    const weakAreas = Object.entries(systemStats)
      .filter(
        ([_sys, stats]: [string, (typeof systemStats)[string]]) =>
          stats.total >= 5 && stats.accuracy < 70
      )
      .sort(
        (a: [string, (typeof systemStats)[string]], b: [string, (typeof systemStats)[string]]) =>
          a[1].accuracy - b[1].accuracy
      )
      .map(([system, stats]: [string, (typeof systemStats)[string]]) => ({
        system,
        accuracy: stats.accuracy,
        attempts: stats.total,
        trend: stats.trend,
      }));

    // Identify strong areas (systems with accuracy >= 80% and at least 10 attempts)
    const strongAreas = Object.entries(systemStats)
      .filter(
        ([_sys, stats]: [string, (typeof systemStats)[string]]) =>
          stats.total >= 10 && stats.accuracy >= 80
      )
      .sort(
        (a: [string, (typeof systemStats)[string]], b: [string, (typeof systemStats)[string]]) =>
          b[1].accuracy - a[1].accuracy
      )
      .map(([system, stats]: [string, (typeof systemStats)[string]]) => ({
        system,
        accuracy: stats.accuracy,
        attempts: stats.total,
      }));

    // Calculate per-condition stats (top 20 most attempted)
    const conditionCounts: Record<string, { total: number; correct: number; conditionId: string }> =
      {};
    for (const attempt of allAttempts as typeof allAttempts) {
      if (attempt.conditionId) {
        if (!conditionCounts[attempt.conditionId]) {
          conditionCounts[attempt.conditionId] = {
            total: 0,
            correct: 0,
            conditionId: attempt.conditionId,
          };
        }
        conditionCounts[attempt.conditionId].total++;
        if (attempt.wasCorrect) conditionCounts[attempt.conditionId].correct++;
      }
    }

    const conditionStats = Object.values(conditionCounts)
      .filter((c: (typeof conditionCounts)[string]) => c.total >= 3) // At least 3 attempts
      .map((c: (typeof conditionCounts)[string]) => ({
        conditionId: c.conditionId,
        total: c.total,
        correct: c.correct,
        accuracy: Math.round((c.correct / c.total) * 100),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 30); // Top 30 conditions

    // Identify weak conditions (accuracy < 60% with at least 5 attempts)
    const weakConditions = Object.values(conditionCounts)
      .filter((c: (typeof conditionCounts)[string]) => c.total >= 5 && c.correct / c.total < 0.6)
      .map((c: (typeof conditionCounts)[string]) => ({
        conditionId: c.conditionId,
        total: c.total,
        correct: c.correct,
        accuracy: Math.round((c.correct / c.total) * 100),
      }))
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 10); // Top 10 weakest

    // Calculate study streak (days with at least 1 attempt)
    const attemptDates = new Set(
      allAttempts.map((a: (typeof allAttempts)[0]) => a.createdAt.toISOString().split('T')[0])
    );
    const sortedDates = Array.from(attemptDates).sort().reverse() as string[];

    let currentStreak = 0;
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    // Check if studied today or yesterday
    const mostRecentDate = sortedDates[0];
    if (mostRecentDate && (mostRecentDate === today || mostRecentDate === yesterday)) {
      currentStreak = 1;
      for (let i = 1; i < sortedDates.length; i++) {
        const prevDateStr = sortedDates[i - 1];
        const currDateStr = sortedDates[i];
        if (!prevDateStr || !currDateStr) break;
        const prevDate = new Date(prevDateStr);
        const currDate = new Date(currDateStr);
        const diffDays = Math.floor((prevDate.getTime() - currDate.getTime()) / 86400000);

        if (diffDays === 1) {
          currentStreak++;
        } else {
          break;
        }
      }
    }

    // Get questions seen count
    const questionsSeenCount = await prisma.userQuestionSeen.count({
      where: { userId },
    });

    // Calculate time-based analytics (last 7 days vs previous 7 days)
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 86400000);

    const last7DaysAttempts = allAttempts.filter(
      (a: (typeof allAttempts)[0]) => a.createdAt >= sevenDaysAgo
    );
    const prev7DaysAttempts = allAttempts.filter(
      (a: (typeof allAttempts)[0]) => a.createdAt >= fourteenDaysAgo && a.createdAt < sevenDaysAgo
    );

    const last7Accuracy =
      last7DaysAttempts.length > 0
        ? Math.round(
            (last7DaysAttempts.filter((a: (typeof last7DaysAttempts)[0]) => a.wasCorrect).length /
              last7DaysAttempts.length) *
              100
          )
        : null;
    const prev7Accuracy =
      prev7DaysAttempts.length > 0
        ? Math.round(
            (prev7DaysAttempts.filter((a: (typeof prev7DaysAttempts)[0]) => a.wasCorrect).length /
              prev7DaysAttempts.length) *
              100
          )
        : null;

    // Generate study recommendations
    const recommendations: string[] = [];

    if (weakAreas.length > 0) {
      recommendations.push(
        `Focus on ${weakAreas[0].system} - currently at ${weakAreas[0].accuracy}% accuracy`
      );
    }

    if (currentStreak === 0) {
      recommendations.push('Start a study streak today!');
    } else if (currentStreak >= 7) {
      recommendations.push(`Great ${currentStreak}-day streak! Keep it up!`);
    }

    const underStudiedSystems = Object.entries(systemStats)
      .filter(([_sys, stats]: [string, (typeof systemStats)[string]]) => stats.total < 10)
      .map(([system]: [string, (typeof systemStats)[string]]) => system);

    if (underStudiedSystems.length > 0) {
      recommendations.push(`Try more questions in: ${underStudiedSystems.slice(0, 3).join(', ')}`);
    }

    const responseData = {
      success: true,
      stats: {
        overall: {
          totalAttempts,
          correctAttempts,
          accuracy: overallAccuracy,
          questionsSeenCount,
          currentStreak,
          totalStudyDays: attemptDates.size,
          avgTimeMs,
          avgAnswerChanges,
        },
        bySystems: systemStats,
        byConditions: conditionStats,
        weakAreas,
        strongAreas,
        weakConditions,
        recentPerformance: {
          last7Days: {
            attempts: last7DaysAttempts.length,
            accuracy: last7Accuracy,
          },
          previous7Days: {
            attempts: prev7DaysAttempts.length,
            accuracy: prev7Accuracy,
          },
          trend:
            last7Accuracy !== null && prev7Accuracy !== null
              ? last7Accuracy > prev7Accuracy
                ? 'improving'
                : last7Accuracy < prev7Accuracy
                  ? 'declining'
                  : 'stable'
              : 'insufficient_data',
        },
        recommendations,
      },
    };

    // Cache the result if KV is available
    if (isKVAvailable(env.CACHE)) {
      const cacheKey = getUserStatsCacheKey(userId);
      await setInCache(env.CACHE, cacheKey, responseData, CACHE_CONFIG.TTL.USER_STATS);
    }

    logger.info('Fetched user stats', {
      userId,
      totalAttempts,
      accuracy: overallAccuracy,
      weakAreasCount: weakAreas.length,
    });

    return {
      data: responseData,
      headers: { 'X-Cache': 'MISS' },
    };
  } catch (error) {
    logger.error('Error fetching user stats', {
      error: error instanceof Error ? error.message : String(error),
      userId: auth.userId,
    });
    throw new Error('Failed to fetch user stats');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
