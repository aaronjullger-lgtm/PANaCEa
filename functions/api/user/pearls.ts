/**
 * GET /api/user/pearls - Fetch user's clinical pearls
 *
 * Sprint 8: My Pearls Dashboard
 * Returns pearls from questions the user has answered, with interaction data.
 *
 * Migrated to authenticatedEndpoint: adds rate limiting (300/min), CORS,
 * structured logging, error handling.
 */

import { z } from 'zod';
import { authenticatedEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';

const PearlsQuerySchema = z.object({
  query: z
    .object({
      limit: z.coerce.number().int().min(1).max(200).optional().default(50),
      system: z.string().optional(),
    })
    .optional()
    .default({}),
});

export const onRequestGet = authenticatedEndpoint(
  PearlsQuerySchema,
  async (context) => {
    const { env, auth } = context;
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      const url = new URL(context.request.url);
      const limit = parseInt(url.searchParams.get('limit') || '50', 10);
      const system = url.searchParams.get('system');

      const user = await prisma.user.findUnique({
        where: { clerkId: auth.userId },
        select: { id: true },
      });
      if (!user) {
        return { status: 404, error: 'User not found' };
      }
      const userId = user.id;

      const userHistory = await prisma.userQuestionSeen.findMany({
        where: { userId },
        select: { questionId: true },
        orderBy: { lastSeenAt: 'desc' },
        take: 200,
      });

      const questionIds = userHistory.map((h: any) => h.questionId);

      if (questionIds.length === 0) {
        return {
          data: {
            pearls: [],
            stats: { total: 0, mastered: 0, due: 0, saved: 0 },
          },
        };
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
      const pearlIds = pearls.map((p: any) => p.id);
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

      const userPearlMap = new Map(userPearls.map((up: any) => [up.pearlId, up]));

      // Merge pearls with user interaction data
      const pearlsWithInteraction = pearls.map((pearl: any) => {
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

      const stats = {
        total: pearls.length,
        mastered: userPearls.filter((up: any) => up.markedUseful).length,
        saved: userPearls.filter((up: any) => up.isSaved).length,
        due: pearls.length - userPearls.filter((up: any) => up.markedUseful).length,
      };

      return {
        data: {
          pearls: pearlsWithInteraction,
          stats,
        },
      };
    } catch (error) {
      console.error('[GET /api/user/pearls] Error:', error);
      return { status: 500, error: 'Failed to fetch pearls' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { source: 'query' }
);
