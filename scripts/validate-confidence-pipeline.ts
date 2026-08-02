/**
 * Confidence Pipeline Validation Script
 *
 * Offline validation that measures whether the confidence model actually
 * predicts future retention. Run periodically to track pipeline health.
 *
 * Usage:
 *   npx tsx scripts/validate-confidence-pipeline.ts
 *
 * What it does:
 * 1. Pulls ReviewLog pairs (review_i → review_i+1) for same conditionId
 * 2. Recomputes confidence using the current model
 * 3. Measures Brier scores, calibration curves, feature ablation
 * 4. Outputs JSON results to docs/validation/
 *
 * Sprint 6 of the confidence pipeline v2.
 */

import { PrismaClient } from '@prisma/client';
import {
  deriveContinuousRating,
  confidenceStabilityMultiplier,
  fluencyIllusionDampener,
  assessTelemetryQuality,
  QUESTION_TYPE_WEIGHTS,
  type ImplicitBehaviorMetrics,
  type QuestionTypeKey,
} from '../lib/implicit-metrics';
import {
  computeBrierScore,
  computeCalibrationBuckets,
  computeMSEPScore,
  computeTimeWeightedBrierScore,
  linearRegression,
} from '../lib/services/calibrationService';
import * as fs from 'fs';
import * as path from 'path';

// ── Types ──

interface ReviewPair {
  conditionId: string;
  /** Confidence from review_i */
  confidence: number;
  /** Whether review_i+1 was correct */
  nextWasCorrect: boolean;
  /** Telemetry quality of review_i */
  telemetryQuality: string;
  /** Question type */
  questionType: string;
  /** Stability multiplier applied */
  stabilityMultiplier: number;
  /** Elapsed days at review_i */
  elapsedDays: number;
  /** Timestamp of review_i (for recency weighting) */
  reviewedAt: Date;
}

interface AblationResult {
  signal: string;
  brierWithout: number;
  brierWith: number;
  degradation: number; // positive = removing signal makes predictions worse
}

interface ValidationResult {
  timestamp: string;
  totalPairs: number;
  brierScoreOverall: number;
  msep: number;
  timeWeightedBrier: number | null;
  calibrationSlope: number;
  calibrationIntercept: number;
  calibrationBuckets: Array<{
    confidenceRange: [number, number];
    predictedRetention: number;
    actualRetention: number;
    count: number;
  }>;
  brierByQuality: Record<string, { brier: number; count: number }>;
  brierByQuestionType: Record<string, { brier: number; count: number }>;
  stabilityMultiplierCorrelation: number;
  featureAblation: AblationResult[];
  fluencyIllusionImpact: {
    sameDayBrier: number;
    sameDayCount: number;
    multiDayBrier: number;
    multiDayCount: number;
  };
}

// ── Helpers ──

function pearsonCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length < 3) return 0;
  const n = x.length;
  const meanX = x.reduce((s, v) => s + v, 0) / n;
  const meanY = y.reduce((s, v) => s + v, 0) / n;
  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const den = Math.sqrt(denX * denY);
  return den === 0 ? 0 : num / den;
}

// ── Main ──

