import { authenticateRequest, createErrorResponse, createSuccessResponse, handleCorsOptions } from '../../_shared/auth';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';

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

    const body = await request.json();
    const { setId, selectedConditionId, isCorrect } = body as any;

    if (!setId || !selectedConditionId || typeof isCorrect !== 'boolean') {
      return createErrorResponse('Missing required fields', 400);
    }

    // Record the attempt (you can extend this to store more analytics)
    // For now, just return success
    return createSuccessResponse({ 
      success: true,
      correct: isCorrect 
    }, 200);
  } catch (error) {
    console.error('[contrastive/submit] Failed to submit answer', error);
    return createErrorResponse('Failed to submit answer', 500);
  } finally {
    await safePrismaDisconnect(prisma as any);
  }
};
