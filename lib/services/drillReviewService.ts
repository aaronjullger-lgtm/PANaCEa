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

import type { PrismaClient } from '@prisma/client';
import { calculateParTime } from '../utils/questionComplexity';
import { updateReviewOutcome } from './srsService';
import { FSRS, Rating } from '../fsrs';
import { updateUserProgressWithHistory } from './userProgressService';
import type { ImplicitBehaviorMetrics } from '../implicit-metrics';
import { deriveImplicitRating } from '../implicit-metrics';
import { buildCircadianContext, applyCircadianModifier } from '../circadian';
import { propagateRecallToSiblings } from './semanticSiblingService';
import { applyAttemptToUserStatistics, updateTimingAggregates } from './userStatisticsService';

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
    confidence: number;
    latencyRatio: number;
    answerSwitches: number;
  };
  circadian: {
    phase: string;
    stabilityModifier: number;
    localHour: number;
  };
}

/** Optional logger for service-level events (e.g. KAR3L, rapid guess) */
export interface DrillReviewLogger {
  info?(msg: string, data?: Record<string, unknown>): void;
  warn?(msg: string, data?: Record<string, unknown>): void;
}

/**
 * Submit a drill review: process answer, update FSRS, record telemetry, update progress.
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
  logger?: DrillReviewLogger
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

  const parTimeMs = calculateParTime({
    ...qData,
    stem: qData.stem || qData.question || qData.vignette || qData.text || '',
    choices: qData.choices || qData.options || [],
  });

  const numericTime = typeof timeSpentMs === 'number' ? timeSpentMs : Number(timeSpentMs) || 0;

  const circadianContext = buildCircadianContext(
    { typicalWakeTime: wakeTimeHHMM },
    timezone || undefined
  );

  const behaviorMetrics: ImplicitBehaviorMetrics = {
    timeToFirstClick: timeToFirstClick ?? numericTime,
    answerSwitches: answerSwitches ?? 0,
    totalDwellTime: totalDwellTime ?? numericTime,
    isCorrect,
    parTimeMs,
  };

  const implicitResult = deriveImplicitRating(behaviorMetrics);
  const rating = implicitResult.rating;

  const quality =
    rating === Rating.Again ? 1 : rating === Rating.Hard ? 2 : rating === Rating.Easy ? 5 : 4;

  updateReviewOutcome(userId, questionId, {
    quality,
    timeToAnswer: numericTime,
    baselineTime: parTimeMs,
  });

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
  const isRapidGuess = telemetry?.rapid_guess ?? numericTime < 1500;

  try {
    await prisma.questionAttempt.create({
      data: {
        userId,
        questionId,
        selectedAnswer: normalizedSelectedAnswer,
        wasCorrect: isCorrect,
        durationMs: effectiveDurationMs,
        telemetryJson: telemetry
          ? {
              ...telemetry,
              server_computed: {
                par_time_ms: parTimeMs,
                latency_ratio: effectiveDurationMs / parTimeMs,
                implicit_rating: rating,
                implicit_confidence: implicitResult.confidence,
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
                latency_ratio: numericTime / parTimeMs,
                implicit_rating: rating,
                implicit_confidence: implicitResult.confidence,
                circadian_phase: circadianContext.circadianPhase,
                is_rapid_guess: isRapidGuess,
              },
            },
      },
    });
    if (isRapidGuess) {
      logger?.info?.('Rapid guess detected', {
        questionId,
        duration: effectiveDurationMs,
        threshold: telemetry?.mvrt_threshold_ms ?? 2000,
      });
    }
  } catch (attemptError) {
    logger?.warn?.('Failed to create QuestionAttempt record', {
      error: attemptError instanceof Error ? attemptError.message : String(attemptError),
    });
  }

  if (question.conditionId) {
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

      const { card: rawCard } = fsrs.next(currentCard, new Date(), rating);
      const modifiedStability = applyCircadianModifier(rawCard.stability, circadianContext);
      const updatedCard = { ...rawCard, stability: modifiedStability };

      await updateUserProgressWithHistory(prisma, {
        userId,
        conditionId: question.conditionId,
        fsrsCard: updatedCard,
        rating,
        accuracy: isCorrect ? 1.0 : 0.0,
      });

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
      logger?.warn?.('Failed to update UserProgress', {
        error: progressError instanceof Error ? progressError.message : String(progressError),
      });
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
      confidence: implicitResult.confidence,
      latencyRatio: numericTime / parTimeMs,
      answerSwitches: answerSwitches ?? 0,
    },
    circadian: {
      phase: circadianContext.circadianPhase,
      stabilityModifier: circadianContext.stabilityModifier,
      localHour: circadianContext.localHour,
    },
  };
}
