/**
 * API Endpoint: /api/user/stats
 * 
 * Get comprehensive user statistics for analytics and FSRS tuning.
 * Returns per-system accuracy, trends, weak areas, and study recommendations.
 */

import type { PagesFunction } from '@cloudflare/workers-types';
import { authenticateRequest } from '../_shared/auth';
import { createEdgePrismaClient } from '../_shared/prisma-edge';

interface Env {
  DATABASE_URL: string;
  CLERK_SECRET_KEY: string;
}

const SYSTEMS = ['CV', 'PULM', 'GI', 'NEURO', 'MSK', 'DERM', 'HEME', 'ENDO', 'HEENT', 'RENAL', 'REPRO', 'PSYCH', 'ID', 'GU'];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const onRequestGet: PagesFunction<Env> = async (context): Promise<any> => {
  const prisma = createEdgePrismaClient(context.env.DATABASE_URL);
  
  try {
    // Authenticate request
    const authResult = await authenticateRequest(context.request as any, context.env);
    if (!authResult) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const userId = authResult.userId;

    // Get all attempts for this user
    const allAttempts = await prisma.questionAttempt.findMany({
      where: { userId },
      select: {
        wasCorrect: true,
        system: true,
        conditionId: true,
        mode: true,
        timeSpentMs: true,
        answerChangedCount: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate overall stats
    const totalAttempts = allAttempts.length;
    const correctAttempts = allAttempts.filter(a => a.wasCorrect).length;
    const overallAccuracy = totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 0;

    // Calculate average time metrics
    const attemptsWithTime = allAttempts.filter(a => a.timeSpentMs && a.timeSpentMs > 0);
    const avgTimeMs = attemptsWithTime.length > 0
      ? Math.round(attemptsWithTime.reduce((sum, a) => sum + (a.timeSpentMs || 0), 0) / attemptsWithTime.length)
      : null;
    const avgAnswerChanges = attemptsWithTime.length > 0
      ? +(attemptsWithTime.reduce((sum, a) => sum + (a.answerChangedCount || 0), 0) / attemptsWithTime.length).toFixed(2)
      : null;

    // Calculate per-system stats
    const systemStats: Record<string, {
      total: number;
      correct: number;
      accuracy: number;
      trend: 'improving' | 'declining' | 'neutral';
      avgTimeMs: number | null;
      lastAttempt: string | null;
    }> = {};

    for (const system of SYSTEMS) {
      const systemAttempts = allAttempts.filter(a => a.system === system);
      const total = systemAttempts.length;
      const correct = systemAttempts.filter(a => a.wasCorrect).length;
      const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
      
      // Calculate trend
      let trend: 'improving' | 'declining' | 'neutral' = 'neutral';
      if (systemAttempts.length >= 10) {
        const recent5 = systemAttempts.slice(0, 5);
        const previous5 = systemAttempts.slice(5, 10);
        const recentAcc = recent5.filter(a => a.wasCorrect).length / 5;
        const prevAcc = previous5.filter(a => a.wasCorrect).length / 5;
        
        if (recentAcc > prevAcc + 0.15) trend = 'improving';
        else if (recentAcc < prevAcc - 0.15) trend = 'declining';
      }

      // Calculate average time for this system
      const systemWithTime = systemAttempts.filter(a => a.timeSpentMs && a.timeSpentMs > 0);
      const sysAvgTime = systemWithTime.length > 0
        ? Math.round(systemWithTime.reduce((sum, a) => sum + (a.timeSpentMs || 0), 0) / systemWithTime.length)
        : null;

      systemStats[system] = {
        total,
        correct,
        accuracy,
        trend,
        avgTimeMs: sysAvgTime,
        lastAttempt: systemAttempts[0]?.createdAt.toISOString() || null,
      };
    }

    // Identify weak areas (systems with accuracy < 70% and at least 5 attempts)
    const weakAreas = Object.entries(systemStats)
      .filter(([, stats]) => stats.total >= 5 && stats.accuracy < 70)
      .sort((a, b) => a[1].accuracy - b[1].accuracy)
      .map(([system, stats]) => ({
        system,
        accuracy: stats.accuracy,
        attempts: stats.total,
        trend: stats.trend,
      }));

    // Identify strong areas (systems with accuracy >= 80% and at least 10 attempts)
    const strongAreas = Object.entries(systemStats)
      .filter(([, stats]) => stats.total >= 10 && stats.accuracy >= 80)
      .sort((a, b) => b[1].accuracy - a[1].accuracy)
      .map(([system, stats]) => ({
        system,
        accuracy: stats.accuracy,
        attempts: stats.total,
      }));

    // Calculate per-condition stats (top 20 most attempted)
    const conditionCounts: Record<string, { total: number; correct: number; conditionId: string }> = {};
    for (const attempt of allAttempts) {
      if (attempt.conditionId) {
        if (!conditionCounts[attempt.conditionId]) {
          conditionCounts[attempt.conditionId] = { total: 0, correct: 0, conditionId: attempt.conditionId };
        }
        conditionCounts[attempt.conditionId].total++;
        if (attempt.wasCorrect) conditionCounts[attempt.conditionId].correct++;
      }
    }

    const conditionStats = Object.values(conditionCounts)
      .filter(c => c.total >= 3) // At least 3 attempts
      .map(c => ({
        conditionId: c.conditionId,
        total: c.total,
        correct: c.correct,
        accuracy: Math.round((c.correct / c.total) * 100),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 30); // Top 30 conditions

    // Identify weak conditions (accuracy < 60% with at least 5 attempts)
    const weakConditions = Object.values(conditionCounts)
      .filter(c => c.total >= 5 && (c.correct / c.total) < 0.6)
      .map(c => ({
        conditionId: c.conditionId,
        total: c.total,
        correct: c.correct,
        accuracy: Math.round((c.correct / c.total) * 100),
      }))
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 10); // Top 10 weakest

    // Calculate study streak (days with at least 1 attempt)
    const attemptDates = new Set(
      allAttempts.map(a => a.createdAt.toISOString().split('T')[0])
    );
    const sortedDates = Array.from(attemptDates).sort().reverse() as string[];
    
    let currentStreak = 0;
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    
    // Check if studied today or yesterday
    if (sortedDates[0] === today || sortedDates[0] === yesterday) {
      currentStreak = 1;
      for (let i = 1; i < sortedDates.length; i++) {
        const prevDate = new Date(sortedDates[i - 1]);
        const currDate = new Date(sortedDates[i]);
        const diffDays = Math.floor((prevDate.getTime() - currDate.getTime()) / 86400000);
        
        if (diffDays === 1) {
          currentStreak++;
        } else {
          break;
        }
      }
    }

    // Get questions seen count
    const questionsSeenCount = await prisma.userQuestionHistory.count({
      where: { userId },
    });

    // Calculate time-based analytics (last 7 days vs previous 7 days)
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 86400000);

    const last7DaysAttempts = allAttempts.filter(a => a.createdAt >= sevenDaysAgo);
    const prev7DaysAttempts = allAttempts.filter(a => a.createdAt >= fourteenDaysAgo && a.createdAt < sevenDaysAgo);

    const last7Accuracy = last7DaysAttempts.length > 0
      ? Math.round((last7DaysAttempts.filter(a => a.wasCorrect).length / last7DaysAttempts.length) * 100)
      : null;
    const prev7Accuracy = prev7DaysAttempts.length > 0
      ? Math.round((prev7DaysAttempts.filter(a => a.wasCorrect).length / prev7DaysAttempts.length) * 100)
      : null;

    // Generate study recommendations
    const recommendations: string[] = [];
    
    if (weakAreas.length > 0) {
      recommendations.push(`Focus on ${weakAreas[0].system} - currently at ${weakAreas[0].accuracy}% accuracy`);
    }
    
    if (currentStreak === 0) {
      recommendations.push('Start a study streak today!');
    } else if (currentStreak >= 7) {
      recommendations.push(`Great ${currentStreak}-day streak! Keep it up!`);
    }

    const underStudiedSystems = Object.entries(systemStats)
      .filter(([, stats]) => stats.total < 10)
      .map(([system]) => system);
    
    if (underStudiedSystems.length > 0) {
      recommendations.push(`Try more questions in: ${underStudiedSystems.slice(0, 3).join(', ')}`);
    }

    return new Response(JSON.stringify({
      success: true,
      stats: {
        overall: {
          totalAttempts,
          correctAttempts,
          accuracy: overallAccuracy,
          questionsSeenCount,
          currentStreak,
          totalStudyDays: attemptDates.size,
          avgTimeMs,
          avgAnswerChanges,
        },
        bySystems: systemStats,
        byConditions: conditionStats,
        weakAreas,
        strongAreas,
        weakConditions,
        recentPerformance: {
          last7Days: {
            attempts: last7DaysAttempts.length,
            accuracy: last7Accuracy,
          },
          previous7Days: {
            attempts: prev7DaysAttempts.length,
            accuracy: prev7Accuracy,
          },
          trend: last7Accuracy !== null && prev7Accuracy !== null
            ? last7Accuracy > prev7Accuracy ? 'improving' : last7Accuracy < prev7Accuracy ? 'declining' : 'stable'
            : 'insufficient_data',
        },
        recommendations,
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching user stats:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } finally {
    await prisma.$disconnect();
  }
};
