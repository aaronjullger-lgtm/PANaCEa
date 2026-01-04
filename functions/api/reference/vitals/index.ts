import { createEdgePrismaClient } from '../../_shared/prisma-edge';
import { handleCorsOptions, verifyAuthToken } from '../../_shared/auth';

export const onRequestOptions = handleCorsOptions;

/**
 * GET /api/reference/vitals
 * Fetch all vital sign ranges
 */
export async function onRequestGet(context: any) {
  const { request, env } = context;
  const url = new URL(request.url);
  const ageGroup = url.searchParams.get('ageGroup');

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
    const results = await prisma.vitalSignRange.findMany({
      where: ageGroup ? { ageGroup } : undefined,
      orderBy: { vitalSign: 'asc' }
    });
    
    return new Response(JSON.stringify({ success: true, data: results }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error: any) {
    console.error('Error fetching vitals:', error);
    return new Response(JSON.stringify({ success: false, error: 'Failed to fetch vitals', details: error.message }), { 
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
