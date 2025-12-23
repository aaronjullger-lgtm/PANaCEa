// functions/api/conditions/index.ts
// GET endpoint to fetch condition list from database

import { createEdgePrismaClient } from '../_shared/prisma-edge';
import { authenticateRequest } from '../_shared/auth';

interface Env {
  DATABASE_URL?: string;
  CLERK_SECRET_KEY?: string;
}

interface PagesContext {
  request: Request;
  env: Env;
}

/**
 * GET /api/conditions
 * Fetches all published conditions from the Condition table
 * Groups by system for efficient frontend rendering
 */
export async function onRequestGet(context: PagesContext): Promise<Response> {
  const { request, env } = context;

  // Authenticate the request
  const authResult = await authenticateRequest(request, env.CLERK_SECRET_KEY);
  if (!authResult.authenticated) {
    return new Response(
      JSON.stringify({ 
        error: 'Unauthorized', 
        message: 'Authentication required to access conditions' 
      }),
      { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    // Parse query params for filtering
    const url = new URL(request.url);
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
        headers: { 'Content-Type': 'application/json' }
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
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } finally {
    await prisma.$disconnect();
  }
}
