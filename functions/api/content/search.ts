import { createEdgePrismaClient } from '../../_shared/prisma-edge';
import { handleCorsOptions } from '../../_shared/auth';

export const onRequestOptions = handleCorsOptions;

export async function onRequestGet(context: any) {
  const { request, env } = context;
  const url = new URL(request.url);
  const q = url.searchParams.get('q');
  const system = url.searchParams.get('system');
  const limit = url.searchParams.get('limit') || '30';

  if (!q) {
    return new Response(JSON.stringify({ error: 'Query parameter "q" is required' }), { 
      status: 400,
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
    const query = String(q);
    
    const where: any = {
      status: 'published',
      OR: [
        { condition: { contains: query, mode: 'insensitive' } },
        { overview: { contains: query, mode: 'insensitive' } }
      ]
    };
    
    if (system) {
      where.AND = [
        {
          OR: [
            { system: String(system) },
            { relatedSystems: { has: String(system) } }
          ]
        }
      ];
    }
    
    const results = await prisma.medicalContent.findMany({
      where,
      take: Number(limit),
      select: {
        conditionId: true,
        condition: true,
        system: true,
        subcategory: true,
        overview: true
      },
      orderBy: { condition: 'asc' }
    });
    
    return new Response(JSON.stringify({ results, count: results.length }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('Error searching content:', error);
    return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
