/**
 * Corrective RAG (CRAG) Guardrail Service
 *
 * Evaluates retrieval quality BEFORE passing context to the LLM,
 * applying corrective actions to prevent hallucinated clinical content:
 *
 *   1. EVALUATE — Score each retrieved chunk for relevance and clinical accuracy
 *   2. DECIDE — Route to one of three actions:
 *      - CORRECT: High-quality retrieval → use context directly
 *      - AMBIGUOUS: Mixed quality → strip low-relevance chunks + add caution flag
 *      - INCORRECT: Poor retrieval → reject context, flag content gap
 *   3. FILTER — Remove chunks below relevance threshold
 *   4. LOG — Record content gap signals for knowledge base improvement
 *
 * Research basis:
 *   - Yan et al. (2024): Corrective RAG (CRAG) — retrieval evaluator + knowledge refinement
 *   - Research showed naive RAG degrades performance by 2–8% without CRAG guardrails
 *   - PANaCEa pa4.md P2: "Prevents hallucinated clinical content from reaching students"
 *
 * @see lib/services/ragContextService.ts — Upstream retrieval
 * @see functions/api/questions/generate-rag.ts — Consumer of guardrail output
 * @see functions/api/questions/explain-rag.ts — Consumer of guardrail output
 * @module lib/services/cragGuardrailService
 */

import type { RAGChunk, RAGContext } from './ragContextService';

// ─── Types ───────────────────────────────────────────────────────────────

/** CRAG routing decision */
export type CRAGAction = 'CORRECT' | 'AMBIGUOUS' | 'INCORRECT';

/** Per-chunk evaluation result */
export interface ChunkEvaluation {
  /** Source chunk */
  chunk: RAGChunk;
  /** Relevance score (0-1), combining similarity + clinical alignment */
  relevanceScore: number;
  /** Whether this chunk passes the relevance threshold */
  isRelevant: boolean;
  /** Reason for relevance classification */
  reason: string;
}

/** Content gap signal for knowledge base improvement */
export interface ContentGapSignal {
  /** The query that failed to retrieve adequate content */
  query: string;
  /** Target system (organ system) */
  system: string;
  /** Target condition if known */
  condition?: string;
  /** What type of content was needed */
  contentType: 'generation' | 'explanation' | 'osce' | 'general';
  /** Best retrieval score achieved */
  bestScore: number;
  /** Average retrieval score */
  avgScore: number;
  /** Number of chunks retrieved */
  chunksRetrieved: number;
  /** Action that was taken */
  action: CRAGAction;
  /** Timestamp */
  timestamp: string;
}

/** CRAG evaluation result */
export interface CRAGResult {
  /** The routing decision */
  action: CRAGAction;
  /** Filtered/refined context (only relevant chunks) */
  refinedContext: RAGContext;
  /** Per-chunk evaluations */
  chunkEvaluations: ChunkEvaluation[];
  /** Summary metrics */
  metrics: CRAGMetrics;
  /** Content gap signal (populated when action is AMBIGUOUS or INCORRECT) */
  contentGap: ContentGapSignal | null;
  /** Safety warning to prepend to LLM prompt if action is AMBIGUOUS */
  cautionPrefix: string | null;
}

export interface CRAGMetrics {
  /** Number of input chunks */
  inputChunks: number;
  /** Number of chunks that passed filter */
  outputChunks: number;
  /** Number of chunks filtered out */
  filteredOut: number;
  /** Average relevance of retained chunks */
  avgRelevance: number;
  /** Highest chunk relevance */
  maxRelevance: number;
  /** Confidence in the retrieval quality (0-1) */
  retrievalConfidence: number;
  /** Whether the clinical system matched */
  systemMatch: boolean;
  /** Whether the condition was found in retrieved content */
  conditionMatch: boolean;
}

/** Configuration for CRAG guardrails */
export interface CRAGConfig {
  /** Minimum chunk similarity to consider relevant */
  chunkRelevanceThreshold: number;
  /** Average similarity required for CORRECT routing */
  correctThreshold: number;
  /** Average similarity below which routes to INCORRECT */
  incorrectThreshold: number;
  /** Minimum number of relevant chunks for CORRECT */
  minRelevantChunks: number;
  /** Maximum ratio of irrelevant-to-relevant chunks for CORRECT */
  maxIrrelevantRatio: number;
  /** Bonus for system match */
  systemMatchBonus: number;
  /** Bonus for condition name appearing in content */
  conditionMatchBonus: number;
}

// ─── Defaults ────────────────────────────────────────────────────────────

export const DEFAULT_CRAG_CONFIG: CRAGConfig = {
  chunkRelevanceThreshold: 0.35,
  correctThreshold: 0.50,
  incorrectThreshold: 0.30,
  minRelevantChunks: 2,
  maxIrrelevantRatio: 0.5,
  systemMatchBonus: 0.05,
  conditionMatchBonus: 0.08,
};

