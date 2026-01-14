import { authenticateRequest, createErrorResponse, createSuccessResponse, handleCorsOptions } from '../_shared/auth';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';

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

    const user = await prisma.user.findUnique({
      where: { clerkId: auth.userId },
      select: { id: true },
    });

    if (!user) return createErrorResponse('User not found', 404);

    const body = await request.json();
    const { recommendationId, action } = body as { recommendationId: string; action: 'complete' | 'dismiss' };

    if (!recommendationId || !['complete', 'dismiss'].includes(action)) {
      return createErrorResponse('Invalid request', 400);
    }

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
      return createErrorResponse('Recommendation not found', 404);
    }

    const updated = await prisma.studyRecommendation.findUnique({ where: { id: recommendationId } });

    return createSuccessResponse({ success: true, recommendation: updated });
  } catch (error) {
    console.error('[recommendations/action] Failed to update recommendation', error);
    return createErrorResponse('Failed to update recommendation', 500);
  } finally {
    await safePrismaDisconnect(prisma as any);
  }
};
