/**
 * POST /api/questions/attempt
 * Record a question attempt for a user.
 * Updates UserQuestionSeen and QuestionAttempt tables.
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { scheduleConceptReview } from '../intelligence/profile';

const LETTERS = ['A', 'B', 'C', 'D'] as const;

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

    // SRS: Schedule concept review (Leitner-style: fail +1 day, pass +3 days)
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

    logger.info('Attempt recorded', { userId: auth.userId, questionId, correctness });

    return {
      data: {
        success: true,
        attemptId: result.attemptId,
        stats: result.stats,
        systemStats: detailedSystemStats || result.systemStats,
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
