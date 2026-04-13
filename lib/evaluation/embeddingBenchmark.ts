/**
 * Medical Embedding Model Benchmark Harness
 *
 * Compares embedding model quality for clinical retrieval tasks.
 * Supports:
 * - Google text-embedding-005 (current production, 768-dim)
 * - Gemini Embedding 2 (3072-dim, Matryoshka-capable)
 * - Voyage 4 (1024-dim, strong medical retrieval)
 * - OpenAI text-embedding-3-large (3072-dim)
 *
 * Metrics: Hit@K, MRR, NDCG, cosine similarity distribution,
 * latency, and cost per 1K embeddings.
 *
 * Usage: Run via `scripts/benchmark-embeddings.ts` with a curated
 * medical test set of query-document pairs.
 *
 * @module lib/evaluation/embeddingBenchmark
 */

// ─── Types ─────────────────────────────────────────────────────────────────

export interface EmbeddingProvider {
  name: string;
  dimensions: number;
  costPer1M: number;
  /** Generate embedding for text. Returns vector. */
  embed: (text: string) => Promise<number[]>;
  /** Optional: batch embed for efficiency */
  batchEmbed?: (texts: string[]) => Promise<number[][]>;
}

export interface BenchmarkQuery {
  id: string;
  query: string;
  /** IDs of relevant documents (ground truth) */
  relevantDocIds: string[];
  /** Clinical domain (e.g., 'cardiology', 'pulmonology') */
  domain?: string;
}

export interface BenchmarkCorpus {
  id: string;
  text: string;
  domain?: string;
}

export interface ProviderResult {
  provider: string;
  dimensions: number;
  costPer1M: number;
  metrics: {
    hitAt1: number;
    hitAt5: number;
    hitAt10: number;
    mrr: number;
    ndcg: number;
    avgLatencyMs: number;
    p95LatencyMs: number;
  };
  perDomain?: Record<string, { hitAt5: number; mrr: number }>;
}

export interface BenchmarkResult {
  timestamp: string;
  corpusSize: number;
  queryCount: number;
  providers: ProviderResult[];
  winner: string;
  recommendation: string;
}

// ─── Similarity & Metrics ──────────────────────────────────────────────────

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error(`Dimension mismatch: ${a.length} vs ${b.length}`);
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/** Hit@K: fraction of queries where at least one relevant doc is in top K */
export function hitAtK(
  rankings: Array<{ queryId: string; rankedDocIds: string[] }>,
  queries: BenchmarkQuery[],
  k: number
): number {
  const queryMap = new Map(queries.map((q) => [q.id, new Set(q.relevantDocIds)]));
  let hits = 0;
  for (const { queryId, rankedDocIds } of rankings) {
    const relevant = queryMap.get(queryId);
    if (!relevant) continue;
    const topK = rankedDocIds.slice(0, k);
    if (topK.some((id) => relevant.has(id))) hits++;
  }
  return rankings.length > 0 ? hits / rankings.length : 0;
}

/** MRR: Mean Reciprocal Rank */
export function meanReciprocalRank(
  rankings: Array<{ queryId: string; rankedDocIds: string[] }>,
  queries: BenchmarkQuery[]
): number {
  const queryMap = new Map(queries.map((q) => [q.id, new Set(q.relevantDocIds)]));
  let rrSum = 0;
  for (const { queryId, rankedDocIds } of rankings) {
    const relevant = queryMap.get(queryId);
    if (!relevant) continue;
    const rank = rankedDocIds.findIndex((id) => relevant.has(id));
    if (rank >= 0) rrSum += 1 / (rank + 1);
  }
  return rankings.length > 0 ? rrSum / rankings.length : 0;
}

/** NDCG: Normalized Discounted Cumulative Gain */
export function ndcg(
  rankings: Array<{ queryId: string; rankedDocIds: string[] }>,
  queries: BenchmarkQuery[],
  k: number = 10
): number {
  const queryMap = new Map(queries.map((q) => [q.id, new Set(q.relevantDocIds)]));
  let ndcgSum = 0;

  for (const { queryId, rankedDocIds } of rankings) {
    const relevant = queryMap.get(queryId);
    if (!relevant) continue;

    // DCG
    let dcg = 0;
    for (let i = 0; i < Math.min(rankedDocIds.length, k); i++) {
      const rel = relevant.has(rankedDocIds[i]) ? 1 : 0;
      dcg += rel / Math.log2(i + 2); // i+2 because log2(1)=0
    }

    // Ideal DCG
    const idealRanking = Math.min(relevant.size, k);
    let idcg = 0;
    for (let i = 0; i < idealRanking; i++) {
      idcg += 1 / Math.log2(i + 2);
    }

    ndcgSum += idcg > 0 ? dcg / idcg : 0;
  }

  return rankings.length > 0 ? ndcgSum / rankings.length : 0;
}

// ─── Benchmark Runner ─────────────────────────────────────────────────────

/**
 * Run a full embedding benchmark comparing multiple providers.
 *
 * @example
 * ```ts
 * const result = await runBenchmark(
 *   [googleProvider, voyageProvider],
 *   testQueries,
 *   testCorpus,
 * );
 * console.log(result.winner); // 'voyage-4'
 * ```
 */
