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

    // Note: In Cloudflare Workers/Pages Functions, we can't use Prisma directly
    // due to connection pooling issues. This is a placeholder.
    // In production, you'd use Prisma Data Proxy or D1 to query the database:
    // const achievements = await prisma.userAchievement.findMany({
    //   where: { userId: requestedUserId }
    // });

    const response = {
      success: true,
      data: {
        achievements: [],
        totalUnlocked: 0,
        totalAvailable: 25,
      },
    };

    return createSuccessResponse(response);
  } catch (error) {
    console.error('Achievements GET error:', error);
    return createErrorResponse('Internal server error', 500);
  }
}
