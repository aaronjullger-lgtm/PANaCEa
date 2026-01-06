// functions/api/admin/cache-metrics.ts
// Admin endpoint to view cache performance metrics

import { authenticateRequest } from '../_shared/auth';
import { createEdgePrismaClient } from '../_shared/prisma-edge';
import { getCacheMetrics, isKVAvailable } from '../_shared/cache';
import type { KVNamespace } from '@cloudflare/workers-types';

interface Env {
  DATABASE_URL: string;
  CLERK_SECRET_KEY: string;
  CACHE?: KVNamespace;
}

interface PagesContext {
  request: Request;
  env: Env;
}

/**
 * GET /api/admin/cache-metrics
 * Returns cache hit/miss statistics for monitoring performance
 * Admin-only endpoint
 */
export async function onRequestGet(context: PagesContext): Promise<Response> {
  const prisma = createEdgePrismaClient(context.env.DATABASE_URL);
  
  try {
    // Authenticate request
    const authResult = await authenticateRequest(context.request as any, context.env);
    if (!authResult) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { clerkId: authResult.userId },
      select: { role: true },
    });

    if (user?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check if KV is available
    if (!isKVAvailable(context.env.CACHE)) {
      return new Response(JSON.stringify({ 
        error: 'Cache not available',
        message: 'KV namespace is not configured',
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get cache metrics
    const metrics = await getCacheMetrics(context.env.CACHE);

    // Calculate hit rate
    const total = metrics.hits + metrics.misses;
    const hitRate = total > 0 ? Math.round((metrics.hits / total) * 100) : 0;

    return new Response(JSON.stringify({
      success: true,
      metrics: {
        hits: metrics.hits,
        misses: metrics.misses,
        errors: metrics.errors,
        total,
        hitRate: `${hitRate}%`,
        lastUpdated: metrics.lastUpdated,
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error fetching cache metrics:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } finally {
    await prisma.$disconnect();
  }
};