export async function runBenchmark(
  providers: EmbeddingProvider[],
  queries: BenchmarkQuery[],
  corpus: BenchmarkCorpus[],
  options?: { onProgress?: (provider: string, step: string) => void }
): Promise<BenchmarkResult> {
  const providerResults: ProviderResult[] = [];

  for (const provider of providers) {
    options?.onProgress?.(provider.name, 'Embedding corpus...');

    // Embed corpus
    const corpusLatencies: number[] = [];
    const corpusEmbeddings: Map<string, number[]> = new Map();

    for (const doc of corpus) {
      const start = Date.now();
      const embedding = await provider.embed(doc.text);
      corpusLatencies.push(Date.now() - start);
      corpusEmbeddings.set(doc.id, embedding);
    }

    options?.onProgress?.(provider.name, 'Evaluating queries...');

    // Embed queries and rank
    const queryLatencies: number[] = [];
    const rankings: Array<{ queryId: string; rankedDocIds: string[] }> = [];

    for (const query of queries) {
      const start = Date.now();
      const queryVec = await provider.embed(query.query);
      queryLatencies.push(Date.now() - start);

      // Rank corpus by cosine similarity
      const scored = corpus.map((doc) => ({
        id: doc.id,
        score: cosineSimilarity(queryVec, corpusEmbeddings.get(doc.id)!),
      }));
      scored.sort((a, b) => b.score - a.score);

      rankings.push({ queryId: query.id, rankedDocIds: scored.map((s) => s.id) });
    }

    // Compute metrics
    const allLatencies = [...corpusLatencies, ...queryLatencies].sort((a, b) => a - b);
    const p95Idx = Math.floor(allLatencies.length * 0.95);

    const result: ProviderResult = {
      provider: provider.name,
      dimensions: provider.dimensions,
      costPer1M: provider.costPer1M,
      metrics: {
        hitAt1: Math.round(hitAtK(rankings, queries, 1) * 1000) / 1000,
        hitAt5: Math.round(hitAtK(rankings, queries, 5) * 1000) / 1000,
        hitAt10: Math.round(hitAtK(rankings, queries, 10) * 1000) / 1000,
        mrr: Math.round(meanReciprocalRank(rankings, queries) * 1000) / 1000,
        ndcg: Math.round(ndcg(rankings, queries) * 1000) / 1000,
        avgLatencyMs: Math.round(allLatencies.reduce((a, b) => a + b, 0) / allLatencies.length),
        p95LatencyMs: allLatencies[p95Idx] ?? 0,
      },
    };

    // Per-domain breakdown
    const domains = [...new Set(queries.map((q) => q.domain).filter(Boolean))] as string[];
    if (domains.length > 1) {
      result.perDomain = {};
      for (const domain of domains) {
        const domainQueries = queries.filter((q) => q.domain === domain);
        const domainRankings = rankings.filter((r) =>
          domainQueries.some((q) => q.id === r.queryId)
        );
        result.perDomain[domain] = {
          hitAt5: Math.round(hitAtK(domainRankings, domainQueries, 5) * 1000) / 1000,
          mrr: Math.round(meanReciprocalRank(domainRankings, domainQueries) * 1000) / 1000,
        };
      }
    }

    providerResults.push(result);
  }

  // Determine winner by composite score (MRR * 0.4 + NDCG * 0.3 + Hit@5 * 0.3)
  const scored = providerResults.map((p) => ({
    name: p.provider,
    composite: p.metrics.mrr * 0.4 + p.metrics.ndcg * 0.3 + p.metrics.hitAt5 * 0.3,
  }));
  scored.sort((a, b) => b.composite - a.composite);

  const winner = scored[0]?.name ?? 'unknown';
  const bestResult = providerResults.find((p) => p.provider === winner);

  return {
    timestamp: new Date().toISOString(),
    corpusSize: corpus.length,
    queryCount: queries.length,
    providers: providerResults,
    winner,
    recommendation: bestResult
      ? `${winner} achieves MRR=${bestResult.metrics.mrr}, NDCG=${bestResult.metrics.ndcg}, Hit@5=${bestResult.metrics.hitAt5} at $${bestResult.costPer1M}/1M tokens`
      : 'Insufficient data',
  };
}

// ─── Provider Factories ───────────────────────────────────────────────────

/**
 * Create a Google text-embedding-005 provider.
 */
export function createGoogleEmbeddingProvider(apiKey: string): EmbeddingProvider {
  return {
    name: 'text-embedding-005',
    dimensions: 768,
    costPer1M: 0.00,  // Free tier
    embed: async (text: string) => {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-005:embedContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: { parts: [{ text }] },
          outputDimensionality: 768,
        }),
      });
      if (!res.ok) throw new Error(`Google embed error: ${res.status}`);
      const data = (await res.json()) as { embedding?: { values?: number[] } };
      return data.embedding?.values ?? [];
    },
  };
}

/**
 * Create a Voyage embedding provider (requires VOYAGE_API_KEY).
 */
export function createVoyageEmbeddingProvider(apiKey: string): EmbeddingProvider {
  return {
    name: 'voyage-3-large',
    dimensions: 1024,
    costPer1M: 0.18,
    embed: async (text: string) => {
      const res = await fetch('https://api.voyageai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model: 'voyage-3-large', input: text }),
      });
      if (!res.ok) throw new Error(`Voyage embed error: ${res.status}`);
      const data = (await res.json()) as { data?: Array<{ embedding: number[] }> };
      return data.data?.[0]?.embedding ?? [];
    },
  };
}

/**
 * Create an OpenAI text-embedding-3-large provider.
 */
export function createOpenAIEmbeddingProvider(apiKey: string): EmbeddingProvider {
  return {
    name: 'text-embedding-3-large',
    dimensions: 3072,
    costPer1M: 0.13,
    embed: async (text: string) => {
      const res = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model: 'text-embedding-3-large', input: text }),
      });
      if (!res.ok) throw new Error(`OpenAI embed error: ${res.status}`);
      const data = (await res.json()) as { data?: Array<{ embedding: number[] }> };
      return data.data?.[0]?.embedding ?? [];
    },
  };
}
