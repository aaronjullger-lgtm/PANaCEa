/**
 * POST /api/library/semantic-search
 *
 * Semantic search over Reference Library (MedicalContent) using pgvector
 * and Google AI text-embedding-005. Returns nearest neighbors by cosine similarity.
 */

import { z } from 'zod';
import { aiEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { validateFunctionEnv, MissingEnvError } from '../_shared/env-validation';
import type { CloudflareEnv } from '../_shared/types';
import { hybridSearchRRF, classifyQuery } from '@/lib/services/search/hybridSearch';
import { gradeDocuments, buildCRAGContext, type RetrievedDocument, type CRAGResult } from '@/lib/services/search/correctiveRag';

const EMBED_MODEL = 'text-embedding-005';
const EMBED_DIMS = 768;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

/**
 * HNSW ef_search — controls recall/latency tradeoff at query time.
 * Default (40) underperforms for 768-dim clinical embeddings; 100 restores
 * ≥ 95% recall vs. exact scan at ~2x the query cost (still sub-50ms on our
 * corpus). Set per-transaction via SET LOCAL so it never leaks across requests.
 */
const HNSW_EF_SEARCH = 100;

const BodySchema = z.object({
  query: z.string().min(1).max(2000),
  limit: z.number().int().min(1).max(MAX_LIMIT).optional().default(DEFAULT_LIMIT),
  /** Search mode: 'semantic' (default, pure vector) or 'hybrid' (keyword + semantic RRF) */
  mode: z.enum(['semantic', 'hybrid']).optional().default('semantic'),
  /** Enable corrective RAG grading to filter low-relevance results */
  crag: z.boolean().optional().default(false),
});

type Env = CloudflareEnv & { GEMINI_API_KEY?: string };

async function getQueryEmbedding(query: string, apiKey: string): Promise<number[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: { parts: [{ text: query }] },
      outputDimensionality: EMBED_DIMS,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Embed API error ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = (await res.json()) as { embedding?: { values?: number[] } };
  const values = data.embedding?.values;
  if (!Array.isArray(values) || values.length !== EMBED_DIMS) {
    throw new Error(`Invalid embedding: expected ${EMBED_DIMS} dims`);
  }
  return values;
}

/** Convert search results to CRAG documents for grading.
 * Include all safety-critical fields so CRAG can assess relevance on the
 * clinically important parts (e.g. first_line_rx, complications, differentialDx)
 * rather than only overview text. Cap at 2000 chars — sufficient for all fields
 * on a typical result without bloating the in-memory grader.
 */
function toCRAGDocs(results: Array<{
  id: string;
  condition?: string | null;
  overview?: string | null;
  symptoms?: string | null;
  first_line_rx?: string | null;
  gold_standard_dx?: string | null;
  complications?: string | null;
  differentialDiagnosis?: string | null;
  similarity: number;
}>): RetrievedDocument[] {
  return results.map((r) => ({
    id: r.id,
    text: [
      r.condition,
      r.overview,
      r.symptoms,
      r.first_line_rx,
      r.gold_standard_dx,
      r.complications,
      r.differentialDiagnosis,
    ].filter(Boolean).join(' ').slice(0, 2000),
    score: r.similarity,
    source: 'semantic-search',
  }));
}

/** Apply CRAG grading and filter results, returning quality metadata */
async function applyCRAG(
  query: string,
  results: Array<Record<string, unknown> & { id: string; similarity: number }>,
): Promise<{ filtered: typeof results; cragMeta: { qualityScore: number; accepted: number; rejected: number; fallbackTriggered: boolean } }> {
  const docs = toCRAGDocs(results as Array<{ id: string; condition?: string | null; overview?: string | null; symptoms?: string | null; similarity: number }>);
  const cragResult: CRAGResult = await gradeDocuments(query, docs);
  const acceptedIds = new Set(cragResult.accepted.map((d) => d.id));
  const filtered = results.filter((r) => acceptedIds.has(r.id));
  return {
    filtered,
    cragMeta: {
      qualityScore: cragResult.qualityScore,
      accepted: cragResult.accepted.length,
      rejected: cragResult.rejected.length,
      fallbackTriggered: cragResult.fallbackTriggered,
    },
  };
}

export const onRequestPost = aiEndpoint(BodySchema, async (context) => {
  const { env, validated, auth } = context as {
    env: Env;
    validated: z.infer<typeof BodySchema>;
    auth: { userId: string };
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

  const prisma = createEdgePrismaClient(env.DATABASE_URL);
  const { query, limit, mode, crag: enableCRAG } = validated;

  try {
    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
      return { status: 500, error: 'GEMINI_API_KEY not configured' };
    }

    // ── Hybrid search path (keyword + semantic RRF fusion) ──
    if (mode === 'hybrid') {
      const complexity = classifyQuery(query);
      const hybridResults = await hybridSearchRRF(query, {
        prisma: prisma as any,
        apiKey,
        limit,
      });

      if (hybridResults.length === 0) {
        return {
          data: { results: [], count: 0, mode: 'hybrid', queryComplexity: complexity },
          headers: { 'Cache-Control': 'private, max-age=60' },
        };
      }

      const hybridIds = hybridResults.map((r) => r.id);
      const hybridScoreMap = new Map(hybridResults.map((r) => [r.id, r]));

      const hybridContent = await prisma.medicalContent.findMany({
        where: { id: { in: hybridIds } },
        select: {
          id: true, condition: true, conditionId: true, system: true,
          subcategory: true, pance_yield: true, classic_patient: true,
          buzzwords: true, gold_standard_dx: true, first_line_rx: true,
          overview: true, symptoms: true, pathophysiology: true,
          treatment: true, diagnostics: true, best_initial_test: true,
          clinical_pearls: true, lastClinicalReviewAt: true,
        },
      });

      const hybridMapped = hybridIds
        .map((id) => {
          const item = hybridContent.find((c) => c.id === id);
          const scores = hybridScoreMap.get(id);
          return item ? {
            ...item,
            similarity: scores?.score ?? 0,
            keywordScore: scores?.keywordScore ?? 0,
            semanticScore: scores?.semanticScore ?? 0,
            source: scores?.source ?? 'semantic',
          } : null;
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);

      // Apply CRAG if enabled
      if (enableCRAG && hybridMapped.length > 0) {
        const { filtered, cragMeta } = await applyCRAG(query, hybridMapped as Array<Record<string, unknown> & { id: string; similarity: number }>);
        return {
          data: { results: filtered, count: filtered.length, mode: 'hybrid', queryComplexity: complexity, crag: cragMeta },
          headers: { 'Cache-Control': 'private, max-age=60' },
        };
      }

      return {
        data: { results: hybridMapped, count: hybridMapped.length, mode: 'hybrid', queryComplexity: complexity },
        headers: { 'Cache-Control': 'private, max-age=60' },
      };
    }

    // ── Pure semantic search path (default, backward compat) ──
    const embedding = await getQueryEmbedding(query, apiKey);
    const vectorStr = `[${embedding.join(',')}]`;

    // Tune HNSW recall for this connection only (SET LOCAL is transaction-scoped).
    // Must run inside the same implicit transaction as the vector query — Prisma
    // $queryRawUnsafe reuses the pooled connection, so back-to-back calls land
    // on the same session.
    await prisma.$executeRawUnsafe(`SET LOCAL hnsw.ef_search = ${HNSW_EF_SEARCH}`);

    type Row = { medicalContentId: string; similarity: number };
    const rows = await prisma.$queryRawUnsafe<Row[]>(
      `SELECT e."medicalContentId", (1 - (e.embedding <=> $1::vector))::float as similarity
       FROM "MedicalContentEmbedding" e
       ORDER BY e.embedding <=> $1::vector
       LIMIT $2`,
      vectorStr,
      limit
    );

    if (rows.length === 0) {
      return {
        data: { results: [], count: 0, mode: 'semantic' },
        headers: { 'Cache-Control': 'private, max-age=60' },
      };
    }

    const ids = rows.map((r) => r.medicalContentId);
    const scoreMap = new Map(rows.map((r) => [r.medicalContentId, r.similarity]));

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

    const results = ids
      .map((id) => {
        const item = content.find((c) => c.id === id);
        const similarity = scoreMap.get(id) ?? 0;
        return item ? { ...item, similarity } : null;
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    // Apply CRAG if enabled
    if (enableCRAG && results.length > 0) {
      const { filtered, cragMeta } = await applyCRAG(query, results as Array<Record<string, unknown> & { id: string; similarity: number }>);
      return {
        data: { results: filtered, count: filtered.length, mode: 'semantic', crag: cragMeta },
        headers: { 'Cache-Control': 'private, max-age=60' },
      };
    }

    return {
      data: { results, count: results.length, mode: 'semantic' },
      headers: { 'Cache-Control': 'private, max-age=60' },
    };
  } catch (error) {
    console.error('[semantic-search]', error);
    return {
      status: 500,
      error: error instanceof Error ? error.message : 'Semantic search failed',
    };
  } finally {
    await safePrismaDisconnect(prisma);
  }
}, { requestsPerMinute: 10 });
