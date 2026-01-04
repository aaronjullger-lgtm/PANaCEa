import { createEdgePrismaClient } from '../../_shared/prisma-edge';
import { handleCorsOptions, verifyAuthToken } from '../../_shared/auth';

export const onRequestOptions = handleCorsOptions;

/**
 * GET /api/reference/history-components
 * Fetch all history components, optionally filtered by type or search query
 */
export async function onRequestGet(context: any) {
  const { request, env } = context;
  const url = new URL(request.url);
  const type = url.searchParams.get('type');
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

  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    let results;
    
    if (query) {
      // Search mode
      results = await prisma.historyComponent.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } }
          ]
        },
        orderBy: { name: 'asc' },
        take: 20
      });
    } else {
      // List mode with optional type filter
      results = await prisma.historyComponent.findMany({
        where: type ? { type } : undefined,
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
    console.error('Error fetching history components:', error);
    return new Response(JSON.stringify({ success: false, error: 'Failed to fetch history components', details: error.message }), { 
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } finally {
    await prisma.$disconnect();
  }
}
