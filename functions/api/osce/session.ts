/**
 * API: Create or get active OSCE session
 * POST /api/osce/session
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
    const { caseId } = body;

    if (!caseId) {
      return createErrorResponse('Missing caseId', 400);
    }

    const user = await prisma.user.findUnique({ 
      where: { clerkId: authContext.userId } 
    });
    
    if (!user) {
      return createErrorResponse('User not found', 404);
    }

    // Check for existing active session for this case
    const existingSession = await prisma.patientEncounterSession.findFirst({
      where: {
        userId: user.id,
        caseId: caseId,
        status: 'active'
      }
    });

    if (existingSession) {
      return createSuccessResponse({ success: true, session: existingSession });
    }

    // Create new session
    const session = await prisma.patientEncounterSession.create({
      data: {
        userId: user.id,
        caseId,
        messages: [],
        status: 'active'
      }
    });

    return createSuccessResponse({ success: true, session });
  } catch (error: any) {
    console.error('Error creating OSCE session:', error);
    return createErrorResponse('Internal server error', 500);
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}
