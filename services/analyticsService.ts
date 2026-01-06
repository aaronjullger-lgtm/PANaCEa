import { prisma } from '../lib/prisma';

interface PerformanceDataPoint {
  date: string;
  performance: number;
}

class AnalyticsService {
  /**
   * Calculates a user's performance on a specific topic over time.
   * @param userId - The ID of the user.
   * @param topic - The PANCE blueprint topic (e.g., 'Cardiology').
   * @returns A promise that resolves to an array of performance data points.
   */
  async getTopicPerformanceTrend(userId: string, topic: string): Promise<PerformanceDataPoint[]> {
    try {
      const history = await prisma.userQuestionHistory.findMany({
        where: {
          userId,
          question: {
            topic: topic,
          },
        },
        orderBy: {
          seenAt: 'asc',
        },
        select: {
          isCorrect: true,
          seenAt: true,
        },
      });

      if (history.length === 0) {
        return [];
      }

      // Group by day and calculate percentage correct for each day
      const performanceByDay: { [date: string]: { correct: number; total: number } } = {};

      history.forEach(record => {
        const date = record.seenAt.toISOString().split('T')[0]; // YYYY-MM-DD
        if (!performanceByDay[date]) {
          performanceByDay[date] = { correct: 0, total: 0 };
        }
        if (record.isCorrect) {
          performanceByDay[date].correct++;
        }
        performanceByDay[date].total++;
      });

      const trendData: PerformanceDataPoint[] = Object.entries(performanceByDay).map(([date, stats]) => ({
        date,
        performance: (stats.correct / stats.total) * 100,
      }));

      return trendData;

    } catch (error) {
      console.error(`Error fetching performance trend for topic "${topic}":`, error);
      throw new Error('Failed to retrieve topic performance data.');
    }
  }
}

export const analyticsService = new AnalyticsService();
