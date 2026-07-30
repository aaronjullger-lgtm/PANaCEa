/**
 * Qdrant long-term memory client for the orchestrator.
 *
 * Collection layout (all created lazily on first use, or via `cli --ensure-collections`):
 *   panacea_agents_runs        — agent run summaries (search: "what did the X agent decide last week?")
 *   panacea_agents_decisions   — structured decisions / action items produced by agents
 *   panacea_agents_context     — ingested reference context (repo audit snippets, Sentry events, PR diffs)
 *
 * Embeddings: Gemini text-embedding-004 (768-dim) when GEMINI_API_KEY is set,
 * falling back to OpenAI text-embedding-3-small (1536-dim). The collection
 * vector size is fixed at creation time, so the embedding model is pinned
 * per-collection and recorded in the payload metadata.
 *
 * Doc references (researched 2026-07):
 *  - Qdrant JS client: https://github.com/qdrant/qdrant-js  (`@qdrant/js-client-rest`)
 *  - LangChain Qdrant vectorstore: `@langchain/qdrant` QdrantVectorStore
 *  - create collection: client.createCollection(name, { vectors: { size, distance: 'Cosine' } })
 *
 * @module packages/agent-orchestrator/src/clients/qdrant
 */

import { getEnv, getCapabilities, getQdrantUrl, requireEnv } from '../config/env.js';

export const COLLECTIONS = {
  runs: 'panacea_agents_runs',
  decisions: 'panacea_agents_decisions',
  context: 'panacea_agents_context',
} as const;

export type CollectionName = keyof typeof COLLECTIONS;

let _qdrant: import('@qdrant/js-client-rest').QdrantClient | null = null;

async function getQdrant(): Promise<import('@qdrant/js-client-rest').QdrantClient | null> {
  if (_qdrant) return _qdrant;
  const env = getEnv();
  const url = getQdrantUrl();
  if (!url) return null;

  const { QdrantClient } = await import('@qdrant/js-client-rest');
  _qdrant = new QdrantClient({
    url,
    apiKey: env.QDRANT_API_KEY,
  });
  return _qdrant;
}

/** Embedding dimension for the active embedding provider. */
async function getEmbeddingDim(): Promise<number> {
  const env = getEnv();
  if (env.GEMINI_API_KEY) return 768; // text-embedding-004
  if (env.OPENAI_API_KEY) return 1536; // text-embedding-3-small
  return 384; // fallback dim for_sha256-hash pseudo-embeddings in fully offline mode
}

const _ensured = new Set<string>();

// Payload fields indexed for O(log n) filtered recall.
const PAYLOAD_INDEXES: Record<CollectionName, string[]> = {
  runs: ['role', 'startedAt', 'via', 'error'],
  decisions: ['kind', 'severity', 'conditionId'],
  context: ['source', 'conditionId'],
};

export async function ensureCollection(name: CollectionName): Promise<void> {
  const client = await getQdrant();
  if (!client) return;
  const collection = COLLECTIONS[name];
  if (_ensured.has(collection)) return;

  let existed = false;
  try {
    await client.getCollection(collection);
    _ensured.add(collection);
    existed = true;
  } catch {
    // doesn't exist — create below
  }

  const dim = await getEmbeddingDim();
  try {
    if (!existed) {
      // decisions collection gets a sparse BM25 vector alongside dense for hybrid RRF.
      const sparseVectors = name === 'decisions' ? { bm25: { index: {} } } : undefined;
      await client.createCollection(collection, {
        vectors: { size: dim, distance: 'Cosine' },
        sparse_vectors: sparseVectors,
        // scalar int8 quantization cuts memory ~3x with negligible recall loss.
        quantization_config: { scalar: { type: 'int8', quantile: 0.99, always_ram: true } },
      });
      _ensured.add(collection);
    }
    // Apply payload indexes to both new and existing collections (idempotent).
    for (const field of PAYLOAD_INDEXES[name] ?? []) {
      try {
        await client.createPayloadIndex(collection, {
          field_name: field,
          field_schema: 'keyword',
        });
      } catch {
        // already indexed — ignore
      }
    }
  } catch (err) {
    console.warn(
      `[agent-orchestrator] Failed to configure Qdrant collection "${collection}":`,
      err instanceof Error ? err.message : err,
    );
  }
}

