/**
 * API Endpoint: /api/user/daily-performance
 *
 * Get daily performance data for trend visualization.
 * Returns attempts and accuracy per day for a specified period.
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

const DailyPerformanceSchema = z.object({
  query: z.object({
    days: z.string().optional().default('30'),
  }),
});

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(DailyPerformanceSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/user/daily-performance');
  let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;

  try {
    prisma = createEdgePrismaClient(env.DATABASE_URL);

    // Parse and validate days parameter
    const days = Math.min(parseInt(validated.query?.days || '30'), 90); // Max 90 days

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 86400000);

    // Get all attempts in the date range
    const attempts = await prisma.questionAttempt.findMany({
      where: {
        userId: auth.userId,
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

    logger.info('Fetched daily performance', {
      userId: auth.userId,
      days,
      activeDays: dailyData.length,
      totalAttempts: attempts.length,
    });

    return {
      data: {
        period: `${days}d`,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        dailyPerformance: dailyData,
        summary: {
          totalAttempts: attempts.length,
          totalCorrect: attempts.filter((a) => a.wasCorrect).length,
          activeDays: dailyData.length,
          avgAttemptsPerActiveDay:
            dailyData.length > 0 ? Math.round(attempts.length / dailyData.length) : 0,
        },
      },
    };
  } catch (error) {
    logger.error('Error fetching daily performance', {
      error: error instanceof Error ? error.message : String(error),
      userId: auth.userId,
    });
    throw new Error('Failed to fetch daily performance');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
