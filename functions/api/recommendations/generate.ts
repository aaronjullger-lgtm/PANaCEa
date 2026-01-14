import { authenticateRequest, createErrorResponse, createSuccessResponse, handleCorsOptions } from '../_shared/auth';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { generateRecommendations } from '../../../lib/recommendationEngine';

interface Env {
  DATABASE_URL: string;
  CLERK_SECRET_KEY: string;
}

export const onRequestOptions = handleCorsOptions;

export const onRequestPost = async (context: { request: Request; env: Env }) => {
  const { request, env } = context;
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const auth = await authenticateRequest(request as any, env as any);
    if (!auth) return createErrorResponse('Unauthorized', 401);

    const recommendations = await generateRecommendations(auth.userId, prisma);

    return createSuccessResponse({ 
      success: true, 
      count: recommendations.length, 
      recommendations 
    });
  } catch (error) {
    console.error('[recommendations/generate] Recommendation generation failed', error);
    return createErrorResponse('Failed to generate recommendations', 500);
  } finally {
    await safePrismaDisconnect(prisma as any);
  }
};
