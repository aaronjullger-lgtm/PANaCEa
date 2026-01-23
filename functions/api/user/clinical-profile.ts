import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import {
  calculateProfile,
  derivePeakHoursFromSessions,
  updateSystemStats,
} from '../../../lib/clinicalProfileCalculator';
import { recomputeAvgSessionLength } from '../../../lib/services/userStatisticsService';

const ClinicalProfileSchema = z.object({
  query: z.object({}).optional(), // No query params expected
});

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(ClinicalProfileSchema, async (context) => {
  const { env, auth } = context;
  const logger = createEndpointLogger('/api/user/clinical-profile');
  const userId = auth.userId;
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    // Get persisted stats (if any)
    const currentStats = await prisma.userStatistics.findUnique({ where: { userId } });

    let systemStats = (currentStats?.systemStats as Record<string, any>) || {};
    let totalQuestions = currentStats?.totalQuestions ?? 0;
    let correctAnswers = currentStats?.correctAnswers ?? 0;
    let avgTimePerQuestion = currentStats?.avgTimePerQuestion ?? null;
    const diagnosisBias = (currentStats?.diagnosisBias as Record<string, number> | undefined) || {};

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

      type AttemptType = (typeof attempts)[0];

      totalQuestions = attempts.length;
      correctAnswers = attempts.filter((a: AttemptType) => a.wasCorrect).length;

      const timeValues = attempts
        .map((a: AttemptType) => a.timeSpentMs || 0)
        .filter((n: number) => n > 0);
      avgTimePerQuestion = timeValues.length
        ? timeValues.reduce((sum, n) => sum + n, 0) / timeValues.length
        : null;

      attempts.forEach((attempt: AttemptType) => {
        if (attempt.system) {
          systemStats = updateSystemStats(
            systemStats,
            attempt.system,
            attempt.wasCorrect,
            attempt.timeSpentMs
          );
        }
      });
    }

    const derived = calculateProfile({
      systemStats,
      totalQuestions,
      correctAnswers,
    });

    const peakStudyHours =
      currentStats?.peakStudyHours && currentStats.peakStudyHours.length
        ? currentStats.peakStudyHours
        : await (async () => {
            try {
              const attempts = await prisma.questionAttempt.findMany({
                where: { userId },
                select: { createdAt: true },
                take: 500,
                orderBy: { createdAt: 'desc' },
              });
              type PeakAttemptType = (typeof attempts)[0];
              return derivePeakHoursFromSessions(
                attempts.map((a: PeakAttemptType) => new Date(a.createdAt).getHours())
              );
            } catch (err) {
              logger.error('Failed to derive peak hours', {
                error: err instanceof Error ? err.message : String(err),
                userId,
              });
              return [];
            }
          })();

    const avgSessionLength =
      currentStats?.avgSessionLength ??
      (await recomputeAvgSessionLength(prisma as any, userId).catch((err) => {
        logger.error('Failed to compute avg session length', {
          error: err instanceof Error ? err.message : String(err),
          userId,
        });
        return null;
      }));

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

    const systemBreakdown = Object.entries(systemStats).map(([system, stats]: [string, any]) => ({
      system,
      total: stats.total,
      correct: stats.correct,
      accuracy: stats.accuracy ?? (stats.total ? stats.correct / stats.total : 0),
      avgTimeMs: stats.avgTimeMs,
    }));

    logger.info('Generated clinical profile', {
      userId,
      totalQuestions,
      accuracy: totalQuestions > 0 ? correctAnswers / totalQuestions : 0,
    });

    return {
      data: {
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
          .sort((a: [string, number], b: [string, number]) => (b[1] || 0) - (a[1] || 0))
          .map(([condition, count]: [string, number]) => ({ condition, count })),
        studyPatterns: {
          peakHours: peakStudyHours,
          avgSessionLength,
        },
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to load clinical profile', {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : typeof error,
      userId,
    });
    throw new Error(`Failed to load clinical profile: ${errorMessage}`);
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
