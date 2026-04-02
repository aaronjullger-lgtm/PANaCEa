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
import { deriveContinuousRating, assessTelemetryQuality, confidenceStabilityMultiplier, fluencyIllusionDampener } from '../implicit-metrics';
import { getMVRTThreshold, type QuestionType } from '../../types/telemetry';
import { buildCircadianContext, applyCircadianModifier, applyCircadianParTimeModifier } from '../circadian';
import { propagateRecallToSiblings } from './semanticSiblingService';
import { applyAttemptToUserStatistics, updateTimingAggregates } from './userStatisticsService';
import { applyHonestRating } from '../srs/ghostGrader';
import { getRolling360Service } from './rolling360Service';
import { applyEorClampIfNeeded } from '../fsrs/eorScheduler';
import { getTaskTypeFromContent } from '../taskTypes';
import { getUserSpeedFactor } from './userTimingProfileService';

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
  /** When 'main' or omitted, review is written to UserProgress.reviewHistory (FSRS). When 'cram' or 'rapid_recall', FSRS is not updated. */
  sessionType?: 'main' | 'cram' | 'rapid_recall';
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

  const optionPool = (qData.options || qData.choices) as
    | Array<OptionPoolItem>
    | string[]
    | undefined;
  const selectedMeta = findSelectedOption(optionPool, normalizedSelectedAnswer);

  // Fetch user's personalized speed factor (cached, 24h TTL)
  const userSpeedFactor = await getUserSpeedFactor(prisma, userId);

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

  const circadianAdjustedParTimeMs = applyCircadianParTimeModifier(parTimeMs, circadianContext);

  const commitmentGapMs = (telemetry?.selection_drift_ms as number | undefined) ?? null;
  const cursorEntropy = telemetry?.cursor_entropy as number | undefined;
  const hoverOscillationCount = (telemetry?.hover_oscillations as number | undefined) ?? 0;

  // Detect rapid guesses BEFORE deriving implicit rating — don't waste compute on accidental taps
  // Use question-type-specific MVRT when available; server floor prevents client from lowering threshold
  const questionTypeMvrt = getMVRTThreshold(
    ((telemetry?.question_type as string) ?? 'unknown') as QuestionType
  );
  const effectiveMvrt = Math.max(
    SERVER_MVRT_THRESHOLD_MS,
    (telemetry?.mvrt_threshold_ms as number) ?? questionTypeMvrt
  );
  const isRapidGuess = (telemetry?.rapid_guess as boolean) ?? numericTime < effectiveMvrt;

  let rating: Rating;
  let gradeContinuous: number;
  let implicitConfidence: number;
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
    };

    const continuousResult = deriveContinuousRating(behaviorMetrics);
    rating = continuousResult.discreteRating;
    gradeContinuous = continuousResult.grade;
    implicitConfidence = continuousResult.confidence;

    // Implicit FSRS "Truth Engine": Override user-derived rating using behavioral honesty heuristics
    // Binary system: Again(1) / Good(3). Hard(2) and Easy(4) are deprecated.
    // Rule 1: If rating came out as Easy (shouldn't happen often) → normalize to Good
    if (rating === Rating.Easy) {
      rating = Rating.Good;
    }
    // Rule 2: If answerChanges > 2 (high indecision) → downgrade to Again
    if (switches > 2 && rating > Rating.Again) {
      rating = Rating.Again;
      logger?.info?.('Behavioral override: Again (high indecision)', {
        questionId,
        answerSwitches: switches,
      });
    }
    // Rule 3 (Ghost Grader): oscillations, drift, tremor → force Hard for honest history
    const oscillations = (telemetry?.hover_oscillations as number | undefined) ?? 0;
    const vignetteRegressions = (telemetry?.vignette_regressions as number | undefined) ?? 0;
    const selectionDriftMs = telemetry?.selection_drift_ms as number | null | undefined;
    const tremorScore = (telemetry?.tremor_score as number | undefined) ?? 0;
    rating = applyHonestRating({
      userRating: rating,
      isCorrect,
      oscillations,
      vignetteRegressions,
      selectionDriftMs: selectionDriftMs ?? null,
      tremorScore,
    });

    // When Ghost Grader downgraded to Again, ensure gradeContinuous reflects it.
    // Again means "you didn't really know it" → grade should be in [1.0, 1.9].
    if (rating === Rating.Again && gradeContinuous > 1.9) {
      gradeContinuous = 1.5; // Midpoint of Again range — honest but not catastrophic
    }
  }

  // Hard and Easy ratings are deprecated; mapping remains for historical data.
  const quality =
    rating === Rating.Again ? 1 : rating === Rating.Hard ? 2 : rating === Rating.Easy ? 5 : 4;

  updateReviewOutcome(
    userId,
    questionId,
    {
      quality,
      timeToAnswer: numericTime,
      baselineTime: parTimeMs,
    },
    prisma as any
  );

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
      user_speed_factor: userSpeedFactor,
      circadian_par_time_ms: circadianAdjustedParTimeMs,
      latency_ratio: effectiveDurationMs / circadianAdjustedParTimeMs,
      implicit_confidence: implicitConfidence,
      grade_continuous: gradeContinuous,
      answer_changes: (telemetry?.answer_changes as number | undefined) ?? switches,
      circadian_phase: circadianContext.circadianPhase,
      rapid_guess: isRapidGuess,
      telemetry_quality: telemetryQuality,
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
        const fsrs = new FSRS();
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

        const { card: rawCard } = fsrs.next(currentCard, new Date(), gradeContinuous);
        let modifiedStability = rawCard.stability;
        modifiedStability = applyCircadianModifier(modifiedStability, circadianContext);

        // ── Graduated confidence → stability modifier (replaces old binary threshold) ──
        // Continuous sigmoid function: rewards high confidence, penalizes low.
        // Research: Benjamin et al. (1998) — retrieval fluency predicts future recall.
        //
        // Fluency illusion correction (Kornell & Bjork, 2008):
        // Short review intervals inflate perceived fluency. Dampen confidence
        // when elapsed_days < 1.0 to prevent over-scheduling.
        let adjustedConfidence = implicitConfidence;
        const elapsedDays = typeof currentCard.elapsed_days === 'number'
          ? currentCard.elapsed_days
          : 0;
        adjustedConfidence *= fluencyIllusionDampener(elapsedDays);

        // Apply graduated stability multiplier (sigmoid centered at 0.6)
        modifiedStability *= confidenceStabilityMultiplier(adjustedConfidence);
        // Exam urgency: when an exam is close, tighten review intervals.
        // urgencyMultiplier > 1.0 → stability shrinks → more frequent reviews.
        // Formula: stability /= (1 + (urgency - 1) * 0.3)
        //   urgency 1.0 → no change; urgency 2.0 → stability × 0.77 (23% shorter intervals)
        if (urgencyMultiplier && urgencyMultiplier > 1.0) {
          const urgencyDampener = 1 + (urgencyMultiplier - 1) * 0.3;
          modifiedStability /= urgencyDampener;
        }
        const updatedCard = { ...rawCard, stability: Math.max(0.01, modifiedStability) };

        const rawNextDue = new Date(Date.now() + updatedCard.scheduled_days * 86400000);
        const { due: clampedNextDue } = applyEorClampIfNeeded(rawNextDue, eorRotationEnd ?? null);

        // Capture real FSRS schedule for the API response (use clamped date when in EOR mode)
        fsrsSchedule = {
          intervalDays: updatedCard.scheduled_days,
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
              telemetry: buildReviewLogTelemetry(currentCard),
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
      }
    } catch (confusionError) {
      logger?.warn?.('Failed to record confusion pair', {
        error: confusionError instanceof Error ? confusionError.message : String(confusionError),
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
  };
}
