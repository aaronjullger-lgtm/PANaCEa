/**
 * Guidelines API Endpoint
 * GET /api/guidelines - List all guidelines with optional filtering
 * 
 * Query params:
 * - type: Filter by type (screening, prevention, treatment)
 * - organization: Filter by organization (USPSTF, AHA, IDSA, etc.)
 * - conditionId: Filter by associated condition
 */

import { createEdgePrismaClient } from '../_shared/prisma-edge';
import { handleCorsOptions, authenticateRequest } from '../_shared/auth';

interface Env {
  DATABASE_URL: string;
  CLERK_SECRET_KEY: string;
}

export const onRequestOptions = handleCorsOptions;

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context;
  
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

    // Parse query parameters
    const url = new URL(context.request.url);
    const type = url.searchParams.get('type');
    const organization = url.searchParams.get('organization');
    const conditionId = url.searchParams.get('conditionId');

    // Build where clause
    const where: any = {};
    if (type) where.type = type;
    if (organization) where.organization = organization;
    if (conditionId) where.conditionId = conditionId;

    // Query guidelines
    const guidelines = await prisma.guideline.findMany({
      where,
      orderBy: [
        { panceYield: 'desc' },
        { name: 'asc' }
      ],
      include: {
        Condition: {
          select: {
            id: true,
            name: true,
            system: true
          }
        }
      }
    });

    return new Response(JSON.stringify({
      success: true,
      count: guidelines.length,
      data: guidelines
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    console.error('Error fetching guidelines:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
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