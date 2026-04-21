/**
 * GET /api/user/calibration-dashboard
 *
 * Returns comprehensive calibration analytics for the Tier 2 Calibration Dashboard.
 * Computes dual-track calibration:
 * - FSRS model calibration (predicted retrievability vs actual recall)
 * - Metacognitive calibration (implicit confidence vs actual performance)
 *
 * Also provides per-PANCE-domain breakdowns and weekly Brier score trends.
 *
 * @see lib/services/calibrationDashboardService.ts — Pure computation functions
 */

import { z } from 'zod';
import { authenticatedEndpoint, type AuthenticatedContext, type ValidatedContext, withCors} from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import {
  buildCalibrationDashboard,
  type CalibrationObservation,
} from '../../../lib/services/calibrationDashboardService';

const emptySchema = z.object({});
type EmptyQuery = z.infer<typeof emptySchema>;

/** Max reviews to pull for calibration analysis */
const MAX_REVIEWS = 5000;

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(
  emptySchema,
  async (context: AuthenticatedContext & ValidatedContext<EmptyQuery>) => {
    const { userId } = context.auth;
    const prisma = createEdgePrismaClient(context.env.DATABASE_URL as string);

    try {
      // Pull ReviewLog entries with retrievability and confidence data
      const reviews = await prisma.reviewLog.findMany({
        where: {
          userId,
          review_type: 'real',
        },
        select: {
          retrievability: true,
          wasCorrect: true,
          implicit_confidence: true,
          system: true,
          reviewedAt: true,
        },
        orderBy: { reviewedAt: 'desc' },
        take: MAX_REVIEWS,
      });

      // Build FSRS calibration observations (predicted R vs actual)
      const fsrsObservations: CalibrationObservation[] = [];
      const metacognitiveObservations: CalibrationObservation[] = [];

      for (const review of reviews) {
        const actual = review.wasCorrect ? 1 : 0;
        const reviewedAt = review.reviewedAt.toISOString();
        const domain = review.system || undefined;

        // FSRS calibration: retrievability as predicted P(recall)
        if (review.retrievability != null && review.retrievability > 0) {
          fsrsObservations.push({
            predicted: review.retrievability,
            actual,
            domain,
            reviewedAt,
          });
        }

        // Metacognitive calibration: implicit confidence as predicted P(recall)
        if (review.implicit_confidence != null && review.implicit_confidence > 0) {
          metacognitiveObservations.push({
            predicted: review.implicit_confidence,
            actual,
            domain,
            reviewedAt,
          });
        }
      }

      // Compute full dashboard data using pure functions
      const dashboardData = buildCalibrationDashboard(
        fsrsObservations,
        metacognitiveObservations
      );

      return { data: dashboardData };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { status: 500, error: message };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
