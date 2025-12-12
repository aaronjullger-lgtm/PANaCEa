/**
 * API: Delete OSCE chat history for a session
 * DELETE /api/osce/history?sessionId={sessionId}
 * 
 * Query params:
 * - sessionId: string (required)
 * 
 * Note: This is called after an encounter is complete to clean up chat history
 */

import { authenticateRequest, createErrorResponse, createSuccessResponse, handleCorsOptions, type Env } from '../_shared/auth';
import { createEdgePrismaClient } from '../_shared/prisma-edge';

export async function onRequestDelete(context: { request: Request; env: Env }) {
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

    if (!sessionId) {
      return createErrorResponse('Missing sessionId parameter', 400);
    }

    const result = await prisma.encounterChatHistory.deleteMany({
      where: { sessionId }
    });

    return createSuccessResponse({ 
      deleted: result.count,
      message: `Deleted ${result.count} chat messages for session ${sessionId}`
    });
  } catch (error: any) {
    console.error('Error deleting chat history:', error);
    return createErrorResponse('Failed to delete chat history', 500);
  } finally {
    await prisma.$disconnect();
  }
}
