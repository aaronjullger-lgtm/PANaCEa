/**
 * API: Submit Grand Rounds completion and get rank
 * POST /api/grandrounds/submit
 * 
 * Body: {
 *   userId: string,
 *   date: string (ISO),
 *   score: number,
 *   completionTimeMs: number,
 *   correctAnswers: number,
 *   timeBonus: number
 * }
 */

import { authenticateRequest, createErrorResponse, createSuccessResponse, handleCorsOptions, type Env } from '../_shared/auth';
import { createEdgePrismaClient } from '../_shared/prisma-edge';

export async function onRequestPost(context: { request: Request; env: Env }) {
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
    const body = await request.json();
    const { userId, date, score, completionTimeMs, correctAnswers, timeBonus } = body;

    if (!userId || !date || score === undefined || !completionTimeMs || correctAnswers === undefined) {
      return createErrorResponse('Missing required fields', 400);
    }

    const challengeDate = new Date(date);
    challengeDate.setHours(0, 0, 0, 0);

    // Create or update the history entry
    const history = await prisma.grandRoundsHistory.upsert({
      where: {
        userId_date: {
          userId,
          date: challengeDate
        }
      },
      create: {
        userId,
        date: challengeDate,
        score,
        completionTimeMs,
        correctAnswers,
        timeBonus
      },
      update: {
        score,
        completionTimeMs,
        correctAnswers,
        timeBonus
      }
    });

    // Calculate rank by counting users with higher scores for this date
    const rank = await prisma.grandRoundsHistory.count({
      where: {
        date: challengeDate,
        OR: [
          { score: { gt: score } },
          {
            score: score,
            completionTimeMs: { lt: completionTimeMs }
          }
        ]
      }
    }) + 1; // +1 because rank is 1-indexed

    // Update the rank in the history entry
    await prisma.grandRoundsHistory.update({
      where: { id: history.id },
      data: { rank }
    });

    return createSuccessResponse({ rank, history });
  } catch (error: any) {
    console.error('Error submitting Grand Rounds completion:', error);
    return createErrorResponse('Failed to submit completion', 500);
  } finally {
    await prisma.$disconnect();
  }
}
