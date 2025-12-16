import { createEdgePrismaClient } from '../_shared/prisma-edge';
import { handleCorsOptions } from '../_shared/auth';

export const onRequestOptions = handleCorsOptions;

export async function onRequestGet(context: any) {
  const { request, env, params } = context;
  const { id } = params;

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
    const guideline = await prisma.clinicalGuideline.findUnique({
      where: { id }
    });
    
    if (!guideline) {
      return new Response(JSON.stringify({ error: 'Guideline not found' }), { 
        status: 404,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
    
    return new Response(JSON.stringify(guideline), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error: any) {
    console.error(`Error fetching guideline ${id}:`, error);
    return new Response(JSON.stringify({ error: 'Failed to fetch guideline', details: error.message }), { 
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}
