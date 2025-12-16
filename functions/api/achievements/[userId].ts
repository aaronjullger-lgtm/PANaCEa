/**
 * Achievement API - Get user achievements
 * GET /api/achievements/:userId
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
  params: {
    userId: string;
  };
}

export async function onRequestOptions(): Promise<Response> {
  return handleCorsOptions();
}

/**
 * GET: Fetch user's achievements
 */
export async function onRequestGet(context: PagesContext): Promise<Response> {
  const { request, env, params } = context;

  try {
    const authContext = await authenticateRequest(request, env);

    if (!authContext) {
      return createErrorResponse('Unauthorized', 401);
    }

    const { userId: authenticatedUserId } = authContext;
    const { userId: requestedUserId } = params;

    // Users can only fetch their own achievements
    if (authenticatedUserId !== requestedUserId) {
      return createErrorResponse('Forbidden', 403);
    }

    if (!env.DATABASE_URL) {
      return createErrorResponse('Database not configured', 500);
    }

    const prisma = createEdgePrismaClient(env.DATABASE_URL);
    
    const achievements = await prisma.userAchievement.findMany({
      where: { userId: requestedUserId }
    });

    const response = {
      success: true,
      data: {
        achievements: achievements,
        totalUnlocked: achievements.length,
        // totalAvailable: 25, // This should ideally come from a config or DB
      },
    };

    return createSuccessResponse(response);
  } catch (error: any) {
    console.error('Achievements GET error:', error);
    return createErrorResponse('Internal server error', 500);
  }
}
