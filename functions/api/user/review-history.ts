/**
 * API Endpoint: GET /api/user/review-history
 *
 * Fetches complete review history for FSRS optimizer.
 * Returns QuestionAttempt records with telemetry data.
 *
 * Migrated to authenticatedEndpoint: adds rate limiting (300/min), CORS,
 * structured logging, error handling.
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';

const ReviewHistorySchema = z.object({
  query: z
    .object({
      limit: z.coerce.number().int().min(1).max(5000).optional().default(1000),
      mainOnly: z.enum(['true', 'false']).optional().default('false'),
    })
    .optional()
    .default({}),
});

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(
  ReviewHistorySchema,
  async (context) => {
    const { env, auth } = context;
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      const url = new URL(context.request.url);
      const limit = Number.parseInt(url.searchParams.get('limit') ?? '1000', 10);
      const mainOnly = url.searchParams.get('mainOnly') === 'true';

      // Resolve internal user id (UserProgress uses internal id)
      const user = await prisma.user.findUnique({
        where: { clerkId: auth.userId },
        select: { id: true },
      });
      const queryUserId = user?.id ?? auth.userId;

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
          userId: auth.userId,
        },
      };
    } catch (error) {
      console.error('Failed to fetch review history:', error);
      return { status: 500, error: 'Failed to fetch review history' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { source: 'query' }
);
