/**
 * POST /api/questions/attempt
 * Record a question attempt for a user.
 * Updates UserQuestionSeen and QuestionAttempt tables.
 *
 * Single-writer note: For main-session flow, this is the primary writer for QuestionAttempt.
 * When isMainSession is true we also update Rolling 360 here. Submit-review (drillReviewService)
 * reuses an existing attempt if one exists within 5 minutes and skips Rolling 360 to avoid double count.
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { scheduleConceptReview } from '../intelligence/profile';
import { getRolling360Service } from '../../../lib/services/rolling360Service';
import { computeFSRSUpdate } from '../../../lib/services/fsrsScheduleService';
import { Rating } from '../../../lib/fsrs';
import { buildCircadianContext } from '../../../lib/circadian';
import { updateUserProgressWithHistory } from '../../../lib/services/userProgressService';
import { propagateRecallToSiblings } from '../../../lib/services/semanticSiblingService';

const LETTERS = ['A', 'B', 'C', 'D'] as const;
// DEFAULT_PAR_TIME_MS removed — was only used by the FSRS block now in drillReviewService

// normalizeDeprecatedRating removed — FSRS scheduling moved to drillReviewService (Improvement 5)

// normalizeTelemetryMetrics removed — FSRS scheduling moved to drillReviewService (Improvement 5)

const AttemptSchema = z.object({
  body: z.object({
    questionId: z.string().min(1),
    isCorrect: z.boolean().optional(),
    wasCorrect: z.boolean().optional(),
    system: z.string().optional(),
    conditionId: z.string().optional(),
    medicalContentId: z.string().optional(),
    questionType: z.string().optional(),
    mode: z.string().optional().default('session'),
    timeSpent: z.number().optional(),
    timeSpentMs: z.number().optional(),
    answerChangedCount: z.number().optional(),
    isRankedAttempt: z.boolean().optional().default(false),
    selectedAnswer: z
      .union([z.number().int().min(0).max(3), z.enum(['A', 'B', 'C', 'D'])])
      .optional(),
    telemetryJson: z.record(z.string(), z.unknown()).optional(),
    durationMs: z.number().optional(),
    isMainSession: z.boolean().optional().default(false),
    rating: z.number().int().min(1).max(4).optional(),
  }),
});

export const onRequestOptions = withCors();

export const onRequestPost = authenticatedEndpoint(AttemptSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/questions/attempt');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const user = await prisma.user.findUnique({
      where: { clerkId: auth.userId },
      select: { id: true },
    });

    if (!user) {
      return { data: { error: 'User not found', message: 'Account not synced yet.' }, status: 404 };
    }

    const userId = user.id;
    const {
      questionId,
      isCorrect,
      wasCorrect,
      system,
      conditionId,
      medicalContentId,
      questionType,
      mode = 'session',
      timeSpent,
      timeSpentMs,
      answerChangedCount,
      isRankedAttempt = false,
      selectedAnswer: selectedAnswerRaw,
      telemetryJson,
      durationMs,
      isMainSession = false,
      // rating field still accepted by schema for backward compat but no longer used here;
      // FSRS scheduling is handled by drillReviewService (Improvement 5)
    } = validated.body;

    // Support both isCorrect and wasCorrect field names
    const correctness = isCorrect ?? wasCorrect;
    const timeSpentMillis = timeSpentMs ?? timeSpent ?? null;
    const attemptId = `attempt-${userId}-${questionId}-${Date.now()}`;

    const selectedAnswerLetter =
      selectedAnswerRaw === undefined
        ? null
        : typeof selectedAnswerRaw === 'number'
          ? (LETTERS[selectedAnswerRaw] ?? null)
          : selectedAnswerRaw;

    type AttemptResult = { wasCorrect: boolean; system: string | null };
    type TransactionResult = {
      attemptId: string;
      stats: { totalQuestionsAnswered: number; correctAnswers: number; overallAccuracy: number };
      systemStats: {
        system: string;
        totalAttempts: number;
        correctAnswers: number;
        accuracy: number;
      } | null;
    };
    const result = (await prisma.$transaction(async (tx) => {
      // 1. Record attempt (with selectedAnswer, telemetry for Ghost Grader)
      await tx.questionAttempt.create({
        data: {
          id: attemptId,
          userId,
          questionId,
          wasCorrect: correctness,
          system: system ?? null,
          conditionId: conditionId ?? null,
          medicalContentId: medicalContentId ?? null,
          questionType: questionType ?? null,
          mode: mode ?? null,
          isRankedAttempt,
          isMainSession,
          timeSpentMs: timeSpentMillis ?? durationMs ?? null,
          answerChangedCount: answerChangedCount ?? null,
          selectedAnswer: selectedAnswerLetter,
          telemetryJson:
            telemetryJson != null
              ? (JSON.parse(JSON.stringify(telemetryJson)) as object)
              : undefined,
          durationMs: durationMs ?? null,
        },
      });

      // 2. Update UserQuestionSeen
      const qType = questionType || 'question';
      const existingSeen = await tx.userQuestionSeen.findUnique({
        where: { userId_questionId_questionType: { userId, questionId, questionType: qType } },
        select: { avgTimeMs: true, timesShown: true },
      });

      let newAvgTimeMs: number | null = null;
      if (timeSpentMillis && timeSpentMillis > 0) {
        if (existingSeen?.avgTimeMs) {
          const currentCount = existingSeen.timesShown || 1;
          newAvgTimeMs = Math.round(
            (existingSeen.avgTimeMs * (currentCount - 1) + timeSpentMillis) / currentCount
          );
        } else {
          newAvgTimeMs = timeSpentMillis;
        }
      }

      await tx.userQuestionSeen.upsert({
        where: { userId_questionId_questionType: { userId, questionId, questionType: qType } },
        create: {
          userId,
          questionId,
          questionType: qType,
          firstSeenAt: new Date(),
          lastSeenAt: new Date(),
          timesShown: 1,
          timesCorrect: correctness ? 1 : 0,
          timesIncorrect: correctness ? 0 : 1,
          avgTimeMs: timeSpentMillis || null,
        },
        update: {
          lastSeenAt: new Date(),
          timesCorrect: correctness ? { increment: 1 } : undefined,
          timesIncorrect: correctness ? undefined : { increment: 1 },
          avgTimeMs: newAvgTimeMs ?? undefined,
        },
      });

      // 3. Update question statistics (if exists)
      try {
        await tx.question.update({
          where: { id: questionId },
          data: {
            timesSeen: { increment: 1 },
            timesCorrect: correctness ? { increment: 1 } : undefined,
          },
        });
      } catch {
        // Question might not exist in main table (could be pre-generated)
      }

      // 4. Calculate aggregate stats
      const allAttempts = await tx.questionAttempt.findMany({
        where: { userId },
        select: { wasCorrect: true, system: true },
      });

      const totalQuestionsAnswered = allAttempts.length;
      const correctAnswers = allAttempts.filter(
        (a: { wasCorrect: boolean; system: string | null }) => a.wasCorrect
      ).length;
      const overallAccuracy =
        totalQuestionsAnswered > 0
          ? Math.round((correctAnswers / totalQuestionsAnswered) * 100)
          : 0;

      let systemStats = null;
      if (system) {
        const systemAttempts = allAttempts.filter(
          (a: { wasCorrect: boolean; system: string | null }) => a.system === system
        );
        const systemCorrect = systemAttempts.filter(
          (a: { wasCorrect: boolean; system: string | null }) => a.wasCorrect
        ).length;
        systemStats = {
          system,
          totalAttempts: systemAttempts.length,
          correctAnswers: systemCorrect,
          accuracy:
            systemAttempts.length > 0
              ? Math.round((systemCorrect / systemAttempts.length) * 100)
              : 0,
        };
      }

      return {
        attemptId,
        stats: { totalQuestionsAnswered, correctAnswers, overallAccuracy },
        systemStats,
      };
    })) as unknown as TransactionResult;

    // Get detailed system stats
    const detailedSystemStats = system ? await getUserSystemStats(prisma, userId, system) : null;

    // SRS: Schedule concept review (legacy Leitner fallback)
    if (typeof correctness === 'boolean' && (system || conditionId)) {
      try {
        const conceptKey = `${system || 'General'}|${conditionId || questionType || 'unknown'}`;
        await scheduleConceptReview(prisma, userId, conceptKey, correctness);
      } catch (srsErr) {
        logger.warn('SRS scheduleConceptReview failed (non-fatal)', {
          error: srsErr instanceof Error ? srsErr.message : String(srsErr),
        });
      }
    }

    // FSRS v6: Schedule via shared helper (same pipeline as drillReviewService)
    // When conditionId is present and we have a correctness result, derive a binary rating
    // and run the full confidence pipeline through computeFSRSUpdate.
    let nextReviewDate: Date | null = null;

    if (isMainSession && conditionId && typeof correctness === 'boolean') {
      try {
        const rating = correctness ? Rating.Good : Rating.Again;
        const gradeContinuous = correctness ? 3.0 : 1.0;
        const implicitConfidence = correctness ? 0.7 : 0.3;
        const effectiveDurationMs = timeSpentMillis ?? 30000;

        const circadianContext = buildCircadianContext({});

        const fsrsResult = await computeFSRSUpdate(prisma, {
          userId,
          questionId,
          conditionId,
          system,
          rating,
          gradeContinuous,
          implicitConfidence,
          isCorrect: correctness,
          effectiveDurationMs,
          circadianContext,
          telemetry: telemetryJson as Record<string, unknown> | undefined,
        }, logger);

        // ── Transactional core writes: ReviewLog + UserProgress + UserTopicProgress ──
        await prisma.$transaction(async (tx: any) => {
          await tx.reviewLog.create({
            data: {
              userId,
              conditionId,
              medicalContentId: medicalContentId ?? undefined,
              questionId,
              questionType: questionType ?? 'pre_generated',
              grade: rating,
              grade_continuous: gradeContinuous,
              state: fsrsResult.previousCard.state,
              stability: fsrsResult.previousCard.stability,
              difficulty: fsrsResult.previousCard.difficulty,
              retrievability: fsrsResult.retrievability,
              implicit_confidence: implicitConfidence,
              scheduledAt: new Date(
                fsrsResult.previousCard.last_review.getTime()
                + fsrsResult.previousCard.scheduled_days * 86400000
              ),
              reviewedAt: new Date(),
              responseTimeMs: effectiveDurationMs,
              review_type: 'real',
              elapsedDays: fsrsResult.previousCard.elapsed_days,
              wasCorrect: correctness,
              sessionType: isMainSession ? 'MAIN' : 'DRILL',
              attemptId: result.attemptId,
              system: system ?? undefined,
              telemetry: {
                ...(telemetryJson ?? {}),
                server_computed: {
                  source: 'attempt_endpoint',
                  implicit_confidence: implicitConfidence,
                  grade_continuous: gradeContinuous,
                  par_time_ms: 30000,
                  is_rapid_guess: false,
                },
                confidence_pipeline_v3: fsrsResult.confidenceTelemetry,
              },
            },
          });

          await updateUserProgressWithHistory(tx, {
            userId,
            conditionId,
            fsrsCard: fsrsResult.updatedCard,
            rating,
            accuracy: correctness ? 1.0 : 0.0,
          });

          const taskType = questionType === 'diagnosis' ? 'diagnosis' : (questionType ?? 'diagnosis');
          await tx.userTopicProgress.upsert({
            where: {
              userId_conditionId_taskType: { userId, conditionId, taskType },
            },
            create: {
              userId,
              conditionId,
              taskType,
              stability: fsrsResult.updatedCard.stability,
              difficulty: fsrsResult.updatedCard.difficulty,
              state: fsrsResult.updatedCard.state,
              reps: fsrsResult.updatedCard.reps,
              lapses: fsrsResult.updatedCard.lapses,
              lastReviewDate: new Date(),
              nextReviewDate: fsrsResult.clampedNextDue,
            },
            update: {
              stability: fsrsResult.updatedCard.stability,
              difficulty: fsrsResult.updatedCard.difficulty,
              state: fsrsResult.updatedCard.state,
              reps: fsrsResult.updatedCard.reps,
              lapses: fsrsResult.updatedCard.lapses,
              lastReviewDate: new Date(),
              nextReviewDate: fsrsResult.clampedNextDue,
            },
          });
        }, { timeout: 10000 });

        // Card dual-write (non-blocking)
        try {
          await prisma.card.upsert({
            where: { userId_questionId: { userId, questionId } },
            create: {
              id: `${userId}_${questionId}`,
              userId,
              questionId,
              due: fsrsResult.clampedNextDue,
              stability: fsrsResult.updatedCard.stability,
              difficulty: fsrsResult.updatedCard.difficulty,
              elapsed_days: fsrsResult.updatedCard.elapsed_days,
              scheduled_days: fsrsResult.updatedCard.scheduled_days,
              reps: fsrsResult.updatedCard.reps,
              lapses: fsrsResult.updatedCard.lapses,
              state: fsrsResult.updatedCard.state,
              last_review: new Date(),
            },
            update: {
              due: fsrsResult.clampedNextDue,
              stability: fsrsResult.updatedCard.stability,
              difficulty: fsrsResult.updatedCard.difficulty,
              elapsed_days: fsrsResult.updatedCard.elapsed_days,
              scheduled_days: fsrsResult.updatedCard.scheduled_days,
              reps: fsrsResult.updatedCard.reps,
              lapses: fsrsResult.updatedCard.lapses,
              state: fsrsResult.updatedCard.state,
              last_review: new Date(),
              updatedAt: new Date(),
            },
          });
        } catch (cardErr) {
          logger.warn('Card dual-write failed (non-fatal)', {
            error: cardErr instanceof Error ? cardErr.message : String(cardErr),
          });
        }

        // Sibling propagation (non-blocking)
        try {
          await propagateRecallToSiblings(conditionId, rating);
        } catch (sibErr) {
          logger.warn('Sibling propagation failed (non-fatal)', {
            error: sibErr instanceof Error ? sibErr.message : String(sibErr),
          });
        }

        nextReviewDate = fsrsResult.clampedNextDue;
      } catch (fsrsErr) {
        logger.warn('FSRS scheduling via shared helper failed (non-fatal)', {
          error: fsrsErr instanceof Error ? fsrsErr.message : String(fsrsErr),
        });
      }
    }

    // Rolling 360: update circular buffer and stats for main-session attempts
    if (isMainSession && typeof correctness === 'boolean') {
      try {
        const systemFor360 = system ?? (await getQuestionSystem(prisma, questionId));
        await getRolling360Service(prisma).updateRolling360OnSubmit({
          attemptId: result.attemptId,
          userId,
          isCorrect: correctness,
          system: systemFor360,
          answeredAt: new Date(),
        });
      } catch (r360Err) {
        logger.warn('Rolling 360 update failed (non-fatal)', {
          error: r360Err instanceof Error ? r360Err.message : String(r360Err),
        });
      }
    }


    logger.info('Attempt recorded', { userId: auth.userId, questionId, correctness });

    return {
      data: {
        success: true,
        attemptId: result.attemptId,
        stats: result.stats,
        systemStats: detailedSystemStats || result.systemStats,
        ...(nextReviewDate && { nextReviewDate: nextReviewDate.toISOString() }),
      },
    };
  } catch (error) {
    logger.error('Error recording attempt', {
      error: error instanceof Error ? error.message : String(error),
      userId: auth.userId,
    });
    throw new Error('Failed to record attempt');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});

async function getQuestionSystem(
  prisma: ReturnType<typeof createEdgePrismaClient>,
  questionId: string
): Promise<string> {
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    select: { system: true },
  });
  if (question?.system) return question.system;
  const preGenerated = await prisma.preGeneratedQuestion.findUnique({
    where: { id: questionId },
    select: { system: true },
  });
  return preGenerated?.system ?? 'Unknown';
}

async function getUserSystemStats(
  prisma: ReturnType<typeof createEdgePrismaClient>,
  userId: string,
  system: string
) {
  const attempts = await prisma.questionAttempt.findMany({
    where: { userId, system },
    select: { wasCorrect: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  if (attempts.length === 0) {
    return {
      system,
      totalAttempts: 0,
      correctAttempts: 0,
      accuracy: 0,
      recentTrend: 'neutral' as const,
    };
  }

  const totalAttempts = attempts.length;
  const correctAttempts = attempts.filter(
    (a: { wasCorrect: boolean; createdAt: Date }) => a.wasCorrect
  ).length;
  const accuracy = Math.round((correctAttempts / totalAttempts) * 100);

  const recent10 = attempts.slice(0, 10);
  const previous10 = attempts.slice(10, 20);

  let recentTrend: 'improving' | 'declining' | 'neutral' = 'neutral';
  if (recent10.length >= 5 && previous10.length >= 5) {
    const recentAccuracy =
      recent10.filter((a: { wasCorrect: boolean; createdAt: Date }) => a.wasCorrect).length /
      recent10.length;
    const previousAccuracy =
      previous10.filter((a: { wasCorrect: boolean; createdAt: Date }) => a.wasCorrect).length /
      previous10.length;

    if (recentAccuracy > previousAccuracy + 0.1) recentTrend = 'improving';
    else if (recentAccuracy < previousAccuracy - 0.1) recentTrend = 'declining';
  }

  return { system, totalAttempts, correctAttempts, accuracy, recentTrend };
}
