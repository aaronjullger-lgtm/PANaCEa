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
    if (!auth?.userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const userId = auth.userId;
    const url = new URL(context.request.url);
    const limit = Number.parseInt(url.searchParams.get('limit') ?? '1000', 10);
    // FSRS isolation: when true, return only MAIN/session attempts (exclude cram, rapid_recall, osce, drill)
    const mainOnly = url.searchParams.get('mainOnly') === 'true';

    // Connect to database
    prisma = createEdgePrismaClient(context.env.DATABASE_URL);

    // Resolve internal user id if needed (UserProgress/ReviewLog use internal id; QuestionAttempt may use clerkId)
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true },
    });
    const queryUserId = user?.id ?? userId;

    // Fetch review history with telemetry. When mainOnly, exclude non-FSRS modes.
    const reviews = await prisma.questionAttempt.findMany({
      where: {
        userId: queryUserId,
        ...(mainOnly && {
          mode: { in: ['session', 'main', 'MAIN'] },
        }),
      },
      select: {
        id: true,
        userId: true,
        questionId: true,
        wasCorrect: true,
        createdAt: true,
        durationMs: true,
        telemetryJson: true,
        answerChangedCount: true,
        timeSpentMs: true,
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    return new Response(
      JSON.stringify({
        reviews,
        count: reviews.length,
        userId,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Failed to fetch review history:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to fetch review history',
        details: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } finally {
    if (prisma) {
      await prisma.$disconnect();
    }
  }
};
