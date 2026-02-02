import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { generateRecommendations } from '../../../lib/recommendationEngine';
import { createEndpointLogger } from '../_shared/secureLogger';
import { z } from 'zod';

interface Env {
  DATABASE_URL: string;
  CLERK_SECRET_KEY: string;
}

// Define Zod schema for request validation (empty for this endpoint)
const RecommendationGenerationSchema = z.object({});

export const onRequestOptions = withCors();

export const onRequestPost = authenticatedEndpoint(
  RecommendationGenerationSchema,
  async (context) => {
    const { env, auth } = context;
    const logger = createEndpointLogger('/api/recommendations/generate');
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      const user = await prisma.user.findUnique({
        where: { clerkId: auth.userId },
        select: { id: true },
      });
      if (!user) {
        return { status: 404, error: 'User not found' };
      }
      const recommendations = await generateRecommendations(user.id, prisma);

      return {
        data: {
          success: true,
          count: recommendations.length,
          recommendations,
        },
      };
    } catch (error) {
      logger.error('Recommendation generation failed', error);
      return {
        status: 500,
        error: 'Failed to generate recommendations',
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
