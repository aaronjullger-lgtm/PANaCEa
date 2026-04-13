import { describe, it, expect } from 'vitest';
import {
  formatContextForPrompt,
  assessRetrievalQuality,
  refineRetrievedContext,
  type RAGContext,
  type RAGChunk,
} from '@/lib/services/ragContextService';

// ─── Test Fixtures ────────────────────────────────────────────────

function makeChunk(overrides: Partial<RAGChunk> = {}): RAGChunk {
  return {
    sourceId: 'mc-001',
    content: 'Heart failure is characterized by the inability of the heart to pump sufficient blood.',
    system: 'cardiovascular',
    condition: 'Heart Failure',
    contentType: 'pathophysiology',
    similarity: 0.75,
    ...overrides,
  };
}

function makeContext(overrides: Partial<RAGContext> = {}): RAGContext {
  const chunks = overrides.chunks ?? [makeChunk()];
  return {
    chunks,
    totalTokensEstimate: chunks.reduce((s, c) => s + c.content.length, 0) * 0.25,
    retrievalScores: chunks.map((c) => c.similarity),
    isGrounded: true,
    ...overrides,
  };
}

// ─── formatContextForPrompt ───────────────────────────────────────

describe('formatContextForPrompt', () => {
  it('returns empty string for empty context', () => {
    const ctx = makeContext({ chunks: [], retrievalScores: [] });
    expect(formatContextForPrompt(ctx)).toBe('');
  });

  it('formats single chunk with header and metadata', () => {
    const result = formatContextForPrompt(makeContext());
    expect(result).toContain('CLINICAL REFERENCE CONTEXT');
    expect(result).toContain('[Source: Heart Failure — pathophysiology]');
    expect(result).toContain('relevance: 0.75');
    expect(result).toContain('inability of the heart');
  });

  it('formats multiple chunks in similarity order', () => {
    const ctx = makeContext({
      chunks: [
        makeChunk({ similarity: 0.80, contentType: 'treatment', content: 'ACE inhibitors are first-line' }),
        makeChunk({ similarity: 0.60, contentType: 'diagnostics', content: 'BNP levels elevated' }),
      ],
      retrievalScores: [0.80, 0.60],
    });
    const result = formatContextForPrompt(ctx);
    const treatmentIdx = result.indexOf('ACE inhibitors');
    const diagIdx = result.indexOf('BNP levels');
    expect(treatmentIdx).toBeLessThan(diagIdx);
  });

  it('truncates when exceeding token budget', () => {
    const longContent = 'A'.repeat(5000);
    const ctx = makeContext({
      chunks: [
        makeChunk({ content: longContent }),
        makeChunk({ content: 'Should not appear', similarity: 0.5 }),
      ],
    });
    // With a small budget, second chunk should be omitted or truncated
    const result = formatContextForPrompt(ctx, 500);
    expect(result.length).toBeLessThan(5000);
  });
});

// ─── assessRetrievalQuality ───────────────────────────────────────

describe('assessRetrievalQuality', () => {
  it('returns "none" for empty context', () => {
    const ctx = makeContext({ chunks: [], retrievalScores: [] });
    const result = assessRetrievalQuality(ctx);
    expect(result.grade).toBe('none');
  });

  it('returns "excellent" for high similarity scores', () => {
    const ctx = makeContext({
      chunks: [makeChunk({ similarity: 0.80 }), makeChunk({ similarity: 0.70 })],
      retrievalScores: [0.80, 0.70],
    });
    expect(assessRetrievalQuality(ctx).grade).toBe('excellent');
  });

  it('returns "good" for moderate similarity', () => {
    const ctx = makeContext({
      chunks: [makeChunk({ similarity: 0.55 }), makeChunk({ similarity: 0.45 })],
      retrievalScores: [0.55, 0.45],
    });
    expect(assessRetrievalQuality(ctx).grade).toBe('good');
  });

  it('returns "fair" for borderline similarity', () => {
    const ctx = makeContext({
      chunks: [makeChunk({ similarity: 0.38 })],
      retrievalScores: [0.38],
    });
    expect(assessRetrievalQuality(ctx).grade).toBe('fair');
  });

  it('returns "poor" for very low similarity', () => {
    const ctx = makeContext({
      chunks: [makeChunk({ similarity: 0.20 })],
      retrievalScores: [0.20],
    });
    expect(assessRetrievalQuality(ctx).grade).toBe('poor');
  });
});

