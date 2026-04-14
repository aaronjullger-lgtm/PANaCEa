/**
 * Drill Review Service
 *
 * Handles the full submit-drill-review flow:
 * - Correctness resolution from question data
 * - Implicit rating from behavior (zero-friction FSRS)
 * - Par-time calculation, circadian context
 * - FSRS update, QuestionAttempt, UserProgress, confusion pairs, sibling propagation
 *
 * API route should: authenticate, validate, delegate here, return result.
 */

import type { CircadianPhase as PrismaCircadianPhase, PrismaClient } from '@prisma/client';
import { calculateParTime } from '../utils/questionComplexity';
import { updateReviewOutcome } from './srsService';
import { FSRS, Rating } from '../fsrs';
import { updateUserProgressWithHistory } from './userProgressService';
import type { ImplicitBehaviorMetrics } from '../implicit-metrics';
import { deriveContinuousRating, assessTelemetryQuality, confidenceStabilityMultiplier, fluencyIllusionDampener, type UserBaseline, type CardBaseline } from '../implicit-metrics';
import { getMVRTThreshold, type TelemetryQuestionType } from '../../types/telemetry';
import { buildCircadianContext, applyCircadianModifier, applyCircadianParTimeModifier } from '../circadian';
import { propagateRecallToSiblings } from './semanticSiblingService';
import { applyAttemptToUserStatistics, updateTimingAggregates } from './userStatisticsService';
import { applyHonestRating, applyHonestRatingWithDetail, GHOST_GRADER_CONSTANTS } from '../srs/ghostGrader';
import { getRolling360Service } from './rolling360Service';
import { applyEorClampIfNeeded } from '../fsrs/eorScheduler';
import { getTaskTypeFromContent } from '../taskTypes';
import { getUserSpeedFactor, getUserBehavioralBaseline } from './userTimingProfileService';
import { getUserCalibration } from './calibrationService';
import { accumulateConfidence, type HistoricalReview } from '../confidence/bayesianAccumulator';
import type { TelemetryQuality } from '../implicit-metrics';
import { applyFatigueCorrection, computeFatigueConfidenceDampener } from './sessionFatigueService';
import { getStabilityCorrectionFactor } from './retrievabilityCalibrationService';
import { getOptimizedParameters } from './fsrsOptimizerService';
import { computeDesirableDifficultyBonus } from '../confidence/desirableDifficultyBonus';
import { detectInterference, type SessionReviewEntry } from '../confidence/interferenceDetector';
import { detectConfidenceTrend } from '../confidence/trendDetector';
import { modulateDifficultyDelta } from '../confidence/difficultyModulator';
// Wave 1 behavioral signal services
import { computeLapseSeverity } from './lapseSeverityService';
import { computeRtTrajectory } from './rtTrajectoryService';
import { recordOutcome as recordAccuracyOutcome, getConfidenceModifier as getAccuracySlopeModifier } from './sessionAccuracySlopeService';
import { computeIntervalDeviation } from './intervalDeviationService';
// Wave 2 behavioral signal services
import { analyzeDistractorChronometry, type DistractorChronometryResult, type OptionInteractionRecord } from './distractorChronometryService';
import { analyzeSwitchDirections, type SwitchDirectionResult } from './switchDirectionService';
// Wave 3 behavioral signal services
import { analyzeExplanationEngagement, type ExplanationEngagementResult } from './explanationEngagementService';
import { computeSessionRegularity, type SessionRegularityResult } from './sessionRegularityService';
import { computeRelearningSpeed, getOriginalLearningRt, type RelearningSpeedResult } from './relearningSpeedService';
// Behavioral analysis grade modulation coordinator (Phase 1 — Behavioral Analysis Audit)
import { modulateGrade, type BehavioralContext, type GradeModulation } from './gradeModulationCoordinator';
import { analyzeConfusionRecurrence, type ConfusionPairAction } from './confusionPairRecurrenceService';
// A/B test integration
import { resolveAssignments, logABConversion, type ABAssignmentMap } from '../middleware/abTestMiddleware';

/** Active A/B test experiment IDs wired into the review pipeline */
const AB_EXPERIMENTS = [
  'scheduling_retention_target',   // Variant config overrides request_retention (0.85, 0.90, 0.95)
  'explanation_format',            // Variant config controls explanation rendering style
] as const;

/** Map lib/circadian phase to ReviewLog CircadianPhase enum */
function toCircadianPhaseEnum(phase: string): PrismaCircadianPhase | undefined {
  const p = phase.toLowerCase();
  if (p === 'peak') return 'PEAK';
  if (p === 'trough') return 'TROUGH';
  if (p === 'neutral' || p === 'evening_recovery' || p === 'late_night') return 'NEUTRAL';
  return undefined;
}

/** Question data structure from PreGeneratedQuestion.questionData field */
export interface QuestionData {
  stem?: string;
  question?: string;
  vignette?: string;
  text?: string;
  correctAnswer?: string;
  answer?: string;
  correct_option?: string;
  correctChoice?: string;
  correctIndex?: number;
  options?: Array<{ value?: string; text?: string; label?: string } | string>;
  choices?: Array<{ value?: string; text?: string; label?: string } | string>;
  [key: string]: unknown;
}

/** Option pool item shape for findSelectedOption */
interface OptionPoolItem {
  value?: string;
  text?: string;
  label?: string;
  conditionId?: string;
  condition_id?: string;
  conditionRef?: string;
  medicalContentId?: string;
  condition?: string;
  conditionName?: string;
  id?: string;
}

export function findSelectedOption(
  pool: Array<OptionPoolItem> | string[] | undefined,
  selectedAnswer: string
): { label: string; conditionId?: string; conditionName?: string } | null {
  if (!Array.isArray(pool)) return null;

  for (const option of pool) {
    if (typeof option === 'string') {
      if (option === selectedAnswer) {
        return { label: option };
      }
      continue;
    }

    const label =
      option.value ??
      option.text ??
      option.label ??
      option.conditionName ??
      option.condition ??
      option.id;
    if (label === selectedAnswer) {
      return {
        label,
        conditionId:
          option.conditionId ??
          option.condition_id ??
          option.conditionRef ??
          option.medicalContentId ??
          option.id,
        conditionName: option.conditionName ?? option.condition ?? label,
      };
    }
  }

  return null;
}

/** Resolve correct answer from question data */
export function resolveCorrectAnswer(qData: QuestionData): string | null {
  let correctAnswer: string | null =
    qData.correctAnswer ?? qData.answer ?? qData.correct_option ?? qData.correctChoice ?? null;

  if (correctAnswer === null && typeof qData.correctIndex === 'number') {
    const pool = Array.isArray(qData.options) ? qData.options : qData.choices;
    if (Array.isArray(pool) && pool[qData.correctIndex]) {
      const candidate = pool[qData.correctIndex];
      if (typeof candidate === 'string') {
        correctAnswer = candidate;
      } else if (typeof candidate === 'object' && candidate !== null) {
        correctAnswer =
          (candidate as { value?: string; text?: string; label?: string }).value ??
          (candidate as { value?: string; text?: string; label?: string }).text ??
          (candidate as { value?: string; text?: string; label?: string }).label ??
          null;
      }
    }
  }

  return correctAnswer;
}

/** Input validated by API route */
export interface SubmitDrillReviewInput {
  questionId: string;
  selectedAnswer: string | number;
  timeSpentMs: number;
  timeToFirstClick?: number;
  answerSwitches?: number;
  totalDwellTime?: number;
  timezone?: string;
  wakeTimeHHMM?: string;
  /** When 'main', 'drill', or omitted, review is written to UserProgress.reviewHistory (FSRS). When 'cram' or 'rapid_recall', FSRS is not updated. */
  sessionType?: 'main' | 'drill' | 'cram' | 'rapid_recall';
  telemetry?: {
    duration_ms: number;
    time_to_first_interaction_ms?: number | null;
    rapid_guess?: boolean;
    question_type?: string;
    mvrt_threshold_ms?: number;
    question_displayed_at?: string;
    answer_submitted_at?: string;
    answer_changes?: number;
    hint_viewed?: boolean;
    hint_view_duration_ms?: number | null;
    [key: string]: unknown;
  };
}

/** Result returned by submitDrillReview */
export interface SubmitDrillReviewResult {
  success: true;
  isCorrect: boolean;
  quality: number;
  parTimeMs: number;
  timeSpentMs: number;
  implicitMetrics: {
    rating: Rating;
    gradeContinuous: number;
    confidence: number;
    latencyRatio: number;
    answerSwitches: number;
  };
  circadian: {
    phase: string;
    stabilityModifier: number;
    localHour: number;
  };
  /** Real FSRS schedule — undefined when FSRS was skipped (cram, rapid_recall, rapid guess, no conditionId) */
  fsrsSchedule?: {
    intervalDays: number;
    nextDueDate: string;
    stability: number;
    difficulty: number;
  };
}

/** Optional logger for service-level events (e.g. KAR3L, rapid guess) */
export interface DrillReviewLogger {
  info?(msg: string, data?: Record<string, unknown>): void;
  warn?(msg: string, data?: Record<string, unknown>): void;
  debug?(msg: string, data?: Record<string, unknown>): void;
  error?(msg: string, data?: Record<string, unknown>): void;
}

