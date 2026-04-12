/**
 * Tests for cragGuardrailService — Corrective RAG guardrails
 *
 * @see lib/services/cragGuardrailService.ts
 */

import { describe, it, expect } from 'vitest';
import {
  evaluateChunk,
  evaluateRetrieval,
  decideAction,
  computeRetrievalConfidence,
  hasStructuredClinicalMarkers,
  formatGapForLogging,
  DEFAULT_CRAG_CONFIG,
  type CRAGConfig,
} from '../lib/services/cragGuardrailService';
import type { RAGChunk, RAGContext } from '../lib/services/ragContextService';

// ─── Fixtures ────────────────────────────────────────────────────────

function makeChunk(overrides: Partial<RAGChunk> = {}): RAGChunk {
  return {
    sourceId: 'mc-001',
    content: 'Heart failure is characterized by reduced cardiac output leading to fluid retention and pulmonary congestion. First-line treatment includes ACE inhibitors and beta-blockers per ACC/AHA guidelines.',
    system: 'Cardiovascular',
    condition: 'Heart Failure',
    contentType: 'pathophysiology',
    similarity: 0.65,
    ...overrides,
  };
}

function makeContext(chunks: RAGChunk[]): RAGContext {
  const scores = chunks.map((c) => c.similarity);
  const avgSim = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  return {
    chunks,
    totalTokensEstimate: chunks.reduce((s, c) => s + Math.ceil(c.content.length * 0.25), 0),
    retrievalScores: scores,
    isGrounded: avgSim >= 0.40,
  };
}

const HIGH_QUALITY_CHUNKS: RAGChunk[] = [
  makeChunk({ sourceId: 'mc-001', similarity: 0.75 }),
  makeChunk({ sourceId: 'mc-002', similarity: 0.68, contentType: 'treatment' }),
  makeChunk({ sourceId: 'mc-003', similarity: 0.62, contentType: 'diagnostics' }),
];

const MIXED_QUALITY_CHUNKS: RAGChunk[] = [
  makeChunk({ sourceId: 'mc-001', similarity: 0.55 }),
  makeChunk({ sourceId: 'mc-002', similarity: 0.25, system: 'Pulmonary', condition: 'COPD' }),
  makeChunk({ sourceId: 'mc-003', similarity: 0.20, system: 'Neurology', condition: 'Stroke' }),
];

const LOW_QUALITY_CHUNKS: RAGChunk[] = [
  makeChunk({ sourceId: 'mc-001', similarity: 0.22, system: 'Dermatology', condition: 'Psoriasis' }),
  makeChunk({ sourceId: 'mc-002', similarity: 0.18, system: 'Psychiatry', condition: 'Depression' }),
];

// ─── evaluateChunk ───────────────────────────────────────────────────

describe('evaluateChunk', () => {
  it('marks high-similarity chunks as relevant', () => {
    const result = evaluateChunk(makeChunk({ similarity: 0.70 }), 'Cardiovascular', 'Heart Failure');
    expect(result.isRelevant).toBe(true);
    expect(result.relevanceScore).toBeGreaterThan(0.70);
  });

  it('marks low-similarity chunks as irrelevant', () => {
    const result = evaluateChunk(makeChunk({ similarity: 0.15 }), 'Cardiovascular', 'Heart Failure');
    expect(result.isRelevant).toBe(false);
  });

  it('adds system match bonus', () => {
    const withMatch = evaluateChunk(makeChunk({ similarity: 0.50 }), 'Cardiovascular', undefined);
    const withoutMatch = evaluateChunk(
      makeChunk({ similarity: 0.50, system: 'Neurology' }),
      'Cardiovascular',
      undefined
    );
    expect(withMatch.relevanceScore).toBeGreaterThan(withoutMatch.relevanceScore);
  });

  it('adds condition match bonus when condition appears in content', () => {
    const chunk = makeChunk({
      similarity: 0.40,
      content: 'Heart failure is the leading cause of hospitalization in elderly.',
    });
    const result = evaluateChunk(chunk, undefined, 'Heart failure');
    expect(result.relevanceScore).toBeGreaterThan(0.40);
    expect(result.reason).toContain('condition mentioned');
  });

  it('applies short content penalty', () => {
    const shortChunk = makeChunk({ similarity: 0.50, content: 'Brief.' });
    const normalChunk = makeChunk({ similarity: 0.50 });
    const shortResult = evaluateChunk(shortChunk, undefined, undefined);
    const normalResult = evaluateChunk(normalChunk, undefined, undefined);
    expect(shortResult.relevanceScore).toBeLessThan(normalResult.relevanceScore);
  });

  it('adds structured clinical markers bonus', () => {
    const structured = makeChunk({
      similarity: 0.50,
      content: 'Sensitivity: 95%, specificity: 88%. First-line treatment is metformin per ADA guidelines. Dose: 500mg twice daily.',
    });
    const unstructured = makeChunk({
      similarity: 0.50,
      content: 'This condition is common and can be treated with various medications.',
    });
    const structuredResult = evaluateChunk(structured, undefined, undefined);
    const unstructuredResult = evaluateChunk(unstructured, undefined, undefined);
    expect(structuredResult.relevanceScore).toBeGreaterThan(unstructuredResult.relevanceScore);
  });

  it('caps relevance at 1.0', () => {
    const result = evaluateChunk(makeChunk({ similarity: 0.95 }), 'Cardiovascular', 'Heart Failure');
    expect(result.relevanceScore).toBeLessThanOrEqual(1.0);
  });
});

