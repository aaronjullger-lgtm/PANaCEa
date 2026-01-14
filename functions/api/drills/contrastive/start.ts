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

    const body = (await request.json()) as Partial<{ setId: string }> | null;
    const { setId } = body || {};

    if (!setId) {
      return createErrorResponse('setId is required', 400);
    }

    // Fetch the contrastive set
    const set = await prisma.contrastiveSet.findUnique({
      where: { id: setId },
      include: {
        conditions: true,
      },
    });

    if (!set) {
      return createErrorResponse('Contrastive set not found', 404);
    }

    return createSuccessResponse({ set }, 200);
  } catch (error) {
    console.error('[contrastive/start] Failed to start drill', error);
    return createErrorResponse('Failed to start contrastive drill', 500);
  } finally {
    await safePrismaDisconnect(prisma as any);
  }
};
