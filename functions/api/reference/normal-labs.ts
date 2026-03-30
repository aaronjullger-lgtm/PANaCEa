/**
 * Normal Lab Values Reference API
 *
 * GET /api/reference/normal-labs - Fetch normal lab reference ranges for in-session lookup.
 * Used by the Normal Labs slide-out panel in QuizView.
 *
 * Security: Authenticated endpoint; read-only reference data.
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import {
  createEdgePrismaClient,
  safePrismaDisconnect,
  EdgePrismaClient,
} from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

const NormalLabsQuerySchema = z.object({
  category: z.string().max(50).optional(),
  limit: z.string().regex(/^\d+$/).optional(),
  query: z.string().max(200).optional(),
  highYield: z.string().optional(),
}).transform((v) => ({
  category: v.category ?? undefined,
  limit: v.limit ? Math.min(500, Math.max(1, Number.parseInt(v.limit, 10))) : 200,
  query: v.query ?? undefined,
  highYield: v.highYield ?? undefined,
}));

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(
  NormalLabsQuerySchema,
  async (context) => {
    const { env, auth, validated } = context;
    const log = createEndpointLogger('/api/reference/normal-labs', auth.userId);
    let prisma: EdgePrismaClient | null = null;

    try {
      prisma = createEdgePrismaClient(env.DATABASE_URL);

      const where: any = {};
      if (validated.category) where.category = validated.category;
      if (validated.highYield === 'true') where.isHighYield = true;
      if (validated.query) {
        where.OR = [
          { labTestName: { contains: validated.query, mode: 'insensitive' } },
          { category: { contains: validated.query, mode: 'insensitive' } },
          { clinicalNotes: { contains: validated.query, mode: 'insensitive' } },
        ];
      }

      const results = await prisma.normalLabValue.findMany({
        where: Object.keys(where).length > 0 ? where : undefined,
        orderBy: [{ isHighYield: 'desc' }, { category: 'asc' }, { labTestName: 'asc' }, { sex: 'asc' }, { ageGroup: 'asc' }],
        take: validated.limit,
        select: {
          id: true,
          labTestName: true,
          category: true,
          normalRangeLow: true,
          normalRangeHigh: true,
          normalRangeText: true,
          units: true,
          siUnits: true,
          sex: true,
          ageGroup: true,
          criticalLow: true,
          criticalHigh: true,
          clinicalNotes: true,
          commonCauses: true,
          isHighYield: true,
        },
      });

      log.info('Normal lab values fetched', { count: results.length, category: validated.category });

      return {
        data: {
          success: true,
          data: results,
        },
      };
    } catch (error) {
      log.error('Error fetching normal lab values', error);
      return {
        status: 500,
        error: 'Failed to fetch normal lab reference',
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { source: 'query' }
);
