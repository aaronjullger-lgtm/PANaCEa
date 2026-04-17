/**
 * GET /api/study/calibration-insights
 *
 * Returns FSRS calibration data for the student dashboard:
 * - Calibration bins (predicted vs actual)
 * - Rolling-window drift (Sprint 8)
 * - Circadian phase performance (Sprint 9)
 * - Per-system calibration factors
 *
 * Security: Authenticated endpoint - requires valid Clerk JWT
 */

import { z } from 'zod';
import { authenticatedEndpoint, AuthenticatedContext, ValidatedContext } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import {
  CALIBRATION_CONSTANTS,
  bucketReviews,
  computeCorrectionFactor,
  detectDrift,
  getCircadianPhase,
} from '../../../lib/calibration/calibrationMath';
import type { CalibrationReview } from '../../../lib/calibration/calibrationMath';

// Empty schema for GET endpoint with no parameters
const emptySchema = z.object({});
type EmptyQuery = z.infer<typeof emptySchema>;

export const onRequestGet = authenticatedEndpoint(
  emptySchema,
  async (context: AuthenticatedContext & ValidatedContext<EmptyQuery>) => {
    const { userId } = context.auth;
    const prisma = createEdgePrismaClient(context.env.DATABASE_URL as string);

    let prismaInstance: ReturnType<typeof createEdgePrismaClient> | null = null;
    try {
      prismaInstance = prisma;

      const logs = await prismaInstance.reviewLog.findMany({
        where: {
          userId,
          retrievability: { not: null },
          review_type: { not: 'rapid_guess' },
        },
        select: {
          retrievability: true,
          wasCorrect: true,
          system: true,
          reviewedAt: true,
        },
        orderBy: { reviewedAt: 'asc' },
      });

      const reviews: CalibrationReview[] = logs
        .filter((l: any) => l.retrievability != null)
        .map((l: any) => ({
          retrievability: l.retrievability as number,
          wasCorrect: l.wasCorrect as boolean,
          system: (l.system as string) ?? undefined,
          hourOfDay: new Date(l.reviewedAt).getHours(),
        }));

      if (reviews.length < 50) {
        return {
          data: {
            bins: [],
            globalFactor: 1.0,
            drift: { longWindowFactor: 1.0, shortWindowFactor: 1.0, drift: 0, isDrifting: false, direction: 'stable' },
            circadianPhases: [],
            systemCalibrations: [],
            totalReviews: reviews.length,
            lastUpdated: new Date().toISOString(),
          },
        };
      }

      // Calibration bins
      const bins = bucketReviews(reviews);
      const globalFactor = computeCorrectionFactor(bins);

      // Drift detection
      const drift = detectDrift(reviews);

      // Circadian phases
      const phaseMap: Record<string, { correct: number; total: number }> = {};
      for (const r of reviews) {
        const phase = getCircadianPhase(r.hourOfDay);
        if (!phaseMap[phase]) phaseMap[phase] = { correct: 0, total: 0 };
        phaseMap[phase].total++;
        if (r.wasCorrect) phaseMap[phase].correct++;
      }

      const circadianPhases = ['morning', 'afternoon', 'evening', 'night']
        .filter(phase => phaseMap[phase]?.total > 0)
        .map(phase => {
          const data = phaseMap[phase]!;
          return {
            phase,
            reviewCount: data.total,
            recallRate: data.correct / data.total,
            optimized: data.total >= 50,
          };
        });

      // Per-system calibration
      const systems = [...new Set(reviews.map(r => r.system).filter(Boolean))] as string[];
      const systemCalibrations = systems
        .map(system => {
          const sysReviews = reviews.filter(r => r.system === system);
          if (sysReviews.length < CALIBRATION_CONSTANTS.MIN_SYSTEM_REVIEWS) return null;
          const factor = computeCorrectionFactor(bucketReviews(sysReviews));
          return { system, factor, reviewCount: sysReviews.length };
        })
        .filter(Boolean) as Array<{ system: string; factor: number; reviewCount: number }>;

      return {
        data: {
          bins: bins.map(b => ({
            predictedCenter: b.predictedCenter,
            actualRecallRate: b.actualRecallRate,
            count: b.count,
            calibrationRatio: b.calibrationRatio,
          })),
          globalFactor,
          drift,
          circadianPhases,
          systemCalibrations,
          totalReviews: reviews.length,
          lastUpdated: new Date().toISOString(),
        },
      };
    } catch (err: any) {
      return {
        status: 500,
        error: err.message,
      };
    } finally {
      if (prismaInstance) await safePrismaDisconnect(prismaInstance);
    }
  }
);
