/**
 * Streak API - Record daily activity
 * POST /api/streaks/record
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

const RecordStreakSchema = z.object({
  body: z.object({
    date: z.string().optional(),
    questionsAnswered: z.number().int().min(0),
    accuracyPercent: z.number().min(0).max(100),
    studyMinutes: z.number().int().min(0).optional(),
  }),
});

export const onRequestOptions = withCors();

/**
 * POST: Record daily study activity
 */
export const onRequestPost = authenticatedEndpoint(RecordStreakSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/streaks/record');
  let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;

  try {
    prisma = createEdgePrismaClient(env.DATABASE_URL);

    const payload = validated.body;

    // Use provided date or today
    const activityDate = payload.date ? new Date(payload.date) : new Date();
    activityDate.setHours(0, 0, 0, 0); // Normalize to start of day

    const streak = await prisma.dailyStreak.upsert({
      where: {
        userId_date: {
          userId: auth.userId,
          date: activityDate,
        },
      },
      update: {
        questionsAnswered: { increment: payload.questionsAnswered },
        accuracyPercent: payload.accuracyPercent,
        studyMinutes: { increment: payload.studyMinutes ?? 0 },
      },
      create: {
        userId: auth.userId,
        date: activityDate,
        questionsAnswered: payload.questionsAnswered,
        accuracyPercent: payload.accuracyPercent,
        studyMinutes: payload.studyMinutes ?? 0,
      },
    });

    logger.info('Streak recorded', {
      userId: auth.userId,
      date: activityDate.toISOString().split('T')[0],
      questionsAnswered: streak.questionsAnswered,
      accuracyPercent: streak.accuracyPercent,
    });

    return {
      data: {
        success: true,
        message: 'Activity recorded successfully',
        data: {
          date: activityDate.toISOString().split('T')[0],
          questionsAnswered: streak.questionsAnswered,
          accuracyPercent: streak.accuracyPercent,
          studyMinutes: streak.studyMinutes,
        },
      },
      status: 201,
    };
  } catch (error) {
    logger.error('Streak record error', {
      error: error instanceof Error ? error.message : String(error),
      userId: auth.userId,
    });
    throw new Error('Failed to record streak');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
