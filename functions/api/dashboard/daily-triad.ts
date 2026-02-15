/**
 * GET /api/dashboard/daily-triad
 * Fetch a single high-yield "Daily Triad" fact (gold standard or clinical pearl)
 * directly from the database (no AI generation).
 */

import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import {
  createEdgePrismaClient,
  safePrismaDisconnect,
  EdgePrismaClient,
} from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { Prisma } from '@prisma/client/edge';
import { z } from 'zod';

// Schema - no query params required
const DailyTriadSchema = z.object({
  query: z.object({}).optional(),
});

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

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(DailyTriadSchema, async ({ env, auth }) => {
  const log = createEndpointLogger('/api/dashboard/daily-triad', auth.userId);
  let prisma: EdgePrismaClient | null = null;

  try {
    if (!env.DATABASE_URL) {
      log.error('Database not configured');
      return { status: 500, error: 'Database not configured' };
    }

    prisma = createEdgePrismaClient(env.DATABASE_URL);

    const where = {
      status: 'published',
      OR: [
        { gold_standard_dx: { not: null } },
        { clinical_pearls: { not: Prisma.DbNull } },
      ] as const,
    };

    const total = await prisma.medicalContent.count({ where: { ...where, OR: [...where.OR] } });
    if (total === 0) {
      log.warn('No high-yield content available');
      return { status: 404, error: 'No high-yield content available' };
    }

    const randomSkip = Math.max(0, Math.floor(Math.random() * total));

    const record = await prisma.medicalContent.findFirst({
      where: { ...where, OR: [...where.OR] },
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
      log.warn('No triad found after random selection');
      return { status: 404, error: 'No triad found' };
    }

    const goldStandard = record.gold_standard_dx?.trim();
    const pearl = extractPearl(record.clinical_pearls);
    const highlight = goldStandard || pearl;

    if (!highlight) {
      log.warn('No triad content found for record', { conditionId: record.conditionId });
      return { status: 404, error: 'No triad content found' };
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

    log.info('Daily triad fetched', {
      conditionId: payload.conditionId,
      type: payload.type,
    });

    return {
      success: true,
      data: payload,
      _cacheControl: 'public, max-age=600',
    };
  } catch (error) {
    log.error('Error fetching daily triad', error);
    return { status: 500, error: 'Failed to fetch daily triad' };
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
