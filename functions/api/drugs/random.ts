import { createEdgePrismaClient } from '../_shared/prisma-edge';
import { handleCorsOptions } from '../_shared/auth';

export const onRequestOptions = handleCorsOptions;

export async function onRequestGet(context: any) {
  const { request, env } = context;
  const url = new URL(request.url);
  const count = Number(url.searchParams.get('count')) || 10;

  if (!env.DATABASE_URL) {
    return new Response(JSON.stringify({ error: 'Database not configured' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const prisma = createEdgePrismaClient(env.DATABASE_URL);
    // Use raw SQL for random selection for better performance
    const drugs = await prisma.$queryRaw`SELECT * FROM "Drug" ORDER BY RANDOM() LIMIT ${count}`;
    
    return new Response(JSON.stringify(drugs), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('Error fetching random drugs:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch random drugs', details: error.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
