/**
 * API Endpoint: /api/analytics/session
 *
 * Record comprehensive session analytics to the database.
 * This endpoint receives all behavioral data collected during a study session.
 *
 * Security: Sprint 4 - Enterprise-grade middleware pattern
 */

import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { sessionAnalyticsSchema, sessionAnalyticsQuerySchema } from '../_shared/zodSchemas';
import type { AuthenticatedContext, ValidatedContext } from '../_shared/middleware';
import { v4 as uuidv4 } from 'uuid';
import type { z } from 'zod';
import {
  getFromCache,
  setInCache,
  CACHE_CONFIG,
  isKVAvailable,
} from '../_shared/cache';
import { resolveOrCreateUserId } from '../_shared/user-resolver';

type SessionAnalyticsData = z.infer<typeof sessionAnalyticsSchema>;
type SessionAnalyticsQuery = z.infer<typeof sessionAnalyticsQuerySchema>;

/**
 * Generate cache key for session analytics
 */
function getSessionAnalyticsCacheKey(userId: string, limit: number, includeProfile: boolean): string {
  return `${CACHE_CONFIG.PREFIX.USER_STATS}session_analytics:${userId}:${limit}:${includeProfile}`;
}

export const onRequestOptions = withCors();

/**
 * POST: Record comprehensive session analytics
 */
