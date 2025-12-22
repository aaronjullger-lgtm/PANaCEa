/**
 * API: Check if user has completed today's Grand Rounds challenge
 * GET /api/grandrounds/completed?userId={userId}
 */

import { authenticateRequest, createErrorResponse, createSuccessResponse, handleCorsOptions, type Env } from '../_shared/auth';
import { createEdgePrismaClient } from '../_shared/prisma-edge';

export async function onRequestGet(context: { request: Request; env: Env }) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return handleCorsOptions();
  }

  const authContext = await authenticateRequest(request, env);
  if (!authContext) {
    return createErrorResponse('Unauthorized', 401);
  }

  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');

    if (!userId) {
      return createErrorResponse('Missing userId parameter', 400);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if user has a history entry for today
    const history = await prisma.grandRoundsHistory.findUnique({
      where: {
        userId_date: {
          userId,
          date: today
        }
      }
    });

    return createSuccessResponse({ completed: !!history });
  } catch (error: any) {
    console.error('Error checking Grand Rounds completion:', error);
    return createErrorResponse('Failed to check completion status', 500);
  } finally {
    await prisma.$disconnect();
  }
}
