import { authenticateRequest, createErrorResponse, createSuccessResponse, handleCorsOptions } from '../_shared/auth';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';

interface Env {
  DATABASE_URL: string;
  CLERK_SECRET_KEY: string;
}

export const onRequestOptions = handleCorsOptions;

export const onRequestGet = async (context: { request: Request; env: Env }) => {
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

    const url = new URL(request.url);
    const status = url.searchParams.get('status') || 'pending';

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

    return createSuccessResponse({ 
      recommendations,
      total: recommendations.length 
    });
  } catch (error) {
    console.error('[recommendations/list] Failed to fetch recommendations', error);
    return createErrorResponse('Failed to fetch recommendations', 500);
  } finally {
    await safePrismaDisconnect(prisma as any);
  }
};
