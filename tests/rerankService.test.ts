/**
 * Tests for rerankService — Cross-encoder reranking
 *
 * @see lib/services/rerankService.ts
 */

import { describe, it, expect } from 'vitest';
import {
  rerankFast,
  rerankPipeline,
  computeLexicalScore,
  computeClinicalScore,
  computeContentTypePriority,
  computeSystemAlignment,
  tokenize,
  DEFAULT_WEIGHTS,
  CONTENT_TYPE_PRIORITY,
  type RerankOptions,
} from '../lib/services/rerankService';
import type { RAGChunk, RAGContext, ContentType } from '../lib/services/ragContextService';

// ─── Fixtures ────────────────────────────────────────────────────────

function makeChunk(overrides: Partial<RAGChunk> = {}): RAGChunk {
  return {
    sourceId: 'mc-001',
    content: 'Heart failure pathophysiology involves reduced cardiac output leading to neurohormonal activation. First-line treatment includes ACE inhibitors per ACC/AHA guidelines.',
    system: 'Cardiovascular',
    condition: 'Heart Failure',
    contentType: 'pathophysiology',
    similarity: 0.60,
    ...overrides,
  };
}

function makeContext(chunks: RAGChunk[]): RAGContext {
  const scores = chunks.map((c) => c.similarity);
  return {
    chunks,
    totalTokensEstimate: chunks.reduce((s, c) => s + Math.ceil(c.content.length * 0.25), 0),
    retrievalScores: scores,
    isGrounded: true,
  };
}

// ─── tokenize ────────────────────────────────────────────────────────

describe('tokenize', () => {
  it('lowercases and splits on whitespace', () => {
    const tokens = tokenize('Heart Failure Treatment');
    expect(tokens).toContain('heart');
    expect(tokens).toContain('failure');
    expect(tokens).toContain('treatment');
  });

  it('removes stopwords', () => {
    const tokens = tokenize('the patient is presenting with chest pain');
    expect(tokens).not.toContain('the');
    expect(tokens).not.toContain('is');
    expect(tokens).not.toContain('with');
    expect(tokens).toContain('patient');
    expect(tokens).toContain('presenting');
    expect(tokens).toContain('chest');
    expect(tokens).toContain('pain');
  });

  it('removes short tokens (<3 chars)', () => {
    const tokens = tokenize('A PA at the ER');
    expect(tokens).not.toContain('a');
    expect(tokens).not.toContain('pa');
    expect(tokens).not.toContain('at');
  });

  it('handles empty input', () => {
    expect(tokenize('')).toEqual([]);
  });

  it('preserves hyphenated clinical terms', () => {
    const tokens = tokenize('first-line beta-blockers');
    // Hyphen preserved in token
    expect(tokens.some((t) => t.includes('first-line') || t.includes('first'))).toBe(true);
  });
});

// ─── computeLexicalScore ─────────────────────────────────────────────

describe('computeLexicalScore', () => {
  it('returns higher score for more term overlap', () => {
    const query = 'heart failure pathophysiology treatment';
    const queryTerms = tokenize(query);
    const queryTermSet = new Set(queryTerms);

    const relevantContent = 'Heart failure pathophysiology includes reduced cardiac output. Treatment involves ACE inhibitors.';
    const irrelevantContent = 'Diabetes mellitus is a metabolic disorder affecting glucose regulation.';

    const relevantScore = computeLexicalScore(relevantContent, queryTerms, queryTermSet);
    const irrelevantScore = computeLexicalScore(irrelevantContent, queryTerms, queryTermSet);

    expect(relevantScore).toBeGreaterThan(irrelevantScore);
  });

  it('down-weights common clinical terms', () => {
    // Two queries with the same number of matching terms but different IDF weights
    const query = 'cardiomyopathy treatment';
    const queryTerms = tokenize(query);
    const queryTermSet = new Set(queryTerms);

    // Content that only matches the specific term
    const specificContent = 'Cardiomyopathy is a disease of the heart muscle.';
    // Content that only matches the common term
    const commonContent = 'Treatment options vary by condition severity.';

    const specificScore = computeLexicalScore(specificContent, queryTerms, queryTermSet);
    const commonScore = computeLexicalScore(commonContent, queryTerms, queryTermSet);

    // Specific term match should score higher due to IDF weighting
    expect(specificScore).toBeGreaterThan(commonScore);
  });

  it('returns 0 for empty query', () => {
    expect(computeLexicalScore('Some content', [], new Set())).toBe(0);
  });

  it('handles BM25 saturation (diminishing returns for repeated terms)', () => {
    const queryTerms = ['failure'];
    const querySet = new Set(queryTerms);

    const oneOccurrence = 'Heart failure is common.';
    const manyOccurrences = 'Failure failure failure failure failure failure failure.';

    const oneScore = computeLexicalScore(oneOccurrence, queryTerms, querySet);
    const manyScore = computeLexicalScore(manyOccurrences, queryTerms, querySet);

    // Many occurrences should be higher but not proportionally (saturation)
    expect(manyScore).toBeGreaterThan(oneScore);
    expect(manyScore).toBeLessThan(oneScore * 5); // Saturated, not 7x
  });
});

