/**
 * API Endpoint: /api/analytics/session
 *
 * Record comprehensive session analytics to the database.
 * This endpoint receives all behavioral data collected during a study session.
 *
 * Security: Sprint 4 - Enterprise-grade middleware pattern
 */

import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { authenticatedEndpoint } from '../_shared/middleware';
import { sessionAnalyticsSchema, sessionAnalyticsQuerySchema } from '../_shared/zodSchemas';
import type { AuthenticatedContext, ValidatedContext } from '../_shared/middleware';
import { v4 as uuidv4 } from 'uuid';
import type { z } from 'zod';

type SessionAnalyticsData = z.infer<typeof sessionAnalyticsSchema>;
type SessionAnalyticsQuery = z.infer<typeof sessionAnalyticsQuerySchema>;

/**
 * POST: Record comprehensive session analytics
 */
export const onRequestPost = authenticatedEndpoint(
  sessionAnalyticsSchema,
  async (context: AuthenticatedContext & ValidatedContext<SessionAnalyticsData>) => {
    const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

    try {
      const data = context.validated;

      // Find user by Clerk ID
      const user = await prisma.user.findUnique({
        where: { clerkId: context.auth.userId },
        select: { id: true },
      });

      if (!user) {
        return {
          status: 404,
          error: 'User not found - must be synced from Clerk webhook first',
        };
      }

      // Create session analytics record
      const session = await prisma.studySession.create({
        data: {
          id: data.sessionId || uuidv4(),
          userId: user.id,
          startedAt: new Date(data.startedAt),
          endedAt: new Date(data.endedAt),

          // Core metrics
          totalQuestions: data.totalQuestions,
          correctAnswers: data.correctAnswers || 0,
          accuracy: data.accuracy || 0,
          totalTimeMs: data.totalTimeMs || 0,
          avgTimePerQuestion: data.avgTimePerQuestion,

          // Streak data
          bestStreak: data.bestStreak || 0,
          finalStreak: data.finalStreak || 0,
          avgStreak: data.avgStreak,
          errorClusters: data.errorClusters || 0,

          // Momentum metrics
          peakMomentum: data.peakMomentum,
          avgMomentum: data.avgMomentum,
          momentumTrend: data.momentumTrend,

          // Behavioral signals
          totalAnswerChanges: data.totalAnswerChanges || 0,
          helpfulChanges: data.helpfulChanges || 0,
          harmfulChanges: data.harmfulChanges || 0,
          firstInstinctAccuracy: data.firstInstinctAccuracy,

          // Confidence calibration
          avgInferredConfidence: data.avgInferredConfidence,
          highConfidenceAccuracy: data.highConfidenceAccuracy,
          lowConfidenceAccuracy: data.lowConfidenceAccuracy,
          calibrationScore: data.calibrationScore,

          // Time pressure analysis
          questionsUnderPar: data.questionsUnderPar || 0,
          questionsOverPar: data.questionsOverPar || 0,
          rushingAccuracy: data.rushingAccuracy,
          deliberateAccuracy: data.deliberateAccuracy,

          // Fatigue indicators
          early10Accuracy: data.early10Accuracy,
          late10Accuracy: data.late10Accuracy,
          staminaFade: data.staminaFade,

          // PANCE distribution
          distributionScore: data.distributionScore,
          systemsCovered: data.systemsCovered || [],

          // Predicted score
          predictedScore: data.predictedScore,
          scoreConfidence: data.scoreConfidence,
          passLikelihood: data.passLikelihood,

          // Session settings
          mode: data.mode,
          focus: data.focus,
          difficulty: data.difficulty,

          // Device info
          deviceType: data.deviceType,
          browserName: data.browserName,
        },
      });

      // Update user learning profile (upsert)
      await updateUserLearningProfile(prisma, user.id, data);

      return {
        status: 201,
        data: {
          success: true,
          sessionId: session.id,
          message: 'Session analytics recorded successfully',
        },
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);

/**
 * GET: Retrieve user's session history and learning profile
 */
export const onRequestGet = authenticatedEndpoint(
  sessionAnalyticsQuerySchema,
  async (context: AuthenticatedContext & ValidatedContext<SessionAnalyticsQuery>) => {
    const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

    try {
      const params = context.validated;

      // Find user by Clerk ID
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

      const limit = params.limit;
      const includeProfile = params.includeProfile;

      // Get recent sessions
      const sessions = await prisma.studySession.findMany({
        where: { userId: user.id },
        orderBy: { startedAt: 'desc' },
        take: Math.min(limit, 100),
      });

      // Get learning profile if requested
      let profile = null;
      if (includeProfile) {
        profile = await prisma.userLearningProfile.findUnique({
          where: { userId: user.id },
        });
      }

      // Calculate aggregate stats from recent sessions
      const recentSessions = sessions.slice(0, 10);
      const aggregateStats = {
        recentAvgAccuracy:
          recentSessions.length > 0
            ? recentSessions.reduce((sum, s) => sum + s.accuracy, 0) / recentSessions.length
            : null,
        recentAvgQuestions:
          recentSessions.length > 0
            ? Math.round(
                recentSessions.reduce((sum, s) => sum + s.totalQuestions, 0) /
                  recentSessions.length
              )
            : null,
        recentAvgMomentum:
          recentSessions.filter((s) => s.avgMomentum !== null).length > 0
            ? recentSessions
                .filter((s) => s.avgMomentum !== null)
                .reduce((sum, s) => sum + (s.avgMomentum || 0), 0) /
              recentSessions.filter((s) => s.avgMomentum !== null).length
            : null,
        accuracyTrend: calculateTrend(recentSessions.map((s) => s.accuracy)),
        totalSessions: sessions.length,
      };

      return {
        status: 200,
        data: {
          sessions: sessions.map((s) => ({
            ...s,
            // Convert BigInt to number for JSON serialization
            lifetimeStudyTimeMs: undefined,
          })),
          profile: profile
            ? {
                ...profile,
                lifetimeStudyTimeMs: Number(profile.lifetimeStudyTimeMs),
              }
            : null,
          aggregateStats,
        },
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);

// ============================================================================
// HELPER FUNCTIONS (Business Logic Preserved)
// ============================================================================

/**
 * Update or create user learning profile with session data
 */
async function updateUserLearningProfile(
  prisma: ReturnType<typeof createEdgePrismaClient>,
  userId: string,
  sessionData: SessionAnalyticsData
): Promise<void> {
  const existing = await prisma.userLearningProfile.findUnique({
    where: { userId },
  });

  if (existing) {
    // Update existing profile with new session data
    const newLifetimeQuestions = existing.lifetimeQuestions + sessionData.totalQuestions;
    const newLifetimeCorrect = existing.lifetimeCorrect + sessionData.correctAnswers;
    const newLifetimeAccuracy =
      newLifetimeQuestions > 0 ? (newLifetimeCorrect / newLifetimeQuestions) * 100 : 0;
    const newLifetimeStudyTime =
      BigInt(existing.lifetimeStudyTimeMs) + BigInt(sessionData.totalTimeMs || 0);

    // Update best streak if this session had a better one
    const newBestStreak = Math.max(existing.bestEverStreak, sessionData.bestStreak || 0);

    // Rolling average for calibration score
    const newCalibrationScore =
      sessionData.calibrationScore !== undefined
        ? existing.overallCalibrationScore !== null
          ? existing.overallCalibrationScore * 0.8 + sessionData.calibrationScore * 0.2
          : sessionData.calibrationScore
        : existing.overallCalibrationScore;

    // Rolling average for answer change ratio
    const sessionChangeRatio =
      sessionData.totalAnswerChanges > 0
        ? sessionData.helpfulChanges / sessionData.totalAnswerChanges
        : null;
    const newChangeHelpfulRatio =
      sessionChangeRatio !== null
        ? existing.changeHelpfulRatio !== null
          ? existing.changeHelpfulRatio * 0.8 + sessionChangeRatio * 0.2
          : sessionChangeRatio
        : existing.changeHelpfulRatio;

    // Update estimated score with exponential smoothing
    const newEstimatedScore =
      sessionData.predictedScore !== undefined
        ? existing.estimatedScore !== null
          ? Math.round(existing.estimatedScore * 0.7 + sessionData.predictedScore * 0.3)
          : sessionData.predictedScore
        : existing.estimatedScore;

    await prisma.userLearningProfile.update({
      where: { userId },
      data: {
        lifetimeQuestions: newLifetimeQuestions,
        lifetimeCorrect: newLifetimeCorrect,
        lifetimeAccuracy: newLifetimeAccuracy,
        lifetimeStudyTimeMs: newLifetimeStudyTime,
        bestEverStreak: newBestStreak,
        overallCalibrationScore: newCalibrationScore,
        changeHelpfulRatio: newChangeHelpfulRatio,
        estimatedScore: newEstimatedScore,
        updatedAt: new Date(),
      },
    });
  } else {
    // Create new profile
    await prisma.userLearningProfile.create({
      data: {
        id: uuidv4(),
        userId,
        lifetimeQuestions: sessionData.totalQuestions,
        lifetimeCorrect: sessionData.correctAnswers,
        lifetimeAccuracy: sessionData.accuracy,
        lifetimeStudyTimeMs: BigInt(sessionData.totalTimeMs || 0),
        bestEverStreak: sessionData.bestStreak || 0,
        overallCalibrationScore: sessionData.calibrationScore,
        changeHelpfulRatio:
          sessionData.totalAnswerChanges > 0
            ? sessionData.helpfulChanges / sessionData.totalAnswerChanges
            : null,
        estimatedScore: sessionData.predictedScore,
      },
    });
  }
}

/**
 * Calculate trend from array of values (most recent first)
 */
function calculateTrend(values: number[]): 'improving' | 'declining' | 'stable' {
  if (values.length < 3) return 'stable';

  const recent = values.slice(0, Math.floor(values.length / 2));
  const older = values.slice(Math.floor(values.length / 2));

  const recentAvg = recent.reduce((s, v) => s + v, 0) / recent.length;
  const olderAvg = older.reduce((s, v) => s + v, 0) / older.length;

  const diff = recentAvg - olderAvg;

  if (diff > 5) return 'improving';
  if (diff < -5) return 'declining';
  return 'stable';
}