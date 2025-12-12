/**
 * API: Get or create today's Grand Rounds challenge
 * GET /api/grandrounds/challenge
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Try to get existing challenge for today
    let challenge = await prisma.grandRoundsChallenge.findUnique({
      where: { date: today }
    });

    // If no challenge exists, create one
    if (!challenge) {
      // Generate 5 random question IDs using the date as seed
      const seed = today.getTime();
      const questionIds = generateQuestionIds(seed, 5);

      challenge = await prisma.grandRoundsChallenge.create({
        data: {
          date: today,
          questionIds,
          seed
        }
      });
    }

    return createSuccessResponse({ challenge });
  } catch (error: any) {
    console.error('Error fetching/creating Grand Rounds challenge:', error);
    return createErrorResponse('Failed to fetch challenge', 500);
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Generate deterministic question IDs based on seed
 */
function generateQuestionIds(seed: number, count: number): string[] {
  const ids: string[] = [];
  let current = seed;
  
  for (let i = 0; i < count; i++) {
    // Simple LCG (Linear Congruential Generator) for deterministic randomness
    current = (current * 1103515245 + 12345) % 2147483648;
    ids.push(`gr-q-${current % 10000}`);
  }
  
  return ids;
}
