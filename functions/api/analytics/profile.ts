/**
 * API Endpoint: /api/analytics/profile
 *
 * Get and update user learning profile with computed insights.
 * Analyzes historical data to generate personalized recommendations.
 *
 * Security: Enterprise-grade middleware with auth, validation, CORS, and logging
 * Sprint: Security Hardening Sprint 4
 */

import { authenticatedEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { profileRecomputeSchema } from '../_shared/zodSchemas';
import { z } from 'zod';

/**
 * GET: Retrieve user's learning profile with computed insights
 */
export const onRequestGet = authenticatedEndpoint(
  z.object({}).optional().default({}), // Empty schema - no query params
  async (context) => {
    const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

    try {
      const user = await prisma.user.findUnique({
        where: { clerkId: context.auth.userId },
        select: { id: true },
      });

      if (!user) {
        return {
          status: 404,
          error: 'User not found',
        };
      }

      // Get learning profile
      const profile = await prisma.userLearningProfile.findUnique({
        where: { userId: user.id },
      });

      if (!profile) {
        return {
          status: 200,
          data: {
            profile: null,
            message: 'No learning profile yet. Complete some study sessions to build your profile.',
          },
        };
      }

      // Get recent sessions for trend analysis
      const recentSessions = await prisma.studySession.findMany({
        where: { userId: user.id },
        orderBy: { startedAt: 'desc' },
        take: 20,
      });

      // Compute additional insights
      const insights = computeInsights(profile, recentSessions);

      return {
        status: 200,
        data: {
          profile: {
            ...profile,
            lifetimeStudyTimeMs: Number(profile.lifetimeStudyTimeMs),
            computedInsights: insights,
          },
        },
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);

/**
 * POST: Trigger profile recomputation from historical data
 */
export const onRequestPost = authenticatedEndpoint(
  profileRecomputeSchema,
  async (context) => {
    const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

    try {
      // const { force } = context.validated; // Optional: use force to bypass cache

      const user = await prisma.user.findUnique({
        where: { clerkId: context.auth.userId },
        select: { id: true },
      });

      if (!user) {
        return {
          status: 404,
          error: 'User not found',
        };
      }

      // Get all sessions for this user
      const allSessions = await prisma.studySession.findMany({
        where: { userId: user.id },
        orderBy: { startedAt: 'desc' },
      });

      if (allSessions.length === 0) {
        return {
          status: 200,
          data: {
            message: 'No sessions found to compute profile from',
          },
        };
      }

      // Compute aggregated metrics
      const lifetimeQuestions = allSessions.reduce((sum: number, s: StudySessionData) => sum + s.totalQuestions, 0);
      const lifetimeCorrect = allSessions.reduce((sum: number, s: StudySessionData) => sum + s.correctAnswers, 0);
      const lifetimeAccuracy =
        lifetimeQuestions > 0 ? (lifetimeCorrect / lifetimeQuestions) * 100 : 0;
      const lifetimeStudyTimeMs = allSessions.reduce((sum: number, s: StudySessionData) => sum + s.totalTimeMs, 0);
      const bestEverStreak = Math.max(...allSessions.map((s: StudySessionData) => s.bestStreak));

      // Compute system strengths/weaknesses
      const systemStats: Record<string, { correct: number; total: number }> = {};
      for (const session of allSessions) {
        for (const system of session.systemsCovered) {
          if (!systemStats[system]) {
            systemStats[system] = { correct: 0, total: 0 };
          }
          // Approximate - we'd need per-question data for exact numbers
          systemStats[system].total += Math.ceil(
            session.totalQuestions / session.systemsCovered.length
          );
          systemStats[system].correct += Math.ceil(
            session.correctAnswers / session.systemsCovered.length
          );
        }
      }

      const systemAccuracies = Object.entries(systemStats)
        .filter(([_, stats]) => stats.total >= 10)
        .map(([system, stats]) => ({
          system,
          accuracy: (stats.correct / stats.total) * 100,
          total: stats.total,
        }))
        .sort((a, b) => b.accuracy - a.accuracy);

      const strongestSystems = systemAccuracies
        .filter((s) => s.accuracy >= 75)
        .slice(0, 5)
        .map((s) => s.system);

      const weakestSystems = systemAccuracies
        .filter((s) => s.accuracy < 60)
        .slice(-5)
        .map((s) => s.system);

      // Compute average calibration score
      const sessionsWithCalibration = allSessions.filter((s: StudySessionData) => s.calibrationScore !== null);
      const avgCalibration =
        sessionsWithCalibration.length > 0
          ? sessionsWithCalibration.reduce((sum: number, s: StudySessionData) => sum + (s.calibrationScore || 0), 0) /
            sessionsWithCalibration.length
          : null;

      // Compute answer change effectiveness
      const totalHelpful = allSessions.reduce((sum: number, s: StudySessionData) => sum + s.helpfulChanges, 0);
      const totalHarmful = allSessions.reduce((sum: number, s: StudySessionData) => sum + s.harmfulChanges, 0);
      const totalChanges = totalHelpful + totalHarmful;
      const changeHelpfulRatio = totalChanges > 0 ? totalHelpful / totalChanges : null;

      // Compute average session metrics
      const avgSessionLength = Math.round(lifetimeQuestions / allSessions.length);

      // Compute fatigue onset (where accuracy drops)
      // This is a simplified calculation
      const sessionsWithFatigue = allSessions.filter(
        (s: StudySessionData) =>
          s.early10Accuracy !== null &&
          s.late10Accuracy !== null &&
          s.early10Accuracy - (s.late10Accuracy || 0) > 10
      );
      const fatigueOnsetQuestion =
        sessionsWithFatigue.length > 0
          ? Math.round(avgSessionLength * 0.7) // Approximate
          : null;

      // Estimate PANCE score based on accuracy
      // Very rough estimate: 60% → 400, 80% → 600, etc.
      const estimatedScore = Math.round(200 + (lifetimeAccuracy / 100) * 600);

      // Determine readiness level
      let readinessLevel = 'not_ready';
      if (lifetimeQuestions >= 1000 && lifetimeAccuracy >= 75) {
        readinessLevel = 'ready';
      } else if (lifetimeQuestions >= 500 && lifetimeAccuracy >= 70) {
        readinessLevel = 'almost_ready';
      } else if (lifetimeQuestions >= 200 && lifetimeAccuracy >= 60) {
        readinessLevel = 'progressing';
      }

      // Generate recommendations
      const recommendations: string[] = [];

      if (weakestSystems.length > 0) {
        recommendations.push(
          `Focus on ${weakestSystems.slice(0, 3).join(', ')} - these are your weakest areas`
        );
      }

      if (changeHelpfulRatio !== null && changeHelpfulRatio < 0.4) {
        recommendations.push('Trust your first instinct more - you often change to wrong answers');
      }

      if (fatigueOnsetQuestion && fatigueOnsetQuestion < 30) {
        recommendations.push(
          `Consider shorter study sessions (~${fatigueOnsetQuestion} questions) for optimal retention`
        );
      }

      if (lifetimeAccuracy < 70) {
        recommendations.push('Review content in your weak areas before doing more questions');
      }

      // Upsert the profile
      const updatedProfile = await prisma.userLearningProfile.upsert({
        where: { userId: user.id },
        create: {
          id: `profile_${user.id}`,
          userId: user.id,
          lifetimeQuestions,
          lifetimeCorrect,
          lifetimeAccuracy,
          lifetimeStudyTimeMs: BigInt(lifetimeStudyTimeMs),
          bestEverStreak,
          overallCalibrationScore: avgCalibration,
          changeHelpfulRatio,
          avgSessionLength,
          fatigueOnsetQuestion,
          strongestSystems,
          weakestSystems,
          estimatedScore,
          readinessLevel,
          recommendations,
        },
        update: {
          lifetimeQuestions,
          lifetimeCorrect,
          lifetimeAccuracy,
          lifetimeStudyTimeMs: BigInt(lifetimeStudyTimeMs),
          bestEverStreak,
          overallCalibrationScore: avgCalibration,
          changeHelpfulRatio,
          avgSessionLength,
          fatigueOnsetQuestion,
          strongestSystems,
          weakestSystems,
          estimatedScore,
          readinessLevel,
          recommendations,
          updatedAt: new Date(),
        },
      });

      return {
        status: 200,
        data: {
          success: true,
          message: 'Profile recomputed from historical data',
          profile: {
            ...updatedProfile,
            lifetimeStudyTimeMs: Number(updatedProfile.lifetimeStudyTimeMs),
          },
        },
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);

// Type for UserLearningProfile from Prisma
interface UserLearningProfileData {
  id: string;
  userId: string;
  lifetimeQuestions: number;
  lifetimeCorrect: number;
  lifetimeAccuracy: number;
  lifetimeStudyTimeMs: bigint;
  bestEverStreak: number;
  overallCalibrationScore: number | null;
  changeHelpfulRatio: number | null;
  avgSessionLength: number | null;
  fatigueOnsetQuestion: number | null;
  strongestSystems: string[];
  weakestSystems: string[];
  estimatedScore: number | null;
  readinessLevel: string | null;
  recommendations: string[];
  createdAt: Date;
  updatedAt: Date;
}

// Type for StudySession from Prisma
interface StudySessionData {
  id: string;
  userId: string;
  sessionType: string;
  totalQuestions: number;
  correctAnswers: number;
  accuracy: number;
  totalTimeMs: number;
  bestStreak: number;
  systemsCovered: string[];
  calibrationScore: number | null;
  helpfulChanges: number;
  harmfulChanges: number;
  early10Accuracy: number | null;
  late10Accuracy: number | null;
  momentumTrend: string | null;
  startedAt: Date;
  endedAt: Date | null;
}

/**
 * Compute additional insights from profile and recent sessions
 */
function computeInsights(
  profile: UserLearningProfileData,
  recentSessions: StudySessionData[]
): {
  accuracyTrend: 'improving' | 'declining' | 'stable';
  momentumTrend: string;
  recentAvgAccuracy: number | null;
  studyConsistency: 'consistent' | 'sporadic' | 'new';
} {
  // Accuracy trend from recent sessions
  let accuracyTrend: 'improving' | 'declining' | 'stable' = 'stable';
  if (recentSessions.length >= 6) {
    const recent3 = recentSessions.slice(0, 3);
    const older3 = recentSessions.slice(3, 6);

    const recentAvg = recent3.reduce((s: number, sess: StudySessionData) => s + sess.accuracy, 0) / 3;
    const olderAvg = older3.reduce((s: number, sess: StudySessionData) => s + sess.accuracy, 0) / 3;

    if (recentAvg > olderAvg + 5) accuracyTrend = 'improving';
    else if (recentAvg < olderAvg - 5) accuracyTrend = 'declining';
  }

  // Most common momentum trend
  const momentumCounts: Record<string, number> = {};
  for (const session of recentSessions) {
    if (session.momentumTrend) {
      momentumCounts[session.momentumTrend] = (momentumCounts[session.momentumTrend] || 0) + 1;
    }
  }
  const sortedMomentum = Object.entries(momentumCounts).sort((a, b) => b[1] - a[1]);
  const momentumTrend = sortedMomentum.length > 0 ? sortedMomentum[0][0] : 'steady';

  // Recent average accuracy
  const recentAvgAccuracy =
    recentSessions.length > 0
      ? recentSessions.slice(0, 10).reduce((s: number, sess: StudySessionData) => s + sess.accuracy, 0) /
        Math.min(recentSessions.length, 10)
      : null;

  // Study consistency (based on session timestamps)
  let studyConsistency: 'consistent' | 'sporadic' | 'new' = 'new';
  if (recentSessions.length >= 5) {
    const daysBetweenSessions: number[] = [];
    for (let i = 1; i < Math.min(recentSessions.length, 10); i++) {
      const diff =
        new Date(recentSessions[i - 1].startedAt).getTime() -
        new Date(recentSessions[i].startedAt).getTime();
      daysBetweenSessions.push(diff / (1000 * 60 * 60 * 24));
    }

    const avgDaysBetween =
      daysBetweenSessions.reduce((s: number, d: number) => s + d, 0) / daysBetweenSessions.length;
    studyConsistency = avgDaysBetween <= 2 ? 'consistent' : 'sporadic';
  }

  return {
    accuracyTrend,
    momentumTrend,
    recentAvgAccuracy,
    studyConsistency,
  };
}