/**
 * Retention Stats API Endpoint
 * GET /api/stats/retention
 * Returns retention analytics for dashboard visualizations
 */

import { z } from 'zod';
import { authenticatedEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { buildRetrievabilityCurve } from '../../../lib/fsrs-retrievability';

/** Type for canonical UserProgress rows used by retention stats. */
interface FSRSProgressRecord {
  id: string;
  nextReviewAt: Date | null;
  lastReviewAt: Date | null;
  fsrsStability: number | null;
}

const RetentionStatsSchema = z.object({});

export const onRequestGet = authenticatedEndpoint(RetentionStatsSchema, async (context) => {
  const { env, auth } = context;
  const logger = createEndpointLogger('/api/stats/retention');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const user = await prisma.user.findUnique({
      where: { clerkId: auth.userId },
      select: { id: true },
    });

    if (!user) {
      return {
        data: { error: 'User not found', message: 'Your user account has not been synced yet.' },
        status: 404,
      };
    }

    const userId = user.id;
    const now = new Date();

    const progressRows = await prisma.userProgress.findMany({
      where: { userId },
      select: {
        id: true,
        nextReviewAt: true,
        lastReviewAt: true,
        fsrsStability: true,
      },
    });

    const dueCount = progressRows.filter(
      (item: FSRSProgressRecord) => item.nextReviewAt != null && item.nextReviewAt <= now
    ).length;

    // Provenance: only items with real FSRS stability + at least one real review
    // count toward the retention curve. Everything else is fabricated precision.
    const reviewedItems = progressRows.filter(
      (item: FSRSProgressRecord) =>
        item.fsrsStability != null &&
        item.fsrsStability > 0 &&
        item.lastReviewAt != null
    );

    // Short-circuit when there is no real data: don't fabricate a curve.
    if (reviewedItems.length === 0) {
      logger.info('Retention stats: insufficient data', {
        userId: auth.userId,
        totalCards: progressRows.length,
        reviewedCount: 0,
      });

      return {
        data: {
          success: true,
          data: {
            dueCount,
            totalCards: progressRows.length,
            decayCurveData: [],
            stabilityBuckets: [],
            // Empty strings hide the Algorithm Status widget via the
            // `safeData.lastTuned &&` guard in DashboardPage.tsx.
            lastTuned: '',
            tuningReason: '',
            adjustment: 'tighten' as const,
            meta: {
              status: 'insufficient_data' as const,
              reason: 'no_reviewed_items' as const,
            },
          },
        },
      };
    }

    const avgStability =
      reviewedItems.reduce(
        (sum: number, item: FSRSProgressRecord) => sum + (item.fsrsStability ?? 0),
        0
      ) / reviewedItems.length;

    // FSRS v6 retrievability curve via shared helper (lib/fsrs-retrievability.ts).
    // Single source of truth for the (19/81, -0.5) formula across the app.
    const decayCurveData = buildRetrievabilityCurve(avgStability, 30);

    const stabilityBuckets = [
      { bucket: '<1d', count: 0, color: 'var(--color-data-fail)' },
      { bucket: '1-3d', count: 0, color: 'var(--color-data-provisional)' },
      { bucket: '3-7d', count: 0, color: 'var(--color-accent)' },
      { bucket: '7-21d', count: 0, color: 'var(--color-accent)' },
      { bucket: '21d+', count: 0, color: 'var(--color-data-pass)' },
    ];

    // Bucket only reviewed items — unreviewed items have no real stability.
    reviewedItems.forEach((item: FSRSProgressRecord) => {
      const stability = item.fsrsStability ?? 0;
      const bucket0 = stabilityBuckets[0];
      const bucket1 = stabilityBuckets[1];
      const bucket2 = stabilityBuckets[2];
      const bucket3 = stabilityBuckets[3];
      const bucket4 = stabilityBuckets[4];
      if (stability < 1 && bucket0) bucket0.count++;
      else if (stability < 3 && bucket1) bucket1.count++;
      else if (stability < 7 && bucket2) bucket2.count++;
      else if (stability < 21 && bucket3) bucket3.count++;
      else if (bucket4) bucket4.count++;
    });

    logger.info('Fetched retention stats', {
      userId: auth.userId,
      dueCount,
      totalCards: progressRows.length,
      reviewedCount: reviewedItems.length,
    });

    return {
      data: {
        success: true,
        data: {
          dueCount,
          totalCards: progressRows.length,
          decayCurveData,
          stabilityBuckets,
          // Tuning metadata is not yet wired to a real optimizer run.
          // Return empty strings so the Algorithm Status widget stays hidden
          // until a real optimization pipeline populates these fields.
          lastTuned: '',
          tuningReason: '',
          adjustment: 'tighten' as const,
          meta: {
            status: 'ok' as const,
            reviewedCount: reviewedItems.length,
            avgStability,
          },
        },
      },
    };
  } catch (error) {
    logger.error('Retention stats error', {
      error: error instanceof Error ? error.message : String(error),
      userId: auth.userId,
    });
    throw new Error('Failed to fetch retention stats');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
