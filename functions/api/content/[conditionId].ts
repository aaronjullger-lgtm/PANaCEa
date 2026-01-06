// functions/api/content/[conditionId].ts
// GET endpoint to fetch detailed medical content for a specific condition

import { createEdgePrismaClient } from '../_shared/prisma-edge';
import { authenticateRequest } from '../_shared/auth';
import { 
  getFromCache, 
  setInCache, 
  getConditionCacheKey, 
  CACHE_CONFIG,
  isKVAvailable 
} from '../_shared/cache';
import type { KVNamespace } from '@cloudflare/workers-types';

interface Env {
  DATABASE_URL?: string;
  CLERK_SECRET_KEY?: string;
  CACHE?: KVNamespace;
}

interface PagesContext {
  request: Request;
  env: Env;
  params: {
    conditionId: string;
  };
}

/**
 * GET /api/content/:conditionId
 * Fetches the FULL MedicalContent object from the database
 * Returns all fields for Reference Grade UI rendering:
 * - High-yield: classic_triad, clinical_pearls, gold_standard_dx, first_line_rx
 * - Deep-dive: etiology, pathophysiology, epidemiology, treatment, etc.
 */
export async function onRequestGet(context: PagesContext): Promise<Response> {
  const { request, env, params } = context;

  // Authenticate the request
  const authResult = await authenticateRequest(request, env);
  if (!authResult) {
    return new Response(
      JSON.stringify({ 
        error: 'Unauthorized', 
        message: 'Authentication required to access medical content' 
      }),
      { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  const { conditionId } = params;

  // Validate conditionId parameter
  if (!conditionId || typeof conditionId !== 'string' || conditionId.trim() === '') {
    return new Response(
      JSON.stringify({ 
        error: 'Invalid request', 
        message: 'conditionId parameter is required and must be a valid string' 
      }),
      { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  // Sanitize: remove any potentially dangerous characters
  const sanitizedId = conditionId.trim().replace(/[<>"'`;]/g, '');

  // Check cache first if KV is available
  if (isKVAvailable(env.CACHE)) {
    const cacheKey = getConditionCacheKey(sanitizedId);
    const cached = await getFromCache(env.CACHE, cacheKey);
    
    if (cached) {
      return new Response(
        JSON.stringify(cached),
        { 
          status: 200,
          headers: { 
            'Content-Type': 'application/json',
            'X-Cache': 'HIT'
          }
        }
      );
    }
  }

  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    // Query MedicalContent table - return FULL object (no select restriction)
    // This enables the frontend to render both High-Yield Header and Deep-Dive Body
    const content = await prisma.medicalContent.findFirst({
      where: {
        OR: [
          { conditionId: { equals: sanitizedId, mode: 'insensitive' } },
          { condition: { equals: sanitizedId, mode: 'insensitive' } },
        ],
        status: 'published', // Only return published content
      },
      // No select: return entire MedicalContent object including:
      // - High-yield: classic_triad, clinical_pearls, gold_standard_dx, first_line_rx
      // - Content: overview, etiology, pathophysiology, epidemiology, treatment, etc.
      // - Metadata: id, conditionId, condition, system, subcategory, timestamps
    });

    // Handle not found
    if (!content) {
      return new Response(
        JSON.stringify({ 
          error: 'Content not found',
          message: `No published medical content found for condition: ${sanitizedId}`,
          conditionId: sanitizedId,
        }),
        { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Cache the result if KV is available
    if (isKVAvailable(env.CACHE)) {
      const cacheKey = getConditionCacheKey(sanitizedId);
      await setInCache(
        env.CACHE,
        cacheKey,
        content,
        CACHE_CONFIG.TTL.CONDITION_DETAIL
      );
    }

    // Return the full content object directly (pass-through for frontend rendering)
    return new Response(
      JSON.stringify(content),
      { 
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'X-Cache': 'MISS'
        }
      }
    );

  } catch (error) {
    console.error('[Content API] Error fetching medical content:', {
      conditionId: sanitizedId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: 'Failed to fetch medical content. Please try again later.',
        conditionId: sanitizedId,
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } finally {
    // Always disconnect Prisma client
    await prisma.$disconnect();
  }
}
