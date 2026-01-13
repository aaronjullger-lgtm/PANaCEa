/**
 * Single Guideline API Endpoint
 * GET /api/guidelines/[id] - Get a specific guideline by ID
 */

import { createEdgePrismaClient } from '../_shared/prisma-edge';
import { handleCorsOptions, authenticateRequest } from '../_shared/auth';

interface Env {
  DATABASE_URL: string;
  CLERK_SECRET_KEY: string;
}

export const onRequestOptions = handleCorsOptions;

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params } = context;
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

  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    // Authenticate request (optional - guidelines are generally public)
    const auth = await authenticateRequest(context.request, env.CLERK_SECRET_KEY);
    if (!auth.authenticated) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: 401,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    const guideline = await prisma.guideline.findUnique({
      where: { id: id as string },
      include: {
        Condition: {
          select: {
            id: true,
            name: true,
            system: true,
            panceYield: true
          }
        }
      }
    });
    
    if (!guideline) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Guideline not found' 
      }), { 
        status: 404,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
    
    return new Response(JSON.stringify({
      success: true,
      data: guideline
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error: any) {
    console.error(`Error fetching guideline ${id}:`, error);
    return new Response(JSON.stringify({ 
      success: false,
      error: 'Failed to fetch guideline', 
      details: error.message 
    }), { 
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } finally {
    await prisma.$disconnect();
  }
};