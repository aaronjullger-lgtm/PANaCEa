/**
 * API: Get a random patient encounter case
 * GET /api/osce/cases/random
 */

import { authenticateRequest, createErrorResponse, createSuccessResponse, handleCorsOptions, type Env } from '../../_shared/auth';
import { createEdgePrismaClient } from '../../_shared/prisma-edge';

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
    const count = await prisma.patientEncounterCase.count();
    if (count === 0) {
      return createErrorResponse('No cases found', 404);
    }
    
    const skip = Math.floor(Math.random() * count);
    const randomCase = await prisma.patientEncounterCase.findFirst({
      skip: skip
    });
    
    return createSuccessResponse(randomCase);
  } catch (error: any) {
    console.error('Error fetching random OSCE case:', error);
    return createErrorResponse('Internal server error', 500);
  }
}
