// functions/api/conditions/index.ts
// GET endpoint to fetch condition list from database
// PUBLIC endpoint - no authentication required for basic condition metadata

import { createEdgePrismaClient } from '../_shared/prisma-edge';
import { handleCorsOptions } from '../_shared/auth';

interface Env {
  DATABASE_URL?: string;
}

interface PagesContext {
  request: Request;
  env: Env;
}

// Handle CORS preflight
export function onRequestOptions(context: PagesContext): Response {
  return handleCorsOptions();
}

/**
 * GET /api/conditions
 * Fetches all published conditions from the Condition table
 * Groups by system for efficient frontend rendering
 * 
 * PUBLIC endpoint - condition metadata is public curriculum content
 */
export async function onRequestGet(context: PagesContext): Promise<Response> {
  const { env } = context;

  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    // Parse query params for filtering
    const url = new URL(context.request.url);
    const system = url.searchParams.get('system');
    const includeContent = url.searchParams.get('includeContent') === 'true';

    // Build where clause
    const where: any = {
      status: 'published',
    };
    
    if (system) {
      where.OR = [
        { system: system.toUpperCase() },
        { relatedSystems: { has: system.toUpperCase() } },
      ];
    }

    // Query conditions
    const conditions = await prisma.condition.findMany({
      where,
      select: {
        id: true,
        name: true,
        system: true,
        subcategory: true,
        relatedSystems: true,
        aliases: true,
        displayName: true,
        status: true,
        content: includeContent,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [
        { system: 'asc' },
        { subcategory: 'asc' },
        { name: 'asc' },
      ],
    });

    // Group by system for frontend convenience
    const bySystem: Record<string, typeof conditions> = {};
    for (const condition of conditions) {
      if (!bySystem[condition.system]) {
        bySystem[condition.system] = [];
      }
      bySystem[condition.system].push(condition);
    }

    return new Response(
      JSON.stringify({
        conditions,
        bySystem,
        total: conditions.length,
        systems: Object.keys(bySystem),
      }),
      { 
        status: 200,
        headers: corsHeaders
      }
    );

  } catch (error) {
    console.error('[Conditions API] Error fetching conditions:', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: 'Failed to fetch conditions. Please try again later.',
      }),
      { 
        status: 500,
        headers: corsHeaders
      }
    );

  } finally {
    await prisma.$disconnect();
  }
}
