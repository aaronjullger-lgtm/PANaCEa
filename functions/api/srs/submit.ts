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
import { getEorRotationEnd, applyEorClampIfNeeded } from '../../../lib/fsrs/eorScheduler';
import { getTaskTypeFromContent } from '../../../lib/taskTypes';
import { ensureDueVariant } from '../../../lib/ensureDueVariant';
import {
  analyzeBehaviorGemini,
  type BehaviorTelemetryInput,
} from '../_shared/analyzeBehaviorGemini';
import { buildCircadianContext, applyCircadianModifier } from '../../../lib/circadian';
import { applyHonestRating } from '../../../lib/srs/ghostGrader';

const SRSSubmitSchema = z.object({
  body: z.object({
    srsItemId: z.string().uuid().optional(),
    topicProgressId: z.string().uuid().optional(),
    questionId: z.string().uuid(),
    rating: z.number().int().min(1).max(4), // FSRS Rating: 1=Again, 3=Good (Hard/Easy deprecated)
    gradeContinuous: z.number().min(1).max(4).optional(),
    isCorrect: z.boolean(),
    userAnswer: z.string().optional(),
    timeSpent: z.number().optional(),
    variantId: z.string().uuid().optional(),
    /** For Ghost Grader: use behavior to infer true difficulty */
    attemptId: z.string().optional(),
    telemetry: z.record(z.string(), z.unknown()).optional(),
    /** Exam urgency multiplier (0.5–2.0) from blueprint resolver */
    urgencyMultiplier: z.number().min(0).max(3).optional(),
  }),
});

export const onRequestOptions = withCors();

