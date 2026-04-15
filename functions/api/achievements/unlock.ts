/**
 * Achievement API - Unlock achievement
 * POST /api/achievements/unlock
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { getAchievementById } from '../../../config/achievements';

const UnlockAchievementSchema = z.object({
  body: z.object({
    achievementId: z.string().uuid(),
    progress: z.number().int().min(0).max(100).optional(),
  }),
});

export const onRequestOptions = withCors();

/**
 * POST: Unlock an achievement for the authenticated user
 */
export const onRequestPost = authenticatedEndpoint(UnlockAchievementSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/achievements/unlock');
  let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;

  try {
    prisma = createEdgePrismaClient(env.DATABASE_URL);

    const { achievementId, progress } = validated.body;

    // Verify the achievement exists in the database before awarding it.
    // This prevents clients from self-awarding arbitrary UUIDs.
    const achievementDef = getAchievementById(achievementId);
    if (!achievementDef) {
      return { data: { error: 'Achievement not found' }, status: 404 };
    }

    const achievement = await prisma.userAchievement.upsert({
      where: {
        userId_achievementId: {
          userId: auth.userId,
          achievementId,
        },
      },
      update: {
        progress: progress ?? 100,
      },
      create: {
        id: crypto.randomUUID(),
        userId: auth.userId,
        achievementId,
        progress: progress ?? 100,
        unlockedAt: new Date(),
      },
    });

    logger.info('Achievement unlocked', {
      userId: auth.userId,
      achievementId,
      progress: achievement.progress,
    });

    return {
      data: {
        success: true,
        message: 'Achievement unlocked successfully',
        data: {
          achievementId,
          unlockedAt: achievement.unlockedAt,
          progress: achievement.progress,
        },
      },
      status: 201,
    };
  } catch (error) {
    logger.error('Achievement unlock error', {
      error: error instanceof Error ? error.message : String(error),
      userId: auth.userId,
    });
    throw new Error('Failed to unlock achievement');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
