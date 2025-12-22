/**
 * API: Get today's Grand Rounds leaderboard
 * GET /api/grandrounds/leaderboard?date={date}&limit={limit}
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
    const dateParam = url.searchParams.get('date');
    const limitParam = url.searchParams.get('limit') || '100';
    const limit = Math.min(parseInt(limitParam, 10), 500);

    const today = dateParam ? new Date(dateParam) : new Date();
    today.setHours(0, 0, 0, 0);

    // Get leaderboard entries for today, ordered by score (desc) then time (asc)
    const entries = await prisma.grandRoundsHistory.findMany({
      where: { date: today },
      orderBy: [
        { score: 'desc' },
        { completionTimeMs: 'asc' }
      ],
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    // Format leaderboard with rank
    const leaderboard = entries.map((entry, index) => ({
      rank: index + 1,
      userId: entry.userId,
      userName: entry.user ? `${entry.user.firstName || ''} ${entry.user.lastName || ''}`.trim() || 'Anonymous' : 'Anonymous',
      score: entry.score,
      completionTimeMs: entry.completionTimeMs,
      correctAnswers: entry.correctAnswers
    }));

    return createSuccessResponse({ leaderboard });
  } catch (error: any) {
    console.error('Error fetching Grand Rounds leaderboard:', error);
    return createErrorResponse('Failed to fetch leaderboard', 500);
  } finally {
    await prisma.$disconnect();
  }
}
