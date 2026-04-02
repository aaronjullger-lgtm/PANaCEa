/**
 * API Endpoint: GET /api/user/review-history
 *
 * Fetches complete review history for FSRS optimizer
 * Returns QuestionAttempt records with telemetry data
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';

/**
 * Schema for review history query parameters
 */
const ReviewHistorySchema = z.object({
  limit: z.coerce.number().int().positive().default(1000),
  // FSRS isolation: when true, return only MAIN/session attempts (exclude cram, rapid_recall, osce, drill)
  mainOnly: z.string().optional().transform((val) => val === 'true'),
});

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(
  ReviewHistorySchema,
  async (context) => {
    const { env, auth, validated } = context;
    const userId = auth.userId;
    const { limit, mainOnly } = validated;

    let prisma;

    try {
      // Connect to database
      prisma = createEdgePrismaClient(env.DATABASE_URL);

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

      return {
        data: {
          reviews,
          count: reviews.length,
          userId,
        }
      };
    } catch (error) {
      console.error('Failed to fetch review history:', error);
      return {
        status: 500,
        error: 'Failed to fetch review history'
      };
    } finally {
      if (prisma) {
        await safePrismaDisconnect(prisma);
      }
    }
  },
  { source: 'query' }
);
