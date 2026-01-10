/**
 * Achievement API - Unlock achievement
 * POST /api/achievements/unlock
 */

import {
  type Env,
  authenticateRequest,
  createErrorResponse,
  createSuccessResponse,
  handleCorsOptions,
} from '../_shared/auth';
import { createEdgePrismaClient } from '../_shared/prisma-edge';
import { validateRequest, IDSchema } from '../_shared/schemas';
import { z } from 'zod';

interface PagesContext {
  request: Request;
  env: Env;
}

// Zod schema for achievement unlock
const UnlockPayloadSchema = z.object({
  achievementId: IDSchema,
  progress: z.number().int().min(0).max(100).optional(),
});

export async function onRequestOptions(): Promise<Response> {
  return handleCorsOptions();
}

/**
 * POST: Unlock an achievement for the authenticated user
 */
export async function onRequestPost(context: PagesContext): Promise<Response> {
  const { request, env } = context;

  if (!env.DATABASE_URL) {
    return createErrorResponse('Database not configured', 500);
  }

  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const authContext = await authenticateRequest(request, env);

    if (!authContext) {
      return createErrorResponse('Unauthorized', 401);
    }

    const { userId } = authContext;

    // Validate input with Zod schema
    const validation = await validateRequest(request.clone(), UnlockPayloadSchema);
    if (!validation.success) {
      return (validation as { success: false; response: Response }).response;
    }
    const { achievementId, progress } = (validation as { success: true; data: any }).data;

    const achievement = await prisma.userAchievement.upsert({
      where: {
        userId_achievementId: {
          userId,
          achievementId
        }
      },
      update: {
        progress: progress ?? 100
      },
      create: {
        userId,
        achievementId,
        progress: progress ?? 100,
        unlockedAt: new Date()
      }
    });

    const response = {
      success: true,
      message: 'Achievement unlocked successfully',
      data: {
        achievementId,
        unlockedAt: achievement.unlockedAt,
        progress: achievement.progress,
      },
    };

    return createSuccessResponse(response, 201);
  } catch (error) {
    console.error('Achievement unlock error:', error);
    return createErrorResponse('Internal server error', 500);
  } finally {
    await prisma.$disconnect();
  }
}
