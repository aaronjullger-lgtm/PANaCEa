/**
 * GET /api/analytics/learner-analysis
 *
 * Returns the current user's learner cluster assignment, early warnings,
 * and composite risk score. Combines data from UserProgress, QuestionAttempt,
 * and UserStudyPhenotype into the learner clustering + early warning pipeline.
 *
 * Response:
 *   - cluster: { archetype, confidence, distances }
 *   - warnings: [{ type, message, severity, recommendation }]
 *   - riskScore: 0-1 composite
 *
 * @see lib/services/learnerClusteringService.ts — Pure computation
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { resolveUserId } from '../_shared/user-resolver';
import type { CloudflareEnv } from '../_shared/types';
import {
  analyzeLearner,
  coefficientOfVariation,
  computeSpacingRegularity,
  type LearnerFeatures,
  type WarningInput,
} from '../../../lib/services/learnerClusteringService';

// Empty schema — GET endpoint, no body. userId comes from auth.
const EmptySchema = z.object({});

type Env = CloudflareEnv;

export const onRequestOptions = withCors();

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
      return Response.json(
        { error: 'User not found', meta: { status: 'user_not_synced' } },
        { status: 404 }
      );
    }

    // ── Fetch data for feature extraction ──

    // 1. Recent question attempts (last 200)
    const recentAttempts = await prisma.questionAttempt.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        wasCorrect: true,
        timeSpentMs: true,
        createdAt: true,
        system: true,
      },
    });

    // 2. User study phenotype (burnout risk, engagement)
    const phenotype = await prisma.userStudyPhenotype.findUnique({
      where: { userId },
      select: {
        burnoutRisk: true,
        engagementScore: true,
        averageDailyLoad: true,
      },
    });

    // 3. Session records (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sessions = await prisma.drillSessionRecord.findMany({
      where: { userId, sessionStart: { gte: thirtyDaysAgo } },
      orderBy: { sessionStart: 'asc' },
      select: {
        sessionStart: true,
        sessionEnd: true,
        totalQuestions: true,
        accuracy: true,
      },
    });

    // 4. UserProgress for system coverage
    const progressRecords = await prisma.userProgress.findMany({
      where: { userId },
      select: {
        system: true,
        lastReviewAt: true,
        fsrsStability: true,
      },
    });

    // 5. Active blueprint systems
    const allSystems = [
      ...new Set(progressRecords.map((p) => p.system).filter((system): system is string => !!system)),
    ];

    // ── Build LearnerFeatures ──

    const now = Date.now();
    const last50 = recentAttempts.slice(0, 50);
    const recentAccuracy = last50.length > 0
      ? last50.filter(a => a.wasCorrect).length / last50.length
      : 0.5;
    const baselineAccuracy = recentAttempts.length > 0
      ? recentAttempts.filter(a => a.wasCorrect).length / recentAttempts.length
      : 0.5;

    // Daily question counts for volume + variability
    const dailyCounts: Record<string, number> = {};
    for (const a of recentAttempts) {
      const day = new Date(a.createdAt).toISOString().slice(0, 10);
      dailyCounts[day] = (dailyCounts[day] ?? 0) + 1;
    }
    const dailyValues = Object.values(dailyCounts);
    const avgDaily = dailyValues.length > 0
      ? dailyValues.reduce((s, v) => s + v, 0) / dailyValues.length
      : 0;
    const volumeVar = coefficientOfVariation(dailyValues);

    // Spacing regularity from session gaps
    const sessionTimes = sessions
      .map((s) => new Date(s.sessionStart).getTime())
      .sort((a, b) => a - b);
    const gapHours: number[] = [];
    for (let i = 1; i < sessionTimes.length; i++) {
      gapHours.push(((sessionTimes[i] ?? 0) - (sessionTimes[i - 1] ?? 0)) / (1000 * 60 * 60));
    }

    // System breadth/depth
    const systemsStudied = new Set(
      recentAttempts.map((a) => a.system).filter((system): system is string => !!system)
    );
    const totalSystems = Math.max(allSystems.length, 1);

    // Session completion rate
    const sessionCompletionRate = sessions.length > 0
      ? sessions.filter((s) => s.totalQuestions > 0).length / sessions.length
      : 0.5;

    // Average dwell time relative to par (~90s)
    const avgDwell = recentAttempts.length > 0
      ? recentAttempts.reduce((s, a) => s + (a.timeSpentMs ?? 90000), 0) / recentAttempts.length
      : 90000;
    const relativeSpeed = Math.min(avgDwell / 180000, 1.0); // 0=instant, 0.5=90s, 1=180s+

    // Engagement trend (sessions last 7d vs prior 21d)
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const twentyEightDaysAgo = now - 28 * 24 * 60 * 60 * 1000;
    const sessionsLast7 = sessions.filter(s => new Date(s.sessionStart).getTime() >= sevenDaysAgo).length;
    const sessionsPrior21 = sessions.filter(s => {
      const t = new Date(s.sessionStart).getTime();
      return t >= twentyEightDaysAgo && t < sevenDaysAgo;
    }).length;
    const baselineWeekly = sessionsPrior21 / 3;
    const engagementTrend = baselineWeekly > 0
      ? Math.min(1, Math.max(0, (sessionsLast7 / baselineWeekly - 0.5)))
      : 0.5;

    const features: LearnerFeatures = {
      dailyVolume: Math.min(avgDaily / 50, 1.0),
      volumeVariability: Math.min(volumeVar, 1.0),
      accuracy: recentAccuracy,
      relativeSpeed,
      spacingRegularity: computeSpacingRegularity(gapHours),
      systemBreadth: systemsStudied.size / totalSystems,
      systemDepth: Math.min((recentAttempts.length / totalSystems) / 50, 1.0),
      engagementTrend,
      calibrationScore: 0.6, // placeholder — full calibration requires confidence data
      sessionCompletionRate,
    };

    // ── Build WarningInput ──

    // System last reviewed map
    const systemLastReviewed: Record<string, number> = {};
    for (const p of progressRecords) {
      if (p.system && p.lastReviewAt) {
        const daysSince = Math.floor((now - new Date(p.lastReviewAt).getTime()) / (1000 * 60 * 60 * 24));
        const existing = systemLastReviewed[p.system];
        // Take minimum days across conditions in same system
        systemLastReviewed[p.system] = existing != null ? Math.min(existing, daysSince) : daysSince;
      }
    }

    const warningInput: WarningInput = {
      recentAccuracy,
      baselineAccuracy,
      sessionsLast7Days: sessionsLast7,
      sessionsPrior21Days: sessionsPrior21,
      burnoutRisk: phenotype?.burnoutRisk ?? 0,
      engagementTrend: engagementTrend - 0.5, // center around 0
      daysUntilExam: null, // TODO: fetch from UserGoal when exam date tracking ships
      projectedReadiness: recentAccuracy, // simple proxy for now
      requiredReadiness: 0.75,
      systemLastReviewed,
      activeBlueprintSystems: allSystems,
      responseTimeTrend: 0, // TODO: compute from recent vs baseline dwell times
    };

    // ── Run analysis ──

    const analysis = analyzeLearner(features, warningInput);

    return {
      data: {
        cluster: {
          archetype: analysis.cluster.archetype,
          confidence: analysis.cluster.confidence,
          distances: analysis.cluster.distances,
        },
        warnings: analysis.warnings.map(w => ({
          type: w.type,
          message: w.message,
          severity: w.severity,
          value: w.value,
          threshold: w.threshold,
          recommendation: w.recommendation,
        })),
        riskScore: analysis.riskScore,
        features,
        metadata: {
          attemptsSampled: recentAttempts.length,
          sessionsSampled: sessions.length,
          systemsCovered: systemsStudied.size,
          totalSystems: allSystems.length,
        },
      },
    };
  } catch (error) {
    console.error('[learner-analysis]', error);
    return {
      status: 500,
      error: error instanceof Error ? error.message : 'Learner analysis failed',
    };
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