/** Server-authoritative Minimum Valid Response Time. Client cannot lower below this. */
const SERVER_MVRT_THRESHOLD_MS = 2000;

// ─── Per-Card RT Baseline (CRPL z-score enrichment — tier1augment.md) ──────

/**
 * Fetch per-card RT baseline from the user's past QuestionAttempts for a specific question.
 * Returns null if insufficient history (<3 reviews) or if query fails.
 *
 * The baseline enables per-card z-score normalization in deriveContinuousRating,
 * which is more precise than per-user z-scores because it captures the specific
 * question's inherent difficulty.
 *
 * Also pulls FSRS stability from UserProgress for maturity-aware dampening:
 * high-stability (well-learned) cards tolerate slower RT without penalty.
 *
 * Research: tier1augment.md — "z-score approach more robust than absolute thresholds;
 * conservative about penalizing slow responses on high-stability cards."
 */
async function getCardRtBaseline(
  prisma: PrismaClient,
  userId: string,
  questionId: string,
  conditionId?: string | null
): Promise<CardBaseline | undefined> {
  try {
    // Fetch past RT values for this question+user (max 50 most recent)
    const pastAttempts = await (prisma as any).questionAttempt.findMany({
      where: {
        userId,
        questionId,
        isMainSession: true,
        durationMs: { gt: 500 },
        telemetryJson: { not: null },
      },
      select: {
        telemetryJson: true,
        durationMs: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    if (!pastAttempts || pastAttempts.length < 3) return undefined;

    // Extract RT values: prefer time_to_first_interaction_ms, fallback to durationMs
    const rtValues: number[] = [];
    for (const attempt of pastAttempts) {
      const t = attempt.telemetryJson as Record<string, unknown> | null;
      const firstClick = t?.time_to_first_interaction_ms as number | undefined;
      const rt = firstClick ?? attempt.durationMs;
      if (typeof rt === 'number' && rt > 500) {
        rtValues.push(rt);
      }
    }

    if (rtValues.length < 3) return undefined;

    // Compute mean and stddev
    const sum = rtValues.reduce((a, b) => a + b, 0);
    const mean = sum / rtValues.length;
    const variance = rtValues.reduce((a, b) => a + (b - mean) ** 2, 0) / rtValues.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev <= 0) return undefined;

    // Fetch FSRS stability for maturity-aware dampening
    let fsrsStability: number | undefined;
    if (conditionId) {
      const progress = await (prisma as any).userProgress.findFirst({
        where: { userId, conditionId },
        select: { fsrsStability: true },
      });
      fsrsStability = (progress?.fsrsStability as number | null) ?? undefined;
    }

    return {
      meanRtMs: Math.round(mean),
      stdDevRtMs: Math.round(stdDev),
      reviewCount: rtValues.length,
      fsrsStability,
    };
  } catch {
    return undefined; // Non-fatal — caller falls back to user-level baseline
  }
}

/**
 * Submit a drill review: process answer, update FSRS, record telemetry, update progress.
 * This path is the canonical writer for QuestionAttempt with implicitConfidence (used by calibration).
 * When sessionType is 'main' or omitted, reviews are written to UserProgress.reviewHistory for FSRS.
 * When eorRotationEnd is set (EOR mode), next-review date is clamped to rotation end.
 */
export async function submitDrillReview(
  prisma: PrismaClient,
  userId: string,
  input: SubmitDrillReviewInput,
  question: {
    id: string;
    questionData: unknown;
    conditionId: string | null;
    medicalContentId?: string | null;
    system?: string | null;
  },
  logger?: DrillReviewLogger,
  /** When set (EOR mode), next-review date is clamped to this date. */
  eorRotationEnd?: Date | null,
  /** Exam urgency multiplier (0.5–2.0). Higher → tighter intervals. */
  urgencyMultiplier?: number | null
): Promise<SubmitDrillReviewResult> {
  const {
    questionId,
    selectedAnswer,
    timeSpentMs,
    timeToFirstClick,
    answerSwitches,
    totalDwellTime,
    timezone,
    wakeTimeHHMM,
    sessionType,
    telemetry,
  } = input;

  // ── A/B Test: resolve active experiments for this user (non-blocking) ──
  let abAssignments: ABAssignmentMap = {};
  try {
    abAssignments = await resolveAssignments(prisma as any, userId, [...AB_EXPERIMENTS]);
  } catch {
    // Non-fatal: A/B resolution failure must not block the review pipeline
  }

  const normalizedSelectedAnswer =
    typeof selectedAnswer === 'string'
      ? selectedAnswer
      : selectedAnswer != null
        ? String(selectedAnswer)
        : '';

  const qData = (question.questionData as QuestionData) || {};
  const correctAnswer = resolveCorrectAnswer(qData);

  const isCorrect =
    correctAnswer !== null
      ? normalizedSelectedAnswer === correctAnswer
      : (qData.options || qData.choices || []).some((opt: unknown) => {
          if (typeof opt === 'string') return opt === normalizedSelectedAnswer;
          if (typeof opt === 'object' && opt !== null) {
            const optObj = opt as { value?: string; text?: string; label?: string };
            const val = optObj.value ?? optObj.text ?? optObj.label;
            return val === normalizedSelectedAnswer;
          }
          return false;
        });

  // ── Wave 1: Record outcome for session accuracy slope tracking ──
  recordAccuracyOutcome(userId, isCorrect);

  const optionPool = (qData.options || qData.choices) as
    | Array<OptionPoolItem>
    | string[]
    | undefined;
  const selectedMeta = findSelectedOption(optionPool, normalizedSelectedAnswer);

  // Fetch user's personalized speed factor (cached, 24h TTL)
  const userSpeedFactor = await getUserSpeedFactor(prisma, userId);

  // Fetch per-user behavioral baseline for z-score normalization (Sprint 1)
  // Returns null for new users (<25 attempts) — deriveContinuousRating falls back to absolute thresholds
  const behavioralBaseline = await getUserBehavioralBaseline(prisma, userId);
  const userBaseline: UserBaseline | undefined = behavioralBaseline
    ? {
        rtMedianMs: behavioralBaseline.rtBaseline.medianMs,
        rtStdDevMs: behavioralBaseline.rtBaseline.stdDevMs,
        switchMedian: behavioralBaseline.switchBaseline.medianSwitches,
        switchP75: behavioralBaseline.switchBaseline.p75Switches,
        commitmentGapMedianMs: behavioralBaseline.hesitationBaseline.medianCommitmentGapMs,
        cursorEntropyMedian: behavioralBaseline.hesitationBaseline.medianCursorEntropy,
        oscillationMedian: behavioralBaseline.hesitationBaseline.medianOscillations,
        exGaussian: behavioralBaseline.rtBaseline.exGaussian,
      }
    : undefined;

  // Fetch per-card RT baseline for CRPL z-score enrichment (tier1augment.md)
  // Runs concurrently with par time calculation — non-blocking, non-fatal
  const cardBaselinePromise = getCardRtBaseline(prisma, userId, questionId, question.conditionId);

  const parTimeMs = calculateParTime({
    ...qData,
    stem: qData.stem || qData.question || qData.vignette || qData.text || '',
    choices: qData.choices || qData.options || [],
  }, userSpeedFactor);

  const numericTime = typeof timeSpentMs === 'number' ? timeSpentMs : Number(timeSpentMs) || 0;

  const circadianContext = buildCircadianContext(
    { typicalWakeTime: wakeTimeHHMM },
    timezone || undefined
  );

  // Apply session fatigue correction: later questions in a session get more generous par time
  const questionNumber = (telemetry?.question_number as number | undefined) ?? null;
  const fatigueAdjustedParTimeMs = applyFatigueCorrection(parTimeMs, questionNumber);

  const circadianAdjustedParTimeMs = applyCircadianParTimeModifier(fatigueAdjustedParTimeMs, circadianContext);

  const commitmentGapMs = (telemetry?.selection_drift_ms as number | undefined) ?? null;
  const cursorEntropy = telemetry?.cursor_entropy as number | undefined;
  const hoverOscillationCount = (telemetry?.hover_oscillations as number | undefined) ?? 0;

  // Detect rapid guesses BEFORE deriving implicit rating — don't waste compute on accidental taps
  // Use question-type-specific MVRT when available; server floor prevents client from lowering threshold
  const questionTypeMvrt = getMVRTThreshold(
    ((telemetry?.question_type as string) ?? 'unknown') as TelemetryQuestionType
  );
  // Research (Wise & DeMars, 2006): rapid-guess threshold at ~10% of median item RT.
  // When per-user behavioral baseline exists, use 10% of their personal median RT
  // as a more individualized rapid-guess filter. Fall back to fixed thresholds
  // when no baseline is available.
  const perUserMvrt = behavioralBaseline?.rtBaseline?.medianMs
    ? Math.max(SERVER_MVRT_THRESHOLD_MS, behavioralBaseline.rtBaseline.medianMs * 0.10)
    : null;
  const effectiveMvrt = Math.max(
    SERVER_MVRT_THRESHOLD_MS,
    perUserMvrt ?? (telemetry?.mvrt_threshold_ms as number) ?? questionTypeMvrt
  );
  const isRapidGuess = (telemetry?.rapid_guess as boolean) ?? numericTime < effectiveMvrt;

  let rating: Rating;
  let gradeContinuous: number;
  let implicitConfidence: number;
  let rtClassification: string | null = null;
  let rtSignalQuality = 1.0;
  // Wave 2: Distractor chronometry & switch direction results (set when option_interactions present)
  let wave2Chronometry: DistractorChronometryResult | undefined;
  let wave2SwitchDirection: SwitchDirectionResult | undefined;
  // Wave 3: Post-answer engagement + DB extension results
  let wave3ExplanationEngagement: ExplanationEngagementResult | undefined;
  let wave3SessionRegularity: SessionRegularityResult | undefined;
  let wave3RelearningSpeed: RelearningSpeedResult | undefined;
  let wave3ConfusionAction: ConfusionPairAction | undefined;
  const switches = answerSwitches ?? 0;

  if (isRapidGuess) {
    // Skip implicit rating derivation entirely — accidental taps must not enter FSRS pipeline
    rating = Rating.Again;
    gradeContinuous = 1.0;
    implicitConfidence = 0;
    logger?.info?.('Rapid guess detected — skipping implicit rating derivation', {
      questionId,
      duration: numericTime,
      effectiveMvrt,
    });
  } else {
    // Normal path: derive implicit rating from behavioral telemetry
    // When timeToFirstClick is missing, substitute a neutral value (parTimeMs * 0.85)
    // rather than totalDwellTime. Total dwell includes rationale-reading time and
    // inflates the latency ratio by 2-5x, systematically downgrading ratings for
    // questions where the client omits the first-click metric.
    const effectiveFirstClick = timeToFirstClick ?? Math.min(numericTime, parTimeMs * 0.85);

    const behaviorMetrics: ImplicitBehaviorMetrics = {
      timeToFirstClick: effectiveFirstClick,
      answerSwitches: answerSwitches ?? 0,
      totalDwellTime: totalDwellTime ?? numericTime,
      isCorrect,
      parTimeMs: circadianAdjustedParTimeMs,
      commitmentGapMs: commitmentGapMs ?? undefined,
      cursorEntropy,
      hoverOscillationCount,
      // Hint-viewed penalty: aided recall weakens the retrieval strength signal
      hintViewed: (telemetry?.hint_viewed as boolean) ?? false,
      hintViewDurationMs: (telemetry?.hint_view_duration_ms as number | null) ?? null,
      // Question type for type-specific confidence weight profiles (Sprint 3)
      questionType: (telemetry?.question_type as string) ?? 'unknown',
      // Streak modifier: consecutive correct answers in current session (optional)
      consecutiveCorrectStreak: (telemetry?.consecutive_correct as number | undefined) ?? undefined,
    };

    // Await per-card baseline (non-fatal — undefined on failure)
    const cardRtBaseline = await cardBaselinePromise;
    const continuousResult = deriveContinuousRating(behaviorMetrics, undefined, userBaseline, cardRtBaseline);
    rating = continuousResult.discreteRating;
    gradeContinuous = continuousResult.grade;
    implicitConfidence = continuousResult.confidence;
    // Capture ex-Gaussian RT classification for telemetry (lapse detection)
    rtClassification = continuousResult.rtClassification ?? null;
    rtSignalQuality = continuousResult.rtSignalQuality ?? 1.0;

    // ── Wave 2: Distractor chronometry & switch direction (additive, backward-compatible) ──
    const optionInteractionsRaw = telemetry?.option_interactions as OptionInteractionRecord[] | undefined;
    if (optionInteractionsRaw && Array.isArray(optionInteractionsRaw) && optionInteractionsRaw.length > 0) {
      wave2Chronometry = analyzeDistractorChronometry(
        optionInteractionsRaw,
        correctAnswer,
        normalizedSelectedAnswer
      );
      implicitConfidence *= wave2Chronometry.confidenceMultiplier;

      wave2SwitchDirection = analyzeSwitchDirections(
        optionInteractionsRaw,
        correctAnswer
      );
      implicitConfidence *= wave2SwitchDirection.confidenceMultiplier;

      logger?.debug?.('Wave 2 signals applied', {
        questionId,
        chronometryMultiplier: wave2Chronometry.confidenceMultiplier,
        correctAbandoned: wave2Chronometry.correctOptionAbandoned,
        uniqueOptions: wave2Chronometry.uniqueOptionsConsidered,
        switchDirectionMultiplier: wave2SwitchDirection.confidenceMultiplier,
        metacognitivePrecision: wave2SwitchDirection.metacognitivePrecision,
        netSwitchValue: wave2SwitchDirection.netSwitchValue,
      });
    }

    // ── Wave 3A: Explanation engagement confidence modifier (post-correct surprise detection) ──
    const explanationRaw = telemetry?.explanation_engagement as
      | { viewed_ms: number; scroll_depth: number; expanded_sections: number; was_correct: boolean }
      | undefined;
    if (explanationRaw && typeof explanationRaw.viewed_ms === 'number') {
      wave3ExplanationEngagement = analyzeExplanationEngagement(
        explanationRaw.viewed_ms,
        explanationRaw.scroll_depth ?? 0,
        explanationRaw.expanded_sections ?? 0,
        explanationRaw.was_correct ?? isCorrect
      );
      implicitConfidence *= wave3ExplanationEngagement.confidenceModifier;
      // stabilityModifier is applied later in the stability pipeline
    }

    // Implicit FSRS "Truth Engine": Override user-derived rating using behavioral honesty heuristics
    // Binary system: Again(1) / Good(3). Hard(2) and Easy(4) are deprecated.
    // Rule 1: If rating came out as Easy (shouldn't happen often) → normalize to Good
    if (rating === Rating.Easy) {
      rating = Rating.Good;
    }
    // Rule 2: Switch-direction-aware indecision detection
    // Research (ScienceDirect 2022): only the first answer change is informative;
    // subsequent changes approach guessing probability. RW is a strong negative signal.
    if (wave2SwitchDirection && wave2SwitchDirection.totalSwitches > 0) {
      // Apply direction-aware grade penalty from Wave 2 analysis
      gradeContinuous = Math.max(1.0, Math.min(4.0,
        gradeContinuous + wave2SwitchDirection.gradePenaltyRecommendation
      ));
      // Re-sync discrete rating with continuous grade after penalty.
      // Binary system: grade < 2.0 → Again, grade ≥ 2.0 → Good.
      // This prevents grade_continuous and discrete rating from diverging.
      if (gradeContinuous < 2.0 && rating > Rating.Again) {
        rating = Rating.Again;
        logger?.info?.('Behavioral override: Again (grade dropped below 2.0 after switch-direction penalty)', {
          questionId,
          gradeContinuous,
          firstSwitch: wave2SwitchDirection.firstSwitchDirection,
          totalSwitches: wave2SwitchDirection.totalSwitches,
          gradePenalty: wave2SwitchDirection.gradePenaltyRecommendation,
        });
      }
      // RW first switch with multiple total switches = strong indecision → downgrade
      if (wave2SwitchDirection.firstSwitchDirection === 'RW' && wave2SwitchDirection.totalSwitches > 1 && rating > Rating.Again) {
        rating = Rating.Again;
        logger?.info?.('Behavioral override: Again (right→wrong first switch + multiple changes)', {
          questionId,
          firstSwitch: wave2SwitchDirection.firstSwitchDirection,
          totalSwitches: wave2SwitchDirection.totalSwitches,
          gradePenalty: wave2SwitchDirection.gradePenaltyRecommendation,
        });
      }
    } else if (switches > 2 && rating > Rating.Again) {
      // Fallback when Wave 2 option_interactions unavailable: legacy threshold
      rating = Rating.Again;
      logger?.info?.('Behavioral override: Again (high indecision, legacy path)', {
        questionId,
        answerSwitches: switches,
      });
    }
    // Rule 3 (Ghost Grader): bidirectional behavioral adjustment
    // - Indecision signals → downgrade to Again + cap grade_continuous
    // - Clean signals + fast response → boost grade_continuous (confidence pathway)
    // - Fast elimination → additional boost; absent elimination → soft penalty
    const oscillations = (telemetry?.hover_oscillations as number | undefined) ?? 0;
    const vignetteRegressions = (telemetry?.vignette_regressions as number | undefined) ?? 0;
    const selectionDriftMs = telemetry?.selection_drift_ms as number | null | undefined;
    const tremorScore = (telemetry?.tremor_score as number | undefined) ?? 0;
    const eliminationVelocity = (telemetry?.elimination_velocity as number | undefined) ?? undefined;
    const latencyRatio = circadianAdjustedParTimeMs > 0
      ? numericTime / circadianAdjustedParTimeMs
      : undefined;

    // Sprint 7: Build Ghost Grader baseline from behavioral baseline for z-score normalization
    // Uses IQR-derived stddev estimates when direct stddev is unavailable:
    // stddev ≈ IQR / 1.35 (for normal-ish distributions)
    const ghostBaseline = behavioralBaseline ? {
      oscillationMedian: behavioralBaseline.hesitationBaseline.medianOscillations,
      oscillationStdDev: Math.max(0.5, behavioralBaseline.hesitationBaseline.medianOscillations * 0.8),
      tremorMedian: 0, // Tremor not yet in baseline — use 0 (falls back to absolute)
      tremorStdDev: 0,
      driftMedianMs: behavioralBaseline.hesitationBaseline.medianCommitmentGapMs,
      driftStdDevMs: Math.max(500, behavioralBaseline.hesitationBaseline.medianCommitmentGapMs * 0.6),
    } : null;

    const ghostResult = applyHonestRatingWithDetail({
      userRating: rating,
      isCorrect,
      oscillations,
      vignetteRegressions,
      selectionDriftMs: selectionDriftMs ?? null,
      tremorScore,
      latencyRatio,
      eliminationVelocity,
      optionCount: (question.questionData as any)?.options?.length ?? 4,
      baseline: ghostBaseline,
      hintViewed: behaviorMetrics.hintViewed,
      hintDurationMs: behaviorMetrics.hintViewDurationMs,
    });
    rating = ghostResult.rating;

    // Apply grade_continuous adjustment from Ghost Grader
    if (ghostResult.rule === 'indecision') {
      // Indecision: cap grade_continuous at 1.5 (Again range)
      gradeContinuous = Math.min(gradeContinuous, GHOST_GRADER_CONSTANTS.INDECISION_GRADE_CAP);
    } else if (ghostResult.rule === 'hint_assisted') {
      // Hint-assisted: apply penalty and cap at HINT_GRADE_CAP (weaker than indecision)
      gradeContinuous = Math.min(
        Math.max(1.0, gradeContinuous + ghostResult.gradeContinuousAdjustment),
        GHOST_GRADER_CONSTANTS.HINT_GRADE_CAP
      );
    } else if (ghostResult.gradeContinuousAdjustment !== 0) {
      // Confidence boost or elimination adjustment
      gradeContinuous = Math.max(1.0, Math.min(4.0,
        gradeContinuous + ghostResult.gradeContinuousAdjustment
      ));
    }
  }

  // Hard and Easy ratings are deprecated; mapping remains for historical data.
  const quality =
    rating === Rating.Again ? 1 : rating === Rating.Hard ? 2 : rating === Rating.Easy ? 5 : 4;

  try {
    await updateReviewOutcome(
      userId,
      questionId,
      {
        quality,
        timeToAnswer: numericTime,
        baselineTime: parTimeMs,
      },
      prisma as any
    );
  } catch (reviewOutcomeErr) {
    // Non-fatal: log but don't block the review pipeline
    logger?.warn?.('updateReviewOutcome failed', { questionId, error: String(reviewOutcomeErr) });
  }

  try {
    await applyAttemptToUserStatistics(prisma as any, userId, {
      system: question.system || (qData as any).system || undefined,
      isCorrect,
      timeSpentMs: numericTime,
      selectedCondition: selectedMeta?.conditionId ?? selectedMeta?.label ?? null,
      correctCondition: question.conditionId ?? null,
      timestamp: new Date(),
    });
    await updateTimingAggregates(prisma as any, userId, { refreshPeakHours: true });
  } catch (statsError) {
    logger?.warn?.('Failed to update user statistics after review', {
      error: statsError instanceof Error ? statsError.message : String(statsError),
    });
  }

  const effectiveDurationMs = telemetry?.duration_ms ?? numericTime;
  const isMainSession = sessionType !== 'cram' && sessionType !== 'rapid_recall';
  let attemptId = `drill_review_${userId}_${questionId}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  try {
    // Check for existing attempt within last 5 minutes to avoid duplicates
    const existingAttempt = await prisma.questionAttempt.findFirst({
      where: {
        userId,
        questionId,
        createdAt: {
          gte: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes
        },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });

    let finalAttemptId = attemptId;
    if (existingAttempt) {
      finalAttemptId = existingAttempt.id;
      // Skip creation, we'll reuse the existing attempt
    } else {
      await prisma.questionAttempt.create({
        data: {
          id: finalAttemptId,
          userId,
          questionId,
          conditionId: question.conditionId ?? undefined,
          medicalContentId: question.medicalContentId ?? undefined,
          system: question.system ?? undefined,
          // Match the FSRS gate logic: undefined/missing sessionType is treated as main
          isMainSession: sessionType !== 'cram' && sessionType !== 'rapid_recall',
          selectedAnswer: normalizedSelectedAnswer,
          wasCorrect: isCorrect,
          durationMs: effectiveDurationMs,
          implicitConfidence,
          telemetryJson: telemetry
            ? {
                ...telemetry,
                server_computed: {
                  par_time_ms: parTimeMs,
                  circadian_par_time_ms: circadianAdjustedParTimeMs,
                  latency_ratio: effectiveDurationMs / circadianAdjustedParTimeMs,
                  implicit_rating: rating,
                  implicit_confidence: implicitConfidence,
                  grade_continuous: gradeContinuous,
                  circadian_phase: circadianContext.circadianPhase,
                  is_rapid_guess: isRapidGuess,
                },
              }
            : {
                duration_ms: numericTime,
                rapid_guess: isRapidGuess,
                question_type: 'unknown' as const,
                mvrt_threshold_ms: 2000,
                question_displayed_at: new Date(Date.now() - numericTime).toISOString(),
                answer_submitted_at: new Date().toISOString(),
                answer_changes: answerSwitches ?? 0,
                hint_viewed: false,
                time_to_first_interaction_ms: timeToFirstClick ?? null,
                hint_view_duration_ms: null,
                server_computed: {
                  par_time_ms: parTimeMs,
                  circadian_par_time_ms: circadianAdjustedParTimeMs,
                  latency_ratio: numericTime / circadianAdjustedParTimeMs,
                  implicit_rating: rating,
                  implicit_confidence: implicitConfidence,
                  grade_continuous: gradeContinuous,
                  circadian_phase: circadianContext.circadianPhase,
                  is_rapid_guess: isRapidGuess,
                },
              },
        },
      });
    }
    // Ensure attemptId variable used later matches the final attempt ID
    attemptId = finalAttemptId;
    const weCreatedAttempt = !existingAttempt;
    // Update peer validation statistics
    try {
      await prisma.preGeneratedQuestion.update({
        where: { id: questionId },
        data: {
          timesServed: { increment: 1 },
          ...(isCorrect
            ? { timesCorrect: { increment: 1 } }
            : { timesIncorrect: { increment: 1 } }),
        },
      });
    } catch (statsError) {
      logger?.warn?.('Failed to update PreGeneratedQuestion statistics', {
        error: statsError instanceof Error ? statsError.message : String(statsError),
      });
    }
    if (isRapidGuess) {
      logger?.info?.('Rapid guess detected', {
        questionId,
        duration: effectiveDurationMs,
        threshold: telemetry?.mvrt_threshold_ms ?? 2000,
      });
    }

    // Update Rolling 360 for main session attempts only when we created the attempt here.
    // If we reused an existing attempt (e.g. created by POST /api/questions/attempt), that path already updated Rolling 360—skip to avoid double count.
    if (isMainSession && weCreatedAttempt) {
      try {
        await getRolling360Service(prisma).updateRolling360OnSubmit({
          attemptId,
          userId,
          isCorrect,
          system: question.system ?? 'Unknown',
          answeredAt: new Date(),
        });
      } catch (rollingError) {
        logger?.warn?.('Failed to update Rolling 360 stats', {
          error: rollingError instanceof Error ? rollingError.message : String(rollingError),
        });
      }
    }
  } catch (attemptError) {
    logger?.warn?.('Failed to create QuestionAttempt record', {
      error: attemptError instanceof Error ? attemptError.message : String(attemptError),
    });
  }

  // Only update FSRS (UserProgress.reviewHistory) for main study sessions; exclude cram/rapid_recall
  // Rapid guesses are logged to ReviewLog but do NOT update FSRS state (accidental taps must not pollute SRS scheduling)
  const countForFSRS = sessionType !== 'cram' && sessionType !== 'rapid_recall';
  const shouldLogReview = countForFSRS || isRapidGuess; // Log all main-session reviews, including rapid guesses

  // Capture FSRS schedule for the return value so the frontend can display real data
  let fsrsSchedule:
    | { intervalDays: number; nextDueDate: string; stability: number; difficulty: number }
    | undefined;

  const logSessionType = (sessionType ? sessionType.toUpperCase() : 'MAIN') as 'MAIN' | 'CRAM' | 'RAPID_RECALL';

  // Assess telemetry data quality for optimizer weighting.
  // 'minimal' quality means the grade is derived from correctness + duration only —
  // less reliable for FSRS parameter optimization.
  const telemetryQuality = assessTelemetryQuality(telemetry as Record<string, unknown> | undefined);
  if (telemetryQuality === 'minimal' && countForFSRS) {
    logger?.warn?.('Minimal telemetry quality for FSRS-eligible review', {
      questionId,
      sessionType,
      hasTelemetry: !!telemetry,
    });
  }

  // Helper function to create full telemetry object with server_computed key
  const buildReviewLogTelemetry = (
    currentCard?: Record<string, number | Date> | null
  ) => ({
    ...(telemetry ?? {}),
    server_computed: {
      par_time_ms: parTimeMs,
      fatigue_adjusted_par_time_ms: fatigueAdjustedParTimeMs,
      user_speed_factor: userSpeedFactor,
      question_number: questionNumber,
      circadian_par_time_ms: circadianAdjustedParTimeMs,
      latency_ratio: effectiveDurationMs / circadianAdjustedParTimeMs,
      implicit_confidence: implicitConfidence,
      grade_continuous: gradeContinuous,
      answer_changes: (telemetry?.answer_changes as number | undefined) ?? switches,
      circadian_phase: circadianContext.circadianPhase,
      rapid_guess: isRapidGuess,
      telemetry_quality: telemetryQuality,
      rt_classification: rtClassification,
      rt_signal_quality: rtSignalQuality,
      ...(currentCard && {
        state: currentCard.state as number,
        stability: currentCard.stability as number,
        difficulty: currentCard.difficulty as number,
        elapsed_days: currentCard.elapsed_days as number,
      }),
    },
  });

  // DEV-001 FIX: Split rapid-guess ReviewLog from FSRS block
  if (question.conditionId && shouldLogReview) {
    logger?.debug?.('Processing review', { conditionId: question.conditionId, countForFSRS, isRapidGuess });
    
    // For rapid guesses: create ReviewLog with live card state, but skip FSRS update.
    // The card state is logged for analytics accuracy — zero values make it impossible
    // to reconstruct the card lifecycle from ReviewLog alone.
    if (isRapidGuess) {
      try {
        const reviewDate = new Date();
        const hoverOscillations =
          (telemetry?.hover_oscillations as number | undefined) ?? undefined;
        const vignetteRegressions =
          (telemetry?.vignette_regressions as number | undefined) ?? undefined;
        const timeToFirstInteraction =
          (telemetry?.time_to_first_interaction_ms as number | undefined) ??
          timeToFirstClick ??
          undefined;

        // Read live card state so the log reflects the card's true position
        let liveState = 0, liveStability = 0, liveDifficulty = 0, liveRetrievability = 0, liveElapsedDays = 0;
        try {
          const existingProgress = await prisma.userProgress.findUnique({
            where: { userId_conditionId: { userId, conditionId: question.conditionId! } },
          });
          if (existingProgress?.fsrsCard) {
            const card = existingProgress.fsrsCard as Record<string, unknown>;
            liveState = typeof card.state === 'number' ? card.state : 0;
            liveStability = typeof card.stability === 'number' ? card.stability : 0;
            liveDifficulty = typeof card.difficulty === 'number' ? card.difficulty : 0;
            liveElapsedDays = typeof card.elapsed_days === 'number' ? card.elapsed_days : 0;
            if (liveStability > 0) {
              const fsrs = new FSRS();
              liveRetrievability = fsrs.calculateRetrievability(liveElapsedDays, liveStability);
            }
          }
        } catch { /* non-fatal: fall back to zeros */ }

        logger?.debug?.('Creating rapid-guess ReviewLog', { userId, questionId, conditionId: question.conditionId });
        await prisma.reviewLog.create({
          data: {
            userId,
            conditionId: question.conditionId,
            medicalContentId: question.medicalContentId ?? undefined,
            questionId,
            questionType: 'pre_generated',
            grade: Rating.Again, // Force grade to 1 (Again) for rapid guesses
            grade_continuous: 1.0,
            rawGrade: 1.0,
            effectiveGrade: 1.0,
            behavioralDeltas: null, // No behavioral modulation for rapid guesses
            state: liveState,
            stability: liveStability,
            difficulty: liveDifficulty,
            retrievability: liveRetrievability,
            implicit_confidence: implicitConfidence,
            scheduledAt: new Date(), // Placeholder - not used for rapid guesses
            reviewedAt: reviewDate,
            responseTimeMs: effectiveDurationMs,
            review_type: 'rapid_guess',
            elapsedDays: liveElapsedDays,
            wasCorrect: isCorrect,
            sessionType: logSessionType,
            attemptId,
            system: question.system ?? undefined,
            hover_oscillations: hoverOscillations,
            vignette_regressions: vignetteRegressions,
            time_to_first_interaction: timeToFirstInteraction,
            circadian_phase: toCircadianPhaseEnum(circadianContext.circadianPhase),
            telemetry: buildReviewLogTelemetry({ state: liveState, stability: liveStability, difficulty: liveDifficulty, elapsed_days: liveElapsedDays }),
          },
        });
      } catch (reviewLogError) {
        logger?.error?.('Rapid-guess ReviewLog creation failed', { error: reviewLogError instanceof Error ? reviewLogError.message : String(reviewLogError) });
        logger?.warn?.('Failed to write rapid-guess ReviewLog (non-fatal)', {
          error: reviewLogError instanceof Error ? reviewLogError.message : String(reviewLogError),
        });
      }
    } else {
      // For normal reviews: run FSRS calculation, create ReviewLog, update UserProgress
      try {
        // Sprint 5: Use per-user/system optimized parameters when available
        const optimizedParams = await getOptimizedParameters(prisma, userId, question.system).catch(() => undefined);

        // A/B Test: override request_retention from experiment variant config
        const schedulingExp = abAssignments['scheduling_retention_target'];
        let fsrsParams = optimizedParams;
        if (schedulingExp && typeof schedulingExp.config.request_retention === 'number') {
          const abRetention = schedulingExp.config.request_retention as number;
          if (abRetention >= 0.7 && abRetention <= 0.99) {
            fsrsParams = { ...(fsrsParams || { request_retention: 0.9, maximum_interval: 36500, w: [] }), request_retention: abRetention };
            logger?.debug?.('AB: scheduling_retention_target override applied', {
              variant: schedulingExp.variantName,
              request_retention: abRetention,
            });
          }
        }

        const fsrs = fsrsParams ? new FSRS(fsrsParams) : new FSRS();
        const existingProgress = await prisma.userProgress.findUnique({
          where: {
            userId_conditionId: {
              userId,
              conditionId: question.conditionId,
            },
          },
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

        // Use the discrete rating (Again=1, Good=3) for FSRS scheduling, not the
        // continuous grade float. The continuous grade is useful for ReviewLog telemetry
        // but FSRS.next() should receive the binary rating the system is designed around.
        // (Finding 2 fix: gradeContinuous caused interpolated scheduling drift.)
        const { card: rawCard } = fsrs.next(currentCard, new Date(), rating);

        // ── Wave 1A: Lapse severity — amplify difficulty for severe lapses ──
        let lapseSeverityResult: { severity: number; difficultyMultiplier: number; preLapseReps: number; preLapseStability: number } | undefined;
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

        // ══════════════════════════════════════════════════════════════════════
        // CONFIDENCE PIPELINE v4 (18-step with Wave 1 + Wave 2 + Wave 3)
        // distractor_chronometry → switch_direction → explanation_engagement →
        // accumulate → calibrate → fatigue → accuracy_slope → session_regularity →
        // interference → fluency → stability → explanation_stability →
        // rt_trajectory → interval_deviation → relearning_speed →
        // difficulty → confusion_recurrence → trend
        // ══════════════════════════════════════════════════════════════════════

        // Step 1: Bayesian accumulation — blend current confidence with card history
        // Stabilizes confidence estimates; prevents single-review anomalies (Mozer et al., 2009).
        const reviewHistory = (existingProgress?.reviewHistory ?? []) as Array<{
          confidence?: number;
          wasCorrect?: boolean;
          telemetryQuality?: TelemetryQuality;
        }>;
        const historicalReviews: HistoricalReview[] = reviewHistory
          .filter((r): r is { confidence: number; wasCorrect: boolean; telemetryQuality?: TelemetryQuality } =>
            typeof r.confidence === 'number' && typeof r.wasCorrect === 'boolean'
          )
          .map(r => ({
            confidence: r.confidence,
            wasCorrect: r.wasCorrect,
            telemetryQuality: (r.telemetryQuality as TelemetryQuality) ?? 'minimal',
          }));
        const accumulated = accumulateConfidence(
          implicitConfidence,
          isCorrect,
          historicalReviews
        );

        // Step 2: Metacognitive calibration — correct systematic over/under-confidence
        // (Dunlosky & Nelson, 1992; Koriat, 1997)
        let calibrationFactor = 1.0;
        try {
          const calibration = await getUserCalibration(prisma, userId);
          calibrationFactor = calibration.dampenerFactor;
        } catch {
          // Non-fatal — use neutral calibration
        }

        // Step 3: Session fatigue confidence dampener (Warm, 1984; Helton & Russell, 2015)
        // Late-session reviews produce signals under cognitive fatigue — dampen confidence
        const fatigueConfidenceDampener = computeFatigueConfidenceDampener(questionNumber ?? 0);

        // Step 4: Retrieval interference detection (Anderson & Neely, 1996)
        // Lookup confusion pairs from DB and build session history from ReviewLog
        let interferenceResult: { discount: number; detected: boolean; details: { interferingCount: number; closestDistance: number | null; type: string } } = {
          discount: 1.0, detected: false, details: { interferingCount: 0, closestDistance: null, type: 'none' },
        };
        try {
          // Fetch known confusion pairs for this condition from the user's history
          const confusionPairs = await prisma.confusionPair.findMany({
            where: {
              userId,
              OR: [
                { correctConditionId: question.conditionId },
                { selectedConditionId: question.conditionId },
              ],
            },
            select: { correctConditionId: true, selectedConditionId: true },
            take: 20, // Bounded to prevent unbounded scans
          });
          const confusionPairIds = confusionPairs.map(p =>
            p.correctConditionId === question.conditionId
              ? p.selectedConditionId
              : p.correctConditionId
          );

          // Build session review history from recent ReviewLogs in this session
          // Uses session_id from telemetry if available, otherwise last 30 min of reviews
          const sessionId = telemetry?.session_id as string | undefined;
          const sessionCutoff = new Date(Date.now() - 30 * 60 * 1000); // 30 min fallback
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
            .map((r, idx) => ({
              conditionId: r.conditionId,
              position: idx,
            }));

          interferenceResult = detectInterference(
            question.conditionId,
            confusionPairIds,
            sessionHistory
          );
        } catch {
          // Non-fatal — use no-interference fallback (discount = 1.0)
        }

        // Step 5: Fluency illusion dampener (Kornell & Bjork, 2008)
        const elapsedDays = typeof currentCard.elapsed_days === 'number'
          ? currentCard.elapsed_days
          : 0;

        // Combine all confidence adjustments: accumulated → calibrated → fatigue → accuracy_slope → interference → fluency
        let adjustedConfidence = accumulated.posterior;
        adjustedConfidence *= calibrationFactor;
        adjustedConfidence *= fatigueConfidenceDampener;

        // Step 4b: Session accuracy slope (Sievertsen et al., 2016)
        // Observed declining accuracy within session → dampen confidence
        const accuracySlope = getAccuracySlopeModifier(userId);
        adjustedConfidence *= accuracySlope.confidenceMultiplier;

        // Step 4c (Wave 3B): Session regularity — erratic study patterns → noisier behavioral signals
        try {
          wave3SessionRegularity = await computeSessionRegularity(prisma, userId);
          adjustedConfidence *= wave3SessionRegularity.telemetryTrustMultiplier;
        } catch (regErr) {
          logger?.warn?.('Session regularity computation failed (non-fatal)', {
            error: regErr instanceof Error ? regErr.message : String(regErr),
          });
        }

        adjustedConfidence *= interferenceResult.discount;
        adjustedConfidence *= fluencyIllusionDampener(elapsedDays);

        // Step 6: Graduated stability multiplier (sigmoid centered at 0.6)
        modifiedStability *= confidenceStabilityMultiplier(adjustedConfidence);

        // Step 6a: RT trajectory — implicit delayed JOL (Nelson & Dunlosky, 1991)
        // Faster RT at increasing intervals = consolidation → stability bonus
        const lastReviewWithRT = reviewHistory
          .filter((r: any) => typeof r.responseTimeMs === 'number' && r.responseTimeMs > 0)
          .at(0); // newest first
        const previousRtMs = (lastReviewWithRT as any)?.responseTimeMs ?? null;
        const rtTrajectory = computeRtTrajectory(
          effectiveDurationMs,
          previousRtMs,
          currentCard.elapsed_days
        );
        if (rtTrajectory.hasHistory && isCorrect) {
          modifiedStability *= rtTrajectory.stabilityMultiplier;
        }

        // Step 6b: Interval deviation — information value of this observation (Mozer et al., 2009)
        const intervalDev = computeIntervalDeviation(
          currentCard.elapsed_days,
          currentCard.scheduled_days,
          isCorrect
        );
        modifiedStability *= intervalDev.informationMultiplier;

        // Step 6b.1 (Wave 3A): Explanation engagement stability modifier
        // After errors: deep engagement → stability bonus; shallow → penalty
        if (wave3ExplanationEngagement && wave3ExplanationEngagement.stabilityModifier !== 1.0) {
          modifiedStability *= wave3ExplanationEngagement.stabilityModifier;
          logger?.debug?.('Explanation engagement stability modifier applied', {
            stabilityModifier: wave3ExplanationEngagement.stabilityModifier,
            engagementScore: wave3ExplanationEngagement.engagementScore,
          });
        }

        // Step 6b.2 (Wave 3C): Relearning speed — Ebbinghaus savings (post-lapse only)
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
              logger?.debug?.('Relearning speed savings bonus applied', {
                savingsRatio: wave3RelearningSpeed.savingsRatio,
                bonus: wave3RelearningSpeed.postLapseStabilityBonus,
              });
            }
          } catch (rlErr) {
            logger?.warn?.('Relearning speed computation failed (non-fatal)', {
              error: rlErr instanceof Error ? rlErr.message : String(rlErr),
            });
          }
        }

        // Step 6c: Desirable difficulty bonus (Bjork & Bjork, 2011)
        // Correct answers with LOW confidence = effortful retrieval → stability BONUS
        // This partially offsets the penalty from the graduated multiplier above
        const ddBonus = computeDesirableDifficultyBonus(adjustedConfidence, isCorrect, elapsedDays);
        if (ddBonus.activated) {
          modifiedStability *= ddBonus.multiplier;
          logger?.debug?.('Desirable difficulty bonus applied', {
            multiplier: ddBonus.multiplier,
            effortSignal: ddBonus.components.effortSignal,
            spacingSignal: ddBonus.components.spacingSignal,
          });
        }

        // Step 7: Cross-session trend detection (Bjork, 1999; Kornell et al., 2009)
        // Declining confidence trajectory across reviews → stability penalty
        const confidenceValues = historicalReviews.map(r => r.confidence);
        confidenceValues.push(adjustedConfidence); // include current
        const trend = detectConfidenceTrend(confidenceValues);
        if (trend.trendMultiplier !== 1.0 && trend.rSquared >= 0.3) {
          modifiedStability *= trend.trendMultiplier;
          logger?.debug?.('Cross-session trend applied', {
            slope: trend.slope,
            category: trend.category,
            multiplier: trend.trendMultiplier,
            rSquared: trend.rSquared,
          });
        }

        // Exam urgency: when an exam is close, tighten review intervals.
        // urgencyMultiplier > 1.0 → stability shrinks → more frequent reviews.
        // Formula: stability /= (1 + (urgency - 1) * 0.3)
        //   urgency 1.0 → no change; urgency 2.0 → stability × 0.77 (23% shorter intervals)
        if (urgencyMultiplier && urgencyMultiplier > 1.0) {
          const urgencyDampener = 1 + (urgencyMultiplier - 1) * 0.3;
          modifiedStability /= urgencyDampener;
        }
        // ── Retrievability calibration correction (Sprint 4) ──
        // Adjusts stability based on predicted-vs-actual recall calibration.
        // If the model consistently overestimates retention for this system,
        // the correction factor < 1.0 → shorter intervals. Vice versa for underestimation.
        try {
          const stabilityCorrectionFactor = await getStabilityCorrectionFactor(prisma, userId, question.system);
          modifiedStability *= stabilityCorrectionFactor;
        } catch (calErr) {
          // Non-fatal: if calibration fails, proceed without correction
          logger?.warn?.('Calibration correction failed, using uncorrected stability', {
            error: calErr instanceof Error ? calErr.message : String(calErr),
          });
        }

        // Step 8: Confidence-weighted difficulty modulation (Metcalfe & Kornell, 2005)
        // Modulate how aggressively difficulty shifts based on confidence.
        // Does not change FSRS core math — operates on the delta after FSRS computes.
        const baseDifficultyDelta = rawCard.difficulty - currentCard.difficulty;
        const difficultyMod = modulateDifficultyDelta(baseDifficultyDelta, adjustedConfidence, isCorrect);
        const modulatedDifficulty = Math.max(1, Math.min(10,
          currentCard.difficulty + difficultyMod.modulatedDelta
        ));

        const updatedCard = {
          ...rawCard,
          stability: Math.max(0.01, modifiedStability),
          difficulty: modulatedDifficulty,
        };

        // ── Behavioral grade modulation (Phase 1 — Behavioral Analysis Audit) ──
        // Runs AFTER the full confidence pipeline and FSRS state update.
        // Produces rawGrade/effectiveGrade/behavioralDeltas for ReviewLog storage.
        // Does NOT retroactively change the FSRS scheduling — the discrete rating
        // fed to fsrs.next() remains the binary rating (Finding 2 fix preserved).
        // Instead, the modulated grade provides the FSRS optimizer with richer
        // training signal and enables future shadow-mode A/B testing.
        let gradeModulationResult: GradeModulation | null = null;
        try {
          const streakCount = (telemetry?.consecutive_correct as number | undefined) ?? 0;
          const behavioralContext: BehavioralContext = {
            responseTimeMs: effectiveDurationMs,
            isCorrect,
            rawGrade: gradeContinuous,
            streakCount,
            sessionQuestionIndex: questionNumber ?? 0,
            userMedianRtMs: null, // Populated when UserSRSConfig.medianResponseTimeMs is available
            rollingWindowAccuracy: null, // Populated when DrillSessionRecord rolling fields are wired
            rollingWindowMeanRtMs: null,
            sessionMeanAccuracy: null,
          };

          // Attempt to read per-user RT baseline from UserSRSConfig
          try {
            const srsConfig = await prisma.userSRSConfig.findUnique({
              where: { userId },
              select: { medianResponseTimeMs: true, responseTimeSampleN: true },
            });
            if (srsConfig?.medianResponseTimeMs != null) {
              behavioralContext.userMedianRtMs = srsConfig.medianResponseTimeMs;
            }
          } catch { /* non-fatal: use default median */ }

          gradeModulationResult = modulateGrade(behavioralContext);
          logger?.debug?.('Grade modulation computed', {
            rawGrade: gradeModulationResult.rawGrade,
            effectiveGrade: gradeModulationResult.effectiveGrade,
            discreteGrade: gradeModulationResult.discreteGrade,
            deltas: gradeModulationResult.deltas,
            rtZone: gradeModulationResult.signals.rtZone,
            fatigueScore: gradeModulationResult.signals.fatigueScore,
          });
        } catch (modErr) {
          logger?.warn?.('Grade modulation failed (non-fatal, using raw grade)', {
            error: modErr instanceof Error ? modErr.message : String(modErr),
          });
        }

        const rawNextDue = new Date(Date.now() + updatedCard.scheduled_days * 86400000);
        const { due: clampedNextDue } = applyEorClampIfNeeded(rawNextDue, eorRotationEnd ?? null);

        // Capture real FSRS schedule for the API response (use clamped date when in EOR mode)
        // Round intervalDays for display/API consumers; raw float in updatedCard.scheduled_days.
        // FSRS-7 migration: fractional intervals will flow through here — rounding at this
        // boundary keeps UI components and notification logic working unchanged.
        fsrsSchedule = {
          intervalDays: Math.max(1, Math.round(updatedCard.scheduled_days)),
          nextDueDate: clampedNextDue.toISOString(),
          stability: updatedCard.stability,
          difficulty: updatedCard.difficulty,
        };

        // DEV-002 FIX: Store full telemetry with server_computed key
        logger?.debug?.('Creating normal ReviewLog with full telemetry');
        try {
          const reviewDate = new Date();
          const hoverOscillations =
            (telemetry?.hover_oscillations as number | undefined) ?? undefined;
          const vignetteRegressions =
            (telemetry?.vignette_regressions as number | undefined) ?? undefined;
          const timeToFirstInteraction =
            (telemetry?.time_to_first_interaction_ms as number | undefined) ??
            timeToFirstClick ??
            undefined;

          logger?.debug?.('About to create ReviewLog', { userId, questionId, conditionId: question.conditionId });
          await prisma.reviewLog.create({
            data: {
              userId,
              conditionId: question.conditionId,
              medicalContentId: question.medicalContentId ?? undefined,
              questionId,
              questionType: 'pre_generated',
              grade: rating,
              grade_continuous: gradeContinuous,
              rawGrade: gradeModulationResult?.rawGrade ?? gradeContinuous,
              effectiveGrade: gradeModulationResult?.effectiveGrade ?? gradeContinuous,
              behavioralDeltas: gradeModulationResult?.deltas ?? null,
              state: currentCard.state,
              stability: currentCard.stability,
              difficulty: currentCard.difficulty,
              retrievability: fsrs.calculateRetrievability(currentCard.elapsed_days, currentCard.stability),
              implicit_confidence: implicitConfidence,
              scheduledAt: new Date(
                currentCard.last_review.getTime() + currentCard.scheduled_days * 86400000
              ),
              reviewedAt: reviewDate,
              responseTimeMs: effectiveDurationMs,
              review_type: 'real',
              elapsedDays: currentCard.elapsed_days,
              wasCorrect: isCorrect,
              sessionType: logSessionType,
              attemptId,
              system: question.system ?? undefined,
              hover_oscillations: hoverOscillations,
              vignette_regressions: vignetteRegressions,
              time_to_first_interaction: timeToFirstInteraction,
              circadian_phase: toCircadianPhaseEnum(circadianContext.circadianPhase),
              telemetry: {
                ...buildReviewLogTelemetry(currentCard),
                confidence_pipeline_v3: {
                  raw_confidence: implicitConfidence,
                  bayesian_posterior: accumulated.posterior,
                  bayesian_prior_weight: accumulated.priorWeight,
                  calibration_factor: calibrationFactor,
                  fatigue_dampener: fatigueConfidenceDampener,
                  interference_discount: interferenceResult.discount,
                  interference_type: interferenceResult.details.type,
                  fluency_dampener: fluencyIllusionDampener(elapsedDays),
                  adjusted_confidence: adjustedConfidence,
                  stability_multiplier: confidenceStabilityMultiplier(adjustedConfidence),
                  dd_bonus_active: ddBonus.activated,
                  dd_bonus_multiplier: ddBonus.multiplier,
                  trend_slope: trend.slope,
                  trend_category: trend.category,
                  trend_multiplier: trend.trendMultiplier,
                  difficulty_modulation_factor: difficultyMod.modulationFactor,
                  // Wave 1 behavioral signals
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
                  // Wave 2 behavioral signals
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
                  // Wave 3 behavioral signals
                  explanation_engagement_score: wave3ExplanationEngagement?.engagementScore ?? null,
                  explanation_confidence_modifier: wave3ExplanationEngagement?.confidenceModifier ?? null,
                  explanation_stability_modifier: wave3ExplanationEngagement?.stabilityModifier ?? null,
                  session_regularity: wave3SessionRegularity?.regularity ?? null,
                  session_regularity_cv: wave3SessionRegularity?.intervalCV ?? null,
                  session_regularity_streak: wave3SessionRegularity?.streakDays ?? null,
                  session_regularity_trust_multiplier: wave3SessionRegularity?.telemetryTrustMultiplier ?? null,
                  relearning_savings_ratio: wave3RelearningSpeed?.savingsRatio ?? null,
                  relearning_stability_bonus: wave3RelearningSpeed?.postLapseStabilityBonus ?? null,
                  confusion_pair_count: wave3ConfusionAction?.pairCount ?? null,
                  confusion_escalated: wave3ConfusionAction?.escalate ?? null,
                  confusion_difficulty_boost: wave3ConfusionAction?.difficultyBoost ?? null,
                  final_stability: updatedCard.stability,
                  final_difficulty: updatedCard.difficulty,
                },
              },
            },
          });
        } catch (reviewLogError) {
          logger?.error?.('ReviewLog creation failed', { error: reviewLogError instanceof Error ? reviewLogError.message : String(reviewLogError) });
          logger?.warn?.('Failed to write ReviewLog (non-fatal)', {
            error: reviewLogError instanceof Error ? reviewLogError.message : String(reviewLogError),
          });
        }

        // Update UserProgress and sibling propagation for normal reviews only
        await updateUserProgressWithHistory(prisma, {
          userId,
          conditionId: question.conditionId,
          fsrsCard: updatedCard,
          rating,
          accuracy: isCorrect ? 1.0 : 0.0,
          nextReviewAt: eorRotationEnd ? clampedNextDue : undefined,
        });

        // ── UserTopicProgress sync (Improvement 5) ──
        // This is the single authoritative FSRS writer for UserTopicProgress.
        // Previously /api/questions/attempt ran an independent FSRS pipeline that
        // diverged from the modifier chain here. Now only drillReviewService writes
        // FSRS state, ensuring UserProgress and UserTopicProgress stay consistent.
        try {
          const qText = ((question.questionData as QuestionData)?.stem
            ?? (question.questionData as QuestionData)?.question
            ?? (question.questionData as QuestionData)?.text) || '';
          const taskType = getTaskTypeFromContent(qText) || 'diagnosis';
          await prisma.userTopicProgress.upsert({
            where: {
              userId_conditionId_taskType: {
                userId,
                conditionId: question.conditionId,
                taskType,
              },
            },
            create: {
              userId,
              conditionId: question.conditionId,
              taskType,
              stability: updatedCard.stability,
              difficulty: updatedCard.difficulty,
              state: updatedCard.state,
              reps: updatedCard.reps,
              lapses: updatedCard.lapses,
              lastReviewDate: new Date(),
              nextReviewDate: clampedNextDue,
            },
            update: {
              stability: updatedCard.stability,
              difficulty: updatedCard.difficulty,
              state: updatedCard.state,
              reps: updatedCard.reps,
              lapses: updatedCard.lapses,
              lastReviewDate: new Date(),
              nextReviewDate: clampedNextDue,
            },
          });
        } catch (topicProgressError) {
          // Non-fatal: UserTopicProgress sync failure should not break the main pipeline
          logger?.warn?.('UserTopicProgress sync failed (non-fatal)', {
            error: topicProgressError instanceof Error ? topicProgressError.message : String(topicProgressError),
          });
        }

        // ── Card dual-write (non-blocking) ──
        // Creates per-question FSRS Card alongside condition-level UserProgress.
        // Enables future per-question scheduling without breaking current flow.
        try {
          await prisma.card.upsert({
            where: {
              userId_questionId: { userId, questionId },
            },
            create: {
              id: `${userId}_${questionId}`,
              userId,
              questionId,
              due: clampedNextDue,
              stability: updatedCard.stability,
              difficulty: updatedCard.difficulty,
              elapsed_days: updatedCard.elapsed_days,
              scheduled_days: updatedCard.scheduled_days,
              reps: updatedCard.reps,
              lapses: updatedCard.lapses,
              state: updatedCard.state,
              last_review: new Date(),
            },
            update: {
              due: clampedNextDue,
              stability: updatedCard.stability,
              difficulty: updatedCard.difficulty,
              elapsed_days: updatedCard.elapsed_days,
              scheduled_days: updatedCard.scheduled_days,
              reps: updatedCard.reps,
              lapses: updatedCard.lapses,
              state: updatedCard.state,
              last_review: new Date(),
              updatedAt: new Date(),
            },
          });
        } catch (cardError) {
          // Non-blocking: Card dual-write failure should not break the main pipeline
          logger?.warn?.('Card dual-write failed (non-fatal)', {
            error: cardError instanceof Error ? cardError.message : String(cardError),
          });
        }

        try {
          const siblingBoosts = await propagateRecallToSiblings(question.conditionId, rating);
          if (siblingBoosts.length > 0) {
            logger?.info?.(
              `KAR3L: Propagated ${rating === Rating.Again ? 'penalty' : 'boost'} to ${siblingBoosts.length} siblings`,
              { conditionId: question.conditionId }
            );
          }
        } catch (siblingError) {
          logger?.warn?.('KAR3L propagation error', {
            error: siblingError instanceof Error ? siblingError.message : String(siblingError),
          });
        }
      } catch (progressError) {
        logger?.error?.('Failed to update UserProgress', { error: progressError instanceof Error ? progressError.message : String(progressError) });
        logger?.warn?.('Failed to update UserProgress', {
          error: progressError instanceof Error ? progressError.message : String(progressError),
        });
      }
    }
  }

  if (!isCorrect) {
    try {
      const correctWhere: Array<Record<string, unknown>> = [];
      if (question.medicalContentId) correctWhere.push({ id: question.medicalContentId });
      if (question.conditionId) correctWhere.push({ conditionId: question.conditionId });
      if (typeof qData.condition === 'string') {
        correctWhere.push({
          condition: { equals: qData.condition, mode: 'insensitive' as const },
        });
      }

      const selectedWhere: Array<Record<string, unknown>> = [];
      if (selectedMeta?.conditionId) {
        selectedWhere.push({ id: selectedMeta.conditionId });
        selectedWhere.push({ conditionId: selectedMeta.conditionId });
      }
      if (selectedMeta?.conditionName) {
        selectedWhere.push({
          condition: { equals: selectedMeta.conditionName, mode: 'insensitive' as const },
        });
      }

      const [correctContent, selectedContent] = await Promise.all([
        correctWhere.length
          ? prisma.medicalContent.findFirst({
              where: { OR: correctWhere },
              select: { id: true, condition: true, conditionId: true },
            })
          : null,
        selectedWhere.length
          ? prisma.medicalContent.findFirst({
              where: { OR: selectedWhere },
              select: { id: true, condition: true, conditionId: true },
            })
          : null,
      ]);

      if (correctContent && selectedContent && correctContent.id !== selectedContent.id) {
        await prisma.confusionPair.upsert({
          where: {
            userId_correctConditionId_selectedConditionId: {
              userId,
              correctConditionId: correctContent.id,
              selectedConditionId: selectedContent.id,
            },
          },
          create: {
            userId,
            correctConditionId: correctContent.id,
            selectedConditionId: selectedContent.id,
            realCondition: correctContent.condition,
            mistakenFor: selectedContent.condition,
            realConditionId: correctContent.conditionId,
            mistakenForId: selectedContent.conditionId,
          },
          update: {
            count: { increment: 1 },
            realCondition: correctContent.condition,
            mistakenFor: selectedContent.condition,
            realConditionId: correctContent.conditionId,
            mistakenForId: selectedContent.conditionId,
          },
        });

        // ── Wave 3D: Confusion pair recurrence analysis ──
        // Check updated count and determine if escalation is needed
        try {
          const updatedPair = await prisma.confusionPair.findFirst({
            where: {
              userId,
              correctConditionId: correctContent.id,
              selectedConditionId: selectedContent.id,
            },
            select: { count: true },
          });
          wave3ConfusionAction = analyzeConfusionRecurrence(updatedPair?.count ?? 1);
          if (wave3ConfusionAction.escalate) {
            logger?.info?.('Confusion pair escalation triggered', {
              correctCondition: correctContent.condition,
              selectedCondition: selectedContent.condition,
              pairCount: wave3ConfusionAction.pairCount,
              difficultyBoost: wave3ConfusionAction.difficultyBoost,
              queueContrastiveDrill: wave3ConfusionAction.queueContrastiveDrill,
              generateDifferentiation: wave3ConfusionAction.generateDifferentiation,
            });
          }
        } catch (recurrenceErr) {
          logger?.warn?.('Confusion pair recurrence analysis failed (non-fatal)', {
            error: recurrenceErr instanceof Error ? recurrenceErr.message : String(recurrenceErr),
          });
        }
      }
    } catch (confusionError) {
      logger?.warn?.('Failed to record confusion pair', {
        error: confusionError instanceof Error ? confusionError.message : String(confusionError),
      });
    }
  }

  // ── RT baseline update (non-blocking, Phase 1 — Behavioral Analysis Audit) ──
  // Incrementally update per-user median RT for future grade modulation.
  // Fires asynchronously to avoid adding latency to the response.
  if (effectiveDurationMs > 0 && countForFSRS) {
    updateUserMedianRtAsync(prisma, userId, logger).catch(() => {
      // Swallowed — non-fatal background task
    });
  }

  // ── FIRe implicit review compression (non-blocking) ──
  // Propagate review credit/penalty to prerequisite concepts via the graph.
  // Runs only for FSRS-eligible reviews with a valid conditionId.
  let fireCredits: Array<{ conceptId: string; stabilityMultiplier: number }> | undefined;
  if (countForFSRS && question.conditionId) {
    try {
      const fireModule = await import('./fireCompressionService');
      // Fetch prerequisite edges for this condition's system
      const edges = await prisma.graphEdge.findMany({
        where: {
          OR: [{ sourceId: question.conditionId }, { targetId: question.conditionId }],
          type: 'SEMANTIC',
        },
        select: { sourceId: true, targetId: true, weight: true, type: true },
      });

      if (edges.length > 0) {
        const prereqEdges = edges.map((e) => ({
          sourceId: e.sourceId,
          targetId: e.targetId,
          weight: e.weight ?? 0.5,
          type: 'SEMANTIC' as const,
        }));

        const reviewResult = {
          conceptId: question.conditionId!,
          grade: isCorrect ? 1 : 0,
          isSuccess: isCorrect,
        };

        fireCredits = fireModule.computeCredits(reviewResult, prereqEdges)
          .map((c) => ({ conceptId: c.conceptId, stabilityMultiplier: c.stabilityMultiplier }));
      }
    } catch (fireErr) {
      logger?.warn?.('FIRe compression failed (non-fatal)', {
        error: fireErr instanceof Error ? fireErr.message : String(fireErr),
      });
    }
  }

  return {
    success: true,
    isCorrect,
    quality,
    parTimeMs,
    timeSpentMs: numericTime,
    implicitMetrics: {
      rating,
      gradeContinuous,
      confidence: implicitConfidence,
      latencyRatio: numericTime / parTimeMs,
      answerSwitches: answerSwitches ?? 0,
    },
    circadian: {
      phase: circadianContext.circadianPhase,
      stabilityModifier: circadianContext.stabilityModifier,
      localHour: circadianContext.localHour,
    },
    // Real FSRS schedule data — undefined when FSRS was skipped (cram, rapid_recall, rapid guess, no conditionId)
    fsrsSchedule,
    // FIRe implicit review credits — stability multipliers for prerequisite concepts
    fireCredits,
  };

  // ── A/B Test: log conversion events for completed reviews ──
  // Fires non-blocking; failures are caught internally and do not block the response.
  if (Object.keys(abAssignments).length > 0) {
    for (const [expId, assignment] of Object.entries(abAssignments)) {
      logABConversion(
        prisma as any,
        userId,
        expId,
        assignment.variantName,
        'review_completed',
        isCorrect ? 1 : 0,
        { timeSpentMs: numericTime, questionId, sessionType: sessionType ?? 'drill' }
      );
    }
  }
}

/**
 * Non-blocking RT baseline update for UserSRSConfig.
 * Queries last 50 ReviewLogs for the user, computes median RT,
 * and upserts to UserSRSConfig.medianResponseTimeMs.
 *
 * Called at the end of each FSRS-eligible review to keep the
 * baseline fresh for grade modulation RT zone classification.
 */
async function updateUserMedianRtAsync(
  prisma: PrismaClient,
  userId: string,
  logger?: { warn?: (...args: unknown[]) => void; debug?: (...args: unknown[]) => void }
): Promise<void> {
  const { computeMedianRt, MAX_RT_SAMPLE_WINDOW } = await import('./userRtBaselineService');

  const recentReviews = await prisma.reviewLog.findMany({
    where: { userId, responseTimeMs: { not: null, gt: 0 } },
    orderBy: { reviewedAt: 'desc' },
    take: MAX_RT_SAMPLE_WINDOW,
    select: { responseTimeMs: true },
  });

  const samples = recentReviews
    .filter((r): r is { responseTimeMs: number } => r.responseTimeMs != null)
    .map(r => ({ responseTimeMs: r.responseTimeMs }));

  const result = computeMedianRt(samples);
  if (!result) return; // Not enough valid data

  await prisma.userSRSConfig.update({
    where: { userId },
    data: {
      medianResponseTimeMs: result.medianMs,
      responseTimeSampleN: result.sampleCount,
    },
  });

  logger?.debug?.('Updated user RT baseline', {
    userId,
    medianMs: result.medianMs,
    sampleCount: result.sampleCount,
  });
}
