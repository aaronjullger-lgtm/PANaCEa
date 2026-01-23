/**
 * API Endpoint: GET /api/user/review-history
 * 
 * Fetches complete review history for FSRS optimizer
 * Returns QuestionAttempt records with telemetry data
 */

import { authenticateRequest } from '../_shared/auth';
import { createEdgePrismaClient } from '../_shared/prisma-edge';

interface Env {
  DATABASE_URL: string;
}

export const onRequestGet = async (context: { request: Request; env: Env }) => {
  let prisma;

  try {
    // Authenticate request
    const auth = await authenticateRequest(context.request, context.env);
    if (!auth || !auth.userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const userId = auth.userId;
    const url = new URL(context.request.url);
    const limit = parseInt(url.searchParams.get('limit') || '1000', 10);

    // Connect to database
    prisma = createEdgePrismaClient(context.env.DATABASE_URL);

    // Fetch review history with telemetry
    const reviews = await prisma.questionAttempt.findMany({
      where: { userId },
      select: {
        id: true,
        userId: true,
        questionId: true,
        wasCorrect: true,
        createdAt: true,
        durationMs: true,
        telemetryJson: true,
        answerChangedCount: true,
        timeSpentMs: true
      },
      orderBy: { createdAt: 'asc' },
      take: limit
    });

    return new Response(
      JSON.stringify({
        reviews,
        count: reviews.length,
        userId
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Failed to fetch review history:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to fetch review history',
        details: error instanceof Error ? error.message : String(error)
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } finally {
    if (prisma) {
      await prisma.$disconnect();
    }
  }
};
