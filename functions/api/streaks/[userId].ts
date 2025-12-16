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

    if (!env.DATABASE_URL) {
      return createErrorResponse('Database not configured', 500);
    }

    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    const streaks = await prisma.dailyStreak.findMany({
      where: { userId: requestedUserId },
      orderBy: { date: 'desc' },
      take: 100
    });

    // Calculate current streak
    let currentStreak = 0;
    let isActiveToday = false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (streaks.length > 0) {
      const lastStreak = streaks[0];
      const lastDate = new Date(lastStreak.date);
      lastDate.setHours(0, 0, 0, 0);

      if (lastDate.getTime() === today.getTime()) {
        isActiveToday = true;
        currentStreak = 1;
        // Check previous days
        for (let i = 1; i < streaks.length; i++) {
          const prevDate = new Date(streaks[i].date);
          prevDate.setHours(0, 0, 0, 0);
          const expectedDate = new Date(today);
          expectedDate.setDate(expectedDate.getDate() - i);
          
          if (prevDate.getTime() === expectedDate.getTime()) {
            currentStreak++;
          } else {
            break;
          }
        }
      } else if (lastDate.getTime() === yesterday.getTime()) {
        currentStreak = 1;
        // Check previous days
        for (let i = 1; i < streaks.length; i++) {
          const prevDate = new Date(streaks[i].date);
          prevDate.setHours(0, 0, 0, 0);
          const expectedDate = new Date(yesterday);
          expectedDate.setDate(expectedDate.getDate() - i);
          
          if (prevDate.getTime() === expectedDate.getTime()) {
            currentStreak++;
          } else {
            break;
          }
        }
      }
    }

    const response = {
      success: true,
      data: {
        currentStreak,
        longestStreak: currentStreak, // Simplified for now
        isActiveToday,
        flameLevel: Math.min(currentStreak, 5),
        lastActivity: streaks.length > 0 ? streaks[0].date : null,
      },
    };

    return createSuccessResponse(response);
  } catch (error: any) {
    console.error('Streak GET error:', error);
    return createErrorResponse('Internal server error', 500);
  }
}