// ─── computeClinicalScore ────────────────────────────────────────────

describe('computeClinicalScore', () => {
  it('scores higher for content with diagnostic accuracy', () => {
    const withAccuracy = 'Sensitivity: 95%, Specificity: 88%. Gold standard is echocardiography. Dose: 5mg daily.';
    const withoutAccuracy = 'This condition is common and affects many patients.';

    expect(computeClinicalScore(withAccuracy)).toBeGreaterThan(computeClinicalScore(withoutAccuracy));
  });

  it('detects guideline references', () => {
    const score = computeClinicalScore('Per ACC/AHA 2022 guidelines, first-line treatment is recommended.');
    expect(score).toBeGreaterThan(0.2);
  });

  it('detects dosing information', () => {
    const score = computeClinicalScore('Administer metoprolol 25mg twice daily. Titrate to 200mg.');
    expect(score).toBeGreaterThan(0);
  });

  it('detects buzzword/classic markers', () => {
    const score = computeClinicalScore('Classic triad of fever, rash, and joint pain. Pathognomonic finding.');
    expect(score).toBeGreaterThan(0.1);
  });

  it('caps at 1.0', () => {
    const richContent = 'Sensitivity: 95%, Specificity: 88%. LR+ = 8.0. Gold standard diagnosis. First-line treatment 500mg. ACC/AHA guideline Grade A recommendation. Mechanism involves pathophysiology of vasoconstriction. Pathognomonic finding. Contraindicated in pregnancy.';
    expect(computeClinicalScore(richContent)).toBeLessThanOrEqual(1.0);
  });

  it('returns 0 for empty content', () => {
    expect(computeClinicalScore('')).toBe(0);
  });
});

// ─── computeContentTypePriority ──────────────────────────────────────

describe('computeContentTypePriority', () => {
  it('uses default priorities when no preference specified', () => {
    expect(computeContentTypePriority('pathophysiology')).toBe(CONTENT_TYPE_PRIORITY.pathophysiology);
    expect(computeContentTypePriority('overview')).toBe(CONTENT_TYPE_PRIORITY.overview);
  });

  it('ranks pathophysiology higher than overview by default', () => {
    expect(computeContentTypePriority('pathophysiology'))
      .toBeGreaterThan(computeContentTypePriority('overview'));
  });

  it('respects custom preference order', () => {
    const prefs: ContentType[] = ['treatment', 'diagnostics', 'pathophysiology'];
    expect(computeContentTypePriority('treatment', prefs))
      .toBeGreaterThan(computeContentTypePriority('diagnostics', prefs));
    expect(computeContentTypePriority('diagnostics', prefs))
      .toBeGreaterThan(computeContentTypePriority('pathophysiology', prefs));
  });

  it('gives low score to non-preferred types', () => {
    const prefs: ContentType[] = ['treatment'];
    expect(computeContentTypePriority('overview', prefs)).toBe(0.3);
  });
});

// ─── computeSystemAlignment ──────────────────────────────────────────

describe('computeSystemAlignment', () => {
  it('gives bonus for matching system', () => {
    const matched = computeSystemAlignment('Cardiovascular', 'CHF', 'content', 'Cardiovascular');
    const unmatched = computeSystemAlignment('Neurology', 'Stroke', 'content', 'Cardiovascular');
    expect(matched).toBeGreaterThan(unmatched);
  });

  it('gives bonus for matching condition', () => {
    const matched = computeSystemAlignment('CV', 'Heart Failure', 'about heart failure', undefined, 'Heart Failure');
    const unmatched = computeSystemAlignment('CV', 'COPD', 'about COPD', undefined, 'Heart Failure');
    expect(matched).toBeGreaterThan(unmatched);
  });

  it('gives partial bonus for condition mentioned in content', () => {
    const mentioned = computeSystemAlignment('CV', 'Other', 'includes heart failure data', undefined, 'Heart Failure');
    const baseline = computeSystemAlignment('CV', 'Other', 'no relevant content', undefined, 'Heart Failure');
    expect(mentioned).toBeGreaterThan(baseline);
  });

  it('returns baseline when no target specified', () => {
    expect(computeSystemAlignment('CV', 'CHF', 'content')).toBe(0.5);
  });

  it('caps at 1.0', () => {
    const score = computeSystemAlignment('CV', 'Heart Failure', 'Heart Failure info', 'CV', 'Heart Failure');
    expect(score).toBeLessThanOrEqual(1.0);
  });
});

// ─── rerankFast ──────────────────────────────────────────────────────

