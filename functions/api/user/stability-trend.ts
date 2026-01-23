/**
 * User Stability Trend API
 *
 * Returns FSRS stability growth over time for visualization
 * Used by AnalyticsDashboard to show learning progress
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

const StabilityTrendSchema = z.object({
  query: z.object({
    days: z.string().optional(),
  }),
});

export interface StabilityTrendDataPoint {
  date: string;
  avgStability: number;
  totalReviews: number;
  conditions: Array<{ conditionId: string; stability: number }>;
}

interface ReviewSnapshot {
  date: string;
  stability: number;
  difficulty: number;
  rating: number;
  state: number;
}

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(StabilityTrendSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/user/stability-trend');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const days = parseInt(validated.query?.days || '30', 10);

    const user = await prisma.user.findUnique({
      where: { clerkId: auth.userId },
      select: { id: true },
    });

    if (!user) {
      return {
        data: { data: [], message: 'User not found. Please complete some questions first!' },
      };
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const allProgress = await prisma.userProgress.findMany({
      where: { userId: user.id },
      select: { conditionId: true, reviewHistory: true },
    });

    const allSnapshots: Array<ReviewSnapshot & { conditionId: string }> = [];

    for (const progress of allProgress) {
      if (!Array.isArray(progress.reviewHistory)) continue;
      const snapshots = (progress.reviewHistory as ReviewSnapshot[])
        .filter((snapshot: ReviewSnapshot) => {
          if (!snapshot.date) return false;
          const snapshotDate = new Date(snapshot.date);
          return snapshotDate >= cutoffDate;
        })
        .map((snapshot: ReviewSnapshot) => ({ ...snapshot, conditionId: progress.conditionId }));
      allSnapshots.push(...snapshots);
    }

    const reviewHistory = allSnapshots.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    if (reviewHistory.length === 0) {
      return {
        data: {
          data: [],
          message: 'No review history found. Complete some questions to see stability trends!',
        },
      };
    }

    const dateMap = new Map<string, { stabilities: number[]; conditions: Map<string, number> }>();

    reviewHistory.forEach((snapshot: ReviewSnapshot & { conditionId: string }) => {
      const date = snapshot.date?.split('T')[0] ?? '';
      if (!date || !dateMap.has(date)) {
        dateMap.set(date, { stabilities: [], conditions: new Map() });
      }
      const entry = dateMap.get(date)!;
      entry.stabilities.push(snapshot.stability);
      entry.conditions.set(snapshot.conditionId, snapshot.stability);
    });

    const trendData: StabilityTrendDataPoint[] = Array.from(dateMap.entries())
      .map(([date, entry]) => {
        const avgStability =
          entry.stabilities.reduce((sum, s) => sum + s, 0) / entry.stabilities.length;
        return {
          date,
          avgStability: Math.round(avgStability * 100) / 100,
          totalReviews: entry.stabilities.length,
          conditions: Array.from(entry.conditions.entries()).map(([conditionId, stability]) => ({
            conditionId,
            stability: Math.round(stability * 100) / 100,
          })),
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    logger.info('Fetched stability trend', {
      userId: auth.userId,
      days,
      dataPoints: trendData.length,
    });

    const firstData = trendData[0];
    const lastData = trendData[trendData.length - 1];

    return {
      data: {
        data: trendData,
        summary: {
          days,
          totalDataPoints: trendData.length,
          totalReviews: reviewHistory.length,
          startDate: firstData?.date,
          endDate: lastData?.date,
          startStability: firstData?.avgStability || 0,
          endStability: lastData?.avgStability || 0,
          stabilityGrowth:
            trendData.length > 1 && firstData && firstData.avgStability > 0 && lastData
              ? Math.round(
                  ((lastData.avgStability - firstData.avgStability) / firstData.avgStability) * 100
                )
              : 0,
        },
      },
    };
  } catch (error) {
    logger.error('Error fetching stability trend', {
      error: error instanceof Error ? error.message : String(error),
      userId: auth.userId,
    });
    throw new Error('Failed to fetch stability trend');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
