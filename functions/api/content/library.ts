/**
 * GET /api/content/library
 *
 * Fetch filtered library content for Clinical Library browser
 * Supports filtering by system, subcategory, and search
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

// Flat schema for query parameters (not nested under 'query')
const LibraryQuerySchema = z.object({
  system: z.string().optional(),
  subcategory: z.string().optional(),
  search: z.string().optional(),
  highYield: z.string().optional(),
  page: z.string().optional(),
  pageSize: z.string().optional(),
});

export const onRequestOptions = withCors();

// Use { source: 'query' } to read from URL search params instead of body
export const onRequestGet = authenticatedEndpoint(
  LibraryQuerySchema,
  async (context) => {
    const { env, validated } = context;
    const logger = createEndpointLogger('/api/content/library');

    if (!env.DATABASE_URL) {
      logger.error('DATABASE_URL not configured');
      return {
        data: { error: 'Library unavailable', message: 'Database is not configured.' },
        status: 503,
      };
    }

    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      const { system, subcategory, search, highYield } = validated || {};

      // Build where clause — when system is missing or 'all', return all conditions (no system filter)
      const where: Record<string, unknown> = {};
      if (system && system !== 'all') where.system = system;
      if (subcategory) where.subcategory = subcategory;
      if (highYield === 'true') where.pance_yield = { gte: 3 };

      let searchResults: string[] | undefined;
      if (search && search.trim()) {
        try {
          const ftsResults = await prisma.$queryRaw<Array<{ id: string }>>`
            SELECT id FROM "MedicalContent"
            WHERE search_vector @@ websearch_to_tsquery('english', ${search})
            ORDER BY ts_rank(search_vector, websearch_to_tsquery('english', ${search})) DESC
          `;
          searchResults = ftsResults.map((r: { id: string }) => r.id);
          logger.info('Full-text search results', { count: searchResults.length });
          if (searchResults.length > 0) {
            delete where.OR; // clear any previous OR
            where.id = { in: searchResults };
          } else {
            delete where.id; // clear any previous id
            where.OR = [
              { condition: { contains: search, mode: 'insensitive' } },
              { overview: { contains: search, mode: 'insensitive' } },
              { classic_patient: { contains: search, mode: 'insensitive' } },
            ];
          }
        } catch {
          logger.warn('Full-text search failed, falling back to LIKE');
          delete where.id; // ensure no conflicting id
          where.OR = [
            { condition: { contains: search, mode: 'insensitive' } },
            { overview: { contains: search, mode: 'insensitive' } },
            { classic_patient: { contains: search, mode: 'insensitive' } },
          ];
        }
      }

      const content = await prisma.medicalContent.findMany({
        where,
        select: {
          id: true,
          condition: true,
          conditionId: true,
          system: true,
          subcategory: true,
          pance_yield: true,
          classic_patient: true,
          buzzwords: true,
          gold_standard_dx: true,
          first_line_rx: true,
          epidemiology: true,
          etiology: true,
          riskFactors: true,
          pathophysiology: true,
          symptoms: true,
          physicalExam: true,
          classic_triad: true,
          clinical_pearls: true,
          best_initial_test: true,
          diagnostics: true,
          treatment: true,
          complications: true,
          prognosis: true,
          overview: true,
        },
        orderBy: searchResults
          ? undefined
          : [{ pance_yield: 'desc' }, { subcategory: 'asc' }, { condition: 'asc' }],
      });

      if (searchResults && searchResults.length > 0) {
        const rankMap = new Map(searchResults.map((id: string, index: number) => [id, index]));
        content.sort(
          (a: { id: string }, b: { id: string }) =>
            (rankMap.get(a.id) ?? 999) - (rankMap.get(b.id) ?? 999)
        );
      }

      logger.info('Library content fetched', { count: content.length, system, search });
      return {
        data: { content, count: content.length },
        headers: { 'Cache-Control': 'public, max-age=3600' },
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error('Error fetching library content', { error: errMsg });
      return {
        data: {
          error: 'Failed to fetch library content',
          message: errMsg || 'Please try again later.',
          content: [],
          count: 0,
        },
        status: 500,
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { source: 'query' }
);
