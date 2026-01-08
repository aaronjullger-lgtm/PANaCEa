// functions/api/conditions/index.ts
// GET endpoint to fetch condition list from database
// PUBLIC endpoint - no authentication required for basic condition metadata

import { handleCorsOptions } from '../_shared/auth';
import { ContentService } from '../../../lib/services/content/contentService';

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

  const contentService = new ContentService(env.DATABASE_URL);

  try {
    // Parse query params for filtering
    const url = new URL(context.request.url);
    const system = url.searchParams.get('system');
    const includeContent = url.searchParams.get('includeContent') === 'true';

    // Use ContentService to fetch conditions
    // Note: If system is null, we might need a method to get ALL conditions
    // Currently getConditionsBySystem requires a system string.
    // If system is provided, we use it. If not, we might need a new method in ContentService.
    // For now, let's implement getAllConditions in ContentService to match this requirement.
    
    // Use ContentService to fetch conditions
    const conditions = await contentService.getAllConditions({
      system: system,
      includeContent: includeContent,
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
    await contentService.disconnect();
  }
}

