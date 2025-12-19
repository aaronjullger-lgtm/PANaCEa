import { handleCorsOptions } from '../_shared/auth';
import { createEdgePrismaClient } from '../_shared/prisma-edge';
import { searchContent } from '../_shared/content-search';

export const onRequestOptions = handleCorsOptions;

/**
 * Content Search API Endpoint
 * GET /api/content/search?q=<query>&limit=<limit>&type=<condition|drug>
 * 
 * Uses database-driven search with intelligent ranking:
 * - Prioritizes exact matches, then alias matches, then fuzzy matches
 * - Supports medical aliases and alternate names
 * - Returns ranked results with match metadata
 */
export async function onRequestGet(context: any) {
  const { request, env } = context;
  const url = new URL(request.url);
  const q = url.searchParams.get('q');
  const limitParam = url.searchParams.get('limit');
  const typeParam = url.searchParams.get('type');

  // Validate query parameter
  if (!q) {
    return new Response(JSON.stringify({ 
      error: 'Query parameter "q" is required',
      message: 'Please provide a search query'
    }), { 
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Validate query length
  if (q.trim().length < 2) {
    return new Response(JSON.stringify({ 
      error: 'Query too short',
      message: 'Search query must be at least 2 characters'
    }), { 
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Validate database configuration
  if (!env.DATABASE_URL) {
    return new Response(JSON.stringify({ 
      error: 'Database not configured',
      message: 'Search service is temporarily unavailable'
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Parse parameters
  const query = String(q).trim();
  const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10), 1), 50) : 10;
  
  // Parse content types to search
  let includeTypes: ('condition' | 'drug')[] = ['condition', 'drug'];
  if (typeParam) {
    const types = typeParam.split(',').map(t => t.trim().toLowerCase());
    includeTypes = types.filter(t => t === 'condition' || t === 'drug') as ('condition' | 'drug')[];
    
    if (includeTypes.length === 0) {
      includeTypes = ['condition', 'drug']; // Fallback to all types
    }
  }

  try {
    // Create Prisma client for edge runtime
    const prisma = createEdgePrismaClient(env.DATABASE_URL);
    
    // Use the enhanced search service
    const results = await searchContent(prisma, query, limit, includeTypes);
    
    return new Response(JSON.stringify({ 
      results,
      count: results.length,
      query: query,
      limit: limit
    }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
      }
    });
  } catch (error: any) {
    console.error('Error searching content:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message: 'Failed to search content',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }), { 
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}
