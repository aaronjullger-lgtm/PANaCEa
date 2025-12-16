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

interface PagesContext {
  request: Request;
  env: Env;
}

interface UnlockPayload {
  achievementId: string;
  progress?: number;
}

export async function onRequestOptions(): Promise<Response> {
  return handleCorsOptions();
}

/**
 * POST: Unlock an achievement for the authenticated user
 */
export async function onRequestPost(context: PagesContext): Promise<Response> {
  const { request, env } = context;

  try {
    const authContext = await authenticateRequest(request, env);

    if (!authContext) {
      return createErrorResponse('Unauthorized', 401);
    }

    const { userId } = authContext;
    const payload: UnlockPayload = await request.json();

    if (!payload.achievementId) {
      return createErrorResponse('achievementId is required', 400);
    }

    if (!env.DATABASE_URL) {
      return createErrorResponse('Database not configured', 500);
    }

    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    const achievement = await prisma.userAchievement.upsert({
      where: {
        userId_achievementId: {
          userId,
          achievementId: payload.achievementId
        }
      },
      update: {
        progress: payload.progress ?? 100
      },
      create: {
        userId,
        achievementId: payload.achievementId,
        progress: payload.progress ?? 100,
        unlockedAt: new Date()
      }
    });

    const response = {
      success: true,
      message: 'Achievement unlocked successfully',
      data: {
        achievementId: payload.achievementId,
        unlockedAt: achievement.unlockedAt,
        progress: achievement.progress,
      },
    };

    return createSuccessResponse(response, 201);
  } catch (error) {
    console.error('Achievement unlock error:', error);
    return createErrorResponse('Internal server error', 500);
  }
}
