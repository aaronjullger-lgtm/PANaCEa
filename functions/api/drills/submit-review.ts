import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { authenticateRequest } from '../_shared/auth';
import { authenticatedEndpoint } from '../_shared/middleware';
import { createEndpointLogger } from '../_shared/secureLogger';
import { calculateParTime } from '../../../lib/utils/questionComplexity';
import { updateReviewOutcome } from '../../../lib/services/srsService';
import { FSRS, Rating } from '../../../lib/fsrs';
import { updateUserProgressWithHistory } from '../../../lib/services/userProgressService';
import { CloudflareContext } from '../_shared/types';
import {
  deriveImplicitRating,
  serializeImplicitMetrics,
  type ImplicitBehaviorMetrics,
} from '../../../lib/implicit-metrics';
import {
  buildCircadianContext,
  applyCircadianModifier,
  serializeCircadianContext,
} from '../../../lib/circadian';
import { propagateRecallToSiblings } from '../../../lib/services/semanticSiblingService';
import {
  applyAttemptToUserStatistics,
  updateTimingAggregates,
} from '../../../lib/services/userStatisticsService';
import { z } from 'zod';
import { type TelemetryData, isTelemetryData, detectRapidGuess, type QuestionType } from '../../../types/telemetry';

/**
 * Question data structure from PreGeneratedQuestion.questionData field
 */
