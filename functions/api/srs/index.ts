import { authenticateRequest, createErrorResponse, createSuccessResponse, handleCorsOptions, type Env } from '../_shared/auth';
import { createEdgePrismaClient } from '../_shared/prisma-edge';

export async function onRequestGet(context: { request: Request; env: Env }) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return handleCorsOptions();
  }

  const authContext = await authenticateRequest(request, env);
  if (!authContext) {
    return createErrorResponse('Unauthorized', 401);
  }

  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const user = await prisma.user.findUnique({ where: { clerkId: authContext.userId } });
    if (!user) {
      return createErrorResponse('User not found', 404);
    }

    const items = await prisma.sRSItem.findMany({
      where: { userId: user.id }
    });

    return createSuccessResponse({ data: items });
  } catch (error: any) {
    console.error('Error fetching SRS items:', error);
    return createErrorResponse('Failed to fetch SRS items', 500);
  } finally {
    await prisma.$disconnect();
  }
}
