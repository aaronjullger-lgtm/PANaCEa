import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { authenticatedEndpoint } from '../_shared/middleware';
import { createEndpointLogger } from '../_shared/secureLogger';
import { submitDrillReview } from '../../../lib/services/drillReviewService';
import { getEorRotationEnd } from '../../../lib/fsrs/eorScheduler';
import { scheduleConceptReview } from '../intelligence/profile';
import { ensureDueVariant } from '../../../lib/ensureDueVariant';
import { resolveReviewQuestion } from './_shared/reviewQuestionResolver';
import { z } from 'zod';

// Zod schema for TelemetryData (Phase 3: Telemetry Injection)
const TelemetrySchema = z
  .object({
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
    interactions: z
      .array(
        z.object({
          type: z.enum([
            'click',
            'hover',
            'scroll',
            'keypress',
            'option_select',
            'hint_view',
            'explanation_expand',
          ]),
          timestamp_ms: z.number().int().min(0),
          target: z.string().optional(),
        })
      )
      .optional(),
    session_id: z.string().optional(),
    device_info: z
      .object({
        viewport_width: z.number().int().min(0),
        viewport_height: z.number().int().min(0),
        device_pixel_ratio: z.number().min(0),
        is_touch_device: z.boolean(),
        user_agent_short: z.string().optional(),
      })
      .optional(),
    /** Ghost Grader: hover oscillations (A→B→A revisits) */
    hover_oscillations: z.number().int().min(0).optional(),
    /** Ghost Grader: vignette regressions (scroll direction changes after reveal) */
    vignette_regressions: z.number().int().min(0).optional(),
    /** Ghost Grader: selection drift (ms from selection to submit) */
    selection_drift_ms: z.number().int().min(0).optional(),
    /** Ghost Grader: mouse tremor score 0-1 */
    tremor_score: z.number().min(0).max(1).optional(),
    /** Ghost Grader: cursor entropy (movement randomness) */
    cursor_entropy: z.number().min(0).optional(),
    /** Elimination velocity (eliminations per second) */
    elimination_velocity: z.number().min(0).optional(),
    /** Trajectory metrics from micro-kinetics (distractorHovers, etc.) */
    trajectory_metrics: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

// Request validation schema
export const DrillSubmitReviewSchema = z.object({
  // Accept UUID and ephemeral/generated IDs so resolver can handle pool/main/attempt-backed questions.
  questionId: z.string().min(1),
  selectedAnswer: z.union([z.string(), z.number()]),
  timeSpentMs: z.number().int().min(0).max(3600000),
  timeToFirstClick: z.number().int().min(0).optional(),
  answerSwitches: z.number().int().min(0).optional(),
  totalDwellTime: z.number().int().min(0).optional(),
  timezone: z.string().optional(),
  wakeTimeHHMM: z.string().optional(),
  telemetry: TelemetrySchema.optional(),
  /** When 'main' or omitted, review is counted for FSRS (UserProgress.reviewHistory). When 'cram' or 'rapid_recall', FSRS is not updated and Card/UserTopicProgress are not modified. */
  sessionType: z.enum(['main', 'cram', 'rapid_recall']).optional(),
});

export const onRequestOptions = async (context: any) => {
  return authenticatedEndpoint(DrillSubmitReviewSchema, async () => ({
    data: { message: 'Method not allowed' },
    status: 405,
  }))(context);
};

export const onRequestPost = authenticatedEndpoint(DrillSubmitReviewSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/drills/submit-review');
  let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;

  try {
    logger.addContext({ userId: auth.userId });

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
      sessionType,
    } = validated;

    if (!env.DATABASE_URL) {
      logger.error('Database not configured');
      return { status: 500, error: 'Database not configured' };
    }

    prisma = createEdgePrismaClient(env.DATABASE_URL);

    const user = await prisma.user.findUnique({
      where: { clerkId: auth.userId },
      select: {
        id: true,
        yearInProgram: true,
        currentRotation: true,
        eorTestDate: true,
        rotationEndDate: true,
      },
    });

    if (!user) {
      return {
        status: 404,
        error: 'User not found',
        message: 'Your user account has not been synced yet.',
      };
    }

    const normalizedSelectedAnswer =
      typeof selectedAnswer === 'string' ? selectedAnswer : String(selectedAnswer);
    const { question } = await resolveReviewQuestion(prisma, {
      userId: user.id,
      questionId,
      selectedAnswer: normalizedSelectedAnswer,
    });

    if (!question) {
      return { status: 404, error: 'Question not found' };
    }

    const eorRotationEnd = getEorRotationEnd({
      yearInProgram: user.yearInProgram,
      currentRotation: user.currentRotation,
      eorTestDate: user.eorTestDate?.toISOString() ?? null,
      rotationEndDate: user.rotationEndDate?.toISOString() ?? null,
    });

    const result = await submitDrillReview(
      prisma,
      user.id,
      {
        questionId,
        selectedAnswer,
        timeSpentMs,
        timeToFirstClick,
        answerSwitches,
        totalDwellTime,
        timezone,
        wakeTimeHHMM,
        telemetry,
        sessionType,
      },
      question,
      { info: logger.info.bind(logger), warn: logger.warn.bind(logger) },
      eorRotationEnd
    );

    // SRS: Schedule concept review (Leitner-style: fail +1 day, pass +3 days)
    if (typeof result.isCorrect === 'boolean') {
      try {
        const conceptKey = `${question.system || 'General'}|${question.conditionId || questionId}`;
        await scheduleConceptReview(prisma, user.id, conceptKey, result.isCorrect);
      } catch (error_) {
        logger.warn('SRS scheduleConceptReview failed (non-fatal)', {
          error: error_ instanceof Error ? error_.message : String(error_),
        });
      }
      // When incorrect: ensure a due variant exists (sibling or generate+store) so Due session never waits
      if (result.isCorrect === false) {
        ensureDueVariant(
          prisma,
          {
            id: question.id,
            conditionId: question.conditionId,
            system: question.system,
            difficulty: question.difficulty ?? 'medium',
            questionType: question.questionType ?? 'mcq',
            questionData: question.questionData,
          },
          env.GEMINI_API_KEY as string | undefined,
          { info: logger.info.bind(logger), warn: logger.warn.bind(logger) }
        ).catch(() => {});
      }
    }

    // Extract frontend feedback: rapid_guess and nextReview from result
    const isRapidGuess = telemetry?.rapid_guess ?? false;
    const nextReview = result.fsrsSchedule
      ? {
          intervalDays: result.fsrsSchedule.intervalDays,
          nextDueDate: result.fsrsSchedule.nextDueDate,
          stability: result.fsrsSchedule.stability,
          difficulty: result.fsrsSchedule.difficulty,
        }
      : null;

    return {
      data: {
        ...result,
        isRapidGuess,
        nextReview,
      },
    };
  } catch (error: unknown) {
    logger.error('submit-review error:', error);
    return {
      status: 500,
      error: 'Failed to submit review',
      details: error instanceof Error ? error.message : String(error),
    };
  } finally {
    if (prisma) {
      await safePrismaDisconnect(prisma);
    }
  }
});
