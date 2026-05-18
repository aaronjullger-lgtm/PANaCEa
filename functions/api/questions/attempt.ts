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
import { resolveOrCreateUserRecord } from '../_shared/user-resolver';
import { getFromCache, isKVAvailable, setInCache } from '../_shared/cache';
import { upsertCanonicalQuestionMirror } from '../_shared/canonical-question-mirror';
import {
  withProductionPregeneratedSafety,
  withProductionQuestionSafety,
} from '../../../lib/services/questionServingSafety';
import { resolveOrCreateQuestionIdentity } from '../../../lib/study/questionIdentityPersistence';
import type { Prisma } from '@prisma/client';

import { ANSWER_LETTERS } from '../../../lib/answerLetterMap';

// Shared schema — single source of truth for this endpoint's request contract.
// To change the /api/questions/attempt contract, edit lib/api/schemas/questions.ts.
import { QuestionAttemptRequestSchema } from '../../../lib/api/schemas/questions';
const AttemptSchema = z.object({ body: QuestionAttemptRequestSchema });
const IDEM_TTL_SECONDS = 86400;
const IDEM_KEY_PREFIX = 'idem:questions-attempt:';

function buildAttemptIdemKey(clerkId: string, idempotencyKey: string): string {
  return `${IDEM_KEY_PREFIX}${clerkId}:${idempotencyKey}`;
}

function buildDeterministicAttemptId(userId: string, idempotencyKey: string): string {
  const safeKey = idempotencyKey.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  return `attempt-${userId}-${safeKey}`;
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'P2002'
  );
}

type QuestionAttemptTarget = {
  questionId: string;
  conditionId: string | null;
  medicalContentId: string | null;
  questionIdentityId: string | null;
};

type QuestionAttemptIdentityInput = {
  canonicalQuestionId?: string | null;
  sourceQuestionId?: string | null;
  questionSource?: string | null;
  system?: string | null;
  conditionId?: string | null;
  medicalContentId?: string | null;
  mode?: string | null;
  questionType?: string | null;
};

async function resolveAttemptQuestionIdentityId(
  prisma: ReturnType<typeof createEdgePrismaClient>,
  identity: QuestionAttemptIdentityInput,
  logger: ReturnType<typeof createEndpointLogger>
): Promise<string | null> {
  const sourceQuestionId = identity.sourceQuestionId ?? identity.canonicalQuestionId;
  if (!sourceQuestionId) return null;

  const questionIdentityId = await resolveOrCreateQuestionIdentity(
    prisma,
    {
      questionSource: identity.questionSource,
      sourceQuestionId,
      canonicalQuestionId: identity.canonicalQuestionId ?? null,
      medicalContentId: identity.medicalContentId ?? null,
      system: identity.system ?? null,
      conditionId: identity.conditionId ?? null,
      provenance: {
        writer: 'questions-attempt',
        mode: identity.mode ?? null,
        questionType: identity.questionType ?? null,
      },
    },
    logger
  );

  if (!questionIdentityId) {
    logger.warn(
      'QuestionAttempt identity FK was not resolved; writing legacy attempt fields only',
      {
        questionSource: identity.questionSource ?? 'question',
        sourceQuestionId,
      }
    );
  }

  return questionIdentityId;
}

