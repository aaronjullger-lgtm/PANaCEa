/**
 * API: Complete OSCE session
 * POST /api/osce/complete
 */

import { authenticateRequest, createErrorResponse, createSuccessResponse, handleCorsOptions, type Env } from '../_shared/auth';
import { createEdgePrismaClient } from '../_shared/prisma-edge';
import { validateRequest, IDSchema } from '../_shared/schemas';
import { z } from 'zod';

// Schema for OSCE complete
const OSCECompleteFullSchema = z.object({
  sessionId: IDSchema,
  diagnosis: z.string().max(2000).optional(),
  treatmentPlan: z.string().max(5000).optional(),
});

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
    const validation = await validateRequest(request.clone(), OSCECompleteFullSchema);
    if (!validation.success) {
      return (validation as { success: false; response: Response }).response;
    }
    const { sessionId, diagnosis, treatmentPlan } = (validation as { success: true; data: any }).data;

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
