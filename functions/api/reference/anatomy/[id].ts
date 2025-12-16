import { createEdgePrismaClient } from '../../../_shared/prisma-edge';
import { handleCorsOptions, verifyAuthToken } from '../../../_shared/auth';

export const onRequestOptions = handleCorsOptions;

export async function onRequestGet(context: any) {
  const { request, env, params } = context;
  const { id } = params;

  // Verify authentication
  const authHeader = request.headers.get('Authorization');
  const userId = await verifyAuthToken(authHeader, env.CLERK_SECRET_KEY);
  
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (!env.DATABASE_URL) {
    return new Response(JSON.stringify({ error: 'Database not configured' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const prisma = createEdgePrismaClient(env.DATABASE_URL);
    
    const result = await prisma.anatomyStructure.findUnique({
      where: { id },
      include: { conditions: { select: { id: true, name: true } } }
    });
    
    if (!result) {
      return new Response(JSON.stringify({ success: false, error: 'Not found' }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('Error fetching anatomy detail:', error);
    return new Response(JSON.stringify({ success: false, error: 'Failed to fetch anatomy detail', details: error.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
