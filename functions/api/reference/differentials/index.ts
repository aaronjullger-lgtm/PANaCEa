import { createEdgePrismaClient } from '../../_shared/prisma-edge';
import { handleCorsOptions, verifyAuthToken } from '../../_shared/auth';

export const onRequestOptions = handleCorsOptions;

/**
 * GET /api/reference/differentials
 * Fetch all differential diagnoses, optionally filtered by category or search query
 */
export async function onRequestGet(context: any) {
  const { request, env } = context;
  const url = new URL(request.url);
  const category = url.searchParams.get('category');
  const query = url.searchParams.get('query');
  const presentingComplaint = url.searchParams.get('presentingComplaint');

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
      results = await prisma.differentialDiagnosis.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { presentingComplaint: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } }
          ]
        },
        orderBy: { presentingComplaint: 'asc' },
        take: 30
      });
    } else if (presentingComplaint) {
      // Find DDx by presenting complaint
      results = await prisma.differentialDiagnosis.findMany({
        where: { 
          presentingComplaint: { contains: presentingComplaint, mode: 'insensitive' }
        },
        orderBy: { name: 'asc' }
      });
    } else {
      // List mode with optional category filter
      results = await prisma.differentialDiagnosis.findMany({
        where: category ? { category } : undefined,
        orderBy: { presentingComplaint: 'asc' }
      });
    }
    
    return new Response(JSON.stringify({ success: true, data: results }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error: any) {
    console.error('Error fetching differentials:', error);
    return new Response(JSON.stringify({ success: false, error: 'Failed to fetch differentials', details: error.message }), { 
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}
