/**
 * RAG Context Service
 *
 * Retrieves relevant clinical content from the MedicalContent knowledge base
 * to ground AI question generation and explanations in evidence-based guidelines.
 *
 * Uses pgvector HNSW index + Gemini text-embedding-005 for semantic retrieval.
 *
 * Research basis:
 * - MedRAG (Xiong et al., ACL 2024): Hybrid retrieval outperforms single-corpus
 * - Self-MedRAG (Ryan et al., 2026): Self-reflective generation with RRF
 * - Mayo Clinic study: Adaptive chunking achieves 87% vs 50% baseline
 *
 * @module lib/services/ragContextService
 */

// ─── Types ────────────────────────────────────────────────────────

import { getEmbedding } from '../gemini';
import { formatMemorySafetyFlags, sanitizeRetrievedContextText } from './memory/contextSanitizer';

export type ContentType =
  | 'pathophysiology'
  | 'treatment'
  | 'diagnostics'
  | 'clinical_pearls'
  | 'overview'
  | 'symptoms';

export interface RAGChunk {
  sourceId: string;
  content: string;
  system: string;
  condition: string;
  contentType: ContentType;
  similarity: number;
}

export interface RAGContext {
  chunks: RAGChunk[];
  totalTokensEstimate: number;
  retrievalScores: number[];
  isGrounded: boolean;
}

export interface RetrieveOptions {
  system?: string;
  limit?: number;
  minSimilarity?: number;
  preferredTypes?: ContentType[];
}

// ─── Constants ────────────────────────────────────────────────────

const DEFAULT_LIMIT = 5;
const DEFAULT_MIN_SIMILARITY = 0.3;
const GROUNDING_THRESHOLD = 0.4;
const TOKENS_PER_CHAR = 0.25;
const DEFAULT_MAX_CONTEXT_TOKENS = 3000;

// ─── Embedding ────────────────────────────────────────────────────

export async function embedQuery(query: string, apiKey: string): Promise<number[]> {
  return getEmbedding(query, apiKey);
}

// ─── Retrieval ────────────────────────────────────────────────────

interface ContentRow {
  medicalContentId: string;
  similarity: number;
}

interface ContentRecord {
  id: string;
  condition: string | null;
  system: string | null;
  overview: string | null;
  symptoms: string | null;
  pathophysiology: string | null;
  treatment: string | null;
  diagnostics: string | null;
  clinical_pearls: string | null;
  buzzwords: string | null;
  gold_standard_dx: string | null;
  first_line_rx: string | null;
  best_initial_test: string | null;
}

/**
 * Retrieve relevant clinical content chunks from MedicalContent via pgvector.
 */
