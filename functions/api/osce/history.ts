/**
 * API: Get OSCE chat history for a session
 * GET /api/osce/history?sessionId={sessionId}
 * 
 * Query params:
 * - sessionId: string (required)
 * - limit: number (optional, default 100)
 */

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
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('sessionId');
    const limitParam = url.searchParams.get('limit') || '100';
    const limit = Math.min(parseInt(limitParam, 10), 500);

    if (!sessionId) {
      return createErrorResponse('Missing sessionId parameter', 400);
    }

    const history = await prisma.encounterChatHistory.findMany({
      where: { sessionId },
      orderBy: { timestamp: 'asc' },
      take: limit
    });

    return createSuccessResponse({ history });
  } catch (error: any) {
    console.error('Error fetching chat history:', error);
    return createErrorResponse('Failed to fetch chat history', 500);
  } finally {
    await prisma.$disconnect();
  }
}
