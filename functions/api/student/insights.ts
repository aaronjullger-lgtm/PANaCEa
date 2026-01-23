/**
 * API: Get student progress insights
 * GET /api/student/insights?userId={userId}&period={period}
 *
 * Provides automated insights about student learning progress:
 * - Performance trends
 * - Weak areas identification
 * - Study recommendations
 * - Time optimization suggestions
 *
 * Query params:
 * - userId: string (required)
 * - period: '7d' | '30d' | '90d' | 'all' (default: '30d')
 */

import {
  authenticateRequest,
  createErrorResponse,
  createSuccessResponse,
  handleCorsOptions,
  type Env,
} from '../_shared/auth';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';

// Type for PerformanceRecord from Prisma query
interface PerformanceRecordResult {
  id: string;
  userId: string;
  system: string;
  isCorrect: boolean;
  timeSpent: bigint;
  timestamp: bigint;
}

export async function onRequestGet(context: { request: Request; env: Env }) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return handleCorsOptions();
  }

  const authContext = await authenticateRequest(request, env);
  if (!authContext) {
    return createErrorResponse('Unauthorized', 401);
  }

  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    const period = url.searchParams.get('period') || '30d';

    if (!userId) {
      return createErrorResponse('Missing userId parameter', 400);
    }

    // Calculate date range
    const now = new Date();
    const periodDays = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 365;
    const startDate = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);

    // Get performance records
    const records = await prisma.performanceRecord.findMany({
      where: {
        userId,
        timestamp: { gte: BigInt(startDate.getTime()) },
      },
      orderBy: { timestamp: 'desc' },
    });

    if (records.length === 0) {
      return createSuccessResponse({
        insights: {
          message: 'No activity in this period. Start studying to get personalized insights!',
          hasData: false,
        },
      });
    }

    // Calculate metrics
    const totalQuestions = records.length;
    const correctAnswers = records.filter((r: typeof records[0]) => r.isCorrect).length;
    const accuracy = (correctAnswers / totalQuestions) * 100;

    // Group by system
    const systemPerformance: Record<string, { total: number; correct: number; accuracy: number }> =
      {};
    records.forEach((record: typeof records[0]) => {
      if (!systemPerformance[record.system]) {
        systemPerformance[record.system] = { total: 0, correct: 0, accuracy: 0 };
      }
      const perfEntry = systemPerformance[record.system];
      if (perfEntry) {
        perfEntry.total++;
        if (record.isCorrect) {
          perfEntry.correct++;
        }
      }
    });

    // Calculate accuracy per system
    Object.keys(systemPerformance).forEach((system: string) => {
      const data = systemPerformance[system];
      if (data) {
        data.accuracy = (data.correct / data.total) * 100;
      }
    });

    // Identify weak areas (< 70% accuracy)
    const weakAreas = Object.entries(systemPerformance)
      .filter(([_system, data]: [string, any]) => data.accuracy < 70 && data.total >= 5)
      .sort((a: [string, any], b: [string, any]) => a[1].accuracy - b[1].accuracy)
      .map(([system, data]: [string, any]) => ({
        system,
        accuracy: Math.round(data.accuracy),
        questionsAnswered: data.total,
        recommendation: `Focus on ${system} - try ${3 - Math.floor(data.total / 10)} more drills this week`,
      }));

    // Identify strong areas (> 85% accuracy)
    const strongAreas = Object.entries(systemPerformance)
      .filter(([_system, data]: [string, any]) => data.accuracy > 85 && data.total >= 5)
      .sort((a: [string, any], b: [string, any]) => b[1].accuracy - a[1].accuracy)
      .map(([system, data]: [string, any]) => ({
        system,
        accuracy: Math.round(data.accuracy),
        questionsAnswered: data.total,
      }));

    // Calculate trend (compare first half vs second half of period)
    const midpoint = Math.floor(records.length / 2);
    const recentRecords = records.slice(0, midpoint);
    const olderRecords = records.slice(midpoint);

    const recentAccuracy =
      recentRecords.length > 0
        ? (recentRecords.filter((r: typeof recentRecords[0]) => r.isCorrect).length / recentRecords.length) * 100
        : 0;
    const olderAccuracy =
      olderRecords.length > 0
        ? (olderRecords.filter((r: typeof olderRecords[0]) => r.isCorrect).length / olderRecords.length) * 100
        : 0;

    const trend = recentAccuracy - olderAccuracy;
    const trendDirection = trend > 5 ? 'improving' : trend < -5 ? 'declining' : 'stable';

    // Study recommendations
    const recommendations: string[] = [];

    if (accuracy < 60) {
      recommendations.push('Consider reviewing fundamentals before attempting more questions');
      recommendations.push('Use Active Recall mode to strengthen retention');
    } else if (accuracy < 75) {
      recommendations.push("You're making progress! Focus on your weak areas identified below");
      recommendations.push('Try spaced repetition for better long-term retention');
    } else if (accuracy < 85) {
      recommendations.push('Great work! Challenge yourself with harder questions');
      recommendations.push('Review missed questions to understand common mistakes');
    } else {
      recommendations.push('Excellent performance! Consider helping peers in study groups');
      recommendations.push('Try Grand Rounds mode for competitive challenge');
    }

    if (weakAreas.length > 2) {
      const topWeakArea = weakAreas[0];
      if (topWeakArea) {
        recommendations.push(
          `Priority focus: ${topWeakArea.system} (${topWeakArea.accuracy}% accuracy)`
        );
      }
    }

    if (trendDirection === 'declining') {
      recommendations.push(
        'Your accuracy is declining - consider taking a break or reviewing study methods'
      );
    }

    // Time optimization
    const avgTimePerQuestion =
      records.reduce((sum: number, r: typeof records[0]) => sum + Number(r.timeSpent), 0) / records.length;
    const timeOptimization =
      avgTimePerQuestion > 120
        ? "You're taking time to think - good! But try to improve speed for exam conditions"
        : avgTimePerQuestion < 30
          ? "You're fast! Make sure you're reading questions carefully"
          : 'Your pace is excellent for exam-like conditions';

    return createSuccessResponse({
      insights: {
        hasData: true,
        period: `Last ${periodDays} days`,
        summary: {
          totalQuestions,
          accuracy: Math.round(accuracy),
          trend: trendDirection,
          trendChange: Math.round(trend),
        },
        weakAreas: weakAreas.slice(0, 5),
        strongAreas: strongAreas.slice(0, 3),
        recommendations,
        timeOptimization: {
          avgSeconds: Math.round(avgTimePerQuestion),
          message: timeOptimization,
        },
        systemBreakdown: Object.entries(systemPerformance)
          .map(([system, data]: [string, any]) => ({
            system,
            total: data.total,
            correct: data.correct,
            accuracy: Math.round(data.accuracy),
          }))
          .sort((a: any, b: any) => b.total - a.total),
      },
    });
  } catch (error: any) {
    console.error('Error generating student insights:', error);
    return createErrorResponse('Failed to generate insights', 500);
  } finally {
    await safePrismaDisconnect(prisma);
  }
}