/**
 * API: GET /api/student/insights
 *
 * Returns personalized student insights: system weaknesses, calibration
 * alerts, improvement trends, and exam readiness projection.
 *
 * Sprint 3C — April 2026
 */

import { z } from 'zod';
import { authenticatedEndpoint } from '../_shared/middleware';
import { ok, fail, ErrorCode } from '../_shared/endpoint';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import {
  generateInsights,
  type InsightInput,
  type SystemPerformance,
} from '../../../lib/services/insightGenerationService';

const EmptySchema = z.object({});

export const onRequestGet = authenticatedEndpoint(
  EmptySchema,
  async (context) => {
    const { env, auth } = context;
    let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;
    try {
      prisma = createEdgePrismaClient(env.DATABASE_URL);
      const user = await prisma.user.findUniqueOrThrow({
        where: { clerkId: auth.userId },
        select: { id: true, examDate: true },
      });

      // Fetch overall accuracy
      const totalAttempts = await prisma.questionAttempt.count({
        where: { userId: user.id },
      });
      const totalCorrect = await prisma.questionAttempt.count({
        where: { userId: user.id, wasCorrect: true },
      });
      const overallAccuracy = totalAttempts > 0 ? totalCorrect / totalAttempts : 0;

      // Recent accuracy (last 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const recentAttempts = await prisma.questionAttempt.count({
        where: { userId: user.id, createdAt: { gte: thirtyDaysAgo } },
      });
      const recentCorrect = await prisma.questionAttempt.count({
        where: { userId: user.id, wasCorrect: true, createdAt: { gte: thirtyDaysAgo } },
      });
      const recentAccuracy = recentAttempts > 0 ? recentCorrect / recentAttempts : overallAccuracy;
      // Per-system performance
      const systemStats = await prisma.$queryRaw<
        Array<{ system: string; total: string; correct: string }>
      >`
        SELECT COALESCE("systemNormalized", system, 'Unknown') AS system,
               COUNT(*)::text AS total,
               SUM(CASE WHEN "wasCorrect" THEN 1 ELSE 0 END)::text AS correct
        FROM "QuestionAttempt"
        WHERE "userId" = ${user.id}
        GROUP BY COALESCE("systemNormalized", system, 'Unknown')
        HAVING COUNT(*) >= 5
        ORDER BY COUNT(*) DESC
      `;

      // Recent per-system for trend
      const recentSystemStats = await prisma.$queryRaw<
        Array<{ system: string; total: string; correct: string }>
      >`
        SELECT COALESCE("systemNormalized", system, 'Unknown') AS system,
               COUNT(*)::text AS total,
               SUM(CASE WHEN "wasCorrect" THEN 1 ELSE 0 END)::text AS correct
        FROM "QuestionAttempt"
        WHERE "userId" = ${user.id} AND "createdAt" >= ${thirtyDaysAgo}
        GROUP BY COALESCE("systemNormalized", system, 'Unknown')
      `;

      const recentMap = new Map(
        recentSystemStats.map(r => [r.system, parseInt(r.correct) / Math.max(1, parseInt(r.total))])
      );
      const systemPerformances: SystemPerformance[] = systemStats.map(row => {
        const total = parseInt(row.total);
        const correct = parseInt(row.correct);
        const accuracy = total > 0 ? correct / total : 0;
        const recent = recentMap.get(row.system) ?? accuracy;
        const diff = recent - accuracy;
        const trend: 'improving' | 'declining' | 'stable' =
          diff > 0.05 ? 'improving' : diff < -0.05 ? 'declining' : 'stable';

        return {
          system: row.system,
          accuracy,
          totalAttempts: total,
          recentAccuracy: recent,
          trend,
          weakConditions: [], // Could be enriched with condition-level data
        };
      });

      // Streak (consecutive days with >= 1 attempt)
      const streakDays = await computeStreak(prisma, user.id);

      // Days to exam
      const daysToExam = user.examDate
        ? Math.max(0, Math.ceil((new Date(user.examDate).getTime() - Date.now()) / (24*60*60*1000)))
        : null;

      const input: InsightInput = {
        userId: user.id,
        systemPerformances,
        overallAccuracy,
        recentAccuracy,
        totalAttempts,
        streakDays,
        daysToExam,
      };
      const report = generateInsights(input);

      return ok(report);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to generate insights';
      return fail(ErrorCode.INTERNAL_ERROR, { message });
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function computeStreak(prisma: any, userId: string): Promise<number> {
  // Get distinct dates with attempts, ordered descending
  const dates = await prisma.$queryRaw<Array<{ d: string }>>`
    SELECT DISTINCT DATE("createdAt") AS d
    FROM "QuestionAttempt"
    WHERE "userId" = ${userId}
    ORDER BY d DESC
    LIMIT 90
  `;

  if (dates.length === 0) return 0;

  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < dates.length; i++) {
    const dateStr = String(dates[i]!.d);
    const d = new Date(dateStr);
    d.setHours(0, 0, 0, 0);

    const expectedDate = new Date(today);
    expectedDate.setDate(expectedDate.getDate() - i);

    if (d.getTime() === expectedDate.getTime()) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}
