import { authenticateRequest, createErrorResponse, createSuccessResponse, handleCorsOptions } from '../_shared/auth';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { calculateProfile, derivePeakHoursFromSessions, updateSystemStats } from '../../../lib/clinicalProfileCalculator';
import { recomputeAvgSessionLength } from '../../../lib/services/userStatisticsService';

interface Env {
  DATABASE_URL: string;
  CLERK_SECRET_KEY: string;
}

export const onRequestOptions = handleCorsOptions;

export const onRequestGet = async (context: { request: Request; env: Env }) => {
  const { request, env } = context;
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const auth = await authenticateRequest(request as any, env as any);
    if (!auth) {
      return createErrorResponse('Unauthorized', 401);
    }

    const userId = auth.userId;

    // Get persisted stats (if any)
    const currentStats = await prisma.userStatistics.findUnique({ where: { userId } });

    let systemStats = (currentStats?.systemStats as Record<string, any>) || {};
    let totalQuestions = currentStats?.totalQuestions ?? 0;
    let correctAnswers = currentStats?.correctAnswers ?? 0;
    let avgTimePerQuestion = currentStats?.avgTimePerQuestion ?? null;
    let diagnosisBias = (currentStats?.diagnosisBias as Record<string, number> | undefined) || {};

    // If stats are missing, derive from question attempts
    if (!currentStats) {
      const attempts = await prisma.questionAttempt.findMany({
        where: { userId },
        select: {
          wasCorrect: true,
          system: true,
          timeSpentMs: true,
          createdAt: true,
        },
      });

      totalQuestions = attempts.length;
      correctAnswers = attempts.filter((a) => a.wasCorrect).length;

      const timeValues = attempts.map((a) => a.timeSpentMs || 0).filter((n) => n > 0);
      avgTimePerQuestion = timeValues.length
        ? timeValues.reduce((sum, n) => sum + n, 0) / timeValues.length
        : null;

      attempts.forEach((attempt) => {
        if (attempt.system) {
          systemStats = updateSystemStats(systemStats, attempt.system, attempt.wasCorrect, attempt.timeSpentMs);
        }
      });
    }

    const derived = calculateProfile({
      systemStats,
      totalQuestions,
      correctAnswers,
    });

    const peakStudyHours = currentStats?.peakStudyHours && currentStats.peakStudyHours.length
      ? currentStats.peakStudyHours
      : derivePeakHoursFromSessions(
          (await prisma.questionAttempt.findMany({
            where: { userId },
            select: { createdAt: true },
            take: 500,
            orderBy: { createdAt: 'desc' },
          })).map((a) => new Date(a.createdAt).getHours())
        );

    const avgSessionLength = currentStats?.avgSessionLength ?? (await recomputeAvgSessionLength(prisma as any, userId));

    // Persist refreshed aggregates
    await prisma.userStatistics.upsert({
      where: { userId },
      update: {
        totalQuestions,
        correctAnswers,
        avgTimePerQuestion,
        systemStats,
        diagnosisBias,
        ...derived,
        peakStudyHours,
        avgSessionLength,
      },
      create: {
        userId,
        totalQuestions,
        correctAnswers,
        avgTimePerQuestion,
        systemStats,
        diagnosisBias,
        ...derived,
        peakStudyHours,
        avgSessionLength,
      },
    });

    const systemBreakdown = Object.entries(systemStats).map(([system, stats]) => ({
      system,
      total: stats.total,
      correct: stats.correct,
      accuracy: stats.accuracy ?? (stats.total ? stats.correct / stats.total : 0),
      avgTimeMs: stats.avgTimeMs,
    }));

    const response = {
      overall: {
        accuracy: totalQuestions > 0 ? correctAnswers / totalQuestions : 0,
        totalQuestions,
        avgTimeMs: avgTimePerQuestion,
      },
      systemBreakdown,
      strengths: derived.strongestSystems,
      weaknesses: derived.weakestSystems,
      patterns: {
        rushedSystems: derived.rushedSystems,
        overthinkingSystems: derived.overthinkingSystems,
      },
      diagnosisBias: Object.entries(diagnosisBias)
        .sort((a, b) => (b[1] || 0) - (a[1] || 0))
        .map(([condition, count]) => ({ condition, count })),
      studyPatterns: {
        peakHours: peakStudyHours,
        avgSessionLength,
      },
    };

    return createSuccessResponse(response);
  } catch (error) {
    console.error('[user/clinical-profile] Failed to load profile', error);
    return createErrorResponse('Failed to load clinical profile', 500);
  } finally {
    await safePrismaDisconnect(prisma as any);
  }
};