async function resolveQuestionAttemptTarget(
  prisma: ReturnType<typeof createEdgePrismaClient>,
  questionId: string,
  logger: ReturnType<typeof createEndpointLogger>,
  identityInput: QuestionAttemptIdentityInput = {}
): Promise<QuestionAttemptTarget | null> {
  const existingQuestion = await prisma.question.findFirst({
    where: withProductionQuestionSafety({ id: questionId }) as Prisma.QuestionWhereInput,
    select: { id: true, conditionId: true, medicalContentId: true },
  });
  if (existingQuestion) {
    const questionIdentityId = await resolveAttemptQuestionIdentityId(
      prisma,
      {
        ...identityInput,
        canonicalQuestionId: identityInput.canonicalQuestionId ?? existingQuestion.id,
        sourceQuestionId: identityInput.sourceQuestionId ?? questionId,
        questionSource: identityInput.questionSource ?? 'question',
        conditionId: existingQuestion.conditionId ?? identityInput.conditionId ?? null,
        medicalContentId:
          existingQuestion.medicalContentId ?? identityInput.medicalContentId ?? null,
      },
      logger
    );

    return {
      questionId: existingQuestion.id,
      conditionId: existingQuestion.conditionId ?? null,
      medicalContentId: existingQuestion.medicalContentId ?? null,
      questionIdentityId,
    };
  }

  const preGenerated = await prisma.preGeneratedQuestion.findFirst({
    where: withProductionPregeneratedSafety({
      id: questionId,
    }) as Prisma.PreGeneratedQuestionWhereInput,
    select: {
      id: true,
      questionData: true,
      conditionId: true,
      medicalContentId: true,
      system: true,
      difficulty: true,
      generatedAt: true,
    },
  });
  if (!preGenerated) return null;

  try {
    const canonicalQuestionId = await upsertCanonicalQuestionMirror(
      prisma,
      {
        id: preGenerated.id,
        questionData: preGenerated.questionData,
        system: preGenerated.system,
        difficulty: preGenerated.difficulty,
        conditionId: preGenerated.conditionId,
        medicalContentId: preGenerated.medicalContentId,
        generatedAt: preGenerated.generatedAt,
      },
      {
        source: 'pre_generated_identity_mirror',
        humanReviewed: true,
      }
    );
    if (!canonicalQuestionId) {
      logger.warn('Pre-generated question missing mirrorable scoring data', { questionId });
      return null;
    }
    return {
      questionId: canonicalQuestionId,
      conditionId: preGenerated.conditionId ?? null,
      medicalContentId: preGenerated.medicalContentId ?? null,
      questionIdentityId: await resolveAttemptQuestionIdentityId(
        prisma,
        {
          ...identityInput,
          questionSource: identityInput.questionSource ?? 'pre_generated',
          sourceQuestionId: identityInput.sourceQuestionId ?? preGenerated.id,
          canonicalQuestionId: identityInput.canonicalQuestionId ?? canonicalQuestionId,
          conditionId: preGenerated.conditionId ?? identityInput.conditionId ?? null,
          medicalContentId: preGenerated.medicalContentId ?? identityInput.medicalContentId ?? null,
          system: preGenerated.system ?? identityInput.system ?? null,
        },
        logger
      ),
    };
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      logger.warn('Failed to create Question identity mirror for attempt FK', {
        questionId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return null;
  }
}

export const onRequestPost = authenticatedEndpoint(AttemptSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/questions/attempt');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);
  let duplicateContext: {
    idempotencyKey: string;
    userId: string;
    attemptId: string;
    system?: string;
  } | null = null;

  try {
    const user = await resolveOrCreateUserRecord(prisma, auth.userId, { id: true });

    const userId = user.id;
    const {
      questionId,
      canonicalQuestionId,
      sourceQuestionId,
      questionSource,
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
      idempotencyKey,
    } = validated.body;

    if (idempotencyKey && isKVAvailable(env.CACHE)) {
      const cached = await getFromCache<Record<string, unknown>>(
        env.CACHE,
        buildAttemptIdemKey(auth.userId, idempotencyKey)
      );
      if (cached) {
        logger.info('attempt idempotency cache hit', {
          userId: auth.userId,
          questionId,
          idempotencyKey,
        });
        return { data: cached };
      }
    }

    // Support both isCorrect and wasCorrect field names
    const correctness = isCorrect ?? wasCorrect;
    const timeSpentMillis = timeSpentMs ?? timeSpent ?? null;
    const attemptId = idempotencyKey
      ? buildDeterministicAttemptId(userId, idempotencyKey)
      : `attempt-${userId}-${questionId}-${Date.now()}`;
    duplicateContext = idempotencyKey ? { idempotencyKey, userId, attemptId, system } : null;

    const selectedAnswerLetter =
      selectedAnswerRaw === undefined
        ? null
        : typeof selectedAnswerRaw === 'number'
          ? (ANSWER_LETTERS[selectedAnswerRaw] ?? null)
          : selectedAnswerRaw;

    const attemptTarget = await resolveQuestionAttemptTarget(prisma, questionId, logger, {
      canonicalQuestionId,
      sourceQuestionId,
      questionSource,
      system: system ?? null,
      conditionId: conditionId ?? null,
      medicalContentId: medicalContentId ?? null,
      mode,
      questionType,
    });
    if (!attemptTarget) {
      return {
        data: {
          success: false,
          error: 'Question identity could not be resolved',
          code: 'QUESTION_IDENTITY_UNRESOLVED',
        },
        status: 400,
      };
    }

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

    if (idempotencyKey) {
      const existingAttempt = await prisma.questionAttempt.findUnique({
        where: { id: attemptId },
        select: { id: true },
      });
      if (existingAttempt) {
        const stats = await getAggregateAttemptStats(prisma, userId);
        const detailedSystemStats = system
          ? await getUserSystemStats(prisma, userId, system)
          : null;
        const responseData = {
          success: true,
          attemptId,
          stats,
          systemStats: detailedSystemStats,
          deduped: true,
        };

        if (isKVAvailable(env.CACHE)) {
          await setInCache(
            env.CACHE,
            buildAttemptIdemKey(auth.userId, idempotencyKey),
            responseData,
            IDEM_TTL_SECONDS
          );
        }

        return { data: responseData };
      }
    }

    const result = (await prisma.$transaction(async (tx) => {
      // 1. Record attempt (with selectedAnswer, telemetry for Ghost Grader)
      await tx.questionAttempt.create({
        data: {
          id: attemptId,
          userId,
          questionId: attemptTarget.questionId,
          ...(attemptTarget.questionIdentityId
            ? { questionIdentityId: attemptTarget.questionIdentityId }
            : {}),
          wasCorrect: correctness,
          system: system ?? null,
          conditionId: attemptTarget.conditionId ?? conditionId ?? null,
          medicalContentId: attemptTarget.medicalContentId ?? medicalContentId ?? null,
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
        where: {
          userId_questionId_questionType: {
            userId,
            questionId: attemptTarget.questionId,
            questionType: qType,
          },
        },
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

      const now = new Date();
      await tx.userQuestionSeen.upsert({
        where: {
          userId_questionId_questionType: {
            userId,
            questionId: attemptTarget.questionId,
            questionType: qType,
          },
        },
        create: {
          id: crypto.randomUUID(),
          userId,
          questionId: attemptTarget.questionId,
          questionType: qType,
          firstSeenAt: now,
          lastSeenAt: now,
          updatedAt: now,
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
          where: { id: attemptTarget.questionId },
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
      const stats = await getAggregateAttemptStats(tx, userId);

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
          accuracy: sysTotalAttempts > 0 ? Math.round((sysCorrect / sysTotalAttempts) * 100) : 0,
        };
      }

      return {
        attemptId,
        stats,
        systemStats,
      };
    })) as unknown as TransactionResult;

    // Get detailed system stats
    const detailedSystemStats = system ? await getUserSystemStats(prisma, userId, system) : null;

    // FSRS v6 + Rolling 360: Handled by drillReviewService via queueReview → /api/drills/submit-review.
    // This endpoint is stats-only — it does NOT write ReviewLog, UserProgress, Card, UserTopicProgress,
    // or Rolling 360. Those are the exclusive domain of drillReviewService to prevent dual-write races.

    logger.info('Attempt recorded', { userId: auth.userId, questionId, correctness });

    const responseData = {
      success: true,
      attemptId: result.attemptId,
      stats: result.stats,
      systemStats: detailedSystemStats || result.systemStats,
    };

    if (idempotencyKey && isKVAvailable(env.CACHE)) {
      await setInCache(
        env.CACHE,
        buildAttemptIdemKey(auth.userId, idempotencyKey),
        responseData,
        IDEM_TTL_SECONDS
      );
    }

    return {
      data: responseData,
    };
  } catch (error) {
    if (duplicateContext && isUniqueConstraintError(error)) {
      const stats = await getAggregateAttemptStats(prisma, duplicateContext.userId);
      const detailedSystemStats = duplicateContext.system
        ? await getUserSystemStats(prisma, duplicateContext.userId, duplicateContext.system)
        : null;
      return {
        data: {
          success: true,
          attemptId: duplicateContext.attemptId,
          stats,
          systemStats: detailedSystemStats,
          deduped: true,
        },
      };
    }

    logger.error('Error recording attempt', {
      error: error instanceof Error ? error.message : String(error),
      userId: auth.userId,
    });
    throw new Error('Failed to record attempt');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});

async function getAggregateAttemptStats(
  prisma: Pick<ReturnType<typeof createEdgePrismaClient>, '$queryRaw'>,
  userId: string
) {
  type AggRow = { total: bigint; correct: bigint };
  const [agg] = await prisma.$queryRaw<AggRow[]>`
    SELECT
      COUNT(*)                                               AS total,
      SUM(CASE WHEN "wasCorrect" = true THEN 1 ELSE 0 END)  AS correct
    FROM "QuestionAttempt"
    WHERE "userId" = ${userId}
  `;

  const totalQuestionsAnswered = Number(agg?.total ?? 0);
  const correctAnswers = Number(agg?.correct ?? 0);
  const overallAccuracy =
    totalQuestionsAnswered > 0 ? Math.round((correctAnswers / totalQuestionsAnswered) * 100) : 0;

  return { totalQuestionsAnswered, correctAnswers, overallAccuracy };
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
