/**
 * Hybrid Search: Keyword (FTS) + Semantic (HNSW vector) with Reciprocal Rank Fusion.
 * Use for Reference Library / MedicalContent search (e.g. "MI" + "heart attack").
 */

import type { PrismaClient } from '@prisma/client';

const EMBED_MODEL = 'text-embedding-005';
const EMBED_DIMS = 768;
const RRF_K = 60;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const PER_LIST_LIMIT = 100;

export interface HybridSearchDeps {
  prisma: PrismaClient;
  apiKey: string;
  limit?: number;
}

export interface MedicalContentSearchResult {
  id: string;
  condition: string | null;
  conditionId: string | null;
  system: string | null;
  subcategory: string | null;
  pance_yield: number | null;
  classic_patient: string | null;
  buzzwords: string | null;
  gold_standard_dx: string | null;
  first_line_rx: string | null;
  overview: string | null;
  symptoms: string | null;
  pathophysiology: string | null;
  treatment: string | null;
  diagnostics: string | null;
  best_initial_test: string | null;
  clinical_pearls: string | null;
  rrfScore: number;
}

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
  const data: { embedding?: { values?: number[] } } = await res.json();
  const values = data.embedding?.values;
  if (!Array.isArray(values) || values.length !== EMBED_DIMS) {
    throw new Error(`Invalid embedding: expected ${EMBED_DIMS} dims`);
  }
  return values;
}

/**
 * Reciprocal Rank Fusion: score = sum over lists of 1 / (k + rank).
 * k=60 is a common default; ranks are 1-based.
 */
function reciprocalRankFusion(
  keywordIds: string[],
  semanticIds: string[]
): Array<{ id: string; rrfScore: number }> {
  const scoreMap = new Map<string, number>();
  keywordIds.forEach((id, i) => {
    const rank = i + 1;
    scoreMap.set(id, (scoreMap.get(id) ?? 0) + 1 / (RRF_K + rank));
  });
  semanticIds.forEach((id, i) => {
    const rank = i + 1;
    scoreMap.set(id, (scoreMap.get(id) ?? 0) + 1 / (RRF_K + rank));
  });
  return Array.from(scoreMap.entries())
    .map(([id, rrfScore]) => ({ id, rrfScore }))
    .sort((a, b) => b.rrfScore - a.rrfScore);
}

/**
 * Hybrid search: full-text (websearch_to_tsquery) + vector (HNSW) over MedicalContentEmbedding,
 * then RRF fusion. Returns unified, re-ranked list of conditions.
 */
export async function searchMedicalContent(
  query: string,
  deps: HybridSearchDeps
): Promise<MedicalContentSearchResult[]> {
  const { prisma, apiKey, limit: requestedLimit } = deps;
  const limit = Math.min(requestedLimit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const perListLimit = Math.max(limit * 2, 50);

  const trimmed = query.trim();
  if (!trimmed) return [];

  // Step A: Keyword (full-text) search
  let keywordRows: Array<{ id: string; rank: number }> = [];
  try {
    keywordRows = await prisma.$queryRaw<Array<{ id: string; rank: number }>>`
      SELECT id, ts_rank(search_vector, websearch_to_tsquery('english', ${trimmed}))::float as rank
      FROM "MedicalContent"
      WHERE search_vector @@ websearch_to_tsquery('english', ${trimmed})
      ORDER BY rank DESC
      LIMIT ${perListLimit}
    `;
  } catch {
    keywordRows = [];
  }

  // Step B: Semantic (vector) search via MedicalContentEmbedding (HNSW)
  let semanticRows: Array<{ medicalContentId: string }> = [];
  try {
    const embedding = await getQueryEmbedding(trimmed, apiKey);
    const vectorStr = `[${embedding.join(',')}]`;
    semanticRows = await prisma.$queryRawUnsafe<Array<{ medicalContentId: string }>>(
      `SELECT e."medicalContentId"
       FROM "MedicalContentEmbedding" e
       ORDER BY e.embedding <=> $1::vector
       LIMIT $2`,
      vectorStr,
      perListLimit
    );
  } catch {
    semanticRows = [];
  }

  const keywordIds = keywordRows.map((r) => r.id);
  const semanticIds = semanticRows.map((r) => r.medicalContentId);

  // Step C: RRF fusion
  const fused = reciprocalRankFusion(keywordIds, semanticIds).slice(0, limit);
  const ids = fused.map((f) => f.id);
  const scoreMap = new Map(fused.map((f) => [f.id, f.rrfScore]));

  if (ids.length === 0) return [];

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

  return ids
    .map((id) => {
      const item = content.find((c) => c.id === id);
      const rrfScore = scoreMap.get(id) ?? 0;
      return item ? { ...item, rrfScore } : null;
    })
    .filter((r): r is MedicalContentSearchResult => r !== null);
}
