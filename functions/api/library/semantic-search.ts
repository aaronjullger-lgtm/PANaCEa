/**
 * POST /api/library/semantic-search
 *
 * Semantic search over Reference Library (MedicalContent) using pgvector
 * and Google AI text-embedding-005. Returns nearest neighbors by cosine similarity.
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { validateFunctionEnv, MissingEnvError } from '../_shared/env-validation';
import type { CloudflareEnv } from '../_shared/types';
import { hybridSearchRRF, classifyQuery } from '@/lib/services/search/hybridSearch';

const EMBED_MODEL = 'text-embedding-005';
const EMBED_DIMS = 768;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

const BodySchema = z.object({
  query: z.string().min(1).max(2000),
  limit: z.number().int().min(1).max(MAX_LIMIT).optional().default(DEFAULT_LIMIT),
  /** Search mode: 'semantic' (default, pure vector) or 'hybrid' (keyword + semantic RRF) */
  mode: z.enum(['semantic', 'hybrid']).optional().default('semantic'),
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

export const onRequestOptions = withCors();

export const onRequestPost = authenticatedEndpoint(BodySchema, async (context) => {
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
  const { query, limit, mode } = validated;

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
          clinical_pearls: true,
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

      return {
        data: { results: hybridMapped, count: hybridMapped.length, mode: 'hybrid', queryComplexity: complexity },
        headers: { 'Cache-Control': 'private, max-age=60' },
      };
    }

    // ── Pure semantic search path (default, backward compat) ──
    const embedding = await getQueryEmbedding(query, apiKey);
    const vectorStr = `[${embedding.join(',')}]`;

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
      },
    });

    const results = ids
      .map((id) => {
        const item = content.find((c) => c.id === id);
        const similarity = scoreMap.get(id) ?? 0;
        return item ? { ...item, similarity } : null;
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

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
});
