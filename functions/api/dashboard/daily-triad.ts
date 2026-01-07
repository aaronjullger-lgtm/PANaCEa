/**
 * GET /api/dashboard/daily-triad
 * Fetch a single high-yield "Daily Triad" fact (gold standard or clinical pearl)
 * directly from the database (no AI generation).
 */

import { Prisma } from '@prisma/client/edge';
import { createEdgePrismaClient } from '../_shared/prisma-edge';
import { handleCorsOptions, verifyAuthToken, type Env } from '../_shared/auth';

interface PagesContext {
  request: Request;
  env: Env;
}

export const onRequestOptions = handleCorsOptions;

interface DailyTriadResponse {
  conditionId: string;
  condition: string;
  system: string;
  subcategory: string | null;
  type: 'gold_standard' | 'clinical_pearl';
  highlight: string;
  buzzwords: string[];
  panceYield: number | null;
  updatedAt: string;
  source: 'database';
}

function extractPearl(clinicalPearls: unknown): string | null {
  if (!clinicalPearls) return null;

  // Array of strings or objects
  if (Array.isArray(clinicalPearls) && clinicalPearls.length > 0) {
    const first = clinicalPearls[0];
    if (typeof first === 'string') return first;
    if (first && typeof first === 'object' && 'text' in first) {
      return String((first as Record<string, unknown>).text);
    }
  }

  // Object with pearls array
  if (typeof clinicalPearls === 'object' && clinicalPearls && 'pearls' in clinicalPearls) {
    const pearls = (clinicalPearls as any).pearls;
    if (Array.isArray(pearls) && pearls.length > 0) {
      return typeof pearls[0] === 'string' ? pearls[0] : String(pearls[0]);
    }
  }

  return null;
}

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const { request, env } = context;

  try {
    const clerkId = await verifyAuthToken(request, env);
    if (!clerkId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!env.DATABASE_URL) {
      return new Response(JSON.stringify({ error: 'Database not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      const where = {
        status: 'published',
        OR: [
          { gold_standard_dx: { not: null } },
          { clinical_pearls: { not: Prisma.DbNull } },
        ],
      } as const;

      const total = await prisma.medicalContent.count({ where });
      if (total === 0) {
        return new Response(JSON.stringify({ error: 'No high-yield content available' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const randomSkip = Math.max(0, Math.floor(Math.random() * total));

      const record = await prisma.medicalContent.findFirst({
        where,
        skip: randomSkip,
        take: 1,
        orderBy: { conditionId: 'asc' },
        select: {
          conditionId: true,
          condition: true,
          system: true,
          subcategory: true,
          gold_standard_dx: true,
          clinical_pearls: true,
          buzzwords: true,
          pance_yield: true,
          updatedAt: true,
        },
      });

      if (!record) {
        return new Response(JSON.stringify({ error: 'No triad found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const goldStandard = record.gold_standard_dx?.trim();
      const pearl = extractPearl(record.clinical_pearls);
      const highlight = goldStandard || pearl;

      if (!highlight) {
        return new Response(JSON.stringify({ error: 'No triad content found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const payload: DailyTriadResponse = {
        conditionId: record.conditionId,
        condition: record.condition,
        system: record.system,
        subcategory: record.subcategory,
        type: goldStandard ? 'gold_standard' : 'clinical_pearl',
        highlight,
        buzzwords: record.buzzwords || [],
        panceYield: record.pance_yield ?? null,
        updatedAt: record.updatedAt.toISOString(),
        source: 'database',
      };

      return new Response(JSON.stringify({ success: true, data: payload }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=600',
        },
      });
    } finally {
      await prisma.$disconnect();
    }
  } catch (error) {
    console.error('[DailyTriad] Error fetching triad', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch daily triad', message: (error as Error)?.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
