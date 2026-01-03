/**
 * API Endpoint: /api/analytics/session
 * 
 * Record comprehensive session analytics to the database.
 * This endpoint receives all behavioral data collected during a study session.
 */

import { authenticateRequest } from '../_shared/auth';
import { createEdgePrismaClient } from '../_shared/prisma-edge';
import type { CloudflareContext } from '../_shared/types';
import { v4 as uuidv4 } from 'uuid';

interface Env {
  DATABASE_URL: string;
  CLERK_SECRET_KEY: string;
}

interface SessionAnalyticsData {
  // Session identifiers
  sessionId?: string;
  startedAt: string;
  endedAt: string;
  
  // Core metrics
  totalQuestions: number;
  correctAnswers: number;
  accuracy: number;
  totalTimeMs: number;
  avgTimePerQuestion?: number;
  
  // Streak data
  bestStreak: number;
  finalStreak: number;
  avgStreak?: number;
  errorClusters?: number;
  
  // Momentum metrics
  peakMomentum?: number;
  avgMomentum?: number;
  momentumTrend?: string;
  
  // Behavioral signals
  totalAnswerChanges: number;
  helpfulChanges: number;
  harmfulChanges: number;
  firstInstinctAccuracy?: number;
  
  // Confidence calibration
  avgInferredConfidence?: number;
  highConfidenceAccuracy?: number;
  lowConfidenceAccuracy?: number;
  calibrationScore?: number;
  
  // Time pressure analysis
  questionsUnderPar?: number;
  questionsOverPar?: number;
  rushingAccuracy?: number;
  deliberateAccuracy?: number;
  
  // Fatigue indicators
  early10Accuracy?: number;
  late10Accuracy?: number;
  staminaFade?: number;
  
  // PANCE distribution
  distributionScore?: number;
  systemsCovered?: string[];
  
  // Predicted score
  predictedScore?: number;
  scoreConfidence?: string;
  passLikelihood?: number;
  
  // Session settings
  mode?: string;
  focus?: string;
  difficulty?: string;
  
  // Device info
  deviceType?: string;
  browserName?: string;
}

export const onRequestPost = async (context: CloudflareContext<Env>) => {
  const prisma = createEdgePrismaClient(context.env.DATABASE_URL);
  
  try {
    // Authenticate request
    const authResult = await authenticateRequest(context.request as any, context.env);
    if (!authResult || !authResult.userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Parse request body
    let data: SessionAnalyticsData;
    try {
      data = await context.request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate minimum required fields
    if (!data.startedAt || !data.endedAt || data.totalQuestions === undefined) {
      return new Response(JSON.stringify({ 
        error: 'Missing required fields',
        required: ['startedAt', 'endedAt', 'totalQuestions'] 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Find user by Clerk ID
    const user = await prisma.user.findUnique({
      where: { clerkId: authResult.userId },
      select: { id: true },
    });

    if (!user) {
      return new Response(JSON.stringify({ 
        error: 'User not found',
        message: 'User must be synced from Clerk webhook first' 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
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

    return new Response(JSON.stringify({
      success: true,
      sessionId: session.id,
      message: 'Session analytics recorded successfully',
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[SessionAnalytics] Error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  } finally {
    await prisma.$disconnect();
  }
};

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
    const newLifetimeAccuracy = newLifetimeQuestions > 0 
      ? (newLifetimeCorrect / newLifetimeQuestions) * 100 
      : 0;
    const newLifetimeStudyTime = BigInt(existing.lifetimeStudyTimeMs) + BigInt(sessionData.totalTimeMs || 0);

    // Update best streak if this session had a better one
    const newBestStreak = Math.max(existing.bestEverStreak, sessionData.bestStreak || 0);

    // Rolling average for calibration score
    const newCalibrationScore = sessionData.calibrationScore !== undefined
      ? existing.overallCalibrationScore !== null
        ? (existing.overallCalibrationScore * 0.8 + sessionData.calibrationScore * 0.2)
        : sessionData.calibrationScore
      : existing.overallCalibrationScore;

    // Rolling average for answer change ratio
    const sessionChangeRatio = sessionData.totalAnswerChanges > 0
      ? sessionData.helpfulChanges / sessionData.totalAnswerChanges
      : null;
    const newChangeHelpfulRatio = sessionChangeRatio !== null
      ? existing.changeHelpfulRatio !== null
        ? (existing.changeHelpfulRatio * 0.8 + sessionChangeRatio * 0.2)
        : sessionChangeRatio
      : existing.changeHelpfulRatio;

    // Update estimated score with exponential smoothing
    const newEstimatedScore = sessionData.predictedScore !== undefined
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
        changeHelpfulRatio: sessionData.totalAnswerChanges > 0
          ? sessionData.helpfulChanges / sessionData.totalAnswerChanges
          : null,
        estimatedScore: sessionData.predictedScore,
      },
    });
  }
}

/**
 * GET: Retrieve user's session history and learning profile
 */
export const onRequestGet = async (context: CloudflareContext<Env>) => {
  const prisma = createEdgePrismaClient(context.env.DATABASE_URL);
  
  try {
    // Authenticate request
    const authResult = await authenticateRequest(context.request as any, context.env);
    if (!authResult || !authResult.userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Find user by Clerk ID
    const user = await prisma.user.findUnique({
      where: { clerkId: authResult.userId },
      select: { id: true },
    });

    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Parse query params
    const url = new URL(context.request.url);
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);
    const includeProfile = url.searchParams.get('includeProfile') !== 'false';

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
      recentAvgAccuracy: recentSessions.length > 0
        ? recentSessions.reduce((sum, s) => sum + s.accuracy, 0) / recentSessions.length
        : null,
      recentAvgQuestions: recentSessions.length > 0
        ? Math.round(recentSessions.reduce((sum, s) => sum + s.totalQuestions, 0) / recentSessions.length)
        : null,
      recentAvgMomentum: recentSessions.filter(s => s.avgMomentum !== null).length > 0
        ? recentSessions.filter(s => s.avgMomentum !== null)
            .reduce((sum, s) => sum + (s.avgMomentum || 0), 0) / 
            recentSessions.filter(s => s.avgMomentum !== null).length
        : null,
      accuracyTrend: calculateTrend(recentSessions.map(s => s.accuracy)),
      totalSessions: sessions.length,
    };

    return new Response(JSON.stringify({
      sessions: sessions.map(s => ({
        ...s,
        // Convert BigInt to number for JSON serialization
        lifetimeStudyTimeMs: undefined,
      })),
      profile: profile ? {
        ...profile,
        lifetimeStudyTimeMs: Number(profile.lifetimeStudyTimeMs),
      } : null,
      aggregateStats,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[SessionAnalytics] GET Error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  } finally {
    await prisma.$disconnect();
  }
};

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
