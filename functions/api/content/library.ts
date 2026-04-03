/**
 * GET /api/content/library
 *
 * Fetch filtered library content for Clinical Library browser
 * Supports filtering by system, subcategory, and search
 * FTS uses search_vector; on failure falls back to ILIKE.
 * Sprint 5: KV cache TTL 1h for non-search requests.
 */

import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { getCached, setCached } from '../_shared/kv-cache';
import { LibraryResponseSchema } from '@/lib/schemas/medicalContent';
import { normalizeMedicalContent } from '../../../lib/utils/normalization';

const CACHE_TTL = 3600;

const MAX_SEARCH_LENGTH = 200;

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
        error: 'Library unavailable: Database is not configured.',
        status: 503,
      };
    }

    const prisma = createEdgePrismaClient(env.DATABASE_URL);
    const safeValidated = validated ?? {};

    try {
      const system = typeof safeValidated.system === 'string' ? safeValidated.system : undefined;
      const subcategory =
        typeof safeValidated.subcategory === 'string' ? safeValidated.subcategory : undefined;
      const rawSearch =
        typeof safeValidated.search === 'string' ? safeValidated.search : undefined;
      const highYield = safeValidated.highYield;

      const page = Math.max(1, parseInt(safeValidated.page || '1', 10) || 1);
      const pageSize = Math.min(200, Math.max(1, parseInt(safeValidated.pageSize || '100', 10) || 100));
      const search = rawSearch?.trim().slice(0, MAX_SEARCH_LENGTH) || undefined;

      const cacheKey = `content:library:${system ?? 'all'}:${subcategory ?? ''}:${search ?? ''}:${highYield ?? ''}:p${page}:ps${pageSize}`;
      if (!search) {
        const cached = await getCached<{ content: unknown[]; count: number }>(
          env as { CACHE?: KVNamespace },
          cacheKey
        );
        if (cached) {
          return { data: cached, headers: { 'Cache-Control': 'public, max-age=3600' } };
        }
      }

      // Build where clause — when system is missing or 'all', return all conditions (no system filter)
      const where: Record<string, unknown> = {};
      if (system && system !== 'all') where.system = system;
      if (subcategory) where.subcategory = subcategory;
      if (highYield === 'true') where.pance_yield = { gte: 3 };

      let searchResults: string[] | undefined;
      if (search) {
        try {
          const query = Prisma.sql`SELECT id FROM "MedicalContent"
            WHERE search_vector IS NOT NULL
              AND search_vector @@ websearch_to_tsquery('english', ${search})
            ORDER BY ts_rank(search_vector, websearch_to_tsquery('english', ${search})) DESC`;
          const ftsResults = await prisma.$queryRaw<Array<{ id: string }>>(query);
          searchResults = ftsResults.map((r) => r.id);
          logger.info('Full-text search results', { count: searchResults.length });
          if (searchResults.length > 0) {
            delete where.OR;
            where.id = { in: searchResults };
          } else {
            delete where.id;
            where.OR = [
              { condition: { contains: search, mode: 'insensitive' } },
              { overview: { contains: search, mode: 'insensitive' } },
              { classic_patient: { contains: search, mode: 'insensitive' } },
            ];
          }
        } catch (ftsError) {
          const ftsMsg = ftsError instanceof Error ? ftsError.message : String(ftsError);
          logger.warn('Full-text search failed, falling back to ILIKE', { error: ftsMsg });
          delete where.id;
          where.OR = [
            { condition: { contains: search, mode: 'insensitive' } },
            { overview: { contains: search, mode: 'insensitive' } },
            { classic_patient: { contains: search, mode: 'insensitive' } },
          ];
        }
      }

      // First get total count for pagination metadata
      const totalCount = await prisma.medicalContent.count({ where });

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
        skip: (page - 1) * pageSize,
        take: pageSize,
      });

      if (searchResults && searchResults.length > 0) {
        const rankMap = new Map(searchResults.map((id: string, index: number) => [id, index]));
        content.sort(
          (a: { id: string }, b: { id: string }) =>
            (rankMap.get(a.id) ?? 999) - (rankMap.get(b.id) ?? 999)
        );
      }

      // Normalize all JSONB fields so clients receive consistent types
      // (arrays are arrays, not JSON strings; "null" strings become actual null)
      const normalizedContent = content.map((item: Record<string, unknown>) =>
        normalizeMedicalContent(item)
      );

      logger.info('Library content fetched', { count: normalizedContent.length, totalCount, system, search, page, pageSize });
      const totalPages = Math.ceil(totalCount / pageSize);
      const payload = { content: normalizedContent, count: normalizedContent.length, totalCount, page, pageSize, totalPages };
      if (!search) {
        await setCached(env as { CACHE?: KVNamespace }, cacheKey, payload, CACHE_TTL);
      }
      const parsed = LibraryResponseSchema.safeParse(payload);
      if (!parsed.success) {
        logger.warn('Library response shape validation failed', { issues: parsed.error.issues });
      }
      return {
        data: parsed.success ? parsed.data : payload,
        headers: { 'Cache-Control': 'public, max-age=3600' },
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error('Error fetching library content', { error: errMsg });
      return {
        error: 'Clinical content temporarily unavailable. Please try again later.',
        status: 503,
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { source: 'query' }
);
