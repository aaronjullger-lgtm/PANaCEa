import { createEdgePrismaClient } from '../_shared/prisma-edge';
import { handleCorsOptions } from '../_shared/auth';

export const onRequestOptions = handleCorsOptions;

export async function onRequestGet(context: any) {
  const { env } = context;
  
  if (!env.DATABASE_URL) {
    return new Response(JSON.stringify({ error: 'Database not configured' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const categories = await prisma.firstLineTreatment.groupBy({
      by: ['category'],
      orderBy: { category: 'asc' }
    });
    
    return new Response(JSON.stringify(categories.map(c => c.category)), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('Error fetching first line categories:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch categories', details: error.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  } finally {
    await prisma.$disconnect();
  }
}
