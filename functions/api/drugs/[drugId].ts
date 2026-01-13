/**
 * GET /api/drugs/[drugId]
 * 
 * Fetch complete drug details by ID, including related conditions
 */

import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { handleCorsOptions, authenticateRequest } from '../_shared/auth';
import { CloudflareContext } from '../_shared/types';

export const onRequestOptions = handleCorsOptions;

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export const onRequestGet = async (context: CloudflareContext) => {
  // Authenticate user
  const env = context.env as any;
  const authResult = await authenticateRequest(context.request, env);
  if (!authResult) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: CORS_HEADERS,
    });
  }

  const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

  try {
    // Extract drugId from pathname /api/drugs/[drugId]
    const url = new URL(context.request.url);
    const pathSegments = url.pathname.split('/');
    const drugId = pathSegments[pathSegments.length - 1];

    if (!drugId) {
      return new Response(JSON.stringify({ error: 'Drug ID is required' }), {
        status: 400,
        headers: CORS_HEADERS,
      });
    }

    // Fetch complete drug with related conditions
    const drug = await prisma.drug.findUnique({
      where: { id: drugId },
      include: {
        DrugConditionLink: {
          include: {
            Condition: {
              select: {
                id: true,
                condition: true,
                system: true,
              },
            },
          },
        },
      },
    });

    if (!drug) {
      return new Response(JSON.stringify({ error: 'Drug not found' }), {
        status: 404,
        headers: CORS_HEADERS,
      });
    }

    return new Response(
      JSON.stringify(drug),
      {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          'Cache-Control': 'public, max-age=3600, s-maxage=3600',
        },
      }
    );
  } catch (error) {
    const errorDetails = {
      message: error instanceof Error ? error.message : 'Unknown error',
      name: error instanceof Error ? error.name : 'UnknownError',
    };

    console.error('[drugs/[drugId]] Failed to fetch drug:', errorDetails);

    return new Response(
      JSON.stringify({
        error: 'Failed to fetch drug',
        details: errorDetails,
      }),
      {
        status: 500,
        headers: CORS_HEADERS,
      }
    );
  } finally {
    await safePrismaDisconnect(prisma);
  }
};