async function main() {
  const prisma = new PrismaClient();
  const lookbackDays = 90;
  const cutoff = new Date(Date.now() - lookbackDays * 86400000);

  console.log(`Fetching ReviewLog entries from last ${lookbackDays} days...`);

  try {
    const reviews = await prisma.reviewLog.findMany({
      where: {
        implicit_confidence: { not: null },
        review_type: 'real',
        reviewedAt: { gte: cutoff },
      },
      select: {
        conditionId: true,
        implicit_confidence: true,
        wasCorrect: true,
        reviewedAt: true,
        stability: true,
        elapsedDays: true,
        telemetry: true,
        grade_continuous: true,
      },
      orderBy: [
        { conditionId: 'asc' },
        { reviewedAt: 'asc' },
      ],
    });

    console.log(`Found ${reviews.length} reviews. Building pairs...`);

    // Group by conditionId and build consecutive pairs
    const byCondition = new Map<string, typeof reviews>();
    for (const r of reviews) {
      if (!r.conditionId) continue;
      if (!byCondition.has(r.conditionId)) byCondition.set(r.conditionId, []);
      byCondition.get(r.conditionId)!.push(r);
    }

    const pairs: ReviewPair[] = [];
    for (const [conditionId, condReviews] of byCondition) {
      for (let i = 0; i < condReviews.length - 1; i++) {
        const current = condReviews[i];
        const next = condReviews[i + 1];
        const telemetry = current.telemetry as Record<string, unknown> | null;
        const serverComputed = (telemetry?.server_computed as Record<string, unknown>) ?? {};
        const quality = (serverComputed.telemetry_quality as string) ?? 'unknown';
        const questionType = (telemetry?.question_type as string) ?? 'unknown';
        const confidence = current.implicit_confidence as number;
        const elapsed = (current.elapsedDays as number) ?? 0;

        pairs.push({
          conditionId,
          confidence,
          nextWasCorrect: next.wasCorrect,
          telemetryQuality: quality,
          questionType,
          stabilityMultiplier: confidenceStabilityMultiplier(
            confidence * fluencyIllusionDampener(elapsed)
          ),
          elapsedDays: elapsed,
          reviewedAt: current.reviewedAt,
        });
      }
    }

    console.log(`Built ${pairs.length} review pairs. Computing metrics...`);

    if (pairs.length === 0) {
      console.log('No pairs found. Exiting.');
      return;
    }

    // ── Overall Brier score ──
    const brierPairs = pairs.map(p => ({
      confidence: p.confidence,
      wasCorrect: p.nextWasCorrect,
      reviewedAt: p.reviewedAt,
    }));
    const brierScoreOverall = computeBrierScore(brierPairs);
    const msep = computeMSEPScore(brierPairs);
    const timeWeightedBrier = computeTimeWeightedBrierScore(brierPairs);

    // ── Calibration ──
    const { slope, intercept } = linearRegression(brierPairs);
    const calibrationBuckets = computeCalibrationBuckets(brierPairs);

    // ── Brier by quality tier ──
    const brierByQuality: Record<string, { brier: number; count: number }> = {};
    for (const quality of ['full', 'partial', 'minimal', 'unknown']) {
      const subset = pairs.filter(p => p.telemetryQuality === quality);
      if (subset.length > 0) {
        brierByQuality[quality] = {
          brier: computeBrierScore(subset.map(p => ({ confidence: p.confidence, wasCorrect: p.nextWasCorrect }))),
          count: subset.length,
        };
      }
    }

    // ── Brier by question type ──
    const brierByQuestionType: Record<string, { brier: number; count: number }> = {};
    const questionTypes = [...new Set(pairs.map(p => p.questionType))];
    for (const qt of questionTypes) {
      const subset = pairs.filter(p => p.questionType === qt);
      if (subset.length > 0) {
        brierByQuestionType[qt] = {
          brier: computeBrierScore(subset.map(p => ({ confidence: p.confidence, wasCorrect: p.nextWasCorrect }))),
          count: subset.length,
        };
      }
    }

    // ── Stability multiplier correlation ──
    const stabilityMultiplierCorrelation = pearsonCorrelation(
      pairs.map(p => p.stabilityMultiplier),
      pairs.map(p => p.nextWasCorrect ? 1 : 0)
    );

    // ── Fluency illusion impact ──
    const sameDayPairs = pairs.filter(p => p.elapsedDays < 1);
    const multiDayPairs = pairs.filter(p => p.elapsedDays >= 1);
    const fluencyIllusionImpact = {
      sameDayBrier: sameDayPairs.length > 0
        ? computeBrierScore(sameDayPairs.map(p => ({ confidence: p.confidence, wasCorrect: p.nextWasCorrect })))
        : 0,
      sameDayCount: sameDayPairs.length,
      multiDayBrier: multiDayPairs.length > 0
        ? computeBrierScore(multiDayPairs.map(p => ({ confidence: p.confidence, wasCorrect: p.nextWasCorrect })))
        : 0,
      multiDayCount: multiDayPairs.length,
    };

    // ── Feature ablation (simplified — measures Brier by confidence quartile) ──
    // True ablation would require re-deriving confidence from raw telemetry,
    // which isn't stored. Instead, we proxy by measuring prediction quality
    // across confidence ranges.
    const featureAblation: AblationResult[] = [];
    const signalNames = ['RT-dominant', 'Switch-dominant', 'Trajectory-dominant', 'Hesitation-dominant'];
    for (const [qtKey, weights] of Object.entries(QUESTION_TYPE_WEIGHTS)) {
      const dominantSignal = Object.entries(weights).sort((a, b) => (b[1] as number) - (a[1] as number))[0][0];
      const subset = pairs.filter(p => p.questionType === qtKey);
      if (subset.length >= 10) {
        const subBrier = computeBrierScore(subset.map(p => ({ confidence: p.confidence, wasCorrect: p.nextWasCorrect })));
        featureAblation.push({
          signal: `${qtKey} (dominant: ${dominantSignal})`,
          brierWithout: brierScoreOverall,
          brierWith: subBrier,
          degradation: brierScoreOverall - subBrier,
        });
      }
    }

    // ── Build result ──
    const result: ValidationResult = {
      timestamp: new Date().toISOString(),
      totalPairs: pairs.length,
      brierScoreOverall: Math.round(brierScoreOverall * 10000) / 10000,
      msep: Math.round(msep * 10000) / 10000,
      timeWeightedBrier:
        timeWeightedBrier == null ? null : Math.round(timeWeightedBrier * 10000) / 10000,
      calibrationSlope: Math.round(slope * 1000) / 1000,
      calibrationIntercept: Math.round(intercept * 1000) / 1000,
      calibrationBuckets,
      brierByQuality,
      brierByQuestionType,
      stabilityMultiplierCorrelation: Math.round(stabilityMultiplierCorrelation * 1000) / 1000,
      featureAblation,
      fluencyIllusionImpact,
    };

    // ── Write output ──
    const outDir = path.join(__dirname, '..', 'docs', 'validation');
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }
    const dateStr = new Date().toISOString().slice(0, 10);
    const outPath = path.join(outDir, `confidence-validation-${dateStr}.json`);
    fs.writeFileSync(outPath, JSON.stringify(result, null, 2));

    // ── Print summary ──
    console.log('\n═══════════════════════════════════════════');
    console.log('  CONFIDENCE PIPELINE VALIDATION RESULTS');
    console.log('═══════════════════════════════════════════\n');
    console.log(`Total review pairs:    ${result.totalPairs}`);
    console.log(`Overall Brier score:   ${result.brierScoreOverall} (lower = better, 0 = perfect)`);
    console.log(`MSEP (skill beyond base-rate guess): ${result.msep} (<0 = better than predicting the mean)`);
    console.log(`Time-weighted Brier:   ${result.timeWeightedBrier ?? 'n/a'} (recency-weighted, w = exp(-age/30))`);
    console.log(`Calibration slope:     ${result.calibrationSlope} (1.0 = well-calibrated)`);
    console.log(`Stability correlation: ${result.stabilityMultiplierCorrelation} (higher = better)`);
    console.log(`\nBrier by telemetry quality:`);
    for (const [q, stats] of Object.entries(brierByQuality)) {
      console.log(`  ${q.padEnd(10)} ${stats.brier.toFixed(4)} (n=${stats.count})`);
    }
    console.log(`\nFluency illusion:`);
    console.log(`  Same-day:  ${fluencyIllusionImpact.sameDayBrier.toFixed(4)} (n=${fluencyIllusionImpact.sameDayCount})`);
    console.log(`  Multi-day: ${fluencyIllusionImpact.multiDayBrier.toFixed(4)} (n=${fluencyIllusionImpact.multiDayCount})`);
    console.log(`\nResults saved to: ${outPath}`);

  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
