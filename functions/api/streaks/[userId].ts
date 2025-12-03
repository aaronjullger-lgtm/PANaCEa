/**
 * Streak API - Get user streak information
 * GET /api/streaks/:userId
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
 * GET: Fetch user's current streak information
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

    // Users can only fetch their own streaks
    if (authenticatedUserId !== requestedUserId) {
      return createErrorResponse('Forbidden', 403);
    }

    // Note: In Cloudflare Workers/Pages Functions, we can't use Prisma directly
    // due to connection pooling issues. This is a placeholder.
    // In production, you'd use Prisma Data Proxy or D1 to query:
    // const streaks = await prisma.dailyStreak.findMany({
    //   where: { userId: requestedUserId },
    //   orderBy: { date: 'desc' },
    //   take: 100
    // });
    //
    // Calculate current streak by checking consecutive days

    const response = {
      success: true,
      data: {
        currentStreak: 0,
        longestStreak: 0,
        isActiveToday: false,
        flameLevel: 0,
        lastActivity: null,
      },
    };

    return createSuccessResponse(response);
  } catch (error) {
    console.error('Streak GET error:', error);
    return createErrorResponse('Internal server error', 500);
  }
}
