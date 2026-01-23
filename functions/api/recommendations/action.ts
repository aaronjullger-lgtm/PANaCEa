import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { z } from 'zod';

interface Env {
  DATABASE_URL: string;
  CLERK_SECRET_KEY: string;
}

// Define Zod schema for request validation
const RecommendationActionSchema = z.object({
  body: z.object({
    recommendationId: z.string().uuid(),
    action: z.enum(['complete', 'dismiss']),
  }),
});

export const onRequestOptions = withCors();

export const onRequestPost = authenticatedEndpoint(RecommendationActionSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/recommendations/action');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const user = await prisma.user.findUnique({
      where: { clerkId: auth.userId },
      select: { id: true },
    });

    if (!user) {
      return {
        status: 404,
        error: 'User not found',
      };
    }

    const { recommendationId, action } = validated.body;

    const { count } = await prisma.studyRecommendation.updateMany({
      where: {
        id: recommendationId,
        userId: user.id, // Security: ensure user owns the recommendation
      },
      data: {
        status: action === 'complete' ? 'completed' : 'dismissed',
        completedAt: action === 'complete' ? new Date() : null,
      },
    });

    if (count === 0) {
      return {
        status: 404,
        error: 'Recommendation not found',
      };
    }

    const updated = await prisma.studyRecommendation.findUnique({
      where: { id: recommendationId },
    });

    return {
      data: { success: true, recommendation: updated },
    };
  } catch (error) {
    logger.error('Failed to update recommendation', error);
    return {
      status: 500,
      error: 'Failed to update recommendation',
    };
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
