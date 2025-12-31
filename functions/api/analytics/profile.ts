/**
 * API Endpoint: /api/analytics/profile
 * 
 * Get and update user learning profile with computed insights.
 * Analyzes historical data to generate personalized recommendations.
 */

import type { PagesFunction } from '@cloudflare/workers-types';
import { authenticateRequest } from '../_shared/auth';
import { createEdgePrismaClient } from '../_shared/prisma-edge';

interface Env {
  DATABASE_URL: string;
  CLERK_SECRET_KEY: string;
}

/**
 * GET: Retrieve user's learning profile with computed insights
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const prisma = createEdgePrismaClient(context.env.DATABASE_URL);
  
  try {
    const authResult = await authenticateRequest(context.request as any, context.env);
    if (!authResult || !authResult.userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

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

    // Get learning profile
    const profile = await prisma.userLearningProfile.findUnique({
      where: { userId: user.id },
    });

    if (!profile) {
      return new Response(JSON.stringify({ 
        profile: null,
        message: 'No learning profile yet. Complete some study sessions to build your profile.' 
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get recent sessions for trend analysis
    const recentSessions = await prisma.studySession.findMany({
      where: { userId: user.id },
      orderBy: { startedAt: 'desc' },
      take: 20,
    });

    // Compute additional insights
    const insights = computeInsights(profile, recentSessions);

    return new Response(JSON.stringify({
      profile: {
        ...profile,
        lifetimeStudyTimeMs: Number(profile.lifetimeStudyTimeMs),
        computedInsights: insights,
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[ProfileAPI] Error:', error);
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
 * POST: Trigger profile recomputation from historical data
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const prisma = createEdgePrismaClient(context.env.DATABASE_URL);
  
  try {
    const authResult = await authenticateRequest(context.request as any, context.env);
    if (!authResult || !authResult.userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

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

    // Get all sessions for this user
    const allSessions = await prisma.studySession.findMany({
      where: { userId: user.id },
      orderBy: { startedAt: 'desc' },
    });

    if (allSessions.length === 0) {
      return new Response(JSON.stringify({
        message: 'No sessions found to compute profile from',
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Compute aggregated metrics
    const lifetimeQuestions = allSessions.reduce((sum, s) => sum + s.totalQuestions, 0);
    const lifetimeCorrect = allSessions.reduce((sum, s) => sum + s.correctAnswers, 0);
    const lifetimeAccuracy = lifetimeQuestions > 0 ? (lifetimeCorrect / lifetimeQuestions) * 100 : 0;
    const lifetimeStudyTimeMs = allSessions.reduce((sum, s) => sum + s.totalTimeMs, 0);
    const bestEverStreak = Math.max(...allSessions.map(s => s.bestStreak));

    // Compute system strengths/weaknesses
    const systemStats: Record<string, { correct: number; total: number }> = {};
    for (const session of allSessions) {
      for (const system of session.systemsCovered) {
        if (!systemStats[system]) {
          systemStats[system] = { correct: 0, total: 0 };
        }
        // Approximate - we'd need per-question data for exact numbers
        systemStats[system].total += Math.ceil(session.totalQuestions / session.systemsCovered.length);
        systemStats[system].correct += Math.ceil(session.correctAnswers / session.systemsCovered.length);
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
      .filter(s => s.accuracy >= 75)
      .slice(0, 5)
      .map(s => s.system);

    const weakestSystems = systemAccuracies
      .filter(s => s.accuracy < 60)
      .slice(-5)
      .map(s => s.system);

    // Compute average calibration score
    const sessionsWithCalibration = allSessions.filter(s => s.calibrationScore !== null);
    const avgCalibration = sessionsWithCalibration.length > 0
      ? sessionsWithCalibration.reduce((sum, s) => sum + (s.calibrationScore || 0), 0) / sessionsWithCalibration.length
      : null;

    // Compute answer change effectiveness
    const totalHelpful = allSessions.reduce((sum, s) => sum + s.helpfulChanges, 0);
    const totalHarmful = allSessions.reduce((sum, s) => sum + s.harmfulChanges, 0);
    const totalChanges = totalHelpful + totalHarmful;
    const changeHelpfulRatio = totalChanges > 0 ? totalHelpful / totalChanges : null;

    // Compute average session metrics
    const avgSessionLength = Math.round(lifetimeQuestions / allSessions.length);

    // Compute fatigue onset (where accuracy drops)
    // This is a simplified calculation
    const sessionsWithFatigue = allSessions.filter(
      s => s.early10Accuracy !== null && s.late10Accuracy !== null && 
           (s.early10Accuracy - (s.late10Accuracy || 0)) > 10
    );
    const fatigueOnsetQuestion = sessionsWithFatigue.length > 0
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
      recommendations.push(`Focus on ${weakestSystems.slice(0, 3).join(', ')} - these are your weakest areas`);
    }
    
    if (changeHelpfulRatio !== null && changeHelpfulRatio < 0.4) {
      recommendations.push('Trust your first instinct more - you often change to wrong answers');
    }
    
    if (fatigueOnsetQuestion && fatigueOnsetQuestion < 30) {
      recommendations.push(`Consider shorter study sessions (~${fatigueOnsetQuestion} questions) for optimal retention`);
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

    return new Response(JSON.stringify({
      success: true,
      message: 'Profile recomputed from historical data',
      profile: {
        ...updatedProfile,
        lifetimeStudyTimeMs: Number(updatedProfile.lifetimeStudyTimeMs),
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[ProfileAPI] Recompute error:', error);
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
 * Compute additional insights from profile and recent sessions
 */
function computeInsights(
  profile: any,
  recentSessions: any[]
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
    
    const recentAvg = recent3.reduce((s, sess) => s + sess.accuracy, 0) / 3;
    const olderAvg = older3.reduce((s, sess) => s + sess.accuracy, 0) / 3;
    
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
  const momentumTrend = Object.entries(momentumCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || 'steady';

  // Recent average accuracy
  const recentAvgAccuracy = recentSessions.length > 0
    ? recentSessions.slice(0, 10).reduce((s, sess) => s + sess.accuracy, 0) / Math.min(recentSessions.length, 10)
    : null;

  // Study consistency (based on session timestamps)
  let studyConsistency: 'consistent' | 'sporadic' | 'new' = 'new';
  if (recentSessions.length >= 5) {
    const daysBetweenSessions: number[] = [];
    for (let i = 1; i < Math.min(recentSessions.length, 10); i++) {
      const diff = new Date(recentSessions[i - 1].startedAt).getTime() - 
                   new Date(recentSessions[i].startedAt).getTime();
      daysBetweenSessions.push(diff / (1000 * 60 * 60 * 24));
    }
    
    const avgDaysBetween = daysBetweenSessions.reduce((s, d) => s + d, 0) / daysBetweenSessions.length;
    studyConsistency = avgDaysBetween <= 2 ? 'consistent' : 'sporadic';
  }

  return {
    accuracyTrend,
    momentumTrend,
    recentAvgAccuracy,
    studyConsistency,
  };
}
