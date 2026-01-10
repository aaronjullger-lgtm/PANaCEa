/**
 * Streak API - Record daily activity
 * POST /api/streaks/record
 */

import {
  type Env,
  authenticateRequest,
  createErrorResponse,
  createSuccessResponse,
  handleCorsOptions,
} from '../_shared/auth';
import { createEdgePrismaClient } from '../_shared/prisma-edge';
import { validateRequest, StreakRecordSchema } from '../_shared/schemas';

interface PagesContext {
  request: Request;
  env: Env;
}

export async function onRequestOptions(): Promise<Response> {
  return handleCorsOptions();
}

/**
 * POST: Record daily study activity
 */
export async function onRequestPost(context: PagesContext): Promise<Response> {
  const { request, env } = context;

  try {
    const authContext = await authenticateRequest(request, env);

    if (!authContext) {
      return createErrorResponse('Unauthorized', 401);
    }

    // Validate request body with Zod schema
    const validation = await validateRequest(request, StreakRecordSchema);
    if (!validation.success) {
      return (validation as { success: false; response: Response }).response;
    }

    const { userId } = authContext;
    const payload = validation.data;

    if (!env.DATABASE_URL) {
      return createErrorResponse('Database not configured', 500);
    }

    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      // Use provided date or today
      const activityDate = payload.date
        ? new Date(payload.date)
        : new Date();
      activityDate.setHours(0, 0, 0, 0); // Normalize to start of day

      const streak = await prisma.dailyStreak.upsert({
        where: {
          userId_date: {
            userId,
            date: activityDate
          }
        },
        update: {
          questionsAnswered: { increment: payload.questionsAnswered },
          accuracyPercent: payload.accuracyPercent, // Update with latest accuracy? Or average?
          studyMinutes: { increment: payload.studyMinutes ?? 0 }
        },
        create: {
          userId,
          date: activityDate,
          questionsAnswered: payload.questionsAnswered,
          accuracyPercent: payload.accuracyPercent,
          studyMinutes: payload.studyMinutes ?? 0
        }
      });

      const response = {
        success: true,
        message: 'Activity recorded successfully',
        data: {
          date: activityDate.toISOString().split('T')[0],
          questionsAnswered: streak.questionsAnswered,
          accuracyPercent: streak.accuracyPercent,
          studyMinutes: streak.studyMinutes,
        },
      };

      return createSuccessResponse(response, 201);
    } finally {
      await prisma.$disconnect();
    }
  } catch (error) {
    console.error('Streak record error:', error);
    return createErrorResponse('Internal server error', 500);
  }
}
