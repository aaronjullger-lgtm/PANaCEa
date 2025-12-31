/**
 * API Endpoint: /api/user/daily-performance
 * 
 * Get daily performance data for trend visualization.
 * Returns attempts and accuracy per day for a specified period.
 */

import { authenticateRequest } from '../_shared/auth';
import { createEdgePrismaClient } from '../_shared/prisma-edge';

interface Env {
  DATABASE_URL: string;
  CLERK_SECRET_KEY: string;
}

export const onRequestGet = async (context: { request: Request; env: Env }) => {
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

    // Get query params
    const url = new URL(context.request.url);
    const daysParam = url.searchParams.get('days') || '30';
    const days = Math.min(parseInt(daysParam), 90); // Max 90 days

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 86400000);

    // Get all attempts in the date range
    const attempts = await prisma.questionAttempt.findMany({
      where: {
        userId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        wasCorrect: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Group by day
    const dailyMap: Record<string, { attempts: number; correct: number }> = {};
    
    for (const attempt of attempts) {
      const dateKey = attempt.createdAt.toISOString().split('T')[0];
      if (!dailyMap[dateKey]) {
        dailyMap[dateKey] = { attempts: 0, correct: 0 };
      }
      dailyMap[dateKey].attempts++;
      if (attempt.wasCorrect) {
        dailyMap[dateKey].correct++;
      }
    }

    // Convert to array with accuracy calculated
    const dailyData = Object.entries(dailyMap).map(([date, data]) => ({
      date,
      attempts: data.attempts,
      correct: data.correct,
      accuracy: data.attempts > 0 ? Math.round((data.correct / data.attempts) * 100) : 0,
    }));

    // Sort by date
    dailyData.sort((a, b) => a.date.localeCompare(b.date));

    return new Response(JSON.stringify({
      success: true,
      data: {
        period: `${days}d`,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        dailyPerformance: dailyData,
        summary: {
          totalAttempts: attempts.length,
          totalCorrect: attempts.filter(a => a.wasCorrect).length,
          activeDays: dailyData.length,
          avgAttemptsPerActiveDay: dailyData.length > 0 
            ? Math.round(attempts.length / dailyData.length)
            : 0,
        },
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching daily performance:', error);
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
