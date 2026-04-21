/**
 * Hybrid Search: Keyword (FTS) + Semantic (HNSW vector) with Reciprocal Rank Fusion.
 * Use for Reference Library / MedicalContent search (e.g. "MI" + "heart attack").
 *
 * Optionally post-processes the fused list with the cross-encoder-style
 * `rerankFast` service (feature-based reranking) for a recall→precision boost
 * on ambiguous queries. Callers opt in via `rerank: true` to avoid changing
 * ranking behaviour for paths that have been tuned around pure RRF output.
 */

import type { Prisma, PrismaClient } from '@prisma/client';
import { rerankFast } from './services/rerankService';
import type { RAGChunk, RAGContext, ContentType } from './services/ragContextService';

const EMBED_MODEL = 'text-embedding-005';
const EMBED_DIMS = 768;
const RRF_K = 60;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const PER_LIST_LIMIT = 100;

/**
 * HNSW ef_search — see functions/api/library/semantic-search.ts for rationale.
 * Keep the two values in sync; 100 balances recall and latency for 768-dim
 * clinical embeddings.
 */
const HNSW_EF_SEARCH = 100;

export interface HybridSearchDeps {
  prisma: PrismaClient;
  apiKey: string;
  limit?: number;
  /**
   * When true, runs `rerankFast` over the RRF-fused results to improve
   * top-K precision. Default: false (preserves legacy behaviour). Fast mode
   * is synchronous and adds < 5ms; no extra API calls.
   */
  rerank?: boolean;
  /** Optional target system for the reranker's alignment signal. */
  rerankTargetSystem?: string;
}

/**
 * Shape of a hydrated MedicalContent row returned by hybrid search.
 *
 * Field nullability mirrors Prisma's actual return type for the `select` used
 * in {@link searchMedicalContent}: `condition`, `conditionId`, `system`, and
 * `subcategory` are NOT NULL per schema; `buzzwords` is a `String[]` column
 * (default `[]`); `clinical_pearls` is a `Json?` column surfaced as
 * `Prisma.JsonValue | null` so callers coerce defensively.
 */
export interface MedicalContentSearchResult {
  id: string;
  condition: string;
  conditionId: string;
  system: string;
  subcategory: string;
  pance_yield: number | null;
  classic_patient: string | null;
  buzzwords: string[];
  gold_standard_dx: string | null;
  first_line_rx: string | null;
  overview: string | null;
  symptoms: string | null;
  pathophysiology: string | null;
  treatment: string | null;
  diagnostics: string | null;
  best_initial_test: string | null;
  clinical_pearls: Prisma.JsonValue | null;
  lastClinicalReviewAt: Date | null;
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
  const { prisma, apiKey, limit: requestedLimit, rerank, rerankTargetSystem } = deps;
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
        AND status = 'published'
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
    // SET LOCAL is transaction-scoped; safe on a pooled connection.
    await prisma.$executeRawUnsafe(`SET LOCAL hnsw.ef_search = ${HNSW_EF_SEARCH}`);
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
      lastClinicalReviewAt: true,
    },
  });

  const hydrated = ids
    .map((id) => {
      const item = content.find((c) => c.id === id);
      const rrfScore = scoreMap.get(id) ?? 0;
      return item ? { ...item, rrfScore } : null;
    })
    .filter((r): r is MedicalContentSearchResult => r !== null);

  if (!rerank || hydrated.length <= 1) {
    return hydrated;
  }

  return applyReranker(hydrated, query, rerankTargetSystem);
}

// ─── Reranker Adapter ───────────────────────────────────────────────────────
//
// `rerankFast` consumes a `RAGContext` of chunks. For library search we do not
// have chunk-level embeddings — we have hydrated MedicalContent rows. We adapt
// each row into a synthetic `RAGChunk` whose `content` is the richest text
// surface available (condition + buzzwords + classic patient + pearls + ...)
// and whose `similarity` reuses the RRF score so the reranker can blend it
// with lexical/clinical/system signals. The reranker returns chunks keyed by
// `sourceId` which we map back to the original rows.

/**
 * Best-effort coercion of the `clinical_pearls` Json column into a flat string
 * the reranker can lexically match. Supports strings, string arrays, and object
 * shapes (stringified).
 */
function stringifyPearls(pearls: Prisma.JsonValue | null): string {
  if (pearls == null) return '';
  if (typeof pearls === 'string') return pearls;
  if (Array.isArray(pearls)) {
    return pearls
      .filter((p): p is string => typeof p === 'string' && p.length > 0)
      .join(' ');
  }
  if (typeof pearls === 'object') {
    try {
      return JSON.stringify(pearls);
    } catch {
      return '';
    }
  }
  return '';
}

/** @internal Exported for tests. */
export function toRAGChunk(row: MedicalContentSearchResult): RAGChunk {
  const parts: string[] = [];
  if (row.condition) parts.push(row.condition);
  if (row.buzzwords && row.buzzwords.length > 0) {
    parts.push(row.buzzwords.join(', '));
  }
  if (row.classic_patient) parts.push(row.classic_patient);
  const pearlsText = stringifyPearls(row.clinical_pearls);
  if (pearlsText) parts.push(pearlsText);
  if (row.overview) parts.push(row.overview);
  if (row.symptoms) parts.push(row.symptoms);
  if (row.first_line_rx) parts.push(row.first_line_rx);

  // Map MedicalContent shape into the reranker's ContentType enum. We prefer
  // the most clinically useful type available on the row; fall back to overview.
  let contentType: ContentType = 'overview';
  if (pearlsText) contentType = 'clinical_pearls';
  else if (row.first_line_rx || row.treatment) contentType = 'treatment';
  else if (row.best_initial_test || row.gold_standard_dx || row.diagnostics)
    contentType = 'diagnostics';
  else if (row.pathophysiology) contentType = 'pathophysiology';
  else if (row.symptoms) contentType = 'symptoms';

  return {
    sourceId: row.id,
    content: parts.join(' — '),
    system: row.system,
    condition: row.condition,
    contentType,
    similarity: row.rrfScore,
  };
}

/** @internal Exported for tests. */
export function applyReranker(
  rows: MedicalContentSearchResult[],
  query: string,
  targetSystem?: string
): MedicalContentSearchResult[] {
  const chunks = rows.map(toRAGChunk);
  const context: RAGContext = {
    chunks,
    totalTokensEstimate: 0,
    retrievalScores: chunks.map((c) => c.similarity),
    isGrounded: true,
  };
  const { chunks: reranked } = rerankFast(context, query, {
    mode: 'fast',
    ...(targetSystem ? { targetSystem } : {}),
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  // Preserve the rerankScore on the returned shape so callers/telemetry can
  // observe the lift vs. pure RRF.
  const out: MedicalContentSearchResult[] = [];
  for (const scored of reranked) {
    const row = byId.get(scored.chunk.sourceId);
    if (row) out.push({ ...row, rrfScore: scored.rerankScore });
  }
  return out;
}

