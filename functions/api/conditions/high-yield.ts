/**
 * GET /api/conditions/high-yield
 *
 * PUBLIC endpoint - Returns high-yield conditions for Cram Mode
 * with buzzwords and clinical pearls.
 *
 * Database-First: PostgreSQL is the ONLY source of truth for clinical content.
 */

import { publicEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { z } from 'zod';

const HighYieldSchema = z.object({
  query: z.object({
    limit: z.coerce.number().min(1).max(100).optional().default(50),
    system: z.string().optional(),
    random: z.enum(['true', 'false']).optional(),
  }),
});

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

export const onRequestGet = publicEndpoint(HighYieldSchema, async ({ env, validated }) => {
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const { limit, system, random } = validated.query;
    const randomize = random === 'true';

    // Build where clause
    const where: any = {
      status: 'published',
      // Only include conditions with buzzwords or high yield score
      OR: [{ buzzwords: { isEmpty: false } }, { pance_yield: { gt: 5 } }],
    };

    if (system) {
      where.system = system.toUpperCase();
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
        : [{ pance_yield: 'desc' }, { condition: 'asc' }],
      take: randomize ? undefined : limit,
    });

    // Transform to response format
    let results: HighYieldConditionResponse[] = conditions.map((c) => ({
      condition: c.condition,
      system: c.system,
      pearl: extractPearl(c.clinical_pearls, c.overview),
      buzzwords: c.buzzwords || [],
      importance: mapYieldToImportance(c.pance_yield),
    }));

    // Randomize if requested
    if (randomize) {
      results = results.sort(() => Math.random() - 0.5).slice(0, limit);
    }

    return {
      conditions: results,
      total: results.length,
      source: 'database',
    };
  } finally {
    await safePrismaDisconnect(prisma);
  }
});