// ─── refineRetrievedContext (integration: rerank → CRAG) ────────

describe('refineRetrievedContext', () => {
  it('routes high-quality retrieval to CORRECT', () => {
    const ctx = makeContext({
      chunks: [
        makeChunk({ similarity: 0.80, system: 'Cardiovascular', content: 'Heart failure: sensitivity 95%, specificity 88%. ACE inhibitors per ACC/AHA guidelines. Dose: 5mg daily.' }),
        makeChunk({ similarity: 0.70, system: 'Cardiovascular', contentType: 'treatment', content: 'First-line treatment for Heart failure includes ACE inhibitors and beta-blockers per guideline recommendations.' }),
        makeChunk({ similarity: 0.65, system: 'Cardiovascular', contentType: 'diagnostics', content: 'Gold standard diagnosis: echocardiography. BNP levels > 100 pg/mL support the diagnosis of Heart failure.' }),
      ],
      retrievalScores: [0.80, 0.70, 0.65],
    });

    const result = refineRetrievedContext(
      ctx,
      'Heart failure pathophysiology and treatment',
      'Cardiovascular',
      'Heart failure',
      'generation'
    );

    expect(result.cragAction).toBe('CORRECT');
    expect(result.context.chunks.length).toBeGreaterThan(0);
    expect(result.cautionPrefix).toBeNull();
    expect(result.pipelineMetrics.rawChunks).toBe(3);
    expect(result.pipelineMetrics.afterCRAG).toBeGreaterThan(0);
  });

  it('routes low-quality retrieval to INCORRECT', () => {
    const ctx = makeContext({
      chunks: [
        makeChunk({ similarity: 0.20, system: 'Dermatology', condition: 'Psoriasis', content: 'Psoriasis is a chronic skin condition.' }),
        makeChunk({ similarity: 0.15, system: 'Psychiatry', condition: 'Depression', content: 'Depression affects mood and behavior.' }),
      ],
      retrievalScores: [0.20, 0.15],
    });

    const result = refineRetrievedContext(
      ctx,
      'Heart failure treatment',
      'Cardiovascular',
      'Heart failure',
      'generation'
    );

    expect(result.cragAction).toBe('INCORRECT');
    expect(result.contentGap).not.toBeNull();
    expect(result.contentGap!.system).toBe('Cardiovascular');
  });

  it('returns pipeline metrics with timing', () => {
    const ctx = makeContext({
      chunks: [makeChunk({ similarity: 0.60 })],
      retrievalScores: [0.60],
    });

    const result = refineRetrievedContext(ctx, 'test query');
    expect(result.pipelineMetrics.rawChunks).toBe(1);
    expect(result.pipelineMetrics.rerankDurationMs).toBeGreaterThanOrEqual(0);
    expect(result.pipelineMetrics.retrievalConfidence).toBeGreaterThanOrEqual(0);
    expect(result.pipelineMetrics.retrievalConfidence).toBeLessThanOrEqual(1);
  });

  it('handles empty context gracefully', () => {
    const ctx = makeContext({ chunks: [], retrievalScores: [] });
    const result = refineRetrievedContext(ctx, 'query', 'Cardio', 'HF', 'generation');

    expect(result.cragAction).toBe('INCORRECT');
    expect(result.context.chunks).toHaveLength(0);
    expect(result.pipelineMetrics.rawChunks).toBe(0);
  });
});