/** Caution prefix injected when action is AMBIGUOUS */
const AMBIGUOUS_CAUTION = `⚠️ RETRIEVAL QUALITY WARNING: The clinical context below has mixed relevance.
Some chunks may not directly apply to the target condition.
CRITICAL: Cross-reference all clinical facts. If uncertain about any detail,
state "clinical verification recommended" rather than asserting unverified facts.`;

// ─── Core Evaluation ─────────────────────────────────────────────────────

/**
 * Evaluate a single chunk for relevance.
 *
 * Combines vector similarity score with heuristic clinical alignment checks:
 *   - System match: chunk.system matches target system
 *   - Condition match: target condition appears in chunk content
 *   - Content quality: chunk has sufficient length and structure
 */
export function evaluateChunk(
  chunk: RAGChunk,
  targetSystem: string | undefined,
  targetCondition: string | undefined,
  config: CRAGConfig = DEFAULT_CRAG_CONFIG
): ChunkEvaluation {
  let score = chunk.similarity;
  const reasons: string[] = [`base similarity: ${chunk.similarity.toFixed(3)}`];

  // System match bonus
  if (targetSystem && chunk.system.toLowerCase() === targetSystem.toLowerCase()) {
    score += config.systemMatchBonus;
    reasons.push('system match');
  }

  // Condition match bonus
  if (targetCondition && chunk.content.toLowerCase().includes(targetCondition.toLowerCase())) {
    score += config.conditionMatchBonus;
    reasons.push('condition mentioned in content');
  }

  // Content quality penalty for very short chunks
  if (chunk.content.length < 50) {
    score *= 0.7;
    reasons.push('short content penalty');
  }

  // Content quality bonus for structured clinical content
  if (hasStructuredClinicalMarkers(chunk.content)) {
    score += 0.03;
    reasons.push('structured clinical markers');
  }

  const isRelevant = score >= config.chunkRelevanceThreshold;

  return {
    chunk,
    relevanceScore: Math.min(score, 1.0),
    isRelevant,
    reason: isRelevant
      ? `Relevant (${reasons.join(', ')})`
      : `Filtered: score ${score.toFixed(3)} < threshold ${config.chunkRelevanceThreshold} (${reasons.join(', ')})`,
  };
}

/**
 * Evaluate all chunks and decide CRAG routing action.
 *
 * This is the main entry point. Takes RAG context + query metadata,
 * returns a CRAGResult with the routing decision and refined context.
 */
export function evaluateRetrieval(
  context: RAGContext,
  query: string,
  targetSystem?: string,
  targetCondition?: string,
  contentType: ContentGapSignal['contentType'] = 'general',
  config: CRAGConfig = DEFAULT_CRAG_CONFIG
): CRAGResult {
  // 1. Evaluate each chunk
  const evaluations = context.chunks.map((chunk) =>
    evaluateChunk(chunk, targetSystem, targetCondition, config)
  );

  // 2. Partition into relevant and irrelevant
  const relevant = evaluations.filter((e) => e.isRelevant);
  const irrelevant = evaluations.filter((e) => !e.isRelevant);

  // 3. Compute metrics
  const relevantScores = relevant.map((e) => e.relevanceScore);
  const avgRelevance = relevantScores.length > 0
    ? relevantScores.reduce((a, b) => a + b, 0) / relevantScores.length
    : 0;
  const maxRelevance = relevantScores.length > 0
    ? Math.max(...relevantScores)
    : 0;

  const systemMatch = targetSystem
    ? relevant.some((e) => e.chunk.system.toLowerCase() === targetSystem.toLowerCase())
    : false;
  const conditionMatch = targetCondition
    ? relevant.some((e) =>
        e.chunk.content.toLowerCase().includes(targetCondition.toLowerCase())
      )
    : false;

  // 4. Compute retrieval confidence
  const retrievalConfidence = computeRetrievalConfidence(
    relevant.length,
    irrelevant.length,
    avgRelevance,
    maxRelevance,
    systemMatch,
    conditionMatch,
    config
  );

  const metrics: CRAGMetrics = {
    inputChunks: context.chunks.length,
    outputChunks: relevant.length,
    filteredOut: irrelevant.length,
    avgRelevance,
    maxRelevance,
    retrievalConfidence,
    systemMatch,
    conditionMatch,
  };

  // 5. Decide action
  const action = decideAction(relevant.length, irrelevant.length, avgRelevance, config);

  // 6. Build refined context (only relevant chunks)
  const refinedChunks = relevant.map((e) => e.chunk);
  const refinedScores = refinedChunks.map((c) => c.similarity);
  const refinedTokens = Math.ceil(
    refinedChunks.reduce((sum, c) => sum + c.content.length, 0) * 0.25
  );

  const refinedContext: RAGContext = {
    chunks: refinedChunks,
    totalTokensEstimate: refinedTokens,
    retrievalScores: refinedScores,
    isGrounded: action === 'CORRECT',
  };

  // 7. Build content gap signal for AMBIGUOUS/INCORRECT
  const contentGap: ContentGapSignal | null =
    action !== 'CORRECT'
      ? {
          query,
          system: targetSystem ?? 'unknown',
          condition: targetCondition,
          contentType,
          bestScore: maxRelevance,
          avgScore: avgRelevance,
          chunksRetrieved: context.chunks.length,
          action,
          timestamp: new Date().toISOString(),
        }
      : null;

  // 8. Build caution prefix for AMBIGUOUS
  const cautionPrefix = action === 'AMBIGUOUS' ? AMBIGUOUS_CAUTION : null;

  return {
    action,
    refinedContext,
    chunkEvaluations: evaluations,
    metrics,
    contentGap,
    cautionPrefix,
  };
}