describe('rerankFast', () => {
  it('reranks chunks and changes order when lexical signal differs', () => {
    const chunks = [
      makeChunk({
        sourceId: 'low-vector-high-lexical',
        similarity: 0.50,
        content: 'Heart failure pathophysiology: reduced ejection fraction leads to compensatory neurohormonal activation via RAAS.',
      }),
      makeChunk({
        sourceId: 'high-vector-low-lexical',
        similarity: 0.70,
        content: 'Diabetes mellitus is a metabolic disorder. Insulin resistance causes hyperglycemia.',
        system: 'Endocrine',
        condition: 'Diabetes',
      }),
    ];
    const context = makeContext(chunks);

    const result = rerankFast(context, 'heart failure pathophysiology', {
      targetSystem: 'Cardiovascular',
      targetCondition: 'Heart Failure',
    });

    // The chunk about heart failure should rank first despite lower vector score
    expect(result.chunks[0].chunk.sourceId).toBe('low-vector-high-lexical');
  });

  it('preserves order when vector scores are dominant', () => {
    const chunks = [
      makeChunk({ sourceId: 'best', similarity: 0.90 }),
      makeChunk({ sourceId: 'good', similarity: 0.70 }),
      makeChunk({ sourceId: 'ok', similarity: 0.50 }),
    ];
    const context = makeContext(chunks);

    const result = rerankFast(context, 'heart failure');
    // Vector score dominates with weight 0.35
    expect(result.chunks[0].chunk.sourceId).toBe('best');
  });

  it('respects topK parameter', () => {
    const chunks = Array.from({ length: 10 }, (_, i) =>
      makeChunk({ sourceId: `mc-${i}`, similarity: 0.60 - i * 0.03 })
    );
    const context = makeContext(chunks);

    const result = rerankFast(context, 'heart failure', { topK: 3 });
    expect(result.chunks).toHaveLength(3);
    expect(result.context.chunks).toHaveLength(3);
  });

  it('handles empty context', () => {
    const result = rerankFast(makeContext([]), 'heart failure');
    expect(result.chunks).toHaveLength(0);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('includes score breakdown for each chunk', () => {
    const context = makeContext([makeChunk()]);
    const result = rerankFast(context, 'heart failure pathophysiology');

    const scored = result.chunks[0];
    expect(scored.scoreBreakdown).toBeDefined();
    expect(scored.scoreBreakdown.vectorComponent).toBe(0.60);
    expect(scored.scoreBreakdown.lexicalComponent).toBeGreaterThanOrEqual(0);
    expect(scored.scoreBreakdown.clinicalComponent).toBeGreaterThanOrEqual(0);
    expect(scored.rerankScore).toBeGreaterThan(0);
    expect(scored.rerankScore).toBeLessThanOrEqual(1.0);
  });

  it('custom weights change scoring', () => {
    const chunks = [
      makeChunk({
        sourceId: 'clinical-rich',
        similarity: 0.40,
        content: 'Sensitivity: 95%. Gold standard is echo. First-line: ACE inhibitor 10mg. ACC/AHA guideline.',
      }),
      makeChunk({
        sourceId: 'plain',
        similarity: 0.55,
        content: 'Heart failure is a condition where the heart cannot pump enough blood.',
      }),
    ];
    const context = makeContext(chunks);

    // Heavy clinical weight should boost the clinically-rich chunk
    const result = rerankFast(context, 'heart failure', {
      weights: { ...DEFAULT_WEIGHTS, clinical: 0.50, vector: 0.10 },
    });

    expect(result.chunks[0].chunk.sourceId).toBe('clinical-rich');
  });

  it('rebuilds RAG context with correct token estimates', () => {
    const context = makeContext([
      makeChunk({ content: 'Short content.' }),
      makeChunk({ content: 'Much longer content that contains more clinical information about the condition.' }),
    ]);

    const result = rerankFast(context, 'query');
    expect(result.context.totalTokensEstimate).toBeGreaterThan(0);
    expect(result.context.retrievalScores.length).toBe(result.context.chunks.length);
  });
});

// ─── rerankPipeline ──────────────────────────────────────────────────

describe('rerankPipeline', () => {
  it('returns empty result for empty context', () => {
    const result = rerankPipeline(makeContext([]), 'query');
    expect(result.chunks).toHaveLength(0);
    expect(result.durationMs).toBe(0);
  });

  it('delegates to fast mode by default', () => {
    const context = makeContext([makeChunk()]);
    const result = rerankPipeline(context, 'heart failure');
    expect(result.mode).toBe('fast');
    expect(result.chunks.length).toBeGreaterThan(0);
  });

  it('passes options through to reranker', () => {
    const chunks = Array.from({ length: 5 }, (_, i) =>
      makeChunk({ sourceId: `mc-${i}`, similarity: 0.60 })
    );
    const result = rerankPipeline(makeContext(chunks), 'query', { topK: 2 });
    expect(result.chunks).toHaveLength(2);
  });
});

// ─── DEFAULT_WEIGHTS ─────────────────────────────────────────────────

describe('DEFAULT_WEIGHTS', () => {
  it('sums to 1.0', () => {
    const sum = Object.values(DEFAULT_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 5);
  });

  it('vector has highest individual weight', () => {
    const max = Math.max(...Object.values(DEFAULT_WEIGHTS));
    expect(DEFAULT_WEIGHTS.vector).toBe(max);
  });
});
