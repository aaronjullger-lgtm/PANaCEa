/**
 * GET /api/analytics/learner-profile
 *
 * Returns learner archetype (cluster assignment), early warnings,
 * and composite risk score for the current user.
 *
 * @see lib/services/learnerClusteringService.ts — Pure clustering + warning logic
 */

import { z } from 'zod';
import { authenticatedEndpoint } from '../_shared/middleware';
import { ok, fail, ErrorCode } from '../_shared/endpoint';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { resolveUserId } from '../_shared/user-resolver';
import type { CloudflareEnv } from '../_shared/types';
import {
  analyzeLearner,
  type LearnerFeatures,
  type WarningInput,
} from '../../../lib/services/learnerClusteringService';

const EmptySchema = z.object({});

type Env = CloudflareEnv;

export const onRequestGet = authenticatedEndpoint(EmptySchema, async (context) => {
  const { env, auth } = context as {
    env: Env;
    auth: { userId: string };
    validated: z.infer<typeof EmptySchema>;
  };

  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    // Resolve Clerk id to internal User.id — all user-owned tables use the internal id.
    const userId = await resolveUserId(prisma, auth.userId);
    if (!userId) {
      return fail(ErrorCode.NOT_FOUND, { message: 'User not found — account may not be synced yet' });
    }

    // Parallel fetch all needed data
    const [phenotype, learningProfile, goal, recentAttempts, dailyAnalytics] =
      await Promise.all([
        prisma.userStudyPhenotype.findUnique({
          where: { userId },
          select: {
            averageDailyLoad: true,
            consistencyScore: true,
            engagementScore: true,
            burnoutRisk: true,
            strongSystems: true,
            weakSystems: true,
            estimatedReadiness: true,
            daysToExam: true,
          },
        }),
        prisma.userLearningProfile.findUnique({
          where: { userId },
          select: {
            lifetimeAccuracy: true,
            overallCalibrationScore: true,
            avgTimePerQuestion: true,
            avgSessionLength: true,
            optimalSessionLength: true,
          },
        }),
        prisma.userGoal.findFirst({
          where: { userId, status: 'active' },
          select: { targetDate: true },
        }),
        prisma.questionAttempt.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 200,
          select: {
            wasCorrect: true,
            timeSpentMs: true,
            system: true,
            createdAt: true,
            answerChangedCount: true,
          },
        }),
        prisma.dailyUserAnalytics.findMany({
          where: { userId },
          orderBy: { sessionDate: 'desc' },
          take: 30,
          select: {
            questionsAnswered: true,
            accuracy: true,
            sessionDate: true,
          },
        }),
      ]);

    // Derive LearnerFeatures
    const dailyVolumes = dailyAnalytics.map((d) => d.questionsAnswered);
    const avgDailyVolume =
      dailyVolumes.length > 0
        ? dailyVolumes.reduce((a, b) => a + b, 0) / dailyVolumes.length
        : 0;
    const volumeVariability = computeCV(dailyVolumes);

    const recent50 = recentAttempts.slice(0, 50);
    const recentAccuracy =
      recent50.length > 0
        ? recent50.filter((a) => a.wasCorrect).length / recent50.length
        : 0;

    const parTimeMs = (learningProfile?.avgTimePerQuestion ?? 60) * 1000;
    const avgTimeMs =
      recent50.length > 0
        ? recent50.reduce((s, a) => s + (a.timeSpentMs ?? parTimeMs), 0) /
          recent50.length
        : parTimeMs;
    const relativeSpeed = Math.min(1, avgTimeMs / (2 * parTimeMs));

    // Session gaps for spacing regularity
    const sessionDates = [...new Set(
      recentAttempts
        .map((a) => a.createdAt?.toISOString().slice(0, 10))
        .filter(Boolean)
    )].sort();
    const gapHours: number[] = [];
    for (let i = 1; i < sessionDates.length; i++) {
      const diff =
        new Date(sessionDates[i]!).getTime() -
        new Date(sessionDates[i - 1]!).getTime();
      gapHours.push(diff / 3_600_000);
    }
    const spacingRegularity =
      gapHours.length >= 2 ? 1 - Math.min(1, computeCV(gapHours)) : 0.5;

    // System breadth & depth
    const allSystems = [
      'Cardiovascular',
      'Pulmonary',
      'Gastrointestinal',
      'Musculoskeletal',
      'Neurologic',
      'Dermatologic',
      'EENT',
      'Reproductive',
      'Endocrine',
      'Renal',
      'Hematologic',
      'Psychiatry',
      'Infectious Disease',
    ];
    const systemCounts: Record<string, number> = {};
    for (const a of recentAttempts) {
      if (a.system) systemCounts[a.system] = (systemCounts[a.system] ?? 0) + 1;
    }
    const systemsStudied = Object.keys(systemCounts).length;
    const systemBreadth = Math.min(1, systemsStudied / allSystems.length);
    const maxDepth = Math.max(1, ...Object.values(systemCounts));
    const avgDepth =
      systemsStudied > 0
        ? Object.values(systemCounts).reduce((a, b) => a + b, 0) /
          systemsStudied /
          maxDepth
        : 0;

    // Engagement trend (7-day vs prior)
    const last7 = dailyAnalytics.slice(0, 7);
    const prior = dailyAnalytics.slice(7, 28);
    const last7Avg =
      last7.length > 0
        ? last7.reduce((s, d) => s + d.questionsAnswered, 0) / last7.length
        : 0;
    const priorAvg =
      prior.length > 0
        ? prior.reduce((s, d) => s + d.questionsAnswered, 0) / prior.length
        : last7Avg;
    const engagementTrend =
      priorAvg > 0
        ? Math.min(1, Math.max(0, 0.5 + (last7Avg - priorAvg) / (2 * priorAvg)))
        : 0.5;

    // Session completion rate (approximate: unique sessions vs started)
    const sessionCompletionRate = dailyAnalytics.length > 0
      ? Math.min(1, dailyAnalytics.filter((d) => d.questionsAnswered > 0).length / dailyAnalytics.length)
      : 0.5;

    const features: LearnerFeatures = {
      dailyVolume: Math.min(1, avgDailyVolume / 50),
      volumeVariability: Math.min(1, volumeVariability),
      accuracy: recentAccuracy,
      relativeSpeed,
      spacingRegularity,
      systemBreadth,
      systemDepth: avgDepth,
      engagementTrend,
      calibrationScore: learningProfile?.overallCalibrationScore ?? 0.5,
      sessionCompletionRate,
    };

    // Derive WarningInput
    const recent200Accuracy =
      recentAttempts.length > 0
        ? recentAttempts.filter((a) => a.wasCorrect).length /
          recentAttempts.length
        : 0;

    // Sessions per week from daily analytics
    const sessionsLast7Days = last7.filter((d) => d.questionsAnswered > 0).length;
    const sessionsPrior21Days = prior.filter((d) => d.questionsAnswered > 0).length;

    // System last reviewed
    const systemLastReviewed: Record<string, number> = {};
    const now = Date.now();
    for (const a of recentAttempts) {
      if (a.system && a.createdAt && !(a.system in systemLastReviewed)) {
        systemLastReviewed[a.system] = Math.round(
          (now - a.createdAt.getTime()) / 86_400_000
        );
      }
    }

    // Response time trend
    const firstHalfTimes = recent50
      .slice(0, 25)
      .map((a) => a.timeSpentMs ?? parTimeMs);
    const secondHalfTimes = recent50
      .slice(25)
      .map((a) => a.timeSpentMs ?? parTimeMs);
    const firstAvg =
      firstHalfTimes.length > 0
        ? firstHalfTimes.reduce((a, b) => a + b, 0) / firstHalfTimes.length
        : parTimeMs;
    const secondAvg =
      secondHalfTimes.length > 0
        ? secondHalfTimes.reduce((a, b) => a + b, 0) / secondHalfTimes.length
        : parTimeMs;
    const responseTimeTrend =
      secondAvg > 0 ? (firstAvg - secondAvg) / secondAvg : 0;

    const daysUntilExam = goal?.targetDate
      ? Math.max(
          0,
          Math.round(
            (new Date(goal.targetDate).getTime() - now) / 86_400_000
          )
        )
      : phenotype?.daysToExam ?? null;

    const warningInput: WarningInput = {
      recentAccuracy,
      baselineAccuracy: recent200Accuracy,
      sessionsLast7Days,
      sessionsPrior21Days,
      burnoutRisk: phenotype?.burnoutRisk ?? 0,
      engagementTrend: engagementTrend * 2 - 1, // Map 0-1 back to -1 to 1
      daysUntilExam,
      projectedReadiness: phenotype?.estimatedReadiness ?? 0.5,
      requiredReadiness: 0.75,
      systemLastReviewed,
      activeBlueprintSystems: allSystems,
      responseTimeTrend,
    };

    const analysis = analyzeLearner(features, warningInput);

    return ok({
      archetype: analysis.cluster.archetype,
      archetypeConfidence: analysis.cluster.confidence,
      riskScore: analysis.riskScore,
      warnings: analysis.warnings.map((w) => ({
        type: w.type,
        message: w.message,
        severity: w.severity,
        recommendation: w.recommendation,
      })),
      features: {
        dailyVolume: Math.round(avgDailyVolume),
        accuracy: Math.round(recentAccuracy * 100),
        spacingRegularity: Math.round(spacingRegularity * 100),
        systemBreadth: Math.round(systemBreadth * 100),
        engagementTrend: engagementTrend > 0.5 ? 'improving' : engagementTrend < 0.45 ? 'declining' : 'stable',
      },
    });
  } catch (err) {
    console.error('[learner-profile] Error:', err);
    return fail(ErrorCode.INTERNAL_ERROR, { message: 'Failed to compute learner profile' });
  } finally {
    await safePrismaDisconnect(prisma);
  }
});

/** Coefficient of variation (stdev / mean). Returns 0 for empty arrays. */
function computeCV(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean === 0) return 0;
  const variance =
    values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / mean;
}