export async function retrieveContext(
  query: string,
  options: RetrieveOptions,
  prisma: any,
  apiKey: string
): Promise<RAGContext> {
  const { limit = DEFAULT_LIMIT, minSimilarity = DEFAULT_MIN_SIMILARITY, system } = options;

  const embedding = await embedQuery(query, apiKey);
  const vectorStr = `[${embedding.join(',')}]`;

  const queryRawUnsafe = prisma.$queryRawUnsafe as <T = unknown>(
    query: string,
    ...values: unknown[]
  ) => Promise<T>;
  const rows: ContentRow[] = await queryRawUnsafe<ContentRow[]>(
    `SELECT e."medicalContentId", (1 - (e.embedding <=> $1::vector))::float as similarity
     FROM "MedicalContentEmbedding" e
     ORDER BY e.embedding <=> $1::vector
     LIMIT $2`,
    vectorStr,
    limit * 2
  );

  const filteredRows = rows.filter((r) => r.similarity >= minSimilarity);

  if (filteredRows.length === 0) {
    return { chunks: [], totalTokensEstimate: 0, retrievalScores: [], isGrounded: false };
  }

  const ids = filteredRows.map((r) => r.medicalContentId);
  const scoreMap = new Map(filteredRows.map((r) => [r.medicalContentId, r.similarity]));

  const records: ContentRecord[] = await prisma.medicalContent.findMany({
    where: { id: { in: ids }, ...(system ? { system } : {}) },
    select: {
      id: true,
      condition: true,
      system: true,
      overview: true,
      symptoms: true,
      pathophysiology: true,
      treatment: true,
      diagnostics: true,
      clinical_pearls: true,
      buzzwords: true,
      gold_standard_dx: true,
      first_line_rx: true,
      best_initial_test: true,
    },
  });

  const chunks: RAGChunk[] = [];
  const contentFields: Array<{ key: keyof ContentRecord; type: ContentType }> = [
    { key: 'pathophysiology', type: 'pathophysiology' },
    { key: 'treatment', type: 'treatment' },
    { key: 'diagnostics', type: 'diagnostics' },
    { key: 'clinical_pearls', type: 'clinical_pearls' },
    { key: 'overview', type: 'overview' },
    { key: 'symptoms', type: 'symptoms' },
  ];

  for (const record of records) {
    const sim = scoreMap.get(record.id) ?? 0;
    for (const field of contentFields) {
      const text = record[field.key];
      if (typeof text === 'string' && text.trim().length > 20) {
        chunks.push({
          sourceId: record.id,
          content: text.trim(),
          system: record.system ?? 'unknown',
          condition: record.condition ?? 'unknown',
          contentType: field.type,
          similarity: sim,
        });
      }
    }

    // High-yield anchors combined chunk
    const anchors = [
      record.buzzwords ? `Buzzwords: ${record.buzzwords}` : '',
      record.gold_standard_dx ? `Gold Standard Dx: ${record.gold_standard_dx}` : '',
      record.first_line_rx ? `First-Line Rx: ${record.first_line_rx}` : '',
      record.best_initial_test ? `Best Initial Test: ${record.best_initial_test}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    if (anchors.length > 20) {
      chunks.push({
        sourceId: record.id,
        content: anchors,
        system: record.system ?? 'unknown',
        condition: record.condition ?? 'unknown',
        contentType: 'clinical_pearls',
        similarity: sim,
      });
    }
  }

  chunks.sort((a, b) => b.similarity - a.similarity);
  const topChunks = chunks.slice(0, limit * 3);
  const scores = topChunks.map((c) => c.similarity);
  const avgSim = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const totalChars = topChunks.reduce((sum, c) => sum + c.content.length, 0);

  return {
    chunks: topChunks,
    totalTokensEstimate: Math.ceil(totalChars * TOKENS_PER_CHAR),
    retrievalScores: scores,
    isGrounded: avgSim >= GROUNDING_THRESHOLD,
  };
}

// ─── Formatting ───────────────────────────────────────────────────

export function formatContextForPrompt(
  context: RAGContext,
  maxTokens: number = DEFAULT_MAX_CONTEXT_TOKENS
): string {
  if (context.chunks.length === 0) return '';

  const header =
    'CLINICAL REFERENCE CONTEXT (retrieved from evidence-based guidelines — use ONLY this context for clinical accuracy):\n\n';
  const maxChars = Math.floor(maxTokens / TOKENS_PER_CHAR);
  let result = header;
  let currentChars = header.length;

  for (const chunk of context.chunks) {
    const sanitized = sanitizeRetrievedContextText(chunk.content);
    const safetyFlags = formatMemorySafetyFlags(sanitized.flags);
    const sourceLine = `[Source: ${chunk.condition} — ${chunk.contentType}] (relevance: ${chunk.similarity.toFixed(2)})`;
    const block = `${sourceLine}\n${safetyFlags ? `${safetyFlags}\n` : ''}${sanitized.text}\n---\n\n`;
    if (currentChars + block.length > maxChars) {
      const remaining = maxChars - currentChars - 50;
      if (remaining > 100) {
        result += `${sourceLine}\n${safetyFlags ? `${safetyFlags}\n` : ''}${sanitized.text.slice(0, remaining)}...\n---\n\n`;
      }
      break;
    }
    result += block;
    currentChars += block.length;
  }

  return result;
}

// ─── Refined Pipeline (Retrieve → Rerank → CRAG) ────────────────

import { rerankPipeline } from './rerankService';
import { evaluateRetrieval, formatGapForLogging } from './cragGuardrailService';
import type { CRAGResult, ContentGapSignal } from './cragGuardrailService';
import type { RerankResult, RerankOptions } from './rerankService';
import { logger } from '../logger';

const LOG_SCOPE = 'RAGContext';

export interface RefinedRAGResult {
  /** Final context to use for generation (post-CRAG filtering) */
  context: RAGContext;
  /** CRAG routing decision */
  cragAction: 'CORRECT' | 'AMBIGUOUS' | 'INCORRECT';
  /** Caution prefix to prepend to LLM prompt (null if CORRECT) */
  cautionPrefix: string | null;
  /** Content gap signal for knowledge base improvement */
  contentGap: ContentGapSignal | null;
  /** Pipeline metrics */
  pipelineMetrics: {
    rawChunks: number;
    afterRerank: number;
    afterCRAG: number;
    rerankDurationMs: number;
    retrievalConfidence: number;
    cragAction: string;
  };
}

/**
 * Full RAG refinement pipeline: Retrieve → Rerank → CRAG Evaluate.
 *
 * This is the recommended entry point for all RAG consumers.
 * It applies cross-encoder reranking to improve chunk ordering,
 * then CRAG guardrails to filter irrelevant chunks and route
 * the context to the appropriate action.
 *
 * @param rawContext - Raw retrieval output from retrieveContext()
 * @param query - Original user/generation query
 * @param targetSystem - Target organ system (for alignment scoring)
 * @param targetCondition - Target condition (for alignment scoring)
 * @param contentType - What the context will be used for
 * @param rerankOptions - Optional rerank configuration overrides
 */
export function refineRetrievedContext(
  rawContext: RAGContext,
  query: string,
  targetSystem?: string,
  targetCondition?: string,
  contentType: 'generation' | 'explanation' | 'osce' | 'general' = 'general',
  rerankOptions?: RerankOptions
): RefinedRAGResult {
  // Step 1: Rerank chunks
  const rerankResult: RerankResult = rerankPipeline(rawContext, query, {
    targetSystem,
    targetCondition,
    ...rerankOptions,
  });

  // Step 2: CRAG evaluate the reranked context
  const cragResult: CRAGResult = evaluateRetrieval(
    rerankResult.context,
    query,
    targetSystem,
    targetCondition,
    contentType
  );

  // Step 3: Log content gaps for knowledge base improvement
  if (cragResult.contentGap) {
    logger.warn('RAG content gap', {
      scope: LOG_SCOPE,
      gap: formatGapForLogging(cragResult.contentGap),
    });
  }

  return {
    context: cragResult.refinedContext,
    cragAction: cragResult.action,
    cautionPrefix: cragResult.cautionPrefix,
    contentGap: cragResult.contentGap,
    pipelineMetrics: {
      rawChunks: rawContext.chunks.length,
      afterRerank: rerankResult.context.chunks.length,
      afterCRAG: cragResult.refinedContext.chunks.length,
      rerankDurationMs: rerankResult.durationMs,
      retrievalConfidence: cragResult.metrics.retrievalConfidence,
      cragAction: cragResult.action,
    },
  };
}

// ─── Convenience Wrappers ─────────────────────────────────────────

export async function retrieveForQuestionGeneration(
  conditionName: string,
  system: string,
  prisma: any,
  apiKey: string
): Promise<RAGContext> {
  const query = `${conditionName} ${system} clinical presentation diagnosis treatment pathophysiology`;
  return retrieveContext(query, { system, limit: 5, minSimilarity: 0.25 }, prisma, apiKey);
}

export async function retrieveForExplanation(
  questionText: string,
  wrongAnswer: string,
  correctAnswer: string,
  system: string,
  prisma: any,
  apiKey: string
): Promise<RAGContext> {
  const query = `${questionText} Why is ${correctAnswer} correct and not ${wrongAnswer}? ${system}`;
  return retrieveContext(query, { system, limit: 5, minSimilarity: 0.25 }, prisma, apiKey);
}

export function assessRetrievalQuality(context: RAGContext): {
  grade: 'excellent' | 'good' | 'fair' | 'poor' | 'none';
  message: string;
} {
  if (context.chunks.length === 0) {
    return { grade: 'none', message: 'No relevant clinical content found. Content gap detected.' };
  }
  const avgSim =
    context.retrievalScores.reduce((a, b) => a + b, 0) / context.retrievalScores.length;
  const topSim = context.retrievalScores[0] ?? 0;

  if (topSim >= 0.7 && avgSim >= 0.5)
    return { grade: 'excellent', message: 'Strong clinical grounding.' };
  if (topSim >= 0.5 && avgSim >= 0.4)
    return { grade: 'good', message: 'Adequate clinical context.' };
  if (topSim >= 0.35)
    return { grade: 'fair', message: 'Partial context. May need additional review.' };
  return { grade: 'poor', message: 'Low relevance retrieval. Flag for expert review.' };
}
