/**
 * SRS Submit Review API
 * POST /api/srs/submit
 *
 * Submit SRS review with FSRS v5 scheduling updates
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import {
  FSRS,
  Rating,
  createReviewSnapshot,
  topicProgressToCard,
  FSRSState,
  FSRSCard,
} from '../../../lib/fsrs';
import { VariantQueueService } from '../../../services/core/variantQueueService';
import { getTaskTypeFromContent } from '../../../lib/taskTypes';
import { analyzeBehaviorGemini, type BehaviorTelemetryInput } from '../_shared/analyzeBehaviorGemini';

const SRSSubmitSchema = z.object({
  body: z.object({
    srsItemId: z.string().uuid().optional(),
    topicProgressId: z.string().uuid().optional(),
    questionId: z.string().uuid(),
    rating: z.number().int().min(1).max(4), // FSRS Rating: 1=Again, 2=Hard, 3=Good, 4=Easy
    isCorrect: z.boolean(),
    userAnswer: z.string().optional(),
    timeSpent: z.number().optional(),
    variantId: z.string().uuid().optional(),
    /** For Ghost Grader: use behavior to infer true difficulty */
    attemptId: z.string().optional(),
    telemetry: z.record(z.string(), z.unknown()).optional(),
  }),
});

export const onRequestOptions = withCors();

