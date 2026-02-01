/**
 * API Endpoint: /api/user/stats
 *
 * Get comprehensive user statistics for analytics and FSRS tuning.
 * Returns per-system accuracy, trends, weak areas, and study recommendations.
 *
 * PHASE 1 FIX: Uses blueprint normalization to aggregate both abbreviations
 * and full system names (e.g., "CV" and "Cardiovascular" both count).
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { resolveUserId } from '../_shared/user-resolver';
import { createEndpointLogger } from '../_shared/secureLogger';
import {
  getFromCache,
  setInCache,
  getUserStatsCacheKey,
  CACHE_CONFIG,
  isKVAvailable,
} from '../_shared/cache';
import { normalizeSystemName, getAllSystems } from '@/lib/constants/blueprint';

const UserStatsSchema = z.object({
  query: z.object({}).optional(), // No query params for this endpoint
});

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(UserStatsSchema, async (context) => {
  const { env, auth } = context;
  const logger = createEndpointLogger('/api/user/stats');
  let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;

  try {
    prisma = createEdgePrismaClient(env.DATABASE_URL);

    const userId = await resolveUserId(prisma, auth.userId);
    if (!userId) {
      return {
        data: { success: false, error: 'User not found - must be synced from Clerk webhook first' },
        status: 404,
      };
    }

    // Check cache first if KV is available
    if (isKVAvailable(env.CACHE)) {
      const cacheKey = getUserStatsCacheKey(auth.userId);
      const cached = await getFromCache(env.CACHE, cacheKey);

      if (cached) {
        logger.info('Cache hit for user stats', { userId: auth.userId });
        return {
          data: cached,
          headers: { 'X-Cache': 'HIT' },
        };
      }
    }

    const now = new Date();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 86400000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 86400000);

    // Use aggregation and bounded window instead of unbounded findMany
    const [totalCount, correctCount, aggregates, systemGrouped, conditionGrouped, recentAttempts, questionsSeenCount] =
      await Promise.all([
        prisma.questionAttempt.count({ where: { userId } }),
        prisma.questionAttempt.count({ where: { userId, wasCorrect: true } }),
        prisma.questionAttempt.aggregate({
          where: { userId },
          _avg: { timeSpentMs: true, answerChangedCount: true },
        }),
        prisma.questionAttempt.groupBy({
          by: ['system', 'wasCorrect'],
          where: { userId, system: { not: null } },
          _count: { id: true },
        }),
        prisma.questionAttempt.groupBy({
          by: ['conditionId', 'wasCorrect'],
          where: { userId, conditionId: { not: null } },
          _count: { id: true },
        }),
        prisma.questionAttempt.findMany({
          where: { userId, createdAt: { gte: ninetyDaysAgo } },
          select: { wasCorrect: true, system: true, timeSpentMs: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 5000,
        }),
        prisma.userQuestionSeen.count({ where: { userId } }),
      ]);

    const totalAttempts = totalCount;
    const correctAttempts = correctCount;
    const allAttempts = recentAttempts;

    const overallAccuracy =
      totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 0;

    const avgTimeMs =
      aggregates._avg.timeSpentMs != null && aggregates._avg.timeSpentMs > 0
        ? Math.round(aggregates._avg.timeSpentMs)
        : null;
    const avgAnswerChanges =
      aggregates._avg.answerChangedCount != null
        ? Number(aggregates._avg.answerChangedCount.toFixed(2))
        : null;

    // Build system counts from groupBy; add timing/lastAttempt from recentAttempts
    type SystemRow = { system: string | null; wasCorrect: boolean; _count: { id: number } };
    const systemCountsMap = new Map<string, { total: number; correct: number; timeSum: number; timeN: number }>();
    for (const row of systemGrouped as SystemRow[]) {
      if (!row.system) continue;
      const norm = normalizeSystemName(row.system);
      const cur = systemCountsMap.get(norm) || { total: 0, correct: 0, timeSum: 0, timeN: 0 };
      cur.total += row._count.id;
      if (row.wasCorrect) cur.correct += row._count.id;
      systemCountsMap.set(norm, cur);
    }
    for (const a of recentAttempts) {
      if (a.system && a.timeSpentMs && a.timeSpentMs > 0) {
        const norm = normalizeSystemName(a.system);
        const cur = systemCountsMap.get(norm);
        if (cur) {
          cur.timeSum += a.timeSpentMs;
          cur.timeN += 1;
        }
      }
    }
    const systemLastAttempt = new Map<string, Date>();
    for (const a of recentAttempts) {
      if (a.system) {
        const norm = normalizeSystemName(a.system);
        if (!systemLastAttempt.has(norm)) systemLastAttempt.set(norm, a.createdAt);
      }
    }

    // Calculate per-system stats using normalized names
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

    // Get canonical system list from blueprint
    const canonicalSystems = getAllSystems();

    for (const system of canonicalSystems) {
      const data = systemCountsMap.get(system);
      const total = data?.total ?? 0;
      const correct = data?.correct ?? 0;
      const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
      const avgTimeMsSys = data && data.timeN > 0 ? Math.round(data.timeSum / data.timeN) : null;
      const lastAttempt = systemLastAttempt.get(system);

      let trend: 'improving' | 'declining' | 'neutral' = 'neutral';
      const systemRecent = recentAttempts.filter(
        (a) => a.system && normalizeSystemName(a.system) === system
      );
      if (systemRecent.length >= 10) {
        const recent5 = systemRecent.slice(0, 5);
        const previous5 = systemRecent.slice(5, 10);
        const recentAcc = recent5.filter((a) => a.wasCorrect).length / 5;
        const prevAcc = previous5.filter((a) => a.wasCorrect).length / 5;
        if (recentAcc > prevAcc + 0.15) trend = 'improving';
        else if (recentAcc < prevAcc - 0.15) trend = 'declining';
      }

      systemStats[system] = {
        total,
        correct,
        accuracy,
        trend,
        avgTimeMs: avgTimeMsSys,
        lastAttempt: lastAttempt?.toISOString() ?? null,
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

    // Build condition stats from groupBy
    type CondRow = { conditionId: string | null; wasCorrect: boolean; _count: { id: number } };
    const conditionCounts: Record<string, { total: number; correct: number; conditionId: string }> = {};
    for (const row of conditionGrouped as CondRow[]) {
      if (!row.conditionId) continue;
      const c = conditionCounts[row.conditionId] || { total: 0, correct: 0, conditionId: row.conditionId };
      c.total += row._count.id;
      if (row.wasCorrect) c.correct += row._count.id;
      conditionCounts[row.conditionId] = c;
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
        const prevIdx = i - 1;
        const prevDateStr = sortedDates[prevIdx];
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

    // Calculate time-based analytics (last 7 days vs previous 7 days) from recentAttempts
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
      .filter(([_sys, stats]: [string, (typeof systemStats)[string]]) => stats && stats.total < 10)
      .map(([system, _stats]: [string, (typeof systemStats)[string]]) => system);

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
      systemsCounted: Object.keys(systemStats).filter((k) => systemStats[k].total > 0).length,
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