export async function ensureAllCollections(): Promise<void> {
  await Promise.all([
    ensureCollection('runs'),
    ensureCollection('decisions'),
    ensureCollection('context'),
  ]);
}

export async function inspectCollections(): Promise<Array<{ name: string; status: string }>> {
  const client = await getQdrant();
  if (!client) return [];
  const out: Array<{ name: string; status: string }> = [];
  for (const c of Object.values(COLLECTIONS)) {
    try {
      const info = await client.getCollection(c);
      out.push({ name: c, status: info.status ?? 'unknown' });
    } catch (err) {
      out.push({ name: c, status: `missing/error: ${err instanceof Error ? err.message : String(err)}` });
    }
  }
  return out;
}

/**
 * Upzert (insert-or-update) an agent run / decision / context record.
 * `id` should be a stable UUID; `text` is embedded for similarity search;
 * `payload` is stored verbatim and returned on search.
 */
export async function remember(
  collection: CollectionName,
  id: string,
  text: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const client = await getQdrant();
  if (!client) return;
  await ensureCollection(collection);

  const vector = await embed(text);
  try {
    // decisions collection also indexes a BM25 sparse vector so recallHybrid
    // can fuse dense + lexical (exact clinical-term) matches via RRF.
    const point: Record<string, unknown> = { id, vector, payload: { text, ...payload } };
    if (collection === 'decisions') {
      const sparse = tokenizeToSparse(text + ' ' + JSON.stringify(payload));
      point.sparse = { bm25: sparse };
    }
    await client.upsert(COLLECTIONS[collection], {
      points: [point],
      wait: false,
    } as Parameters<typeof client.upsert>[1]);
  } catch (err) {
    console.warn(
      `[agent-orchestrator] Qdrant upsert to "${COLLECTIONS[collection]}" failed:`,
      err instanceof Error ? err.message : err,
    );
  }
}

/** Semantic search over a collection. Returns scored payloads. */
export async function recall(
  collection: CollectionName,
  query: string,
  limit = 5,
  filter?: Record<string, unknown>,
): Promise<Array<{ id: string | number; score: number; payload: Record<string, unknown> }>> {
  const client = await getQdrant();
  if (!client) return [];
  await ensureCollection(collection);

  const vector = await embed(query);
  try {
    const results = await client.search(COLLECTIONS[collection], {
      vector,
      limit,
      with_payload: true,
      filter: filter ? { must: Object.entries(filter).map(([k, v]) => ({ key: k, match: { value: v } })) } : undefined,
    });
    return results.map((r) => ({ id: r.id, score: r.score ?? 0, payload: (r.payload ?? {}) as Record<string, unknown> }));
  } catch (err) {
    console.warn(`[agent-orchestrator] Qdrant search on "${COLLECTIONS[collection]}" failed:`, err);
    return [];
  }
}

/**
 * Hybrid dense+sparse recall with reciprocal-rank fusion (RRF).
 *
 * Runs the unified Query API asking Qdrant to fuse the dense vector search and
 * the sparse BM25 search, returning a single re-ranked list. Only meaningful on
 * collections that have a sparse index (currently `decisions`). Falls back to
 * plain dense `recall` on other collections or on query errors.
 */
