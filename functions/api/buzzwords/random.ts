import { createEdgePrismaClient } from '../_shared/prisma-edge';
import { handleCorsOptions } from '../_shared/auth';

export const onRequestOptions = handleCorsOptions;

export async function onRequestGet(context: any) {
  const { request, env } = context;
  const url = new URL(request.url);
  const count = parseInt(url.searchParams.get('count') || '10');

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
    
    // Use raw query for random selection
    // Note: RANDOM() is PostgreSQL specific. If using MySQL/SQLite, syntax differs.
    const buzzwords = await prisma.$queryRaw`
      SELECT * FROM "Buzzword"
      ORDER BY RANDOM()
      LIMIT ${count}
    `;
    
    return new Response(JSON.stringify(buzzwords), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error: any) {
    console.error('Error fetching random buzzwords:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch random buzzwords', details: error.message }), { 
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}
