import { createEdgePrismaClient } from '../../_shared/prisma-edge';
import { handleCorsOptions } from '../../_shared/auth';

export const onRequestOptions = handleCorsOptions;

export async function onRequestGet(context: any) {
  const { request, env } = context;
  const url = new URL(request.url);
  const count = parseInt(url.searchParams.get('count') || '1');

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
    // Use raw SQL for random ordering
    const cases = await prisma.$queryRaw`
      SELECT * FROM "LabCase"
      ORDER BY RANDOM()
      LIMIT ${count}
    `;
    
    return new Response(JSON.stringify(cases), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error: any) {
    console.error('Error fetching random lab cases:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch random lab cases', details: error.message }), { 
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
