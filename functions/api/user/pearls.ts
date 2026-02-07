/**
 * GET /api/user/pearls - Fetch user's clinical pearls
 *
 * Sprint 8: My Pearls Dashboard
 * Returns pearls from questions the user has answered, with interaction data
 */

import type { EventContext, KVNamespace } from '@cloudflare/workers-types';
import { authenticateRequest } from '../_shared/auth';
import { createEdgePrismaClient } from '../_shared/prisma-edge';

interface Env {
  DATABASE_URL: string;
  CLERK_SECRET_KEY?: string;
  CACHE?: KVNamespace;
}

export async function onRequestGet(context: EventContext<Env, string, unknown>): Promise<Response> {
  const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

  try {
    // Authenticate user
    const authResult = await authenticateRequest(
      context.request as unknown as Request,
      context.env
    );
    if (!authResult?.userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId: authResult.userId },
      select: { id: true },
    });
    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const userId = user.id;
    const url = new URL(context.request.url);
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const system = url.searchParams.get('system');

    const userHistory = await prisma.userQuestionSeen.findMany({
      where: { userId },
      select: { questionId: true },
      orderBy: { lastSeenAt: 'desc' },
      take: 200, // Recent questions
    });

    const questionIds = userHistory.map((h) => h.questionId);

    if (questionIds.length === 0) {
      return new Response(
        JSON.stringify({
          pearls: [],
          stats: { total: 0, mastered: 0, due: 0, saved: 0 },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Build where clause
    const whereClause: Record<string, unknown> = {
      questionId: { in: questionIds },
    };

    if (system) {
      whereClause.system = system;
    }

    // Get pearls from those questions
    const pearls = await prisma.clinicalPearl.findMany({
      where: whereClause,
      orderBy: [{ usefulVotes: 'desc' }, { extractedAt: 'desc' }],
      take: limit,
      select: {
        id: true,
        pearlText: true,
        system: true,
        category: true,
        tags: true,
        fullExplanation: true,
        viewCount: true,
        usefulVotes: true,
      },
    });

    // Get user's interaction data for these pearls
    const pearlIds = pearls.map((p) => p.id);
    const userPearls = await prisma.userPearl.findMany({
      where: {
        userId,
        pearlId: { in: pearlIds },
      },
      select: {
        pearlId: true,
        isSaved: true,
        markedUseful: true,
        viewedAt: true,
        notes: true,
      },
    });

    const userPearlMap = new Map(userPearls.map((up) => [up.pearlId, up]));

    // Merge pearls with user interaction data
    const pearlsWithInteraction = pearls.map((pearl) => {
      const interaction = userPearlMap.get(pearl.id);
      return {
        ...pearl,
        userInteraction: interaction
          ? {
              isSaved: interaction.isSaved,
              markedUseful: interaction.markedUseful,
              viewedAt: interaction.viewedAt?.toISOString(),
              notes: interaction.notes,
            }
          : null,
      };
    });

    // Calculate stats
    const stats = {
      total: pearls.length,
      mastered: userPearls.filter((up) => up.markedUseful).length,
      saved: userPearls.filter((up) => up.isSaved).length,
      due: pearls.length - userPearls.filter((up) => up.markedUseful).length, // Simplified
    };

    return new Response(
      JSON.stringify({
        pearls: pearlsWithInteraction,
        stats,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'private, max-age=60', // 1 minute cache
        },
      }
    );
  } catch (error) {
    console.error('[GET /api/user/pearls] Error:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to fetch pearls',
        message: error instanceof Error ? error.message : 'Unknown error',
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
