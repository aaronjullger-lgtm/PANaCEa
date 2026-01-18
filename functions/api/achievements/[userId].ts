/**
 * Achievement API - Get user achievements
 * GET /api/achievements/:userId
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

const AchievementParamsSchema = z.object({
  params: z.object({
    userId: z.string().min(1, 'User ID is required'),
  }),
});

interface PagesContext {
  request: Request;
  env: any;
  params: {
    userId: string;
  };
}

export const onRequestOptions = withCors();

/**
 * GET: Fetch user's achievements
 */
export const onRequestGet = authenticatedEndpoint(AchievementParamsSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/achievements/[userId]');
  const { userId: requestedUserId } = validated.params;

  // Users can only fetch their own achievements
  if (auth.userId !== requestedUserId) {
    logger.warn('Forbidden access attempt', {
      authenticatedUserId: auth.userId,
      requestedUserId,
    });
    throw new Error('Forbidden');
  }

  if (!env.DATABASE_URL) {
    logger.error('Database not configured');
    throw new Error('Database not configured');
  }

  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const achievements = await prisma.userAchievement.findMany({
      where: { userId: requestedUserId },
    });

    logger.info('Fetched user achievements', {
      userId: requestedUserId,
      count: achievements.length,
    });

    return {
      data: {
        achievements: achievements,
        totalUnlocked: achievements.length,
        // totalAvailable: 25, // This should ideally come from a config or DB
      },
    };
  } catch (error: any) {
    logger.error('Achievements GET error', {
      error: error.message,
      userId: requestedUserId,
    });
    throw new Error('Internal server error');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});