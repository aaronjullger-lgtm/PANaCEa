/**
 * POST /api/questions/record
 * Record a question attempt (seen history + analytics)
 */

import { z } from 'zod';
import { authenticatedEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { resolveUserByClerkId } from '../_shared/resolveUser';
import { isRankedMode } from '../../../config/training-modes';
import { updateGlobalAccuracy } from '../../../lib/services/userStatsService';
import { upsertCanonicalQuestionMirror } from '../_shared/canonical-question-mirror';
import {
  withProductionPregeneratedSafety,
  withProductionQuestionSafety,
} from '../../../lib/services/questionServingSafety';
import { resolveOrCreateQuestionIdentity } from '../../../lib/study/questionIdentityPersistence';
import type { Prisma } from '@prisma/client';

const QuestionRecordSchema = z.object({
  body: z.object({
    questionId: z.string(),
    canonicalQuestionId: z.string().min(1).max(100).nullable().optional(),
    sourceQuestionId: z.string().min(1).max(100).optional(),
    questionSource: z
      .enum(['question', 'pre_generated', 'staging', 'seed', 'generated'])
      .optional(),
    questionType: z.string(),
    system: z.string().optional(),
    conditionId: z.string().optional(),
    medicalContentId: z.string().nullable().optional(),
    wasCorrect: z.boolean().optional(),
    mode: z.string().optional(),
  }),
});

type QuestionRecordIdentityInput = {
  canonicalQuestionId?: string | null;
  sourceQuestionId?: string | null;
  questionSource?: string | null;
  system?: string | null;
  conditionId?: string | null;
  medicalContentId?: string | null;
  mode?: string | null;
  questionType?: string | null;
};

type QuestionRecordTarget = {
  questionId: string;
  conditionId: string | null;
  medicalContentId: string | null;
  questionIdentityId: string | null;
};

async function resolveCanonicalRecordTarget(
  prisma: ReturnType<typeof createEdgePrismaClient>,
  questionId: string,
  identityInput: QuestionRecordIdentityInput,
  logger: ReturnType<typeof createEndpointLogger>
): Promise<QuestionRecordTarget | null> {
  const existing = await prisma.question.findFirst({
    where: withProductionQuestionSafety({ id: questionId }) as Prisma.QuestionWhereInput,
    select: { id: true, conditionId: true, medicalContentId: true },
  });
  if (existing) {
    const questionIdentityId = await resolveRecordQuestionIdentityId(
      prisma,
      {
        ...identityInput,
        canonicalQuestionId: identityInput.canonicalQuestionId ?? existing.id,
        sourceQuestionId: identityInput.sourceQuestionId ?? questionId,
        questionSource: identityInput.questionSource ?? 'question',
        conditionId: existing.conditionId ?? identityInput.conditionId ?? null,
        medicalContentId: existing.medicalContentId ?? identityInput.medicalContentId ?? null,
      },
      logger
    );

    return {
      questionId: existing.id,
      conditionId: existing.conditionId ?? null,
      medicalContentId: existing.medicalContentId ?? null,
      questionIdentityId,
    };
  }

  const pregenerated = await prisma.preGeneratedQuestion.findFirst({
    where: withProductionPregeneratedSafety({
      id: questionId,
    }) as Prisma.PreGeneratedQuestionWhereInput,
    select: {
      id: true,
      questionData: true,
      system: true,
      difficulty: true,
      conditionId: true,
      medicalContentId: true,
      generatedAt: true,
    },
  });
  if (!pregenerated) return null;

  const canonicalQuestionId = await upsertCanonicalQuestionMirror(prisma, pregenerated, {
    source: 'record_pre_generated',
    humanReviewed: true,
  });
  if (!canonicalQuestionId) return null;

  return {
    questionId: canonicalQuestionId,
    conditionId: pregenerated.conditionId ?? null,
    medicalContentId: pregenerated.medicalContentId ?? null,
    questionIdentityId: await resolveRecordQuestionIdentityId(
      prisma,
      {
        ...identityInput,
        canonicalQuestionId: identityInput.canonicalQuestionId ?? canonicalQuestionId,
        sourceQuestionId: identityInput.sourceQuestionId ?? pregenerated.id,
        questionSource: identityInput.questionSource ?? 'pre_generated',
        conditionId: pregenerated.conditionId ?? identityInput.conditionId ?? null,
        medicalContentId: pregenerated.medicalContentId ?? identityInput.medicalContentId ?? null,
        system: pregenerated.system ?? identityInput.system ?? null,
      },
      logger
    ),
  };
}

async function resolveRecordQuestionIdentityId(
  prisma: ReturnType<typeof createEdgePrismaClient>,
  identity: QuestionRecordIdentityInput,
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
        writer: 'questions-record',
        mode: identity.mode ?? null,
        questionType: identity.questionType ?? null,
      },
    },
    logger
  );

  if (!questionIdentityId) {
    logger.warn('Question record identity FK was not resolved; writing legacy fields only', {
      questionSource: identity.questionSource ?? 'question',
      sourceQuestionId,
    });
  }

  return questionIdentityId;
}

