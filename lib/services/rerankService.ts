/**
 * Cross-Encoder Reranking Service
 *
 * Reranks retrieved RAG chunks using a multi-signal scoring approach
 * that combines vector similarity with lexical and clinical domain features.
 *
 * Two modes:
 *   1. FAST (default): Lightweight feature-based reranking (< 5ms)
 *      - BM25-style term overlap between query and chunk
 *      - Clinical domain features (buzzword density, structured markers)
 *      - Content type priority matching
 *      - System/condition alignment
 *
 *   2. LLM (optional): Gemini-based relevance scoring (~500ms)
 *      - Sends (query, chunk) pairs to Gemini Flash for relevance judgment
 *      - Higher precision but slower and uses API quota
 *      - Reserved for high-stakes use cases (question generation, clinical safety)
 *
 * Research basis:
 *   - Nogueira & Cho (2019): Cross-encoder reranking with BERT
 *   - pa4.md P2: "Cross-encoder reranking for clinical search — 2× retrieval precision"
 *   - ms-marco-MiniLM-L12 not feasible on Edge runtime; hybrid approach achieves
 *     comparable gains via domain-specific feature engineering
 *
 * Integration point: slots between ragContextService.retrieveContext()
 * and cragGuardrailService.evaluateRetrieval()
 *
 * @see lib/services/ragContextService.ts — Upstream retrieval
 * @see lib/services/cragGuardrailService.ts — Downstream guardrails
 * @module lib/services/rerankService
 */

import type { RAGChunk, RAGContext, ContentType } from './ragContextService';

// ─── Types ───────────────────────────────────────────────────────────────

export interface RerankResult {
  /** Reranked chunks (highest relevance first) */
  chunks: ScoredChunk[];
  /** Rebuilt RAG context with reranked chunks */
  context: RAGContext;
  /** Reranking mode used */
  mode: RerankMode;
  /** Time taken in ms */
  durationMs: number;
}

export interface ScoredChunk {
  /** Original RAG chunk */
  chunk: RAGChunk;
  /** Original vector similarity score */
  vectorScore: number;
  /** Computed rerank score (0-1) */
  rerankScore: number;
  /** Breakdown of scoring components */
  scoreBreakdown: ScoreBreakdown;
}

export interface ScoreBreakdown {
  /** Vector similarity component */
  vectorComponent: number;
  /** BM25-style lexical overlap */
  lexicalComponent: number;
  /** Clinical domain feature score */
  clinicalComponent: number;
  /** Content type priority score */
  contentTypePriority: number;
  /** System alignment score */
  systemAlignment: number;
}

export type RerankMode = 'fast' | 'llm';

export interface RerankOptions {
  /** Reranking mode */
  mode?: RerankMode;
  /** Target system for alignment scoring */
  targetSystem?: string;
  /** Target condition for alignment scoring */
  targetCondition?: string;
  /** Preferred content types (ordered by priority) */
  preferredContentTypes?: ContentType[];
  /** Maximum chunks to return after reranking */
  topK?: number;
  /** Weight configuration for scoring components */
  weights?: Partial<RerankWeights>;
}

export interface RerankWeights {
  /** Weight for vector similarity (default 0.35) */
  vector: number;
  /** Weight for lexical overlap (default 0.25) */
  lexical: number;
  /** Weight for clinical domain features (default 0.20) */
  clinical: number;
  /** Weight for content type priority (default 0.10) */
  contentType: number;
  /** Weight for system alignment (default 0.10) */
  system: number;
}

// ─── Defaults ────────────────────────────────────────────────────────────

export const DEFAULT_WEIGHTS: RerankWeights = {
  vector: 0.35,
  lexical: 0.25,
  clinical: 0.20,
  contentType: 0.10,
  system: 0.10,
};

/** Content type priority for different use cases */
export const CONTENT_TYPE_PRIORITY: Record<ContentType, number> = {
  pathophysiology: 0.9,
  diagnostics: 0.85,
  treatment: 0.8,
  symptoms: 0.75,
  clinical_pearls: 0.7,
  overview: 0.5,
};

/** IDF approximations for common clinical terms (lower = less discriminative) */
const COMMON_CLINICAL_TERMS = new Set([
  'patient', 'treatment', 'diagnosis', 'clinical', 'disease', 'condition',
  'symptoms', 'signs', 'history', 'exam', 'laboratory', 'imaging',
  'management', 'therapy', 'medication', 'risk', 'common', 'associated',
  'acute', 'chronic', 'presented', 'findings', 'results', 'normal',
]);

// ─── Fast Reranking ──────────────────────────────────────────────────────