export const onRequestPost = authenticatedEndpoint(
  sessionAnalyticsSchema,
  async (context: AuthenticatedContext & ValidatedContext<SessionAnalyticsData>) => {
    const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

    try {
      const data = context.validated;
      const userId = await resolveOrCreateUserId(prisma, context.auth.userId);
      const resolvedSessionId = data.sessionId || uuidv4();

      // Determine session ID: use provided one or generate a fallback
      const sessionId = data.sessionId || uuidv4();

      // Ownership check: if caller supplied an existing session ID, verify they own it
      if (data.sessionId) {
        const existing = await prisma.studySession.findUnique({
          where: { id: data.sessionId },
          select: { id: true, userId: true },
        });
        if (existing && existing.userId !== userId) {
          return {
            status: 403,
            error: 'You do not have permission to update this session.',
          };
        }
      }

      const sessionFields = {
        startedAt: new Date(data.startedAt),
        endedAt: new Date(data.endedAt),
        totalQuestions: data.totalQuestions,
        correctAnswers: data.correctAnswers || 0,
        accuracy: data.accuracy || 0,
        totalTimeMs: data.totalTimeMs || 0,
        avgTimePerQuestion: data.avgTimePerQuestion,
        bestStreak: data.bestStreak || 0,
        finalStreak: data.finalStreak || 0,
        avgStreak: data.avgStreak,
        errorClusters: data.errorClusters || 0,
        peakMomentum: data.peakMomentum,
        avgMomentum: data.avgMomentum,
        momentumTrend: data.momentumTrend,
        totalAnswerChanges: data.totalAnswerChanges || 0,
        helpfulChanges: data.helpfulChanges || 0,
        harmfulChanges: data.harmfulChanges || 0,
        firstInstinctAccuracy: data.firstInstinctAccuracy,
        avgInferredConfidence: data.avgInferredConfidence,
        highConfidenceAccuracy: data.highConfidenceAccuracy,
        lowConfidenceAccuracy: data.lowConfidenceAccuracy,
        calibrationScore: data.calibrationScore,
        questionsUnderPar: data.questionsUnderPar || 0,
        questionsOverPar: data.questionsOverPar || 0,
        rushingAccuracy: data.rushingAccuracy,
        deliberateAccuracy: data.deliberateAccuracy,
        early10Accuracy: data.early10Accuracy,
        late10Accuracy: data.late10Accuracy,
        staminaFade: data.staminaFade,
        distributionScore: data.distributionScore,
        systemsCovered: data.systemsCovered || [],
        predictedScore: data.predictedScore,
        scoreConfidence: data.scoreConfidence,
        passLikelihood: data.passLikelihood,
        mode: data.mode,
        focus: data.focus,
        difficulty: data.difficulty,
        deviceType: data.deviceType,
        browserName: data.browserName,
        updatedAt: new Date(),
      };

      // Upsert study session — idempotent for retry/double-submit cases
      const session = await prisma.studySession.upsert({
        where: { id: sessionId },
        create: { id: sessionId, userId, ...sessionFields },
        update: sessionFields,
      });

      // Upsert SessionAnalytics row — enables dashboards without re-querying StudySession
      const totalDurationMinutes =
        data.totalTimeMs != null ? Math.round(data.totalTimeMs / 60000) : undefined;
      const systemDistribution =
        (data.systemsCovered?.length ?? 0) > 0
          ? (data.systemsCovered as string[]).reduce((acc: Record<string, number>, s: string) => {
              acc[s] = (acc[s] ?? 0) + 1;
              return acc;
            }, {})
          : undefined;
      const analyticsFields = {
        userId,
        sessionId: session.id,
        totalDurationMinutes: totalDurationMinutes ?? undefined,
        avgResponseTime: data.avgTimePerQuestion ?? undefined,
        systemDistribution: systemDistribution ?? undefined,
        wasCompleted: true,
      };
      await prisma.sessionAnalytics.upsert({
        where: { sessionId: session.id },
        create: { id: `analytics_${session.id}`, ...analyticsFields },
        update: analyticsFields,
      });

      // Update user learning profile
      await updateUserLearningProfile(prisma, userId, data);

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
    if (!context.env.DATABASE_URL) {
      return {
        status: 503,
        data: { error: 'Analytics temporarily unavailable. Database not configured.' },
      };
    }
    const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

    try {
      const params = context.validated;
      const limit = params.limit;
      const includeProfile = params.includeProfile;

      // Check cache first if KV is available
      if (isKVAvailable(context.env.CACHE)) {
        const cacheKey = getSessionAnalyticsCacheKey(context.auth.userId, limit, includeProfile);
        const cached = await getFromCache(context.env.CACHE, cacheKey);
        if (cached) {
          return {
            status: 200,
            data: cached,
            headers: { 'X-Cache': 'HIT' },
          };
        }
      }

      const userId = await resolveOrCreateUserId(prisma, context.auth.userId);

      // Get recent sessions
      const sessions = await prisma.studySession.findMany({
        where: { userId },
        orderBy: { startedAt: 'desc' },
        take: Math.min(limit, 100),
      });

      // Get learning profile if requested
      let profile = null;
      if (includeProfile) {
        profile = await prisma.userLearningProfile.findUnique({
          where: { userId },
        });
      }

      // Calculate aggregate stats from recent sessions
      const recentSessions = sessions.slice(0, 10);
      const aggregateStats = {
        recentAvgAccuracy:
          recentSessions.length > 0
            ? recentSessions.reduce(
                (sum: number, s: (typeof recentSessions)[0]) => sum + s.accuracy,
                0
              ) / recentSessions.length
            : null,
        recentAvgQuestions:
          recentSessions.length > 0
            ? Math.round(
                recentSessions.reduce(
                  (sum: number, s: (typeof recentSessions)[0]) => sum + s.totalQuestions,
                  0
                ) / recentSessions.length
              )
            : null,
        recentAvgMomentum:
          recentSessions.filter((s: (typeof recentSessions)[0]) => s.avgMomentum !== null).length >
          0
            ? recentSessions
                .filter((s: (typeof recentSessions)[0]) => s.avgMomentum !== null)
                .reduce(
                  (sum: number, s: (typeof recentSessions)[0]) => sum + (s.avgMomentum || 0),
                  0
                ) /
              recentSessions.filter((s: (typeof recentSessions)[0]) => s.avgMomentum !== null)
                .length
            : null,
        accuracyTrend: calculateTrend(
          recentSessions.map((s: (typeof recentSessions)[0]) => s.accuracy)
        ),
        totalSessions: sessions.length,
      };

      const responseData = {
        sessions: sessions.map((s: (typeof sessions)[0]) => ({
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
      };

      // Cache the result if KV is available
      if (isKVAvailable(context.env.CACHE)) {
        const cacheKey = getSessionAnalyticsCacheKey(context.auth.userId, limit, includeProfile);
        await setInCache(context.env.CACHE, cacheKey, responseData, CACHE_CONFIG.TTL.USER_STATS);
      }

      return {
        status: 200,
        data: responseData,
        headers: { 'X-Cache': 'MISS' },
      };
    } catch (error) {
      return {
        status: 500,
        data: { error: 'Server error loading analytics. Please try again later.' },
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
        updatedAt: new Date(),
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

  const recentAvg = recent.reduce((s: number, v: number) => s + v, 0) / recent.length;
  const olderAvg = older.reduce((s: number, v: number) => s + v, 0) / older.length;

  const diff = recentAvg - olderAvg;

  if (diff > 5) return 'improving';
  if (diff < -5) return 'declining';
  return 'stable';
}