export const onRequestPost = authenticatedEndpoint(QuestionRecordSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/questions/record');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const {
      questionId,
      canonicalQuestionId,
      sourceQuestionId,
      questionSource,
      questionType,
      system,
      conditionId,
      medicalContentId,
      wasCorrect,
      mode,
    } = validated.body;

    // Resolve internal user ID from Clerk auth — never trust client-supplied userId
    const user = await resolveUserByClerkId(prisma, auth.userId);
    if (!user) {
      logger.warn('User not found for question record', { clerkId: auth.userId });
      return { status: 404, error: 'User not found' };
    }
    const userId = user.id;

    const isRankedAttempt = isRankedMode(mode);
    const now = new Date();
    const recordTarget = await resolveCanonicalRecordTarget(
      prisma,
      questionId,
      {
        canonicalQuestionId,
        sourceQuestionId,
        questionSource,
        system: system ?? null,
        conditionId: conditionId ?? null,
        medicalContentId: medicalContentId ?? null,
        mode,
        questionType,
      },
      logger
    );
    if (!recordTarget) {
      logger.warn('Question record rejected because canonical target could not be resolved', {
        questionId,
        questionType,
      });
      return {
        status: 400,
        error: 'Question cannot be recorded because it is not canonical or mirrorable.',
      };
    }

    // Record question seen (no-repeat guard)
    const seenKey = { userId, questionId: recordTarget.questionId, questionType } as const;

    const updateData: any = {
      lastSeenAt: now,
      timesShown: { increment: 1 },
    };

    if (wasCorrect !== undefined) {
      updateData.timesCorrect = wasCorrect ? { increment: 1 } : undefined;
      updateData.timesIncorrect = wasCorrect ? undefined : { increment: 1 };
    }

    await prisma.userQuestionSeen.upsert({
      where: { userId_questionId_questionType: seenKey },
      create: {
        ...seenKey,
        firstSeenAt: now,
        lastSeenAt: now,
        timesShown: 1,
        timesCorrect: wasCorrect ? 1 : 0,
        timesIncorrect: wasCorrect ? 0 : 1,
      },
      update: updateData,
    });

    const attemptId = `attempt-${userId}-${recordTarget.questionId}-${Date.now()}`;
    await prisma.questionAttempt.create({
      data: {
        id: attemptId,
        userId,
        questionId: recordTarget.questionId,
        ...(recordTarget.questionIdentityId
          ? { questionIdentityId: recordTarget.questionIdentityId }
          : {}),
        questionType: questionType ?? null,
        system: system ?? null,
        conditionId: recordTarget.conditionId,
        medicalContentId: recordTarget.medicalContentId,
        mode: mode ?? null,
        wasCorrect: Boolean(wasCorrect),
        isRankedAttempt,
      },
    });

    // Only ranked attempts feed FSRS/Global stats
    if (isRankedAttempt) {
      try {
        await updateGlobalAccuracy(prisma as any, userId);
      } catch (statsError) {
        logger.warn('Failed to update ranked stats', {
          error: statsError instanceof Error ? statsError.message : String(statsError),
        });
      }
    }

    logger.info('Question recorded', { userId: auth.userId, questionId, isRankedAttempt });

    return { data: { success: true, message: 'Question recorded successfully', isRankedAttempt } };
  } catch (error) {
    logger.error('Error recording question', {
      error: error instanceof Error ? error.message : String(error),
      userId: auth.userId,
    });
    throw new Error('Failed to record question');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
