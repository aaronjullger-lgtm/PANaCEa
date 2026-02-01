import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import {
  applyAttemptToUserStatistics,
  updateTimingAggregates,
} from '../../../lib/services/userStatisticsService';

const StatisticsUpdateSchema = z.object({
  body: z.object({
    questionId: z.string().optional(),
    system: z.string().optional(),
    isCorrect: z.boolean(),
    timeSpentMs: z.number().int().min(0).optional(),
    selectedCondition: z.string().optional(),
    correctCondition: z.string().optional(),
    refreshTimingAggregates: z.boolean().optional().default(false),
  }),
});

export const onRequestOptions = withCors();

/**
 * PATCH /api/user/statistics
 * Update user statistics after a question attempt
 */
export const onRequestPatch = authenticatedEndpoint(StatisticsUpdateSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/user/statistics [PATCH]');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const {
      system,
      isCorrect,
      timeSpentMs,
      selectedCondition,
      correctCondition,
      refreshTimingAggregates,
    } = validated.body;

    // Get user's internal ID
    const user = await prisma.user.findUnique({
      where: { clerkId: auth.userId },
      select: { id: true },
    });

    if (!user) {
      return { status: 404, error: 'User not found' };
    }

    // Update statistics
    const updatedStats = await applyAttemptToUserStatistics(prisma, user.id, {
      system: system || null,
      isCorrect,
      timeSpentMs: timeSpentMs ?? null,
      selectedCondition: selectedCondition || null,
      correctCondition: correctCondition || null,
      timestamp: new Date(),
    });

    // Optionally refresh timing aggregates (peak hours, avg session length)
    if (refreshTimingAggregates) {
      await updateTimingAggregates(prisma, user.id, {
        refreshPeakHours: true,
        refreshAvgSessionLength: true,
      });
    }

    logger.info('User statistics updated', {
      userId: user.id,
      totalQuestions: updatedStats.totalQuestions,
      accuracy: updatedStats.correctAnswers / updatedStats.totalQuestions,
    });

    return {
      data: {
        success: true,
        statistics: {
          totalQuestions: updatedStats.totalQuestions,
          correctAnswers: updatedStats.correctAnswers,
          accuracy: updatedStats.correctAnswers / updatedStats.totalQuestions,
          avgTimePerQuestion: updatedStats.avgTimePerQuestion,
          strongestSystems: updatedStats.strongestSystems,
          weakestSystems: updatedStats.weakestSystems,
          rushedSystems: updatedStats.rushedSystems,
          overthinkingSystems: updatedStats.overthinkingSystems,
        },
      },
    };
  } catch (error) {
    logger.error('Failed to update user statistics', {
      error: error instanceof Error ? error.message : String(error),
      userId: auth.userId,
    });
    return { status: 500, error: 'Failed to update statistics' };
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