export const onRequestPost = authenticatedEndpoint(SRSSubmitSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/srs/submit');
  let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;

  try {
    prisma = createEdgePrismaClient(env.DATABASE_URL);

    const { srsItemId, topicProgressId, questionId, rating, isCorrect, variantId, attemptId, telemetry } =
      validated.body;

    let effectiveRating = rating;
    let implicitDifficulty: number | null = null;

    if (telemetry != null || attemptId != null) {
      try {
        let wasCorrect = isCorrect;
        let selectedAnswer: string | undefined;
        let effectiveTelemetry: BehaviorTelemetryInput | undefined = telemetry as BehaviorTelemetryInput | undefined;
        if (attemptId && env.DATABASE_URL) {
          const prismaForAttempt = createEdgePrismaClient(env.DATABASE_URL);
          const attempt = await prismaForAttempt.questionAttempt.findFirst({
            where: { id: attemptId },
            select: { wasCorrect: true, selectedAnswer: true, telemetryJson: true },
          });
          if (attempt) {
            wasCorrect = attempt.wasCorrect;
            selectedAnswer = attempt.selectedAnswer ?? undefined;
            if (attempt.telemetryJson && typeof attempt.telemetryJson === 'object')
              effectiveTelemetry = (effectiveTelemetry ?? attempt.telemetryJson) as BehaviorTelemetryInput;
          }
          await safePrismaDisconnect(prismaForAttempt);
        }
        if (effectiveTelemetry != null) {
          const behavior = await analyzeBehaviorGemini(env, {
            rating,
            wasCorrect,
            selectedAnswer,
            telemetry: effectiveTelemetry,
          });
          effectiveRating = behavior.impliedRating;
          implicitDifficulty = 1 - behavior.confidence;
        }
      } catch (e) {
        logger.warn('Ghost Grader failed (using user rating)', {
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    // Get user's database ID
    const user = await prisma.user.findUnique({
      where: { clerkId: auth.userId },
      select: { id: true },
    });

    if (!user) {
      logger.warn('User not found in database', { clerkId: auth.userId.substring(0, 10) });
      return {
        data: { error: 'User not found' },
        status: 404,
      };
    }

    const dbUserId = user.id;
    const fsrs = new FSRS();
    const now = new Date();

    let nextReviewDate: Date = new Date(); // Default to now, will be updated by FSRS
    let reviewState: any;
    let conditionId: string | null = null;
    let taskType: string | null = null;
    let topicProgress = null;

    // Determine condition and task type
    if (topicProgressId) {
      topicProgress = await prisma.userTopicProgress.findUnique({
        where: { id: topicProgressId },
      });
      if (topicProgress) {
        conditionId = topicProgress.conditionId;
        taskType = topicProgress.taskType;
      }
    } else if (questionId) {
      const question = await prisma.question.findUnique({ where: { id: questionId } });
      if (question) {
        conditionId = question.conditionId;
        taskType = getTaskTypeFromContent(question.question);

        if (conditionId && taskType) {
          topicProgress = await prisma.userTopicProgress.findUnique({
            where: {
              userId_conditionId_taskType: {
                userId: dbUserId,
                conditionId: conditionId,
                taskType: taskType,
              },
            },
          });
        }
      }
    }

    const ratingForFsrs = effectiveRating as 1 | 2 | 3 | 4;

    // Update UserTopicProgress (Primary driver for Variants)
    if (topicProgress) {
      const card = topicProgressToCard(topicProgress);
      const scheduled = fsrs.next(card, now, ratingForFsrs);
      reviewState = scheduled.card;
      nextReviewDate = scheduled.due;

      let stability = reviewState.stability;
      if (implicitDifficulty != null && implicitDifficulty > 0.5) {
        stability = Math.max(0.1, stability * (1 - implicitDifficulty));
      }

      await prisma.userTopicProgress.update({
        where: { id: topicProgress.id },
        data: {
          stability,
          difficulty: reviewState.difficulty,
          state: reviewState.state,
          reps: reviewState.reps,
          lapses: reviewState.lapses,
          lastReviewDate: now,
          nextReviewDate: nextReviewDate,
          implicitDifficulty: implicitDifficulty ?? undefined,
        },
      });
    } else if (conditionId && taskType) {
      const emptyCard = fsrs.createEmptyCard();
      const scheduled = fsrs.next(emptyCard, now, ratingForFsrs);
      reviewState = scheduled.card;
      nextReviewDate = scheduled.due;

      let stability = reviewState.stability;
      if (implicitDifficulty != null && implicitDifficulty > 0.5) {
        stability = Math.max(0.1, stability * (1 - implicitDifficulty));
      }

      await prisma.userTopicProgress.create({
        data: {
          userId: dbUserId,
          conditionId: conditionId,
          taskType: taskType,
          stability,
          difficulty: reviewState.difficulty,
          state: reviewState.state,
          reps: reviewState.reps,
          lapses: reviewState.lapses,
          lastReviewDate: now,
          nextReviewDate: nextReviewDate,
          implicitDifficulty: implicitDifficulty ?? undefined,
        },
      });
    }

    // Update SRSItem (Legacy/Specific Question tracking)
    if (srsItemId) {
      const item = await prisma.sRSItem.findUnique({ where: { id: srsItemId } });
      if (item) {
        const card: FSRSCard = {
          stability: item.fsrsStability || 0,
          difficulty: item.fsrsDifficulty || 0,
          state: (item.fsrsState as FSRSState) || FSRSState.New,
          reps: item.repetition,
          lapses: 0,
          last_review: item.lastReviewed,
          elapsed_days: (now.getTime() - item.lastReviewed.getTime()) / 86400000,
          scheduled_days: 0,
        };

        const scheduled = fsrs.next(card, now, ratingForFsrs);

        await prisma.sRSItem.update({
          where: { id: srsItemId },
          data: {
            lastReviewed: now,
            dueDate: scheduled.due,
            repetition: scheduled.card.reps,
            fsrsStability: scheduled.card.stability,
            fsrsDifficulty: scheduled.card.difficulty,
            fsrsState: scheduled.card.state,
          },
        });
      }
    }

    // Variant Queue Logic
    let queuedVariantId = null;
    if (!isCorrect && conditionId && taskType) {
      const queueService = new VariantQueueService(prisma as any, env.GEMINI_API_KEY);
      queuedVariantId = await queueService.queueVariantForReview(dbUserId, questionId, taskType);
    }

    // Mark variant as used
    if (variantId && questionId) {
      await prisma.questionVariant.update({
        where: { id: variantId },
        data: {
          usedByUsers: { push: dbUserId },
        },
      });
    }

    logger.info('SRS review submitted', {
      userId: dbUserId.substring(0, 10),
      questionId: questionId.substring(0, 10),
      rating,
      isCorrect,
      queuedVariant: !!queuedVariantId,
    });

    // Pillar 4: When user rates "Hard" (1), suggest re-generation with exaggerated mnemonic (frontend calls POST /api/srs/generate-visual with style: "exaggerated").
    const triggerVisualRegeneration = rating === 1 && (conditionId != null || questionId != null);

    return {
      data: {
        success: true,
        nextReviewDate,
        queuedVariantId,
        ...(triggerVisualRegeneration && {
          triggerVisualRegeneration: true,
          questionId: questionId ?? undefined,
          conditionId: conditionId ?? undefined,
          topicProgressId: topicProgress?.id ?? undefined,
          visualRegenerationHint: 'Call POST /api/srs/generate-visual with front/back (or question text) and style: "exaggerated" for cartoon mnemonic; display with Flip animation.',
        }),
      },
    };
  } catch (error) {
    logger.error('SRS submit error', {
      error: error instanceof Error ? error.message : String(error),
      userId: auth.userId.substring(0, 10),
    });
    throw new Error('Failed to submit SRS review');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
