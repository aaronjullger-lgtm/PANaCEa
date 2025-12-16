import { createEdgePrismaClient } from '../../_shared/prisma-edge';
import { handleCorsOptions, verifyAuthToken } from '../../_shared/auth';

export const onRequestOptions = handleCorsOptions;

export async function onRequestGet(context: any) {
  const { request, env, params } = context;
  const { identifier } = params;

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
    
    // 1. Try direct ID match (UUID)
    let condition = await prisma.condition.findUnique({
      where: { id: identifier },
      include: {
        anatomyStructures: true,
        specialTests: true,
        media: true
      }
    });

    // 2. If not found, try name match (exact)
    if (!condition) {
      // Try to convert slug back to name? "atrial-fibrillation" -> "Atrial Fibrillation"
      // Let's try case-insensitive search on name
      const conditions = await prisma.condition.findMany({
        where: {
          name: {
            equals: identifier.replace(/-/g, ' '), // simple de-slugify attempt
            mode: 'insensitive'
          }
        },
        include: {
          anatomyStructures: true,
          specialTests: true,
          media: true
        }
      });
      
      if (conditions.length > 0) {
        condition = conditions[0];
      }
    }

    // 3. If still not found, try searching with the raw identifier
    if (!condition) {
       const conditions = await prisma.condition.findMany({
        where: {
          name: {
            equals: identifier,
            mode: 'insensitive'
          }
        },
        include: {
          anatomyStructures: true,
          specialTests: true,
          media: true
        }
      });
       if (conditions.length > 0) {
        condition = conditions[0];
      }
    }

    if (!condition) {
      return new Response(JSON.stringify({ error: 'Condition not found' }), { 
        status: 404,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    return new Response(JSON.stringify(condition), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error: any) {
    console.error('Error fetching extended condition details:', error);
    return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), { 
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}
