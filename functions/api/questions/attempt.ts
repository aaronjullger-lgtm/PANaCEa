/**
 * POST /api/questions/attempt
 * Record a question attempt for a user.
 * Updates UserQuestionSeen and QuestionAttempt tables.
 *
 * Single-writer note (Sprint 2): This endpoint records QuestionAttempt + UserQuestionSeen + stats ONLY.
 * All FSRS writes (ReviewLog, UserProgress, Card, UserTopicProgress, sibling propagation) and Rolling 360
 * updates go through drillReviewService via the queueReview → POST /api/drills/submit-review path.
 *
 * This endpoint still accepts isMainSession and rating for backward compat with stale offline answers
 * draining from localStorage (24h TTL), but does NOT use them for FSRS or Rolling 360.
 */

import { z } from 'zod';
import { authenticatedEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { scheduleConceptReview } from '../ai/learning/profile-crud';

import { ANSWER_LETTERS } from '../../../lib/answerLetterMap';

// Shared schema — single source of truth for this endpoint's request contract.
// To change the /api/questions/attempt contract, edit lib/api/schemas/questions.ts.
import { QuestionAttemptRequestSchema } from '../../../lib/api/schemas/questions';
const AttemptSchema = z.object({ body: QuestionAttemptRequestSchema });

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
    } = validated.body;

    // Support both isCorrect and wasCorrect field names
    const correctness = isCorrect ?? wasCorrect;
    const timeSpentMillis = timeSpentMs ?? timeSpent ?? null;
    const attemptId = `attempt-${userId}-${questionId}-${Date.now()}`;

    const selectedAnswerLetter =
      selectedAnswerRaw === undefined
        ? null
        : typeof selectedAnswerRaw === 'number'
          ? (ANSWER_LETTERS[selectedAnswerRaw] ?? null)
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
      // FIX (Audit 8/F2): Replaced O(N) findMany + JS aggregation with a single
      // SQL COUNT query. The old approach loaded every attempt the user ever made
      // into memory on each submission — O(total_attempts) per answer, guaranteed
      // to timeout at scale. This is now O(1) regardless of history length.
      type AggRow = { total: bigint; correct: bigint };
      const [agg] = await tx.$queryRaw<AggRow[]>`
        SELECT
          COUNT(*)                                                AS total,
          SUM(CASE WHEN "wasCorrect" = true THEN 1 ELSE 0 END)  AS correct
        FROM "QuestionAttempt"
        WHERE "userId" = ${userId}
      `;

      const totalQuestionsAnswered = Number(agg?.total ?? 0);
      const correctAnswers = Number(agg?.correct ?? 0);
      const overallAccuracy =
        totalQuestionsAnswered > 0
          ? Math.round((correctAnswers / totalQuestionsAnswered) * 100)
          : 0;

      let systemStats = null;
      if (system) {
        type SysRow = { total: bigint; correct: bigint };
        const [sysAgg] = await tx.$queryRaw<SysRow[]>`
          SELECT
            COUNT(*)                                                AS total,
            SUM(CASE WHEN "wasCorrect" = true THEN 1 ELSE 0 END)  AS correct
          FROM "QuestionAttempt"
          WHERE "userId" = ${userId}
            AND "system"  = ${system}
        `;
        const sysTotalAttempts = Number(sysAgg?.total ?? 0);
        const sysCorrect = Number(sysAgg?.correct ?? 0);
        systemStats = {
          system,
          totalAttempts: sysTotalAttempts,
          correctAnswers: sysCorrect,
          accuracy:
            sysTotalAttempts > 0 ? Math.round((sysCorrect / sysTotalAttempts) * 100) : 0,
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

    // FSRS v6 + Rolling 360: Handled by drillReviewService via queueReview → /api/drills/submit-review.
    // This endpoint is stats-only — it does NOT write ReviewLog, UserProgress, Card, UserTopicProgress,
    // or Rolling 360. Those are the exclusive domain of drillReviewService to prevent dual-write races.

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
