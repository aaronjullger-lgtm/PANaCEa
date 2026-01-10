/**
 * API: Delete OSCE chat history for a session
 * DELETE /api/osce/history?sessionId={sessionId}
 * POST /api/osce/cleanup?sessionId={sessionId}
 * 
 * Query params:
 * - sessionId: string (required)
 * 
 * Note: This is called after an encounter is complete to clean up chat history
 */

import { authenticateRequest, createErrorResponse, createSuccessResponse, handleCorsOptions, type Env } from '../_shared/auth';
import { createEdgePrismaClient } from '../_shared/prisma-edge';
import { validateRequest, IDSchema } from '../_shared/schemas';
import { z } from 'zod';

// Zod schema for cleanup (optional body param - can also use query param)
const CleanupSchema = z.object({
  sessionId: IDSchema.optional(),
});

async function handleCleanup(request: Request, env: Env) {
  const authContext = await authenticateRequest(request, env);
  if (!authContext) {
    return createErrorResponse('Unauthorized', 401);
  }

  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    // Try to get sessionId from body first (with Zod validation), then fall back to query param
    let sessionId: string | null = null;
    
    const url = new URL(request.url);
    sessionId = url.searchParams.get('sessionId');
    
    // Try body if not in query params
    if (!sessionId && request.method === 'POST') {
      const validation = await validateRequest(request.clone(), CleanupSchema);
      if (validation.success) {
        const data = (validation as { success: true; data: any }).data;
        sessionId = data.sessionId || null;
      }
    }

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

export async function onRequestDelete(context: { request: Request; env: Env }) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return handleCorsOptions();
  }

  return handleCleanup(request, env);
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return handleCorsOptions();
  }

  return handleCleanup(request, env);
}