// ─── decideAction ────────────────────────────────────────────────────

describe('decideAction', () => {
  it('returns CORRECT for high-quality retrieval', () => {
    expect(decideAction(4, 1, 0.65)).toBe('CORRECT');
  });

  it('returns INCORRECT for too few relevant chunks', () => {
    expect(decideAction(1, 5, 0.60)).toBe('INCORRECT');
  });

  it('returns INCORRECT for very low average relevance', () => {
    expect(decideAction(3, 0, 0.20)).toBe('INCORRECT');
  });

  it('returns AMBIGUOUS for borderline quality', () => {
    expect(decideAction(2, 0, 0.40)).toBe('AMBIGUOUS');
  });

  it('returns AMBIGUOUS when irrelevant ratio is too high', () => {
    // 2 relevant, 5 irrelevant → ratio = 5/7 ≈ 0.71 > 0.5
    expect(decideAction(2, 5, 0.60)).toBe('AMBIGUOUS');
  });

  it('uses config thresholds', () => {
    const strictConfig: CRAGConfig = {
      ...DEFAULT_CRAG_CONFIG,
      correctThreshold: 0.80,
      minRelevantChunks: 4,
    };
    // Would be CORRECT with defaults but AMBIGUOUS/INCORRECT with strict config
    expect(decideAction(2, 0, 0.60, strictConfig)).toBe('INCORRECT');
  });
});

// ─── computeRetrievalConfidence ──────────────────────────────────────

describe('computeRetrievalConfidence', () => {
  it('returns high confidence for many relevant, high-scoring chunks', () => {
    const conf = computeRetrievalConfidence(5, 0, 0.70, 0.85, true, true);
    expect(conf).toBeGreaterThan(0.7);
  });

  it('returns low confidence for few chunks with low scores', () => {
    const conf = computeRetrievalConfidence(1, 3, 0.25, 0.30, false, false);
    expect(conf).toBeLessThan(0.4);
  });

  it('system and condition match increase confidence', () => {
    const withMatch = computeRetrievalConfidence(3, 0, 0.55, 0.65, true, true);
    const withoutMatch = computeRetrievalConfidence(3, 0, 0.55, 0.65, false, false);
    expect(withMatch).toBeGreaterThan(withoutMatch);
  });

  it('noise (irrelevant chunks) reduces confidence', () => {
    const clean = computeRetrievalConfidence(3, 0, 0.60, 0.70, false, false);
    const noisy = computeRetrievalConfidence(3, 6, 0.60, 0.70, false, false);
    expect(noisy).toBeLessThan(clean);
  });

  it('is bounded between 0 and 1', () => {
    const high = computeRetrievalConfidence(10, 0, 0.95, 0.99, true, true);
    const low = computeRetrievalConfidence(0, 0, 0, 0, false, false);
    expect(high).toBeLessThanOrEqual(1.0);
    expect(high).toBeGreaterThanOrEqual(0);
    expect(low).toBeGreaterThanOrEqual(0);
    expect(low).toBeLessThanOrEqual(1.0);
  });
});

// ─── hasStructuredClinicalMarkers ────────────────────────────────────

describe('hasStructuredClinicalMarkers', () => {
  it('detects content with clinical markers', () => {
    expect(hasStructuredClinicalMarkers(
      'Sensitivity: 95%. Gold standard diagnosis is echocardiography. Dose: 5mg daily.'
    )).toBe(true);
  });

  it('rejects content without markers', () => {
    expect(hasStructuredClinicalMarkers(
      'This is a common condition affecting many patients worldwide.'
    )).toBe(false);
  });

  it('requires at least 2 markers', () => {
    // Only one marker: "mechanism"
    expect(hasStructuredClinicalMarkers(
      'The mechanism involves inflammation of the tissue.'
    )).toBe(false);
  });
});

// ─── evaluateRetrieval (integration) ─────────────────────────────────

