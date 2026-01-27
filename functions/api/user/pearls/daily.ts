/**
 * GET /api/user/pearls/daily - Get Pearl of the Day
 *
 * Sprint 8: My Pearls Dashboard
 * Returns a daily pearl - either personalized (from user's history) or random
 * Uses date-based deterministic selection for consistency within the same day
 */

import type { EventContext, KVNamespace } from '@cloudflare/workers-types';
import { authenticateRequest } from '../../_shared/auth';
import { createEdgePrismaClient } from '../../_shared/prisma-edge';

interface Env {
  DATABASE_URL: string;
  CLERK_SECRET_KEY?: string;
  CACHE?: KVNamespace;
}

interface QuestionSeen {
  questionId: string;
}

export async function onRequestGet(context: EventContext<Env, string, unknown>): Promise<Response> {
  const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

  try {
    // Try to authenticate (optional for daily pearl)
    let userId: string | null = null;
    try {
      const authResult = await authenticateRequest(context.request as unknown as Request, context.env);
      if (authResult?.userId) {
        userId = authResult.userId;
      }
    } catch {
      // Anonymous access is fine
    }

    // Calculate day-of-year for consistent daily selection
    const today = new Date();
    const startOfYear = new Date(today.getFullYear(), 0, 1);
    const dayOfYear = Math.floor((today.getTime() - startOfYear.getTime()) / 86400000);

    let pearl = null;

    // If user is authenticated, try to get a pearl from their history first
    if (userId) {
      const userHistory = await prisma.userQuestionSeen.findMany({
        where: { userId },
        select: { questionId: true },
        take: 100,
      });

      const questionIds = userHistory.map((h: QuestionSeen) => h.questionId);

      if (questionIds.length > 0) {
        const count = await prisma.clinicalPearl.count({
          where: { questionId: { in: questionIds } },
        });

        if (count > 0) {
          const skip = dayOfYear % count;
          pearl = await prisma.clinicalPearl.findFirst({
            where: { questionId: { in: questionIds } },
            orderBy: { usefulVotes: 'desc' },
            skip,
            select: {
              id: true,
              pearlText: true,
              system: true,
              category: true,
            },
          });
        }
      }
    }

    // Fallback: any random pearl based on date
    if (!pearl) {
      const count = await prisma.clinicalPearl.count();
      if (count > 0) {
        const skip = dayOfYear % count;
        pearl = await prisma.clinicalPearl.findFirst({
          orderBy: { usefulVotes: 'desc' },
          skip,
          select: {
            id: true,
            pearlText: true,
            system: true,
            category: true,
          },
        });
      }
    }

    // Update view count if pearl found
    if (pearl) {
      await prisma.clinicalPearl.update({
        where: { id: pearl.id },
        data: { viewCount: { increment: 1 } },
      });
    }

    return new Response(
      JSON.stringify({
        pearl,
        date: today.toISOString().split('T')[0],
        personalized: userId !== null && pearl !== null,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          // Cache for the rest of the day (up to 24 hours)
          'Cache-Control': 'public, max-age=3600',
        },
      }
    );
  } catch (error) {
    console.error('[GET /api/user/pearls/daily] Error:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to fetch daily pearl',
        pearl: null,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } finally {
    await prisma.$disconnect();
  }
}
