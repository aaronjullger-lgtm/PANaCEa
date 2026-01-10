
import { authenticateRequest, handleCorsOptions, type Env } from '../_shared/auth';
import { createEdgePrismaClient } from '../_shared/prisma-edge';
import { SessionService, type SessionQuestionRequest } from '../../../lib/services/session/sessionService';
import { validateRequest, SessionRequestSchema } from '../_shared/schemas';

export const onRequestOptions = handleCorsOptions;

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

/**
 * GET /api/questions/session
 * Fetch questions for a study session
 */
export async function onRequestGet(context: { request: Request; env: Env }) {
  const prisma = createEdgePrismaClient(context.env.DATABASE_URL);
  try {
    const authResult = await authenticateRequest(context.request, context.env);
    if (!authResult) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const user = await prisma.user.findUnique({
      where: { clerkId: authResult.userId },
      select: { id: true },
    });

    if (!user) {
      return jsonResponse({ 
        error: 'User not found',
        message: 'Your user account has not been synced yet. Please refresh and try again.',
      }, 404);
    }

    const url = new URL(context.request.url);
    const count = parseInt(url.searchParams.get('count') || '10', 10);
    const system = url.searchParams.get('system');
    const difficulty = url.searchParams.get('difficulty') as 'easy' | 'medium' | 'hard' | null;
    const mode = url.searchParams.get('mode') || 'standard';

    const sessionService = new SessionService(context.env.DATABASE_URL, context.env);
    const result = await sessionService.getSessionQuestions({
      userId: user.id,
      count: Math.min(count, 50),
      system: system || undefined,
      difficulty: difficulty || undefined,
      mode: mode as SessionQuestionRequest['mode'],
    });

    return jsonResponse(result);
  } catch (error) {
    console.error('[Session] Error:', error);
    return jsonResponse({ error: 'Failed to fetch session questions' }, 500);
  } finally {
    if(prisma) {
        await prisma.$disconnect();
    }
  }
}

/**
 * POST /api/questions/session
 * Fetch questions with more complex filtering
 */
export async function onRequestPost(context: { request: Request; env: Env }) {
  // Validate request body with Zod schema first
  const validation = await validateRequest(context.request, SessionRequestSchema);
  if (!validation.success) {
    return (validation as { success: false; response: Response }).response;
  }

  const prisma = createEdgePrismaClient(context.env.DATABASE_URL);
  try {
    const authResult = await authenticateRequest(context.request, context.env);
    if (!authResult) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const user = await prisma.user.findUnique({
      where: { clerkId: authResult.userId },
      select: { id: true },
    });

    if (!user) {
      return jsonResponse({ 
        error: 'User not found',
        message: 'Your user account has not been synced yet. Please refresh and try again.',
      }, 404);
    }

    const sessionService = new SessionService(context.env.DATABASE_URL, context.env);
    const result = await sessionService.getSessionQuestions({
      ...validation.data,
      userId: user.id,
      count: Math.min(validation.data.count || 10, 50),
    });

    return jsonResponse(result);
  } catch (error) {
    console.error('[Session] Error:', error);
    return jsonResponse({ error: 'Failed to fetch session questions' }, 500);
  } finally {
    if(prisma) {
        await prisma.$disconnect();
    }
  }
}