// ─── Decision Logic ──────────────────────────────────────────────────────

/**
 * Decide the CRAG routing action based on retrieval quality metrics.
 *
 * CORRECT:   Enough relevant chunks with high average relevance
 * INCORRECT: Too few relevant chunks or very low relevance
 * AMBIGUOUS: In between — some useful content but quality is uncertain
 */
export function decideAction(
  relevantCount: number,
  irrelevantCount: number,
  avgRelevance: number,
  config: CRAGConfig = DEFAULT_CRAG_CONFIG
): CRAGAction {
  // Too few relevant chunks → INCORRECT
  if (relevantCount < config.minRelevantChunks) {
    return 'INCORRECT';
  }

  // Average relevance below floor → INCORRECT
  if (avgRelevance < config.incorrectThreshold) {
    return 'INCORRECT';
  }

  // High irrelevant ratio → AMBIGUOUS at best
  const irrelevantRatio =
    relevantCount + irrelevantCount > 0
      ? irrelevantCount / (relevantCount + irrelevantCount)
      : 0;

  if (irrelevantRatio > config.maxIrrelevantRatio) {
    return 'AMBIGUOUS';
  }

  // Average relevance meets CORRECT threshold → CORRECT
  if (avgRelevance >= config.correctThreshold) {
    return 'CORRECT';
  }

  // Default: AMBIGUOUS
  return 'AMBIGUOUS';
}

/**
 * Compute overall retrieval confidence (0-1).
 *
 * Combines:
 *   - Chunk coverage (how many relevant chunks)
 *   - Average relevance
 *   - Max relevance (do we have at least one great chunk?)
 *   - System and condition match
 */
export function computeRetrievalConfidence(
  relevantCount: number,
  irrelevantCount: number,
  avgRelevance: number,
  maxRelevance: number,
  systemMatch: boolean,
  conditionMatch: boolean,
  config: CRAGConfig = DEFAULT_CRAG_CONFIG
): number {
  // Base: average of avg and max relevance
  let confidence = (avgRelevance * 0.6 + maxRelevance * 0.4);

  // Coverage factor: diminishing returns above minRelevantChunks
  const coverageFactor = Math.min(relevantCount / config.minRelevantChunks, 1.5);
  confidence *= coverageFactor;

  // Noise penalty: many irrelevant chunks reduce confidence
  const totalChunks = relevantCount + irrelevantCount;
  if (totalChunks > 0) {
    const noiseRatio = irrelevantCount / totalChunks;
    confidence *= (1 - noiseRatio * 0.3);
  }

  // System/condition match bonuses
  if (systemMatch) confidence += 0.05;
  if (conditionMatch) confidence += 0.08;

  return Math.max(0, Math.min(1, confidence));
}

// ─── Utilities ───────────────────────────────────────────────────────────

/**
 * Check if content contains structured clinical markers that indicate
 * higher-quality clinical content.
 */
export function hasStructuredClinicalMarkers(content: string): boolean {
  const markers = [
    /\b(sensitivity|specificity)\s*[:=]\s*\d/i,
    /\b(first[- ]line|gold standard|best initial)\b/i,
    /\b(mechanism|pathophysiology|etiology)\b/i,
    /\b(guideline|evidence|recommendation)\b/i,
    /\b(dose|mg|mcg|mg\/kg)\b/i,
    /\b(contraindicated?|indication)\b/i,
  ];

  let matchCount = 0;
  for (const marker of markers) {
    if (marker.test(content)) matchCount++;
  }

  return matchCount >= 2;
}

/**
 * Format a content gap signal for logging/storage.
 */
export function formatGapForLogging(gap: ContentGapSignal): string {
  return `[CONTENT_GAP] ${gap.timestamp} | action=${gap.action} | type=${gap.contentType} | system=${gap.system} | condition=${gap.condition ?? 'unknown'} | bestScore=${gap.bestScore.toFixed(3)} | avgScore=${gap.avgScore.toFixed(3)} | chunks=${gap.chunksRetrieved} | query="${gap.query.slice(0, 100)}"`;
}
