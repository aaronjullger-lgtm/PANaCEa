/**
 * Retention Stats API Endpoint
 * GET /api/stats/retention
 * Returns retention analytics for dashboard visualizations
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { buildRetrievabilityCurve } from '../../../lib/fsrs-retrievability';

/** Type for SRS item from Prisma query */
interface SRSItemRecord {
  id: string;
  interval: number;
  dueDate: Date;
  lastReviewed: Date | null;
  easiness: number;
  repetition: number;
  fsrsStability: number | null;
}

const RetentionStatsSchema = z.object({});

export const onRequestOptions = withCors();

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

    const srsItems = await prisma.sRSItem.findMany({
      where: { userId },
      select: {
        id: true,
        interval: true,
        dueDate: true,
        lastReviewed: true,
        easiness: true,
        repetition: true,
        fsrsStability: true,
      },
    });

    const dueCount = srsItems.filter((item: SRSItemRecord) => item.dueDate <= now).length;

    // Provenance: only items with real FSRS stability + at least one real review
    // count toward the retention curve. Everything else is fabricated precision.
    const reviewedItems = srsItems.filter(
      (item: SRSItemRecord) =>
        item.fsrsStability != null &&
        item.fsrsStability > 0 &&
        item.lastReviewed != null
    );

    // Short-circuit when there is no real data: don't fabricate a curve.
    if (reviewedItems.length === 0) {
      logger.info('Retention stats: insufficient data', {
        userId: auth.userId,
        totalCards: srsItems.length,
        reviewedCount: 0,
      });

      return {
        data: {
          success: true,
          data: {
            dueCount,
            totalCards: srsItems.length,
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
        (sum: number, item: SRSItemRecord) => sum + (item.fsrsStability ?? 0),
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

    // Bucket only reviewed items — unreviewed items have no real interval.
    reviewedItems.forEach((item: SRSItemRecord) => {
      const interval = item.interval;
      const bucket0 = stabilityBuckets[0];
      const bucket1 = stabilityBuckets[1];
      const bucket2 = stabilityBuckets[2];
      const bucket3 = stabilityBuckets[3];
      const bucket4 = stabilityBuckets[4];
      if (interval < 1 && bucket0) bucket0.count++;
      else if (interval < 3 && bucket1) bucket1.count++;
      else if (interval < 7 && bucket2) bucket2.count++;
      else if (interval < 21 && bucket3) bucket3.count++;
      else if (bucket4) bucket4.count++;
    });

    logger.info('Fetched retention stats', {
      userId: auth.userId,
      dueCount,
      totalCards: srsItems.length,
      reviewedCount: reviewedItems.length,
    });

    return {
      data: {
        success: true,
        data: {
          dueCount,
          totalCards: srsItems.length,
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
