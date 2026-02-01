/**
 * Cloudflare Function: Get Photo Drill Batch
 *
 * Returns a batch of photo drill questions from MediaAsset table
 *
 * Endpoint: GET /api/drill/photo-batch
 * Query Params:
 * - system: Optional organ system filter
 * - difficulty: Optional difficulty filter
 * - count: Number of questions (default 10)
 *
 * @module functions/api/drill/photo-batch
 */

import { authenticateRequest } from '../_shared/auth';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { getPhotoDrillBatch } from '../../../services/drill/photoDrill.service';

export async function onRequestGet(context: any) {
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

    // Parse query params
    const url = new URL(request.url);
    const system = url.searchParams.get('system');
    const difficulty = url.searchParams.get('difficulty');
    const count = parseInt(url.searchParams.get('count') || '10', 10);

    // Validate count
    if (count < 1 || count > 50) {
      return new Response(JSON.stringify({ error: 'Count must be between 1 and 50' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get drill batch
    const questions = await getPhotoDrillBatch({
      prisma,
      system: system || undefined,
      difficulty: difficulty as any,
      count,
    });

    return new Response(JSON.stringify(questions), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching photo drill batch:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to fetch photo drill batch',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  } finally {
    await safePrismaDisconnect(prisma);
  }
}
