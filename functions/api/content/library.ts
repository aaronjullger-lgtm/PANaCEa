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

const LibrarySchema = z.object({
  query: z.object({
    system: z.string().optional(),
    subcategory: z.string().optional(),
    search: z.string().optional(),
    highYield: z.string().optional(),
    page: z.string().optional(),
    pageSize: z.string().optional(),
  }),
});

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(LibrarySchema, async (context) => {
  const { env, validated } = context;
  const logger = createEndpointLogger('/api/content/library');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const { system, subcategory, search, highYield } = validated.query || {};

    // REQUIRE system selection unless searching
    if ((!system || system === 'all') && !search) {
      return { data: { content: [], count: 0, message: 'Please select a system to browse conditions', requiresSelection: true } };
    }

    // Build where clause
    const where: any = {};
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
        where.id = searchResults && searchResults.length > 0 ? { in: searchResults } : { in: [] };
      } catch {
        logger.warn('Full-text search failed, falling back to LIKE');
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
        id: true, condition: true, conditionId: true, system: true, subcategory: true, pance_yield: true,
        classic_patient: true, buzzwords: true, gold_standard_dx: true, first_line_rx: true,
        epidemiology: true, etiology: true, riskFactors: true, pathophysiology: true,
        symptoms: true, physicalExam: true, classic_triad: true, clinical_pearls: true,
        best_initial_test: true, diagnostics: true, treatment: true, complications: true, prognosis: true, overview: true,
      },
      orderBy: searchResults ? undefined : [{ pance_yield: 'desc' }, { subcategory: 'asc' }, { condition: 'asc' }],
    });

    if (searchResults && searchResults.length > 0) {
      const rankMap = new Map(searchResults.map((id: string, index: number) => [id, index]));
      content.sort((a: { id: string }, b: { id: string }) => (rankMap.get(a.id) ?? 999) - (rankMap.get(b.id) ?? 999));
    }

    logger.info('Library content fetched', { count: content.length, system, search });
    return { data: { content, count: content.length }, headers: { 'Cache-Control': 'public, max-age=3600' } };
  } catch (error) {
    logger.error('Error fetching library content', { error: error instanceof Error ? error.message : String(error) });
    throw new Error('Failed to fetch library content');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
