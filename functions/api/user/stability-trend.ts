/**
 * User Stability Trend API
 *
 * Returns FSRS stability growth over time for visualization
 * Used by AnalyticsDashboard to show learning progress
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors, getSentryTraceId } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { withTimeout, TimeoutError } from '../_shared/timeout';

const STABILITY_TREND_TIMEOUT_MS = 10_000; // 10s to respond before Worker kill
/** Max UserProgress rows to fetch (avoids Worker memory/CPU exhaustion) */
const MAX_PROGRESS_ROWS = 500;
/** Max snapshots to process in-memory (avoids sort/aggregate on huge arrays) */
const MAX_SNAPSHOTS = 10_000;
/** Max days parameter (avoids unbounded data) */
const MAX_DAYS = 90;

const StabilityTrendSchema = z.object({
  days: z.string().optional(),
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

const EMPTY_TREND_RESPONSE = {
  data: [] as StabilityTrendDataPoint[],
  message: 'Unable to load stability trend. Please try again.',
};

export const onRequestGet = authenticatedEndpoint(
  StabilityTrendSchema,
  async (context) => {
    const { env, auth, validated, request } = context;
    const logger = createEndpointLogger('/api/user/stability-trend');
    const sentryTraceId = getSentryTraceId(request);
    const prisma: ReturnType<typeof createEdgePrismaClient> | null = createEdgePrismaClient(
      env.DATABASE_URL
    );

    try {
      const days = Math.min(MAX_DAYS, Math.max(1, Number.parseInt(validated?.days || '30', 10)));

      const work = async () => {
        if (!prisma) throw new Error('No prisma');
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
          orderBy: { lastReviewAt: 'desc' },
          take: MAX_PROGRESS_ROWS,
        });

        const allSnapshots: Array<ReviewSnapshot & { conditionId: string }> = [];
        let totalPushed = 0;

        for (const progress of allProgress) {
          if (totalPushed >= MAX_SNAPSHOTS) break;
          if (!Array.isArray(progress.reviewHistory)) continue;
          const snapshots = (progress.reviewHistory as unknown as ReviewSnapshot[])
            .filter((snapshot: ReviewSnapshot) => {
              if (!snapshot.date) return false;
              const snapshotDate = new Date(snapshot.date);
              return snapshotDate >= cutoffDate;
            })
            .map((snapshot: ReviewSnapshot) => ({
              ...snapshot,
              conditionId: progress.conditionId,
            }));
          for (const s of snapshots) {
            if (totalPushed >= MAX_SNAPSHOTS) break;
            allSnapshots.push(s);
            totalPushed++;
          }
        }

        const reviewHistory = allSnapshots
          .slice()
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        if (reviewHistory.length === 0) {
          return {
            data: {
              data: [],
              message: 'No review history found. Complete some questions to see stability trends!',
            },
          };
        }

        const dateMap = new Map<
          string,
          { stabilities: number[]; conditions: Map<string, number> }
        >();

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
              conditions: Array.from(entry.conditions.entries()).map(
                ([conditionId, stability]) => ({
                  conditionId,
                  stability: Math.round(stability * 100) / 100,
                })
              ),
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
              truncated: totalPushed >= MAX_SNAPSHOTS,
              startDate: firstData?.date,
              endDate: lastData?.date,
              startStability: firstData?.avgStability || 0,
              endStability: lastData?.avgStability || 0,
              stabilityGrowth:
                trendData.length > 1 && firstData && firstData.avgStability > 0 && lastData
                  ? Math.round(
                      ((lastData.avgStability - firstData.avgStability) / firstData.avgStability) *
                        100
                    )
                  : 0,
            },
          },
        };
      };

      return await withTimeout(
        work(),
        STABILITY_TREND_TIMEOUT_MS,
        'Stability trend request timed out'
      );
    } catch (error) {
      const isTimeout = error instanceof TimeoutError;
      logger.error(isTimeout ? 'Stability trend timed out' : 'Error fetching stability trend', {
        error: error instanceof Error ? error.message : String(error),
        userId: auth.userId,
        sentryTraceId: sentryTraceId ?? undefined,
      });
      return {
        status: isTimeout ? 503 : 500,
        data: {
          ...EMPTY_TREND_RESPONSE,
          error: isTimeout
            ? 'Request timed out. Please try again.'
            : 'Failed to fetch stability trend',
          ...(sentryTraceId ? { sentryTraceId } : {}),
        },
      };
    } finally {
      if (prisma) await safePrismaDisconnect(prisma);
    }
  },
  { source: 'query' }
);