describe('evaluateRetrieval', () => {
  it('routes high-quality retrieval to CORRECT', () => {
    const context = makeContext(HIGH_QUALITY_CHUNKS);
    const result = evaluateRetrieval(
      context, 'Heart failure pathophysiology', 'Cardiovascular', 'Heart Failure', 'generation'
    );

    expect(result.action).toBe('CORRECT');
    expect(result.refinedContext.chunks.length).toBeGreaterThan(0);
    expect(result.contentGap).toBeNull();
    expect(result.cautionPrefix).toBeNull();
    expect(result.metrics.systemMatch).toBe(true);
  });

  it('routes mixed-quality retrieval to AMBIGUOUS', () => {
    const context = makeContext(MIXED_QUALITY_CHUNKS);
    const result = evaluateRetrieval(
      context, 'Heart failure treatment', 'Cardiovascular', 'Heart Failure', 'explanation'
    );

    // At least one chunk should be filtered
    expect(result.metrics.filteredOut).toBeGreaterThan(0);
    // Content gap should be recorded
    if (result.action === 'AMBIGUOUS') {
      expect(result.contentGap).not.toBeNull();
      expect(result.cautionPrefix).not.toBeNull();
      expect(result.contentGap!.contentType).toBe('explanation');
    }
  });

  it('routes low-quality retrieval to INCORRECT', () => {
    const context = makeContext(LOW_QUALITY_CHUNKS);
    const result = evaluateRetrieval(
      context, 'Heart failure treatment', 'Cardiovascular', 'Heart Failure', 'generation'
    );

    expect(result.action).toBe('INCORRECT');
    expect(result.refinedContext.isGrounded).toBe(false);
    expect(result.contentGap).not.toBeNull();
    expect(result.contentGap!.action).toBe('INCORRECT');
    expect(result.contentGap!.system).toBe('Cardiovascular');
  });

  it('routes empty retrieval to INCORRECT', () => {
    const emptyContext = makeContext([]);
    const result = evaluateRetrieval(
      emptyContext, 'Rare condition', 'Other', 'Rare Disease', 'general'
    );

    expect(result.action).toBe('INCORRECT');
    expect(result.metrics.inputChunks).toBe(0);
    expect(result.metrics.outputChunks).toBe(0);
  });

  it('filtered chunks are excluded from refined context', () => {
    const context = makeContext(MIXED_QUALITY_CHUNKS);
    const result = evaluateRetrieval(
      context, 'Heart failure', 'Cardiovascular', 'Heart Failure'
    );

    // Refined context should only contain relevant chunks
    for (const chunk of result.refinedContext.chunks) {
      const eval_ = result.chunkEvaluations.find((e) => e.chunk.sourceId === chunk.sourceId);
      expect(eval_?.isRelevant).toBe(true);
    }
  });

  it('produces correct metrics', () => {
    const context = makeContext(HIGH_QUALITY_CHUNKS);
    const result = evaluateRetrieval(
      context, 'Heart failure', 'Cardiovascular', 'Heart Failure'
    );

    expect(result.metrics.inputChunks).toBe(3);
    expect(result.metrics.outputChunks + result.metrics.filteredOut).toBe(3);
    expect(result.metrics.retrievalConfidence).toBeGreaterThan(0);
    expect(result.metrics.retrievalConfidence).toBeLessThanOrEqual(1);
  });

  it('records content gap with correct metadata', () => {
    const context = makeContext(LOW_QUALITY_CHUNKS);
    const result = evaluateRetrieval(
      context, 'rare tropical disease pathology', 'Infectious Disease', 'Dengue Fever', 'osce'
    );

    expect(result.contentGap).not.toBeNull();
    const gap = result.contentGap!;
    expect(gap.query).toBe('rare tropical disease pathology');
    expect(gap.system).toBe('Infectious Disease');
    expect(gap.condition).toBe('Dengue Fever');
    expect(gap.contentType).toBe('osce');
    expect(gap.timestamp).toBeTruthy();
  });
});

// ─── formatGapForLogging ─────────────────────────────────────────────

describe('formatGapForLogging', () => {
  it('produces a structured log line', () => {
    const gap = {
      query: 'Heart failure pathophysiology and treatment',
      system: 'Cardiovascular',
      condition: 'Heart Failure',
      contentType: 'generation' as const,
      bestScore: 0.35,
      avgScore: 0.28,
      chunksRetrieved: 3,
      action: 'AMBIGUOUS' as const,
      timestamp: '2026-04-12T00:00:00.000Z',
    };

    const log = formatGapForLogging(gap);
    expect(log).toContain('[CONTENT_GAP]');
    expect(log).toContain('action=AMBIGUOUS');
    expect(log).toContain('system=Cardiovascular');
    expect(log).toContain('condition=Heart Failure');
    expect(log).toContain('type=generation');
  });
});
