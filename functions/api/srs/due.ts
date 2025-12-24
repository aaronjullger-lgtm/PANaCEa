/**
 * GET /api/srs/due
 * Fetch SRS items due for review for authenticated user
 */

import { authenticateRequest, createErrorResponse, type Env } from '../_shared/auth';
import { createEdgePrismaClient } from '../_shared/prisma-edge';

export async function onRequestGet(context: { request: Request; env: Env }) {
  const { request, env } = context;

  // Authenticate request
  const authContext = await authenticateRequest(request, env);
  if (!authContext) {
    return createErrorResponse('Unauthorized', 401);
  }

  const { userId } = authContext;

  if (!env.DATABASE_URL) {
    return createErrorResponse('Database not configured', 500);
  }

  try {
    const prisma = createEdgePrismaClient(env.DATABASE_URL);
    const now = new Date();

    // Fetch all SRS items due for review (dueDate <= now)
    const dueItems = await prisma.sRSItem.findMany({
      where: {
        userId,
        dueDate: {
          lte: now,
        },
      },
      orderBy: [
        { dueDate: 'asc' }, // Most overdue first
        { difficulty: 'desc' }, // Harder questions prioritized
      ],
      take: 100, // Limit to prevent overwhelming response
      select: {
        id: true,
        questionId: true,
        interval: true,
        dueDate: true,
        difficulty: true,
        easiness: true,
        repetition: true,
        fsrsStability: true,
        fsrsDifficulty: true,
        fsrsState: true,
      },
    });

    // Calculate overdue days for each item
    const enrichedItems = dueItems.map((item) => {
      const overdueDays = Math.floor(
        (now.getTime() - item.dueDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      return {
        ...item,
        overdueDays,
        priority: overdueDays * item.difficulty, // Higher = more urgent
      };
    });

    await prisma.$disconnect();

    return new Response(
      JSON.stringify({
        items: enrichedItems,
        totalDue: enrichedItems.length,
        timestamp: now.toISOString(),
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[SRS Due] Error fetching due items:', error);
    return createErrorResponse('Failed to fetch due items', 500);
  }
}
