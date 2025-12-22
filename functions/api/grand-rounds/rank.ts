/**
 * API: Get user's rank for today
 * GET /api/grandrounds/rank?userId={userId}&date={date}
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
    const dateParam = url.searchParams.get('date');

    if (!userId) {
      return createErrorResponse('Missing userId parameter', 400);
    }

    const today = dateParam ? new Date(dateParam) : new Date();
    today.setHours(0, 0, 0, 0);

    // Get user's history entry
    const userHistory = await prisma.grandRoundsHistory.findUnique({
      where: {
        userId_date: {
          userId,
          date: today
        }
      }
    });

    if (!userHistory) {
      return createSuccessResponse({ rank: null });
    }

    return createSuccessResponse({ rank: userHistory.rank });
  } catch (error: any) {
    console.error('Error fetching Grand Rounds rank:', error);
    return createErrorResponse('Failed to fetch rank', 500);
  } finally {
    await prisma.$disconnect();
  }
}
