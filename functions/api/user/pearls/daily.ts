/**
 * GET /api/user/pearls/daily - Get Pearl of the Day
 *
 * Sprint 8: My Pearls Dashboard
 * Returns a daily pearl - either personalized (from user's history) or random.
 * Uses date-based deterministic selection for consistency within the same day.
 *
 * Auth is optional — anonymous users get a random pearl.
 * Migrated to publicEndpoint: adds rate limiting (600/min by IP), CORS,
 * structured logging, error handling.
 */

import { z } from 'zod';
import { publicEndpoint } from '../../_shared/middleware';
import { authenticateRequest } from '../../_shared/auth';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';

export const onRequestGet = publicEndpoint(
  z.object({}).passthrough(),
  async (context) => {
    const { env } = context;
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      // Try to authenticate (optional — enriches pearl selection if logged in)
      let userId: string | null = null;
      try {
        const authResult = await authenticateRequest(context.request, env);
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

        const questionIds = userHistory.map((h: any) => h.questionId);

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

      // Update view count only for authenticated users
      if (pearl && userId) {
        await prisma.clinicalPearl.update({
          where: { id: pearl.id },
          data: { viewCount: { increment: 1 } },
        });
      }

      return {
        data: {
          pearl,
          date: today.toISOString().split('T')[0],
          personalized: userId !== null && pearl !== null,
        },
      };
    } catch (error) {
      console.error('[GET /api/user/pearls/daily] Error:', error);
      return { status: 500, error: 'Failed to fetch daily pearl' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { envRequired: ['DATABASE_URL'] }
);
