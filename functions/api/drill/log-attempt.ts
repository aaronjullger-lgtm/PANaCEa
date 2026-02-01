/**
 * Cloudflare Function: Log Drill Attempt
 *
 * Logs a drill attempt with statistical isolation (isMainSession = false)
 *
 * Endpoint: POST /api/drill/log-attempt
 * Body:
 * {
 *   questionId?: string;
 *   conditionId?: string;
 *   drillType: 'photo_drill' | 'contrastive_drill' | 'rapid_recall' | 'wordle';
 *   wasCorrect: boolean;
 *   responseTimeMs: number;
 *   metadata?: Record<string, any>;
 * }
 *
 * @module functions/api/drill/log-attempt
 */

import { authenticateRequest } from '../_shared/auth';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { logDrillAttempt, DrillAttemptData } from '../../../services/drill/drillSessionManager';

export async function onRequestPost(context: any) {
  const { request, env } = context;
  let prisma: any = null;

  try {
    // Create edge Prisma client
    prisma = createEdgePrismaClient(env.DATABASE_URL);

    // Authenticate
    const authContext = await authenticateRequest(request, env);
    if (!authContext) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const userId = authContext.userId;

    // Parse body
    const body = await request.json();
    const { questionId, conditionId, drillType, wasCorrect, responseTimeMs, metadata } = body;

    // Validate required fields
    if (!drillType || typeof wasCorrect !== 'boolean' || typeof responseTimeMs !== 'number') {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields: drillType, wasCorrect, responseTimeMs',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate drill type
    const validDrillTypes = ['photo_drill', 'contrastive_drill', 'rapid_recall', 'wordle'];
    if (!validDrillTypes.includes(drillType)) {
      return new Response(
        JSON.stringify({
          error: `Invalid drillType. Must be one of: ${validDrillTypes.join(', ')}`,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Log attempt (map responseTimeMs from request body to durationMs for interface)
    const attemptData: DrillAttemptData = {
      userId,
      questionId,
      conditionId,
      drillType,
      wasCorrect,
      durationMs: responseTimeMs, // Map to correct interface property
      metadata,
    };

    const attempt = await logDrillAttempt(prisma, attemptData);

    return new Response(
      JSON.stringify({
        success: true,
        attemptId: attempt.id,
        isMainSession: false, // Confirm statistical isolation
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error logging drill attempt:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to log drill attempt',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  } finally {
    await safePrismaDisconnect(prisma);
  }
}