interface QuestionData {
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

function findSelectedOption(
  pool:
    | Array<{
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
      }>
    | string[]
    | undefined,
  selectedAnswer: string
) {
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

// Zod schema for TelemetryData (Phase 3: Telemetry Injection)
const TelemetrySchema = z.object({
  duration_ms: z.number().int().min(0),
  time_to_first_interaction_ms: z.number().int().min(0).nullable(),
  rapid_guess: z.boolean(),
  question_type: z.enum(['vignette', 'recall', 'image', 'rapid_recall', 'unknown']),
  mvrt_threshold_ms: z.number().int().min(0),
  question_displayed_at: z.string(),
  answer_submitted_at: z.string(),
  answer_changes: z.number().int().min(0),
  hint_viewed: z.boolean(),
  hint_view_duration_ms: z.number().int().min(0).nullable(),
  interactions: z.array(z.object({
    type: z.enum(['click', 'hover', 'scroll', 'keypress', 'option_select', 'hint_view', 'explanation_expand']),
    timestamp_ms: z.number().int().min(0),
    target: z.string().optional(),
  })).optional(),
  session_id: z.string().optional(),
  device_info: z.object({
    viewport_width: z.number().int().min(0),
    viewport_height: z.number().int().min(0),
    device_pixel_ratio: z.number().min(0),
    is_touch_device: z.boolean(),
    user_agent_short: z.string().optional(),
  }).optional(),
}).strict();

// Define Zod schema for request validation
const DrillSubmitReviewSchema = z.object({
  questionId: z.string().uuid(),
  selectedAnswer: z.union([z.string(), z.number()]),
  timeSpentMs: z.number().int().min(0).max(3600000),
  timeToFirstClick: z.number().int().min(0).optional(),
  answerSwitches: z.number().int().min(0).optional(),
  totalDwellTime: z.number().int().min(0).optional(),
  timezone: z.string().optional(),
  wakeTimeHHMM: z.string().optional(),
  // Phase 3: Behavioral Telemetry (optional - clients can send full telemetry or just basics)
  telemetry: TelemetrySchema.optional(),
});

export const onRequestOptions = async (context: any) => {
  return authenticatedEndpoint(DrillSubmitReviewSchema, async (context) => {
    // This will be handled by the middleware
    return { data: { message: 'Method not allowed' }, status: 405 };
  })(context);
};

export const onRequestPost = authenticatedEndpoint(DrillSubmitReviewSchema, async (context) => {
  const { request, env, auth, validated } = context;
  const logger = createEndpointLogger('/api/drills/submit-review');
  let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;

  try {
    logger.addContext({ userId: auth.userId });

    const {
      questionId,
      selectedAnswer,
      timeSpentMs,
      // Implicit behavior metrics (Phase 2)
      timeToFirstClick,
      answerSwitches,
      totalDwellTime,
      timezone,
      wakeTimeHHMM,
      // Phase 3: Behavioral Telemetry
      telemetry,
    } = validated;

    const normalizedSelectedAnswer =
      typeof selectedAnswer === 'string'
        ? selectedAnswer
        : selectedAnswer != null
          ? String(selectedAnswer)
          : '';

    if (!env.DATABASE_URL) {
      logger.error('Database not configured');
      return { status: 500, error: 'Database not configured' };
    }

    prisma = createEdgePrismaClient(env.DATABASE_URL);

    // Look up user by clerkId to get internal database ID
    const user = await prisma.user.findUnique({
      where: { clerkId: auth.userId },
      select: { id: true },
    });

    if (!user) {
      return {
        status: 404,
        error: 'User not found',
        message: 'Your user account has not been synced yet.',
      };
    }

    const userId = user.id;

    const question = await prisma.preGeneratedQuestion.findUnique({ where: { id: questionId } });

    if (!question) {
      return { status: 404, error: 'Question not found' };
    }

    const qData = (question.questionData as QuestionData) || {};

    let correctAnswer: string | null =
      qData.correctAnswer ?? qData.answer ?? qData.correct_option ?? qData.correctChoice ?? null;

    if (correctAnswer === null && typeof qData.correctIndex === 'number') {
      const pool = Array.isArray(qData.options) ? qData.options : qData.choices;
      if (Array.isArray(pool) && pool[qData.correctIndex]) {
        const candidate = pool[qData.correctIndex];
        if (typeof candidate === 'string') {
          correctAnswer = candidate;
        } else if (typeof candidate === 'object' && candidate !== null) {
          correctAnswer = candidate.value ?? candidate.text ?? candidate.label ?? null;
        }
      }
    }

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
      | Array<{
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
        }>
      | string[]
      | undefined;
    const selectedMeta = findSelectedOption(optionPool, normalizedSelectedAnswer);

    const parTimeMs = calculateParTime({
      ...qData,
      stem: qData.stem || qData.question || qData.vignette || qData.text || '',
      choices: qData.choices || qData.options || [],
    });

    const numericTime = typeof timeSpentMs === 'number' ? timeSpentMs : Number(timeSpentMs) || 0;

    // Build circadian context for time-of-day optimization
    const circadianContext = buildCircadianContext(
      { typicalWakeTime: wakeTimeHHMM }, // UserCircadianPrefs
      timezone || undefined // Override timezone (defaults to browser timezone)
    );

    // Build implicit behavior metrics (Phase 2: Zero-Friction)
    const behaviorMetrics: ImplicitBehaviorMetrics = {
      timeToFirstClick: timeToFirstClick ?? numericTime,
      answerSwitches: answerSwitches ?? 0,
      totalDwellTime: totalDwellTime ?? numericTime,
      isCorrect,
      parTimeMs,
    };

    // Derive rating from implicit behavior instead of buttons
    const implicitResult = deriveImplicitRating(behaviorMetrics);
    const rating = implicitResult.rating;

    // Legacy quality mapping for backward compatibility
    const quality =
      rating === Rating.Again ? 1 : rating === Rating.Hard ? 2 : rating === Rating.Easy ? 5 : 4;

    // Feed into FSRS with dynamic baseline
    const srsResult = updateReviewOutcome(userId, questionId, {
      quality,
      timeToAnswer: numericTime,
      baselineTime: parTimeMs,
    });

    // Update aggregated user statistics for clinical profile
    try {
      await applyAttemptToUserStatistics(prisma as any, userId, {
        system: (question as any).system || (qData as any).system || undefined,
        isCorrect,
        timeSpentMs: numericTime,
        selectedCondition: selectedMeta?.conditionId ?? selectedMeta?.label ?? null,
        correctCondition: question.conditionId ?? null,
        timestamp: new Date(),
      });

      await updateTimingAggregates(prisma as any, userId, { refreshPeakHours: true });
    } catch (statsError) {
      logger.warn('Failed to update user statistics after review', { error: statsError instanceof Error ? statsError.message : String(statsError) });
    }

    // Phase 3: Create QuestionAttempt record with behavioral telemetry
    let questionAttemptId: string | null = null;
    try {
      // Determine effective duration - prefer telemetry if provided, fallback to timeSpentMs
      const effectiveDurationMs = telemetry?.duration_ms ?? numericTime;
      
      // Check for rapid guess using telemetry data or fallback detection
      const isRapidGuess = telemetry?.rapid_guess ?? (numericTime < 1500);
      
      const attemptRecord = await prisma.questionAttempt.create({
        data: {
          userId,
          questionId,
          selectedAnswer: normalizedSelectedAnswer,
          isCorrect,
          // Phase 3: Behavioral telemetry fields
          durationMs: effectiveDurationMs,
          telemetryJson: telemetry ? {
            ...telemetry,
            // Add server-side computed fields
            server_computed: {
              par_time_ms: parTimeMs,
              latency_ratio: effectiveDurationMs / parTimeMs,
              implicit_rating: rating,
              implicit_confidence: implicitResult.confidence,
              circadian_phase: circadianContext.circadianPhase,
              is_rapid_guess: isRapidGuess,
            },
          } : {
            // Minimal telemetry when client doesn't send full data
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
      questionAttemptId = attemptRecord.id;
      
      // Log rapid guess detection for analytics
      if (isRapidGuess) {
        logger.info(`Rapid guess detected: questionId=${questionId}, duration=${effectiveDurationMs}ms, threshold=${telemetry?.mvrt_threshold_ms ?? 2000}ms`);
      }
    } catch (attemptError) {
      // Don't fail the request if QuestionAttempt creation fails
      logger.warn('Failed to create QuestionAttempt record:', { error: attemptError instanceof Error ? attemptError.message : String(attemptError) });
    }

    // If question has conditionId, also update UserProgress with review history
    if (question.conditionId) {
      try {
        // Get or create FSRS card for this condition
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
          elapsed_days:
            typeof fsrsCardData.elapsed_days === 'number' ? fsrsCardData.elapsed_days : 0,
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

        // Apply circadian modifier to stability
        const modifiedStability = applyCircadianModifier(rawCard.stability, circadianContext);

        const updatedCard = {
          ...rawCard,
          stability: modifiedStability,
        };

        await updateUserProgressWithHistory(prisma, {
          userId,
          conditionId: question.conditionId,
          fsrsCard: updatedCard,
          rating,
          accuracy: isCorrect ? 1.0 : 0.0,
        });

        // Propagate recall to semantic siblings (Phase 2: KAR3L)
        try {
          const siblingBoosts = await propagateRecallToSiblings(question.conditionId, rating);
        // Store boost records for future application (logged for now)
        if (siblingBoosts.length > 0) {
          logger.info(
            `KAR3L: Propagated ${rating === Rating.Again ? 'penalty' : 'boost'} to ${siblingBoosts.length} siblings of ${question.conditionId}`
          );
        }
        } catch (siblingError) {
          // Don't fail if sibling propagation fails
          logger.warn('KAR3L propagation error:', { error: siblingError instanceof Error ? siblingError.message : String(siblingError) });
        }
      } catch (progressError) {
        logger.warn('Failed to update UserProgress:', { error: progressError instanceof Error ? progressError.message : String(progressError) });
        // Don't fail the entire request if progress update fails
      }
    }

    // Record confusion pairs when the user answers incorrectly
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
            ? prisma!.medicalContent.findFirst({
                where: { OR: correctWhere },
                select: { id: true, condition: true, conditionId: true },
              })
            : null,
          selectedWhere.length
            ? prisma!.medicalContent.findFirst({
                where: { OR: selectedWhere },
                select: { id: true, condition: true, conditionId: true },
              })
            : null,
        ]);

        if (correctContent && selectedContent && correctContent.id !== selectedContent.id) {
          await prisma!.confusionPair.upsert({
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
        logger.warn('Failed to record confusion pair', { error: confusionError instanceof Error ? confusionError.message : String(confusionError) });
      }
    }

    return {
      data: {
        success: true,
        isCorrect,
        quality,
        parTimeMs,
        timeSpentMs: numericTime,
        // Phase 2: Zero-Friction metrics
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
      },
    };
  } catch (error: any) {
    logger.error('submit-review error:', error);
    return { status: 500, error: 'Failed to submit review', details: error?.message };
  } finally {
    if (prisma) {
      await safePrismaDisconnect(prisma);
    }
  }
});