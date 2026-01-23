import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { z } from 'zod';

interface Env {
  DATABASE_URL: string;
  CLERK_SECRET_KEY: string;
}

// Flattened schema for query params (no nested 'query' wrapper)
const RecommendationListSchema = z.object({
  status: z.enum(['pending', 'completed', 'dismissed']).optional(),
});

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(
  RecommendationListSchema,
  async (context) => {
    const { request, env, auth, validated } = context;
    const logger = createEndpointLogger('/api/recommendations/list');
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

      // Direct access to validated fields (no longer nested under .query)
      const status = validated.status || 'pending';

      const recommendations = await prisma.studyRecommendation.findMany({
        where: {
          userId: user.id,
          status: status as any,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 50, // Limit to 50 most recent
      });

      // Return just the recommendations array for simpler frontend handling
      return {
        data: recommendations,
      };
    } catch (error) {
      logger.error('Failed to fetch recommendations', error);
      return {
        status: 500,
        error: 'Failed to fetch recommendations',
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { source: 'query' }
);
