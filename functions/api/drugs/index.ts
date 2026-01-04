import { createEdgePrismaClient } from '../_shared/prisma-edge';
import { handleCorsOptions } from '../_shared/auth';

export const onRequestOptions = handleCorsOptions;

export async function onRequestGet(context: any) {
  const { request, env } = context;
  const url = new URL(request.url);
  const limitParam = url.searchParams.get('limit');
  const offsetParam = url.searchParams.get('offset');
  const search = url.searchParams.get('search');
  
  // Default to reasonable batch size to avoid 5MB limit
  const limit = limitParam ? Math.min(Number(limitParam), 100) : 50;
  const offset = offsetParam ? Number(offsetParam) : 0;

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
    // Build where clause for search
    const where = search ? {
      OR: [
        { genericName: { contains: search, mode: 'insensitive' as const } },
        { brandName: { contains: search, mode: 'insensitive' as const } },
        { drugClass: { hasSome: [search] } },
      ]
    } : {};

    // Fetch paginated results with limited fields to reduce response size
    const [drugs, total] = await Promise.all([
      prisma.drug.findMany({
        where,
        select: {
          id: true,
          genericName: true,
          brandName: true,
          drugClass: true,
          mechanismOfAction: true,
          indications: true,
          sideEffects: true,
          contraindications: true,
          isHighYield: true,
          // Exclude large text fields from list view
        },
        orderBy: { genericName: 'asc' },
        take: limit,
        skip: offset,
      }),
      prisma.drug.count({ where }),
    ]);
    
    return new Response(JSON.stringify({
      drugs,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + drugs.length < total,
      }
    }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
      }
    });
  } catch (error: any) {
    console.error('Error fetching drugs:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch drugs', details: error.message }), { 
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
