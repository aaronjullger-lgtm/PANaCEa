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
// --- Inline calibration helpers (avoids missing service imports) ---

const CALIBRATION_CONSTANTS = {
  BIN_COUNT: 10,
  MIN_SYSTEM_REVIEWS: 20,
} as const;

interface CalibrationBin {
  predictedCenter: number;
  actualRecallRate: number;
  count: number;
  calibrationRatio: number;
}

interface Review {
  retrievability: number;
  wasCorrect: boolean;
  system?: string;
  hourOfDay: number;
}

function bucketReviews(reviews: Review[]): CalibrationBin[] {
  const bins: { predicted: number[]; correct: number; total: number }[] = [];
  for (let i = 0; i < CALIBRATION_CONSTANTS.BIN_COUNT; i++) {
    bins.push({ predicted: [], correct: 0, total: 0 });
  }
  for (const r of reviews) {
    const idx = Math.min(
      Math.floor(r.retrievability * CALIBRATION_CONSTANTS.BIN_COUNT),
      CALIBRATION_CONSTANTS.BIN_COUNT - 1
    );
    bins[idx].predicted.push(r.retrievability);
    bins[idx].total++;
    if (r.wasCorrect) bins[idx].correct++;
  }
  return bins
    .filter(b => b.total > 0)
    .map(b => {
      const predictedCenter = b.predicted.reduce((a, c) => a + c, 0) / b.predicted.length;
      const actualRecallRate = b.correct / b.total;
      return {
        predictedCenter,
        actualRecallRate,
        count: b.total,
        calibrationRatio: actualRecallRate / Math.max(predictedCenter, 0.01),
      };
    });
}

function computeCorrectionFactor(bins: CalibrationBin[]): number {
  if (bins.length === 0) return 1.0;
  const totalWeight = bins.reduce((s, b) => s + b.count, 0);
  const weightedSum = bins.reduce((s, b) => s + b.calibrationRatio * b.count, 0);
  return totalWeight > 0 ? weightedSum / totalWeight : 1.0;
}

function detectDrift(reviews: Review[]) {
  if (reviews.length < 100) {
    return { longWindowFactor: 1.0, shortWindowFactor: 1.0, drift: 0, isDrifting: false, direction: 'stable' as const };
  }
  const longBins = bucketReviews(reviews);
  const shortWindow = reviews.slice(-Math.floor(reviews.length / 3));
  const shortBins = bucketReviews(shortWindow);
  const longFactor = computeCorrectionFactor(longBins);
  const shortFactor = computeCorrectionFactor(shortBins);
  const drift = shortFactor - longFactor;
  const isDrifting = Math.abs(drift) > 0.1;
  const direction = drift > 0.1 ? 'improving' : drift < -0.1 ? 'declining' : 'stable';
  return { longWindowFactor: longFactor, shortWindowFactor: shortFactor, drift, isDrifting, direction };
}

function getCircadianPhase(hour: number): string {
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

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

      const reviews = logs
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
        .map(phase => ({
          phase,
          reviewCount: phaseMap[phase].total,
          recallRate: phaseMap[phase].correct / phaseMap[phase].total,
          optimized: phaseMap[phase].total >= 50,
        }));

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
