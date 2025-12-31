/**
 * GET /api/conditions/high-yield
 * 
 * Returns high-yield conditions for Cram Mode with buzzwords and clinical pearls.
 * Replaces static TOP_50_HIGH_YIELD_CONDITIONS from data/highYieldConditions.ts
 * 
 * Database-First: PostgreSQL is the ONLY source of truth for clinical content.
 */

import { createEdgePrismaClient } from '../_shared/prisma-edge';
import { handleCorsOptions } from '../_shared/auth';

interface Env {
  DATABASE_URL?: string;
}

interface PagesContext {
  request: Request;
  env: Env;
}

export const onRequestOptions = handleCorsOptions;

/**
 * Response shape matching the static HighYieldCondition interface
 */
interface HighYieldConditionResponse {
  condition: string;
  system: string;
  pearl: string;
  buzzwords: string[];
  importance: 'critical' | 'very_high' | 'high';
}

/**
 * Map PANCE yield score to importance level
 */
function mapYieldToImportance(panceYield: number | null): 'critical' | 'very_high' | 'high' {
  if (!panceYield || panceYield <= 0) return 'high';
  if (panceYield >= 9) return 'critical';
  if (panceYield >= 7) return 'very_high';
  return 'high';
}

/**
 * Extract first clinical pearl as string
 */
function extractPearl(clinicalPearls: unknown, overview: string | null): string {
  if (clinicalPearls && typeof clinicalPearls === 'object') {
    // Handle array of pearls
    if (Array.isArray(clinicalPearls) && clinicalPearls.length > 0) {
      const first = clinicalPearls[0];
      if (typeof first === 'string') return first;
      if (first && typeof first === 'object' && 'text' in first) return String(first.text);
    }
    // Handle object with pearls array
    if ('pearls' in clinicalPearls) {
      const pearls = (clinicalPearls as any).pearls;
      if (Array.isArray(pearls) && pearls.length > 0) {
        return typeof pearls[0] === 'string' ? pearls[0] : String(pearls[0]);
      }
    }
  }
  // Fallback to truncated overview
  if (overview) {
    const truncated = overview.length > 150 ? overview.substring(0, 150) + '...' : overview;
    return truncated;
  }
  return 'High-yield condition for PANCE';
}

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const { request, env } = context;

  if (!env.DATABASE_URL) {
    return new Response(
      JSON.stringify({ error: 'Database not configured' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
    const system = url.searchParams.get('system')?.toUpperCase();
    const randomize = url.searchParams.get('random') === 'true';

    // Build where clause
    const where: any = {
      status: 'published',
      // Only include conditions with buzzwords or high yield score
      OR: [
        { buzzwords: { isEmpty: false } },
        { pance_yield: { gt: 5 } }
      ]
    };

    if (system) {
      where.system = system;
    }

    // Fetch high-yield conditions from database
    const conditions = await prisma.medicalContent.findMany({
      where,
      select: {
        condition: true,
        system: true,
        buzzwords: true,
        clinical_pearls: true,
        overview: true,
        pance_yield: true,
      },
      orderBy: randomize 
        ? undefined // Random handled after fetch
        : [
            { pance_yield: 'desc' },
            { condition: 'asc' }
          ],
      take: randomize ? undefined : limit,
    });

    // Transform to response format
    let results: HighYieldConditionResponse[] = conditions.map(c => ({
      condition: c.condition,
      system: c.system,
      pearl: extractPearl(c.clinical_pearls, c.overview),
      buzzwords: c.buzzwords || [],
      importance: mapYieldToImportance(c.pance_yield),
    }));

    // Randomize if requested
    if (randomize) {
      results = results
        .sort(() => Math.random() - 0.5)
        .slice(0, limit);
    }

    await prisma.$disconnect();

    return new Response(
      JSON.stringify({
        conditions: results,
        total: results.length,
        source: 'database',
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300', // Cache 5 min
        },
      }
    );
  } catch (error) {
    console.error('[High-Yield API] Error:', error);
    await prisma.$disconnect();
    return new Response(
      JSON.stringify({ 
        error: 'Failed to fetch high-yield conditions',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