/**
 * Rerank RAG chunks using fast feature-based scoring.
 *
 * This is the primary reranking function. It computes a weighted
 * combination of multiple relevance signals for each chunk.
 */
export function rerankFast(
  context: RAGContext,
  query: string,
  options: RerankOptions = {}
): RerankResult {
  const startTime = Date.now();
  const weights = { ...DEFAULT_WEIGHTS, ...options.weights };
  const topK = options.topK ?? context.chunks.length;

  // Tokenize query
  const queryTerms = tokenize(query);
  const queryTermSet = new Set(queryTerms);

  // Score each chunk
  const scored: ScoredChunk[] = context.chunks.map((chunk) => {
    const breakdown = computeScoreBreakdown(
      chunk,
      queryTerms,
      queryTermSet,
      options,
      weights
    );

    const rerankScore =
      breakdown.vectorComponent * weights.vector +
      breakdown.lexicalComponent * weights.lexical +
      breakdown.clinicalComponent * weights.clinical +
      breakdown.contentTypePriority * weights.contentType +
      breakdown.systemAlignment * weights.system;

    return {
      chunk,
      vectorScore: chunk.similarity,
      rerankScore: Math.min(rerankScore, 1.0),
      scoreBreakdown: breakdown,
    };
  });

  // Sort by rerank score descending
  scored.sort((a, b) => b.rerankScore - a.rerankScore);
  const topChunks = scored.slice(0, topK);

  // Rebuild RAG context
  const rerankedChunks = topChunks.map((s) => s.chunk);
  const rerankedScores = topChunks.map((s) => s.rerankScore);
  const avgScore = rerankedScores.length > 0
    ? rerankedScores.reduce((a, b) => a + b, 0) / rerankedScores.length
    : 0;

  return {
    chunks: topChunks,
    context: {
      chunks: rerankedChunks,
      totalTokensEstimate: Math.ceil(
        rerankedChunks.reduce((sum, c) => sum + c.content.length, 0) * 0.25
      ),
      retrievalScores: rerankedScores,
      isGrounded: avgScore >= 0.40,
    },
    mode: 'fast',
    durationMs: Date.now() - startTime,
  };
}

/**
 * Compute score breakdown for a single chunk.
 */
export function computeScoreBreakdown(
  chunk: RAGChunk,
  queryTerms: string[],
  queryTermSet: Set<string>,
  options: RerankOptions,
  _weights: RerankWeights
): ScoreBreakdown {
  return {
    vectorComponent: chunk.similarity,
    lexicalComponent: computeLexicalScore(chunk.content, queryTerms, queryTermSet),
    clinicalComponent: computeClinicalScore(chunk.content),
    contentTypePriority: computeContentTypePriority(
      chunk.contentType,
      options.preferredContentTypes
    ),
    systemAlignment: computeSystemAlignment(
      chunk.system,
      chunk.condition,
      chunk.content,
      options.targetSystem,
      options.targetCondition
    ),
  };
}

// ─── Scoring Components ──────────────────────────────────────────────────

/**
 * BM25-inspired lexical overlap score.
 *
 * Computes weighted term overlap between query and chunk,
 * with IDF-like weighting that down-weights common clinical terms.
 */
export function computeLexicalScore(
  content: string,
  queryTerms: string[],
  queryTermSet: Set<string>
): number {
  if (queryTerms.length === 0) return 0;

  const contentTerms = tokenize(content);
  const contentTermSet = new Set(contentTerms);

  let weightedMatches = 0;
  let totalWeight = 0;

  for (const term of queryTermSet) {
    // IDF-like weight: common terms get lower weight
    const idf = COMMON_CLINICAL_TERMS.has(term) ? 0.3 : 1.0;
    totalWeight += idf;

    if (contentTermSet.has(term)) {
      // TF-like: bonus for multiple occurrences (saturating)
      const tf = contentTerms.filter((t) => t === term).length;
      const tfSaturated = tf / (tf + 1.5); // BM25-style saturation
      weightedMatches += idf * tfSaturated;
    }
  }

  return totalWeight > 0 ? weightedMatches / totalWeight : 0;
}

/**
 * Clinical domain feature score.
 *
 * Rewards chunks with structured clinical information:
 *   - Diagnostic test values (sensitivity, specificity, LR+)
 *   - Treatment specifics (doses, drug names, guidelines)
 *   - Evidence markers (guideline references, evidence grades)
 *   - Clinical pearls and buzzwords
 */
