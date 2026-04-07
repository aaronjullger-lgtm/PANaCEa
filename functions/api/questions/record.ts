/**
 * POST /api/questions/record
 * Record a question attempt (seen history + analytics)
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { resolveUserByClerkId } from '../_shared/resolveUser';
import { isRankedMode } from '../../../config/training-modes';
import { updateGlobalAccuracy } from '../../../lib/services/userStatsService';

const QuestionRecordSchema = z.object({
  body: z.object({
    questionId: z.string(),
    questionType: z.string(),
    system: z.string().optional(),
    conditionId: z.string().optional(),
    wasCorrect: z.boolean().optional(),
    mode: z.string().optional(),
  }),
});

export const onRequestOptions = withCors();

export const onRequestPost = authenticatedEndpoint(QuestionRecordSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/questions/record');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const { questionId, questionType, system, conditionId, wasCorrect, mode } =
      validated.body;

    // Resolve internal user ID from Clerk auth — never trust client-supplied userId
    const user = await resolveUserByClerkId(prisma, auth.userId);
    if (!user) {
      logger.warn('User not found for question record', { clerkId: auth.userId });
      return { status: 404, error: 'User not found' };
    }
    const userId = user.id;

    const isRankedAttempt = isRankedMode(mode);
    const now = new Date();

    // Record question seen (no-repeat guard)
    const seenKey = { userId, questionId, questionType } as const;

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

    const attemptId = `attempt-${userId}-${questionId}-${Date.now()}`;
    await prisma.questionAttempt.create({
      data: {
        id: attemptId,
        userId,
        questionId,
        questionType: questionType ?? null,
        system: system ?? null,
        conditionId: conditionId ?? null,
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
