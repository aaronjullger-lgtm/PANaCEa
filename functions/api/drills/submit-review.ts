import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { authenticatedEndpoint } from '../_shared/middleware';
import { createEndpointLogger } from '../_shared/secureLogger';
import { submitDrillReview } from '../../../lib/services/drillReviewService';
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
  })
  .strict();

// Request validation schema
const DrillSubmitReviewSchema = z.object({
  questionId: z.string().uuid(),
  selectedAnswer: z.union([z.string(), z.number()]),
  timeSpentMs: z.number().int().min(0).max(3600000),
  timeToFirstClick: z.number().int().min(0).optional(),
  answerSwitches: z.number().int().min(0).optional(),
  totalDwellTime: z.number().int().min(0).optional(),
  timezone: z.string().optional(),
  wakeTimeHHMM: z.string().optional(),
  telemetry: TelemetrySchema.optional(),
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
    } = validated;

    if (!env.DATABASE_URL) {
      logger.error('Database not configured');
      return { status: 500, error: 'Database not configured' };
    }

    prisma = createEdgePrismaClient(env.DATABASE_URL);

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

    const question = await prisma.preGeneratedQuestion.findUnique({
      where: { id: questionId },
      select: { id: true, questionData: true, conditionId: true, medicalContentId: true, system: true },
    });

    if (!question) {
      return { status: 404, error: 'Question not found' };
    }

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
      },
      question,
      { info: logger.info.bind(logger), warn: logger.warn.bind(logger) }
    );

    return { data: result };
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
