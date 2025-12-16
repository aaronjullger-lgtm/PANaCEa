import { createEdgePrismaClient } from '../_shared/prisma-edge';
import { handleCorsOptions, verifyAuthToken } from '../_shared/auth';

export const onRequestOptions = handleCorsOptions;

export async function onRequestGet(context: any) {
  const { request, env } = context;
  const url = new URL(request.url);
  const system = url.searchParams.get('system');

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
    
    const results = await prisma.clinicalFinding.findMany({
      where: system ? { system } : undefined,
      orderBy: { name: 'asc' }
    });
    
    return new Response(JSON.stringify({ success: true, data: results }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('Error fetching findings:', error);
    return new Response(JSON.stringify({ success: false, error: 'Failed to fetch findings', details: error.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
