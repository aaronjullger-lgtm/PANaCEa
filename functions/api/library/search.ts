/**
 * GET /api/library/search?q=...
 *
 * Hybrid search over Reference Library (MedicalContent): SQL-CTE Reciprocal Rank Fusion
 * combining keyword (ts_rank FTS) + semantic (HNSW vector). Single DB round-trip for fusion.
 * Only returns published content. Results include lastClinicalReviewAt for freshness display.
 *
 * Uses lib/services/search/hybridSearch.ts (SQL-CTE RRF, status='published' filter) for
 * consistent behaviour with POST /api/library/semantic-search?mode=hybrid.
 */

import { z } from 'zod';
import { aiEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { validateFunctionEnv, MissingEnvError } from '../_shared/env-validation';
import { hybridSearchRRF } from '@/lib/services/search/hybridSearch';
import type { CloudflareEnv } from '../_shared/types';

const SearchQuerySchema = z.object({
  q: z.string().min(1).max(2000),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
});

type Env = CloudflareEnv & { GEMINI_API_KEY?: string };

export const onRequestGet = aiEndpoint(
  SearchQuerySchema,
  async (context) => {
    const { env, validated } = context as {
      env: Env;
      validated: z.infer<typeof SearchQuerySchema>;
    };

    try {
      validateFunctionEnv(env as unknown as Record<string, unknown>, [
        'GEMINI_API_KEY',
        'DATABASE_URL',
      ]);
    } catch (e) {
      if (e instanceof MissingEnvError) return e.toResponse();
      throw e;
    }

    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
      return { status: 500, error: 'GEMINI_API_KEY not configured' };
    }

    const prisma = createEdgePrismaClient(env.DATABASE_URL);
    const { q, limit } = validated;

    try {
      // Step 1: SQL-CTE RRF fusion — returns ids + RRF scores (no content yet)
      const fusedResults = await hybridSearchRRF(q, {
        prisma: prisma as any,
        apiKey,
        limit: limit ?? 20,
      });

      if (fusedResults.length === 0) {
        return {
          data: { results: [], count: 0 },
          headers: { 'Cache-Control': 'private, max-age=60' },
        };
      }

      // Step 2: Hydrate with full content fields (published filter already applied by RRF)
      const ids = fusedResults.map((r) => r.id);
      const scoreMap = new Map(fusedResults.map((r) => [r.id, r]));

      const content = await prisma.medicalContent.findMany({
        where: { id: { in: ids } },
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
          overview: true,
          symptoms: true,
          pathophysiology: true,
          treatment: true,
          diagnostics: true,
          best_initial_test: true,
          clinical_pearls: true,
          lastClinicalReviewAt: true,
        },
      });

      // Restore RRF rank order and attach score decomposition
      const results = ids
        .map((id) => {
          const item = content.find((c) => c.id === id);
          const scores = scoreMap.get(id);
          return item
            ? {
                ...item,
                rrfScore: scores?.score ?? 0,
                keywordScore: scores?.keywordScore ?? 0,
                semanticScore: scores?.semanticScore ?? 0,
                source: scores?.source ?? 'semantic',
              }
            : null;
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);

      return {
        data: { results, count: results.length },
        headers: { 'Cache-Control': 'private, max-age=60' },
      };
    } catch (error) {
      console.error('[library/search]', error);
      return {
        status: 500,
        error: error instanceof Error ? error.message : 'Hybrid search failed',
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { source: 'query' }
);
