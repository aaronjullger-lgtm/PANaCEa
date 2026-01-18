import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import {
  applyAttemptToUserStatistics,
  updateTimingAggregates,
} from '../../../lib/services/userStatisticsService';

const UserStatisticsUpdateSchema = z.object({
  body: z.object({
    questionId: z.string().optional(),
    isCorrect: z.boolean(),
    timeSpentMs: z.number().int().positive().optional(),
    system: z.string().optional(),
    selectedCondition: z.string().optional(),
    correctCondition: z.string().optional(),
  }),
});

export const onRequestOptions = withCors();

export const onRequestPatch = authenticatedEndpoint(UserStatisticsUpdateSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/user/statistics');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const { questionId, isCorrect, timeSpentMs, system, selectedCondition, correctCondition } =
      validated.body;

    // system is optional, but without it we cannot update per-system metrics
    const normalizedSystem = typeof system === 'string' && system.length ? system : undefined;
    const normalizedTime = typeof timeSpentMs === 'number' ? timeSpentMs : null;

    const updated = await applyAttemptToUserStatistics(prisma as any, auth.userId, {
      system: normalizedSystem,
      isCorrect,
      timeSpentMs: normalizedTime,
      selectedCondition,
      correctCondition,
      timestamp: new Date(),
    });

    await updateTimingAggregates(prisma as any, auth.userId, { refreshPeakHours: true });

    logger.info('Updated user statistics', {
      userId: auth.userId,
      isCorrect,
      system: normalizedSystem,
    });

    return { data: updated };
  } catch (error) {
    logger.error('Failed to update user statistics', {
      error: error instanceof Error ? error.message : String(error),
      userId: auth.userId,
    });
    throw new Error('Failed to update statistics');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
