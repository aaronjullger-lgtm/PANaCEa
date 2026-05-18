/**
 * Shared FSRS Scheduling Service
 *
 * Extracted from drillReviewService to provide a single canonical FSRS
 * scheduling computation path. Both drill sessions and main sessions
 * should ultimately call computeFSRSUpdate() so that FSRS state is
 * always derived through the same confidence pipeline.
 *
 * This module handles the *computation* only — loading card state,
 * running FSRS.next, applying the confidence pipeline, and returning
 * the updated card + schedule. Persistence (ReviewLog, UserProgress,
 * Card, confusion pairs, sibling propagation) remains in the caller.
 */

import type { PrismaClient } from '@prisma/client';
import { FSRS, type Rating } from '../fsrs';
import { confidenceStabilityMultiplier, fluencyIllusionDampener } from '../implicit-metrics';
import { applyCircadianModifier } from '../circadian';
import { applyEorClampIfNeeded } from '../fsrs/eorScheduler';
import { getUserCalibration } from './calibrationService';
import { getOptimizedParameters } from './fsrsOptimizerService';
import { getStabilityCorrectionFactor } from './retrievabilityCalibrationService';
import { accumulateConfidence, type HistoricalReview } from '../confidence/bayesianAccumulator';
import { computeDesirableDifficultyBonus } from '../confidence/desirableDifficultyBonus';
import { detectInterference, type SessionReviewEntry } from '../confidence/interferenceDetector';
import { detectConfidenceTrend } from '../confidence/trendDetector';
import { modulateDifficultyDelta } from '../confidence/difficultyModulator';
import { computeLapseSeverity } from './lapseSeverityService';
import { computeRtTrajectory } from './rtTrajectoryService';
import {
  recordOutcome as recordAccuracyOutcome,
  getConfidenceModifier as getAccuracySlopeModifier,
} from './sessionAccuracySlopeService';
import { computeIntervalDeviation } from './intervalDeviationService';
import { computeFatigueConfidenceDampener } from './sessionFatigueService';
import type {
  DistractorChronometryResult,
  SwitchDirectionResult,
} from './distractorChronometryService';
import type { ExplanationEngagementResult } from './explanationEngagementService';
import type { SessionRegularityResult } from './sessionRegularityService';
import type { RelearningSpeedResult } from './relearningSpeedService';
import { getOriginalLearningRt, computeRelearningSpeed } from './relearningSpeedService';
import { computeSessionRegularity } from './sessionRegularityService';

// ── Input / Output types ──────────────────────────────────────────

export interface FSRSUpdateInput {
  /** Internal user UUID */
  userId: string;
  questionId: string;
  conditionId: string;
  system?: string | null;
  /**
   * UserProgress partition to read. READINESS is the default longitudinal track;
   * TARGETED keeps focused-study FSRS state isolated.
   */
  progressContext?: 'READINESS' | 'TARGETED';

  /** Discrete rating after Ghost Grader (Again=1, Good=3) */
  rating: Rating;
  /** Continuous grade for telemetry only */
  gradeContinuous: number;
  /** Implicit confidence from behavioral metrics */
  implicitConfidence: number;
  isCorrect: boolean;

  /** Time spent on this question (ms) */
  effectiveDurationMs: number;
  timeToFirstClick?: number;
  /** 1-based question number within session (null = unknown) */
  questionNumber?: number | null;

  /** Circadian context (phase, modifier, local hour) */
  circadianContext: {
    circadianPhase: string;
    stabilityModifier: number;
    localHour: number;
  };

  /** Exam urgency multiplier (0.5–2.0). Higher → tighter intervals. */
  urgencyMultiplier?: number | null;
  /** EOR rotation end date — clamps next-review. */
  eorRotationEnd?: Date | null;

  /** Raw telemetry from client (for hover_oscillations, etc.) */
  telemetry?: Record<string, unknown>;

  /** Pre-computed Wave 2 behavioral results */
  wave2Chronometry?: DistractorChronometryResult;
  wave2SwitchDirection?: SwitchDirectionResult;
  /** Pre-computed Wave 3A explanation engagement result */
  wave3ExplanationEngagement?: ExplanationEngagementResult;
}

