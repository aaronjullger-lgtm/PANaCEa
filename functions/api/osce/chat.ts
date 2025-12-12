/**
 * API: Save OSCE chat message
 * POST /api/osce/chat
 * 
 * Body: {
 *   sessionId: string,
 *   userId: string,
 *   role: 'user' | 'patient',
 *   message: string,
 *   phase?: string,
 *   isRelevant?: boolean
 * }
 */

import { authenticateRequest, createErrorResponse, createSuccessResponse, handleCorsOptions, type Env } from '../_shared/auth';
import { createEdgePrismaClient } from '../_shared/prisma-edge';

export async function onRequestPost(context: { request: Request; env: Env }) {
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
    const body = await request.json();
    const { sessionId, userId, role, message, phase, isRelevant } = body;

    // Validate required fields
    if (!sessionId || !userId || !role || !message) {
      return createErrorResponse('Missing required fields', 400);
    }

    // Validate role
    if (role !== 'user' && role !== 'patient') {
      return createErrorResponse('Invalid role. Must be "user" or "patient"', 400);
    }

    // Validate message length
    if (typeof message !== 'string' || message.length === 0 || message.length > 5000) {
      return createErrorResponse('Invalid message: must be between 1 and 5000 characters', 400);
    }

    // Validate sessionId format
    if (typeof sessionId !== 'string' || sessionId.length === 0 || sessionId.length > 100) {
      return createErrorResponse('Invalid sessionId format', 400);
    }

    const chatMessage = await prisma.encounterChatHistory.create({
      data: {
        sessionId,
        userId,
        role,
        message,
        phase: phase || null,
        isRelevant: isRelevant !== undefined ? isRelevant : true
      }
    });

    return createSuccessResponse({ message: chatMessage });
  } catch (error: any) {
    console.error('Error saving chat message:', error);
    return createErrorResponse('Failed to save chat message', 500);
  } finally {
    await prisma.$disconnect();
  }
}