export const onRequestPost = authenticatedEndpoint(SRSSubmitSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/srs/submit');
  let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;

  try {
    prisma = createEdgePrismaClient(env.DATABASE_URL);

    const {
      srsItemId,
      topicProgressId,
      questionId,
      rating,
      gradeContinuous,
      isCorrect,
      variantId,
      attemptId,
      telemetry,
      urgencyMultiplier,
    } = validated.body;

    // Normalize deprecated ratings: Hard (2) → Again (1), Easy (4) → Good (3)
    const normalizedRating = rating === 2 ? 1 : rating === 4 ? 3 : rating;

    let effectiveRating = gradeContinuous !== undefined ? gradeContinuous : normalizedRating;
    // If effectiveRating is a discrete rating (integer) and deprecated, normalize
    if (effectiveRating === 2) effectiveRating = 1;
    if (effectiveRating === 4) effectiveRating = 3;
    let implicitDifficulty: number | null = null;

    if (telemetry != null || attemptId != null) {
      try {
        let wasCorrect = isCorrect;
        let selectedAnswer: string | undefined;
        let effectiveTelemetry: BehaviorTelemetryInput | undefined = telemetry as
          | BehaviorTelemetryInput
          | undefined;
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
              effectiveTelemetry = (effectiveTelemetry ??
                attempt.telemetryJson) as BehaviorTelemetryInput;
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

    // Get user's database ID and EOR context for time-blocked scheduling
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
      logger.warn('User not found in database', { clerkId: auth.userId.substring(0, 10) });
      return {
        data: { error: 'User not found' },
        status: 404,
      };
    }

    const dbUserId = user.id;

    // Build circadian context (matches drillReviewService pipeline)
    const circadianContext = buildCircadianContext();

    // Apply Ghost Grader to the effective rating (binary: Again/Good only)
    const telemetryData = telemetry as Record<string, unknown> | undefined;
    effectiveRating = applyHonestRating({
      userRating: effectiveRating <= 1.5 ? Rating.Again : effectiveRating >= 2.5 ? Rating.Good : Rating.Again,
      isCorrect,
      oscillations: (telemetryData?.hover_oscillations as number | undefined) ?? 0,
      vignetteRegressions: (telemetryData?.vignette_regressions as number | undefined) ?? 0,
      selectionDriftMs: (telemetryData?.selection_drift_ms as number | null) ?? null,
      tremorScore: (telemetryData?.tremor_score as number | undefined) ?? 0,
    }) === Rating.Again ? 1 : effectiveRating;

    const eorRotationEnd = getEorRotationEnd({
      yearInProgram: user.yearInProgram,
      currentRotation: user.currentRotation,
      eorTestDate: user.eorTestDate?.toISOString() ?? null,
      rotationEndDate: user.rotationEndDate?.toISOString() ?? null,
    });
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
              userId_conditionId_taskType_progressContext: {
                userId: dbUserId,
                conditionId: conditionId,
                taskType: taskType,
                progressContext: 'READINESS',
              },
            },
          });
        }
      }
    }

    const ratingForFsrs = effectiveRating;

    // Update UserTopicProgress (Primary driver for Variants)
    if (topicProgress) {
      const card = topicProgressToCard(topicProgress);
      const scheduled = fsrs.next(card, now, ratingForFsrs);
      reviewState = scheduled.card;
      const { due: clampedDue } = applyEorClampIfNeeded(scheduled.due, eorRotationEnd);
      nextReviewDate = clampedDue;

      let stability = reviewState.stability;
      // Circadian modifier (matches drillReviewService pipeline)
      stability = applyCircadianModifier(stability, circadianContext);
      if (implicitDifficulty != null && implicitDifficulty > 0.5) {
        stability = Math.max(0.1, stability * (1 - implicitDifficulty));
      }
      // Exam urgency: tighten intervals when exam is close
      if (urgencyMultiplier && urgencyMultiplier > 1.0) {
        const urgencyDampener = 1 + (urgencyMultiplier - 1) * 0.3;
        stability = Math.max(0.01, stability / urgencyDampener);
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
      const { due: clampedDue } = applyEorClampIfNeeded(scheduled.due, eorRotationEnd);
      nextReviewDate = clampedDue;

      let stability = reviewState.stability;
      // Circadian modifier (matches drillReviewService pipeline)
      stability = applyCircadianModifier(stability, circadianContext);
      if (implicitDifficulty != null && implicitDifficulty > 0.5) {
        stability = Math.max(0.1, stability * (1 - implicitDifficulty));
      }
      // Exam urgency: tighten intervals when exam is close
      if (urgencyMultiplier && urgencyMultiplier > 1.0) {
        const urgencyDampener = 1 + (urgencyMultiplier - 1) * 0.3;
        stability = Math.max(0.01, stability / urgencyDampener);
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

    // Sync to UserProgress (condition-level source of truth for FSRS)
    if (conditionId && reviewState) {
      try {
        const dbUser = await prisma.user.findUnique({
          where: { clerkId: auth.userId },
          select: { id: true },
        });
        if (dbUser) {
          await prisma.userProgress.upsert({
            where: { userId_conditionId_progressContext: { userId: dbUser.id, conditionId, progressContext: 'READINESS' } },
            create: {
              id: `${dbUser.id}_${conditionId}`,
              userId: dbUser.id,
              conditionId,
              fsrsCard: {
                stability: reviewState.stability,
                difficulty: reviewState.difficulty,
                state: reviewState.state,
                elapsed_days: 0,
                scheduled_days: reviewState.scheduled_days ?? 0,
                reps: reviewState.reps,
                lapses: reviewState.lapses,
                last_review: now.toISOString(),
              },
              // Dual-write scalar FSRS fields for readers that query these directly.
              fsrsStability: reviewState.stability,
              fsrsDifficulty: reviewState.difficulty,
              fsrsState: reviewState.state,
              fsrsReps: reviewState.reps,
              totalAttempts: 1,
              correctCount: isCorrect ? 1 : 0,
              accuracy: isCorrect ? 1.0 : 0.0,
              lastReviewAt: now,
              nextReviewAt: nextReviewDate,
              updatedAt: now,
            },
            update: {
              fsrsCard: {
                stability: reviewState.stability,
                difficulty: reviewState.difficulty,
                state: reviewState.state,
                elapsed_days: 0,
                scheduled_days: reviewState.scheduled_days ?? 0,
                reps: reviewState.reps,
                lapses: reviewState.lapses,
                last_review: now.toISOString(),
              },
              // Dual-write scalar FSRS fields for readers that query these directly.
              fsrsStability: reviewState.stability,
              fsrsDifficulty: reviewState.difficulty,
              fsrsState: reviewState.state,
              fsrsReps: reviewState.reps,
              totalAttempts: { increment: 1 },
              correctCount: isCorrect ? { increment: 1 } : undefined,
              lastReviewAt: now,
              nextReviewAt: nextReviewDate,
              updatedAt: now,
            },
          });
        }
      } catch (e) {
        // Non-fatal: UserTopicProgress is already updated
        logger.warn('UserProgress sync from srs/submit failed', {
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    // Update SRSItem (DEPRECATED — Legacy per-question tracking)
    // TODO: Remove once all frontend callers stop sending srsItemId.
    // UserProgress + UserTopicProgress are the authoritative FSRS stores.
    if (srsItemId) {
      logger.info('SRSItem legacy write (deprecated)', { srsItemId: srsItemId.substring(0, 10) });
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

        const { due: clampedDue } = applyEorClampIfNeeded(scheduled.due, eorRotationEnd);

        await prisma.sRSItem.update({
          where: { id: srsItemId },
          data: {
            lastReviewed: now,
            dueDate: clampedDue,
            repetition: scheduled.card.reps,
            fsrsStability: scheduled.card.stability,
            fsrsDifficulty: scheduled.card.difficulty,
            fsrsState: scheduled.card.state,
          },
        });
      }
    }

    // Variant pre-generation: when a question is answered incorrectly, ensure a sibling variant
    // exists in PreGeneratedQuestion so the Due session can serve a different question for the
    // same concept without waiting for generation at review time.
    // Replaces the old VariantQueueService → QuestionVariant path; now unified under PreGeneratedQuestion.
    if (!isCorrect && conditionId) {
      // Look up the source question to pass its data to the generator
      const preGenSource = await prisma.preGeneratedQuestion.findUnique({
        where: { id: questionId },
        select: {
          id: true,
          conditionId: true,
          system: true,
          difficulty: true,
          questionType: true,
          questionData: true,
        },
      });
      const sourceForVariant = preGenSource ?? (await prisma.question.findUnique({
        where: { id: questionId },
        select: {
          id: true,
          conditionId: true,
          system: true,
          difficulty: true,
          taskType: true,
          vignette: true,
          question: true,
          options: true,
          correctAnswer: true,
          explanation: true,
        },
      }).then((q) =>
        q
          ? {
              id: q.id,
              conditionId: q.conditionId,
              system: q.system,
              difficulty: q.difficulty ?? 'medium',
              questionType: q.taskType ?? 'mcq',
              questionData: {
                question: [q.vignette, q.question].filter(Boolean).join('\n\n') || q.question,
                vignette: q.vignette,
                options: q.options,
                correctAnswer: q.correctAnswer,
                explanation: q.explanation,
              },
            }
          : null
      ));

      if (sourceForVariant) {
        ensureDueVariant(
          prisma,
          {
            id: sourceForVariant.id,
            conditionId: sourceForVariant.conditionId,
            system: sourceForVariant.system,
            difficulty: sourceForVariant.difficulty ?? 'medium',
            questionType: sourceForVariant.questionType ?? 'mcq',
            questionData: sourceForVariant.questionData,
          },
          env.GEMINI_API_KEY as string | undefined,
          { info: logger.info.bind(logger), warn: logger.warn.bind(logger) },
          dbUserId
        ).catch((err: unknown) => {
          logger.warn('srs/submit ensureDueVariant failed (non-fatal)', {
            questionId,
            error: err instanceof Error ? err.message : String(err),
          });
        });
      }
    }

    logger.info('SRS review submitted', {
      userId: dbUserId.substring(0, 10),
      questionId: questionId.substring(0, 10),
      rating,
      isCorrect,
    });

    // Pillar 4: When user rates "Again" (1), suggest re-generation with exaggerated mnemonic (frontend calls POST /api/srs/generate-visual with style: "exaggerated").
    const triggerVisualRegeneration = rating === 1 && (conditionId != null || questionId != null);

    return {
      data: {
        success: true,
        nextReviewDate,
        ...(triggerVisualRegeneration && {
          triggerVisualRegeneration: true,
          questionId: questionId ?? undefined,
          conditionId: conditionId ?? undefined,
          topicProgressId: topicProgress?.id ?? undefined,
          visualRegenerationHint:
            'Call POST /api/srs/generate-visual with front/back (or question text) and style: "exaggerated" for cartoon mnemonic; display with Flip animation.',
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
