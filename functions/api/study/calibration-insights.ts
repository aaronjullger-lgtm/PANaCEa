/**
 * GET /api/study/calibration-insights
 *
 * Returns FSRS calibration data for the student dashboard:
 * - Calibration bins (predicted vs actual)
 * - Rolling-window drift (Sprint 8)
 * - Circadian phase performance (Sprint 9)
 * - Per-system calibration factors
 */

import type { PrismaClient } from '@prisma/client';
import {
  bucketReviews,
  computeCorrectionFactor,
  detectDrift,
  CALIBRATION_CONSTANTS,
} from '../../lib/services/retrievabilityCalibrationService';
import { getCircadianPhase } from '../../lib/services/fsrsOptimizerService';

interface Env {
  prisma: PrismaClient;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { prisma } = context.env;
  const userId = (context as any).userId;
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const logs = await prisma.reviewLog.findMany({
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
      return Response.json({
        bins: [],
        globalFactor: 1.0,
        drift: { longWindowFactor: 1.0, shortWindowFactor: 1.0, drift: 0, isDrifting: false, direction: 'stable' },
        circadianPhases: [],
        systemCalibrations: [],
        totalReviews: reviews.length,
        lastUpdated: new Date().toISOString(),
      });
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

    return Response.json({
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
    });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
};
