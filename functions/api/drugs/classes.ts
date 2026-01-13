/**
 * Drug Classes API - GET /api/drugs/classes
 * 
 * Returns distinct drug classes with drug counts.
 * Used to populate filter dropdowns in the drug library browser.
 */

import { authenticateRequest, handleCorsOptions } from '../_shared/auth';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';

interface Env {
  DATABASE_URL: string;
}

// Handle CORS preflight
export const onRequestOptions = handleCorsOptions;

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function onRequestGet(context: { request: Request; env: Env }) {
  const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

  try {
    // Authenticate user
    const auth = await authenticateRequest(context.request, context.env);
    if (!auth) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: CORS_HEADERS,
      });
    }

    // Edge-safe approach: findMany + JS reduce
    const allDrugs = await prisma.drug.findMany({
      select: { drugClass: true },
    });

    // drugClass is String[] - need to flatten and count
    const classCounts = new Map<string, number>();
    for (const { drugClass } of allDrugs) {
      if (drugClass && Array.isArray(drugClass)) {
        for (const cls of drugClass) {
          if (cls) {
            classCounts.set(cls, (classCounts.get(cls) || 0) + 1);
          }
        }
      }
    }

    const classes = Array.from(classCounts.entries())
      .map(([cls, count]) => ({
        id: cls,
        label: cls,
        count,
      }))
      .sort((a, b) => b.count - a.count);

    return new Response(JSON.stringify(classes), {
      status: 200,
      headers: CORS_HEADERS,
    });
  } catch (error) {
    console.error('[drug-classes] Failed to fetch drug classes:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to fetch drug classes',
        details: error instanceof Error ? error.message : String(error)
      }),
      {
        status: 500,
        headers: CORS_HEADERS,
      }
    );
  } finally {
    await safePrismaDisconnect(prisma);
  }
}