export interface FSRSUpdateResult {
  /** The updated FSRS card after all confidence pipeline modifiers */
  updatedCard: {
    stability: number;
    difficulty: number;
    state: number;
    elapsed_days: number;
    scheduled_days: number;
    reps: number;
    lapses: number;
    last_review: Date;
  };
  /** Pre-update card state (for ReviewLog) */
  previousCard: {
    stability: number;
    difficulty: number;
    state: number;
    elapsed_days: number;
    scheduled_days: number;
    reps: number;
    lapses: number;
    last_review: Date;
  };
  /** Clamped next-review date */
  clampedNextDue: Date;
  /** Schedule data for API response */
  fsrsSchedule: {
    intervalDays: number;
    nextDueDate: string;
    stability: number;
    difficulty: number;
  };
  /** Pre-computed retrievability of the previous card */
  retrievability: number;
  /** FSRS instance used (for any downstream retrievability calls) */
  fsrs: FSRS;

  /**
   * All confidence-pipeline intermediate values for ReviewLog telemetry.
   * DrillReviewService spreads this into the ReviewLog telemetry field.
   */
  confidenceTelemetry: Record<string, unknown>;

  /** Review history from existing progress (for downstream use) */
  reviewHistory: Array<Record<string, unknown>>;
}

// ── Helper function ───────────────────────────────────────────────

/**
 * Run the full FSRS scheduling computation:
 *  1. Load optimized FSRS params + existing card state
 *  2. Call fsrs.next() with discrete rating
 *  3. Apply 18-step confidence pipeline
 *  4. Compute clamped next-review date
 *  5. Return updated card + all intermediate telemetry
 *
 * This is a *computation-only* function. It does NOT write to the database.
 * The caller is responsible for persisting ReviewLog, UserProgress, Card, etc.
 */
