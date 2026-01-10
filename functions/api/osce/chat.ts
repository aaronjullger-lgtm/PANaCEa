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
import { validateRequest, OSCEChatSchema } from '../_shared/schemas';

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
    // Validate input with Zod schema
    const validation = await validateRequest(request.clone(), OSCEChatSchema);
    if (!validation.success) {
      return (validation as { success: false; response: Response }).response;
    }
    const { sessionId, messages } = (validation as { success: true; data: any }).data;

    await prisma.patientEncounterSession.update({
      where: { id: sessionId },
      data: {
        messages: messages,
        updatedAt: new Date()
      }
    });

    return createSuccessResponse({ success: true });
  } catch (error: any) {
    console.error('Error saving chat message:', error);
    return createErrorResponse('Failed to save chat message', 500);
  } finally {
    await prisma.$disconnect();
  }
}
