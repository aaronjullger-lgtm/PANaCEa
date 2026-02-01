/**
 * Cloudflare Function: Get Drill Overview
 *
 * Returns drill statistics overview for DrillHub dashboard
 *
 * Endpoint: GET /api/drill/overview
 *
 * @module functions/api/drill/overview
 */

import { authenticateRequest } from '../_shared/auth';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { getDrillOverview } from '../../../services/drill/drillSessionManager';

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

    // Get overview
    const overview = await getDrillOverview(prisma, userId);

    return new Response(JSON.stringify(overview), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching drill overview:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to fetch drill overview',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  } finally {
    await safePrismaDisconnect(prisma);
  }
}