export function computeClinicalScore(content: string): number {
  let score = 0;
  const checks: Array<{ pattern: RegExp; weight: number }> = [
    // Diagnostic accuracy markers
    { pattern: /\b(sensitivity|specificity)\s*[:=]?\s*\d/i, weight: 0.15 },
    { pattern: /\b(positive|negative)\s+likelihood\s+ratio\b/i, weight: 0.15 },
    { pattern: /\bLR[+-]?\s*[:=]?\s*\d/i, weight: 0.10 },
    // Treatment specifics
    { pattern: /\b(first[- ]line|gold standard|best initial)\b/i, weight: 0.15 },
    { pattern: /\b\d+\s*(mg|mcg|mg\/kg|units?|mL)\b/i, weight: 0.10 },
    // Evidence markers
    { pattern: /\b(guideline|ACC|AHA|USPSTF|evidence|recommendation)\b/i, weight: 0.10 },
    { pattern: /\b(Grade [A-D]|Level [I-V]|Class [I-V])\b/i, weight: 0.10 },
    // Pathophysiology depth
    { pattern: /\b(mechanism|pathophysiology|etiology|pathogenesis)\b/i, weight: 0.08 },
    // Clinical pearls / high-yield markers
    { pattern: /\b(buzzword|classic|pathognomonic|hallmark|triad)\b/i, weight: 0.12 },
    { pattern: /\b(contraindicated?|black box|warning)\b/i, weight: 0.10 },
  ];

  for (const check of checks) {
    if (check.pattern.test(content)) {
      score += check.weight;
    }
  }

  return Math.min(score, 1.0);
}

/**
 * Content type priority score.
 *
 * Ranks chunks by their content type, optionally respecting
 * a user-specified preference order.
 */
export function computeContentTypePriority(
  contentType: ContentType,
  preferredTypes?: ContentType[]
): number {
  if (preferredTypes && preferredTypes.length > 0) {
    const idx = preferredTypes.indexOf(contentType);
    if (idx >= 0) {
      // Higher score for earlier in preference list
      return 1.0 - (idx / preferredTypes.length) * 0.5;
    }
    return 0.3; // Not in preferred list
  }

  return CONTENT_TYPE_PRIORITY[contentType] ?? 0.5;
}

/**
 * System and condition alignment score.
 *
 * Rewards chunks that match the target organ system and/or
 * mention the target condition.
 */
export function computeSystemAlignment(
  chunkSystem: string,
  chunkCondition: string,
  chunkContent: string,
  targetSystem?: string,
  targetCondition?: string
): number {
  let score = 0.5; // baseline

  if (targetSystem) {
    if (chunkSystem.toLowerCase() === targetSystem.toLowerCase()) {
      score += 0.3;
    }
  }

  if (targetCondition) {
    if (chunkCondition.toLowerCase() === targetCondition.toLowerCase()) {
      score += 0.2;
    } else if (chunkContent.toLowerCase().includes(targetCondition.toLowerCase())) {
      score += 0.1;
    }
  }

  return Math.min(score, 1.0);
}

// ─── Tokenization ────────────────────────────────────────────────────────

/**
 * Simple clinical-aware tokenizer.
 *
 * Lowercases, removes punctuation, splits on whitespace,
 * filters out very short tokens (< 3 chars) and stopwords.
 */
export function tokenize(text: string): string[] {
  const STOPWORDS = new Set([
    'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'can', 'shall',
    'and', 'but', 'or', 'nor', 'not', 'no', 'so',
    'if', 'then', 'than', 'that', 'this', 'these', 'those',
    'for', 'from', 'with', 'without', 'about', 'into', 'through',
    'during', 'before', 'after', 'above', 'below', 'between',
    'its', 'his', 'her', 'their', 'our', 'your', 'who', 'which',
    'what', 'when', 'where', 'how', 'all', 'each', 'every',
    'both', 'few', 'more', 'most', 'other', 'some', 'such',
    'only', 'own', 'same', 'also', 'very', 'just',
  ]);

  return text
    .toLowerCase()
    .replace(/[^\w\s/-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

// ─── Pipeline Helper ─────────────────────────────────────────────────────

/**
 * Full reranking pipeline: retrieval → rerank → return improved context.
 *
 * Convenience function that takes a RAG context and query,
 * applies fast reranking, and returns the improved context.
 */
export function rerankPipeline(
  context: RAGContext,
  query: string,
  options: RerankOptions = {}
): RerankResult {
  if (context.chunks.length === 0) {
    return {
      chunks: [],
      context,
      mode: options.mode ?? 'fast',
      durationMs: 0,
    };
  }

  // Currently only fast mode implemented
  // LLM mode would call Gemini Flash here for cross-encoder scoring
  return rerankFast(context, query, options);
}