export async function computeFSRSUpdate(
  prisma: PrismaClient,
  input: FSRSUpdateInput,
  logger?: { info?(...args: unknown[]): void; warn?(...args: unknown[]): void; debug?(...args: unknown[]): void; error?(...args: unknown[]): void }
): Promise<FSRSUpdateResult> {
  const {
    userId,
    questionId,
    conditionId,
    system,
    progressContext = 'READINESS',
    rating,
    gradeContinuous,
    implicitConfidence,
    isCorrect,
    effectiveDurationMs,
    timeToFirstClick,
    questionNumber,
    circadianContext,
    urgencyMultiplier,
    eorRotationEnd,
    telemetry,
    wave2Chronometry,
    wave2SwitchDirection,
    wave3ExplanationEngagement,
  } = input;

  // ── Step 0: Record outcome for session accuracy slope ──
  recordAccuracyOutcome(userId, isCorrect);

  // ── Step 1: Load optimized FSRS parameters and existing card state ──
  const optimizedParams = await getOptimizedParameters(prisma, userId, system).catch(() => undefined);
  const fsrs = optimizedParams ? new FSRS(optimizedParams) : new FSRS();

  const existingProgress = await prisma.userProgress.findUnique({
    where: { userId_conditionId_progressContext: { userId, conditionId, progressContext } },
  });

  const fsrsCardData = (existingProgress?.fsrsCard as Record<string, unknown>) || {};
  const currentCard = {
    stability: typeof fsrsCardData.stability === 'number' ? fsrsCardData.stability : 0,
    difficulty: typeof fsrsCardData.difficulty === 'number' ? fsrsCardData.difficulty : 0,
    state: typeof fsrsCardData.state === 'number' ? fsrsCardData.state : 0,
    elapsed_days: typeof fsrsCardData.elapsed_days === 'number' ? fsrsCardData.elapsed_days : 0,
    scheduled_days:
      typeof fsrsCardData.scheduled_days === 'number' ? fsrsCardData.scheduled_days : 0,
    reps: typeof fsrsCardData.reps === 'number' ? fsrsCardData.reps : 0,
    lapses: typeof fsrsCardData.lapses === 'number' ? fsrsCardData.lapses : 0,
    last_review:
      typeof fsrsCardData.last_review === 'string'
        ? new Date(fsrsCardData.last_review)
        : new Date(),
  };

  // ── Step 2: FSRS.next() with discrete rating ──
  const { card: rawCard } = fsrs.next(currentCard, new Date(), rating);

  // ── Wave 1A: Lapse severity — amplify difficulty for severe lapses ──
  let lapseSeverityResult:
    | { severity: number; difficultyMultiplier: number; preLapseReps: number; preLapseStability: number }
    | undefined;
  if (!isCorrect && currentCard.state >= 2) {
    lapseSeverityResult = computeLapseSeverity(
      currentCard.reps,
      currentCard.stability,
      currentCard.state
    );
    if (lapseSeverityResult.difficultyMultiplier > 1.0) {
      const baseDiffIncrease = rawCard.difficulty - currentCard.difficulty;
      const amplifiedIncrease = baseDiffIncrease * lapseSeverityResult.difficultyMultiplier;
      rawCard.difficulty = Math.min(10, Math.max(1, currentCard.difficulty + amplifiedIncrease));
    }
  }

  let modifiedStability = rawCard.stability;
  modifiedStability = applyCircadianModifier(modifiedStability, circadianContext);

  // ── Step 3: Confidence pipeline ──

  // 3a: Bayesian accumulation
  const reviewHistory = (existingProgress?.reviewHistory ?? []) as Array<Record<string, unknown>>;
  const historicalReviews: HistoricalReview[] = reviewHistory
    .filter((r): r is { confidence: number; wasCorrect: boolean; telemetryQuality?: string } =>
      typeof r.confidence === 'number' && typeof r.wasCorrect === 'boolean'
    )
    .map((r) => ({
      confidence: r.confidence,
      wasCorrect: r.wasCorrect,
      telemetryQuality: (r.telemetryQuality as HistoricalReview['telemetryQuality']) ?? 'minimal',
    }));

  const accumulated = accumulateConfidence(implicitConfidence, isCorrect, historicalReviews);

  // 3b: Metacognitive calibration
  let calibrationFactor = 1.0;
  try {
    const calibration = await getUserCalibration(prisma, userId);
    calibrationFactor = calibration.dampenerFactor;
  } catch (err) {
    console.debug('[fsrsScheduleService] calibration lookup non-fatal', err);
  }

  // 3c: Session fatigue dampener
  const fatigueConfidenceDampener = computeFatigueConfidenceDampener(questionNumber ?? 0);

  // 3d: Retrieval interference detection
  let interferenceResult: {
    discount: number;
    detected: boolean;
    details: { interferingCount: number; closestDistance: number | null; type: string };
  } = {
    discount: 1.0,
    detected: false,
    details: { interferingCount: 0, closestDistance: null, type: 'none' },
  };
  let interferenceIntervalMultiplier = 1.0;
  try {
    const confusionPairs = await prisma.confusionPair.findMany({
      where: {
        userId,
        OR: [
          { correctConditionId: conditionId },
          { selectedConditionId: conditionId },
        ],
      },
      select: { correctConditionId: true, selectedConditionId: true },
      take: 20,
    });
    const confusionPairIds = confusionPairs.map((p) =>
      p.correctConditionId === conditionId ? p.selectedConditionId : p.correctConditionId
    );

    const sessionCutoff = new Date(Date.now() - 30 * 60 * 1000);
    const recentSessionReviews = await prisma.reviewLog.findMany({
      where: {
        userId,
        reviewedAt: { gte: sessionCutoff },
        conditionId: { not: null },
        review_type: { not: 'rapid_guess' },
      },
      select: { conditionId: true, reviewedAt: true },
      orderBy: { reviewedAt: 'asc' },
      take: 30,
    });

    const sessionHistory: SessionReviewEntry[] = recentSessionReviews
      .filter((r): r is typeof r & { conditionId: string } => r.conditionId != null)
      .map((r, idx) => ({ conditionId: r.conditionId, position: idx }));

    interferenceResult = detectInterference(conditionId, confusionPairIds, sessionHistory);

    // ── Interference-aware interval adjustment ──
    // When interference is detected, increase the interval gap to prevent
    // similar items from being reviewed too close together (proactive interference).
    // This reduces recency priming effects and encourages genuine retrieval.
    if (interferenceResult.detected) {
      const { type, interferingCount, closestDistance } = interferenceResult.details;
      if (type === 'same_condition') {
        // Strongest interference: same item reviewed recently → push next review out more
        // Scale: 1 interfering at distance 1 → +40%, max +80% for 2+ items very close
        const distanceFactor = closestDistance != null ? Math.max(0, 1 - closestDistance / 10) : 0.5;
        const countFactor = Math.min(1.0, interferingCount / 3);
        interferenceIntervalMultiplier = 1.0 + 0.4 * distanceFactor + 0.4 * countFactor;
      } else if (type === 'confusion_pair') {
        // Weaker interference: confusable item reviewed recently → moderate push
        const distanceFactor = closestDistance != null ? Math.max(0, 1 - closestDistance / 10) : 0.3;
        interferenceIntervalMultiplier = 1.0 + 0.2 * distanceFactor * Math.min(1.0, interferingCount / 2);
      }

      // Cap the multiplier to prevent excessively long intervals
      interferenceIntervalMultiplier = Math.min(interferenceIntervalMultiplier, 1.8);
    }
  } catch (err) {
    console.debug('[fsrsScheduleService] interference detection non-fatal', err);
  }

  // 3e: Fluency illusion dampener
  const elapsedDays =
    typeof currentCard.elapsed_days === 'number' ? currentCard.elapsed_days : 0;

  // Combine confidence adjustments
  let adjustedConfidence = accumulated.posterior;
  adjustedConfidence *= calibrationFactor;
  adjustedConfidence *= fatigueConfidenceDampener;

  // Session accuracy slope
  const accuracySlope = getAccuracySlopeModifier(userId);
  adjustedConfidence *= accuracySlope.confidenceMultiplier;

  // Wave 3B: Session regularity
  let wave3SessionRegularity: SessionRegularityResult | undefined;
  try {
    wave3SessionRegularity = await computeSessionRegularity(prisma, userId);
    adjustedConfidence *= wave3SessionRegularity.telemetryTrustMultiplier;
  } catch (err) {
    console.debug('[fsrsScheduleService] session regularity non-fatal', err);
  }

  adjustedConfidence *= interferenceResult.discount;
  adjustedConfidence *= fluencyIllusionDampener(elapsedDays);

  // Step 6: Graduated stability multiplier
  modifiedStability *= confidenceStabilityMultiplier(adjustedConfidence);

  // 6a: RT trajectory
  const lastReviewWithRT = reviewHistory
    .filter((r: Record<string, unknown>) => typeof r.responseTimeMs === 'number' && (r.responseTimeMs as number) > 0)
    .at(0);
  const previousRtMs = (lastReviewWithRT as Record<string, unknown> | undefined)?.responseTimeMs as number | null ?? null;
  const rtTrajectory = computeRtTrajectory(
    effectiveDurationMs,
    previousRtMs,
    currentCard.elapsed_days
  );
  if (rtTrajectory.hasHistory && isCorrect) {
    modifiedStability *= rtTrajectory.stabilityMultiplier;
  }

  // 6b: Interval deviation
  const intervalDev = computeIntervalDeviation(
    currentCard.elapsed_days,
    currentCard.scheduled_days,
    isCorrect
  );
  modifiedStability *= intervalDev.informationMultiplier;

  // 6b.1: Wave 3A explanation engagement stability modifier
  if (wave3ExplanationEngagement && wave3ExplanationEngagement.stabilityModifier !== 1.0) {
    modifiedStability *= wave3ExplanationEngagement.stabilityModifier;
  }

  // 6b.2: Wave 3C relearning speed
  let wave3RelearningSpeed: RelearningSpeedResult | undefined;
  if (!isCorrect && currentCard.lapses >= 1) {
    try {
      const originalRt = await getOriginalLearningRt(prisma, userId, questionId);
      wave3RelearningSpeed = computeRelearningSpeed(
        effectiveDurationMs,
        originalRt,
        currentCard.lapses
      );
      if (wave3RelearningSpeed.hasSavings && wave3RelearningSpeed.postLapseStabilityBonus > 1.0) {
        modifiedStability *= wave3RelearningSpeed.postLapseStabilityBonus;
      }
    } catch (err) {
      console.debug('[fsrsScheduleService] relearning speed non-fatal', err);
    }
  }

  // 6c: Desirable difficulty bonus
  const ddBonus = computeDesirableDifficultyBonus(adjustedConfidence, isCorrect, elapsedDays);

  // Step 7: Cross-session trend
  const confidenceValues = historicalReviews.map((r) => r.confidence);
  confidenceValues.push(adjustedConfidence);
  const trend = detectConfidenceTrend(confidenceValues);
  if (trend.trendMultiplier !== 1.0 && trend.rSquared >= 0.3) {
    modifiedStability *= trend.trendMultiplier;
  }

  // Exam urgency
  if (urgencyMultiplier && urgencyMultiplier > 1.0) {
    const urgencyDampener = 1 + (urgencyMultiplier - 1) * 0.3;
    modifiedStability /= urgencyDampener;
  }

  // Retrievability calibration correction
  try {
    const correctionFactor = await getStabilityCorrectionFactor(prisma, userId, system);
    modifiedStability *= correctionFactor;
  } catch (err) {
    console.debug('[fsrsScheduleService] stability correction non-fatal', err);
  }

  // Step 8: Confidence-weighted difficulty modulation
  const baseDifficultyDelta = rawCard.difficulty - currentCard.difficulty;
  const difficultyMod = modulateDifficultyDelta(baseDifficultyDelta, adjustedConfidence, isCorrect);
  const modulatedDifficulty = Math.max(1, Math.min(10, currentCard.difficulty + difficultyMod.modulatedDelta));

  // ── Step 4: Build final card ──
  const updatedCard = {
    ...rawCard,
    stability: Math.max(0.01, modifiedStability),
    difficulty: modulatedDifficulty,
  };
  const recalculatedScheduledDays =
    updatedCard.state === 2 && typeof (fsrs as any).calculateIntervalFromStability === 'function'
      ? (fsrs as any).calculateIntervalFromStability(updatedCard.stability)
      : updatedCard.scheduled_days;
  updatedCard.scheduled_days = recalculatedScheduledDays;

  // Apply interference interval multiplier to push similar items apart
  // This increases the scheduled_days without affecting the underlying stability,
  // so the FSRS model state stays clean but the next review is delayed.
  let effectiveScheduledDays = updatedCard.scheduled_days;
  if (interferenceIntervalMultiplier > 1.0) {
    effectiveScheduledDays = updatedCard.scheduled_days * interferenceIntervalMultiplier;
  }

  const rawNextDue = new Date(Date.now() + effectiveScheduledDays * 86400000);
  const { due: clampedNextDue } = applyEorClampIfNeeded(rawNextDue, eorRotationEnd ?? null);

  const fsrsSchedule = {
    // Round for display/API consumers; raw float preserved in updatedCard.scheduled_days.
    // FSRS-7 migration: when fractional intervals land, this rounding ensures
    // downstream code (UI, notifications) still sees clean integers.
    intervalDays: Math.max(1, Math.round(effectiveScheduledDays)),
    nextDueDate: clampedNextDue.toISOString(),
    stability: updatedCard.stability,
    difficulty: updatedCard.difficulty,
  };

  const retrievability = fsrs.calculateRetrievability(
    currentCard.elapsed_days,
    currentCard.stability
  );

  // ── Step 5: Build confidence pipeline telemetry for ReviewLog ──
  const confidenceTelemetry: Record<string, unknown> = {
    raw_confidence: implicitConfidence,
    bayesian_posterior: accumulated.posterior,
    bayesian_prior_weight: accumulated.priorWeight,
    calibration_factor: calibrationFactor,
    fatigue_dampener: fatigueConfidenceDampener,
    interference_discount: interferenceResult.discount,
    interference_type: interferenceResult.details.type,
    interference_interval_multiplier: interferenceIntervalMultiplier,
    interference_adjusted_interval_days: effectiveScheduledDays,
    fluency_dampener: fluencyIllusionDampener(elapsedDays),
    adjusted_confidence: adjustedConfidence,
    stability_multiplier: confidenceStabilityMultiplier(adjustedConfidence),
    dd_bonus_active: ddBonus.activated,
    dd_bonus_multiplier: ddBonus.multiplier,
    trend_slope: trend.slope,
    trend_category: trend.category,
    trend_multiplier: trend.trendMultiplier,
    difficulty_modulation_factor: difficultyMod.modulationFactor,
    // Wave 1
    lapse_severity: lapseSeverityResult?.severity ?? null,
    lapse_severity_multiplier: lapseSeverityResult?.difficultyMultiplier ?? null,
    rt_change_ratio: rtTrajectory.rtChangeRatio,
    rt_trajectory_multiplier: rtTrajectory.stabilityMultiplier,
    session_accuracy_slope: accuracySlope.slope,
    session_accuracy_multiplier: accuracySlope.confidenceMultiplier,
    session_rolling_accuracy: accuracySlope.rollingAccuracy,
    interval_deviation_ratio: intervalDev.deviationRatio,
    interval_deviation_multiplier: intervalDev.informationMultiplier,
    interval_deviation_class: intervalDev.classification,
    // Wave 2
    distractor_unique_options: wave2Chronometry?.uniqueOptionsConsidered ?? null,
    distractor_correct_abandoned: wave2Chronometry?.correctOptionAbandoned ?? null,
    distractor_longest_dwell_ms: wave2Chronometry?.longestDistractorDwellMs ?? null,
    distractor_chronometry_multiplier: wave2Chronometry?.confidenceMultiplier ?? null,
    switch_wrong_to_right: wave2SwitchDirection?.wrongToRight ?? null,
    switch_right_to_wrong: wave2SwitchDirection?.rightToWrong ?? null,
    switch_wrong_to_wrong: wave2SwitchDirection?.wrongToWrong ?? null,
    switch_net_value: wave2SwitchDirection?.netSwitchValue ?? null,
    switch_metacognitive_precision: wave2SwitchDirection?.metacognitivePrecision ?? null,
    switch_direction_multiplier: wave2SwitchDirection?.confidenceMultiplier ?? null,
    // Wave 3
    explanation_engagement_score: wave3ExplanationEngagement?.engagementScore ?? null,
    explanation_confidence_modifier: wave3ExplanationEngagement?.confidenceModifier ?? null,
    explanation_stability_modifier: wave3ExplanationEngagement?.stabilityModifier ?? null,
    session_regularity: wave3SessionRegularity?.regularity ?? null,
    session_regularity_cv: wave3SessionRegularity?.intervalCV ?? null,
    session_regularity_streak: wave3SessionRegularity?.streakDays ?? null,
    session_regularity_trust_multiplier: wave3SessionRegularity?.telemetryTrustMultiplier ?? null,
    relearning_savings_ratio: wave3RelearningSpeed?.savingsRatio ?? null,
    relearning_stability_bonus: wave3RelearningSpeed?.postLapseStabilityBonus ?? null,
    // confusion_* fields: always null here because confusion pair analysis happens
    // after the FSRS computation in the caller. Preserved for telemetry schema parity.
    confusion_pair_count: null,
    confusion_escalated: null,
    confusion_difficulty_boost: null,
    final_stability: updatedCard.stability,
    final_difficulty: updatedCard.difficulty,
  };

  return {
    updatedCard,
    previousCard: currentCard,
    clampedNextDue,
    fsrsSchedule,
    retrievability,
    fsrs,
    confidenceTelemetry,
    reviewHistory,
  };
}

// Re-export the fatigue helper so drillReviewService doesn't need a separate import
export { computeFatigueConfidenceDampener } from './sessionFatigueService';
