/**
 * API: Complete OSCE session
 * POST /api/osce/complete
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
    const { sessionId, diagnosis, treatmentPlan } = body;

    if (!sessionId) {
      return createErrorResponse('Missing sessionId', 400);
    }

    await prisma.patientEncounterSession.update({
      where: { id: sessionId },
      data: {
        status: 'completed',
        diagnosis,
        treatmentPlan,
        updatedAt: new Date()
      }
    });

    return createSuccessResponse({ success: true });
  } catch (error: any) {
    console.error('Error completing OSCE session:', error);
    return createErrorResponse('Internal server error', 500);
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}
