import { createEdgePrismaClient } from '../../_shared/prisma-edge';
import { handleCorsOptions, verifyAuthToken } from '../../_shared/auth';

export const onRequestOptions = handleCorsOptions;

/**
 * GET /api/reference/procedures
 * Fetch all procedures, optionally filtered by category or search query
 */
export async function onRequestGet(context: any) {
  const { request, env } = context;
  const url = new URL(request.url);
  const category = url.searchParams.get('category');
  const system = url.searchParams.get('system');
  const query = url.searchParams.get('query');

  // Verify authentication
  const authHeader = request.headers.get('Authorization');
  const userId = await verifyAuthToken(authHeader, env.CLERK_SECRET_KEY);
  
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
      status: 401,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  if (!env.DATABASE_URL) {
    return new Response(JSON.stringify({ error: 'Database not configured' }), { 
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  try {
    const prisma = createEdgePrismaClient(env.DATABASE_URL);
    
    let results;
    
    if (query) {
      // Search mode
      results = await prisma.procedure.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
            { indication: { contains: query, mode: 'insensitive' } }
          ]
        },
        orderBy: { name: 'asc' },
        take: 20
      });
    } else {
      // List mode with optional filters
      const where: any = {};
      if (category) where.category = category;
      if (system) where.system = system;
      
      results = await prisma.procedure.findMany({
        where: Object.keys(where).length > 0 ? where : undefined,
        orderBy: { name: 'asc' }
      });
    }
    
    return new Response(JSON.stringify({ success: true, data: results }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error: any) {
    console.error('Error fetching procedures:', error);
    return new Response(JSON.stringify({ success: false, error: 'Failed to fetch procedures', details: error.message }), { 
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}
