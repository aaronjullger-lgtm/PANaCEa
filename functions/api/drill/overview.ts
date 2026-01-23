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
import { createEdgePrismaClient } from '../_shared/prisma-edge';
import { getDrillOverview } from '../../../services/drill/drillSessionManager';

export async function onRequestGet(context: any) {
  const { request, env } = context;

  try {
    // Authenticate
    const userId = await authenticateRequest(context);
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get overview
    const overview = await getDrillOverview(userId);

    return new Response(
      JSON.stringify(overview),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching drill overview:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to fetch drill overview',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