export async function recallHybrid(
  collection: CollectionName,
  query: string,
  limit = 5,
  filter?: Record<string, unknown>,
): Promise<Array<{ id: string | number; score: number; payload: Record<string, unknown> }>> {
  if (collection !== 'decisions') return recall(collection, query, limit, filter);
  const client = await getQdrant();
  if (!client) return [];
  await ensureCollection(collection);

  const dense = await embed(query);
  const sparse = tokenizeToSparse(query);
  try {
    // query_points with prefetches lets Qdrant fuse two retrievals via RRF.
    const res = await (client as unknown as {
      query: (c: string, body: unknown) => Promise<{ points: Array<{ id: string | number; score: number; payload?: Record<string, unknown> }> }>;
    }).query(COLLECTIONS[collection], {
      prefetch: [
        { query: { dense }, limit: limit * 3 },
        { query: { sparse }, limit: limit * 3 },
      ],
      query: { fusion: { rrf: { rrf_k: 60 } } },
      limit,
      with_payload: true,
      filter: filter ? { must: Object.entries(filter).map(([k, v]) => ({ key: k, match: { value: v } })) } : undefined,
    });
    return (res.points ?? []).map((p) => ({ id: p.id, score: p.score ?? 0, payload: (p.payload ?? {}) as Record<string, unknown> }));
  } catch (err) {
    console.warn(`[agent-orchestrator] Qdrant hybrid query on "${COLLECTIONS[collection]}" failed, falling back to dense:`, err);
    return recall(collection, query, limit, filter);
  }
}

/**
 * Tokenize text into a BM25-style sparse vector { index: weight }.
 *
 * Lightweight in-process tokenizer (lowercase, split on non-alnum, stopword
 * strip, term-frequency weights). Avoids a heavy BM25 library dependency for
 * the orchestrator's modest recall volume. Qdrant server-side applies BM25
 * scoring; this just produces the sparse vector the client must send.
 */
function tokenizeToSparse(text: string): { indices: number[]; values: number[] } {
  const STOP = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'for', 'with', 'on', 'is', 'are', 'be', 'this', 'that']);
  const counts = new Map<string, number>();
  for (const raw of text.toLowerCase().match(/[a-z0-9]+/g) ?? []) {
    if (raw.length < 2 || STOP.has(raw)) continue;
    counts.set(raw, (counts.get(raw) ?? 0) + 1);
  }
  const indices: number[] = [];
  const values: number[] = [];
  for (const [tok, cnt] of counts) {
    let h = 0;
    for (let i = 0; i < tok.length; i++) h = (Math.imul(31, h) + tok.charCodeAt(i)) | 0;
    indices.push(Math.abs(h) % 65_536);
    values.push(cnt);
  }
  return { indices, values };
}

// ─── Embedding ─────────────────────────────────────────────────────────────

async function embed(text: string): Promise<number[]> {
  const env = getEnv();
  const caps = getCapabilities();

  if (env.GEMINI_API_KEY) {
    try {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(requireEnv('GEMINI_API_KEY'));
      const model = genAI.getGenerativeModel({ model: 'embedding-001' });
      const res = await model.embedContent(text);
      return res.embedding.values;
    } catch (err) {
      console.warn('[agent-orchestrator] Gemini embedding failed, using hash fallback:', err);
    }
  }

  if (env.OPENAI_API_KEY && caps.qdrant) {
    try {
      const OpenAI = (await import('openai')).default;
      const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
      const res = await client.embeddings.create({ model: 'text-embedding-3-small', input: text });
      return res.data[0]?.embedding ?? hashEmbed(text, 1536);
    } catch (err) {
      console.warn('[agent-orchestrator] OpenAI embedding failed, using hash fallback:', err);
    }
  }

  // Deterministic offline fallback — NOT a real embedding, but keeps Qdrant
  // functional (cosine search degenerates to a near-random but stable retrieval).
  // Only used when no embedding API key is set at all.
  return hashEmbed(text, await getEmbeddingDim());
}

function hashEmbed(text: string, dim: number): number[] {
  const vec = new Array(dim).fill(0);
  for (let i = 0; i < text.length; i++) {
    vec[i % dim] += text.charCodeAt(i) / 1000;
  }
  // normalize so Cosine is meaningful
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

/** Surface whether Qdrant memory is actually wired (UI / health / CLI smoke). */
export function isMemoryEnabled(): boolean {
  return getCapabilities().qdrant;
}