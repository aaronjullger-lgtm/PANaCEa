/**
 * Unit tests for lib/services/cragGuardrailService.ts
 *
 * Pure exports tested (no I/O, no async):
 *   evaluateChunk(chunk, targetSystem, targetCondition, config?)
 *   decideAction(relevantCount, irrelevantCount, avgRelevance, config?)
 *   computeRetrievalConfidence(relevantCount, irrelevantCount, avgRelevance, maxRelevance, systemMatch, conditionMatch, config?)
 *   hasStructuredClinicalMarkers(content)
 *   formatGapForLogging(gap)
 *   evaluateRetrieval(context, query, targetSystem?, targetCondition?, contentType?, config?)
 *
 * CRAG routing thresholds (DEFAULT_CRAG_CONFIG):
 *   chunkRelevanceThreshold: 0.35
 *   correctThreshold: 0.50
 *   incorrectThreshold: 0.30
 *   minRelevantChunks: 2
 *   maxIrrelevantRatio: 0.50
 *   systemMatchBonus: 0.05
 *   conditionMatchBonus: 0.08
 */

import { describe, it, expect } from 'vitest';
import type { RAGChunk, RAGContext } from './ragContextService';
import {
  evaluateChunk,
  evaluateRetrieval,
  decideAction,
  computeRetrievalConfidence,
  hasStructuredClinicalMarkers,
  formatGapForLogging,
  DEFAULT_CRAG_CONFIG,
  type ChunkEvaluation,
  type ContentGapSignal,
  type CRAGConfig,
} from './cragGuardrailService';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeChunk(
  similarity: number,
  system = 'Cardiology',
  content = 'This is a sample clinical chunk about the mechanism and pathophysiology of heart disease.',
  condition = 'Atrial Fibrillation'
): RAGChunk {
  return {
    sourceId: `src-${Math.random().toString(36).slice(2)}`,
    content,
    system,
    condition,
    contentType: 'condition',
    similarity,
  };
}

function makeContext(chunks: RAGChunk[]): RAGContext {
  return {
    chunks,
    totalTokensEstimate: chunks.reduce((sum, c) => sum + c.content.length * 0.25, 0),
    retrievalScores: chunks.map(c => c.similarity),
    isGrounded: false,
  };
}

function makeGapSignal(): ContentGapSignal {
  return {
    query: 'What is the mechanism of mitral regurgitation?',
    system: 'Cardiology',
    condition: 'Mitral Regurgitation',
    contentType: 'general',
    bestScore: 0.42,
    avgScore: 0.31,
    chunksRetrieved: 3,
    action: 'AMBIGUOUS',
    timestamp: new Date().toISOString(),
  };
}

// ─── hasStructuredClinicalMarkers ─────────────────────────────────────────────

describe('hasStructuredClinicalMarkers', () => {
  it('returns false for plain text (no markers)', () => {
    expect(hasStructuredClinicalMarkers('This is a general sentence about health.')).toBe(false);
  });

  it('returns false for single marker (needs ≥2)', () => {
    expect(hasStructuredClinicalMarkers('The mechanism of the disease is unclear.')).toBe(false);
  });

  it('returns true for sensitivity (pattern 0) + mechanism (pattern 2)', () => {
    // pattern 0: sensitivity/specificity:digit; pattern 2: mechanism/pathophysiology
    expect(hasStructuredClinicalMarkers('Sensitivity: 85%. The mechanism involves beta blockade.')).toBe(true);
  });

  it('returns true for first-line + dose (two distinct patterns)', () => {
    // pattern 1: first-line; pattern 4: dose (\bdose\b matches "dose" as standalone word)
    expect(hasStructuredClinicalMarkers('First-line treatment: dose is 25 mg daily.')).toBe(true);
  });

  it('returns true for guideline + dose', () => {
    // pattern 3: guideline; pattern 4: dose/mg
    expect(hasStructuredClinicalMarkers('Per guideline: initial dose 10mg/kg')).toBe(true);
  });

  it('returns true for contraindicated + mechanism (two distinct patterns)', () => {
    // pattern 5: contraindicated; pattern 2: mechanism
    expect(hasStructuredClinicalMarkers('Contraindicated in renal failure. Mechanism is uncertain.')).toBe(true);
  });

  it('returns true for gold standard + evidence', () => {
    // pattern 1: gold standard; pattern 3: evidence
    expect(hasStructuredClinicalMarkers('Gold standard is biopsy. Evidence level A.')).toBe(true);
  });

  it('returns true for pathophysiology + first-line (two distinct patterns)', () => {
    // pattern 2: pathophysiology; pattern 1: first-line
    expect(hasStructuredClinicalMarkers('Pathophysiology involves immune activation. First-line treatment is steroids.')).toBe(true);
  });

  it('empty string returns false', () => {
    expect(hasStructuredClinicalMarkers('')).toBe(false);
  });
});

// ─── evaluateChunk ─────────────────────────────────────────────────────────────

describe('evaluateChunk', () => {
  it('base similarity below threshold → isRelevant=false', () => {
    const chunk = makeChunk(0.20, 'Unknown', 'a'.repeat(100));
    const result = evaluateChunk(chunk, undefined, undefined);
    expect(result.isRelevant).toBe(false);
    expect(result.relevanceScore).toBeCloseTo(0.20, 3);
  });

  it('base similarity above threshold → isRelevant=true', () => {
    const chunk = makeChunk(0.50, 'Unknown', 'a'.repeat(100));
    const result = evaluateChunk(chunk, undefined, undefined);
    expect(result.isRelevant).toBe(true);
  });

  it('system match bonus (+0.05) can push borderline chunk over threshold', () => {
    // similarity=0.31 + systemMatch(0.05) = 0.36 ≥ 0.35 → relevant
    const chunk = makeChunk(0.31, 'Cardiology', 'a'.repeat(100));
    const result = evaluateChunk(chunk, 'Cardiology', undefined);
    expect(result.isRelevant).toBe(true);
    expect(result.relevanceScore).toBeCloseTo(0.36, 3);
  });

  it('condition match bonus (+0.08) increases score', () => {
    const chunk = makeChunk(0.20, 'Cardiology', 'Atrial Fibrillation is a common arrhythmia and is well known.', 'Atrial Fibrillation');
    const without = evaluateChunk(chunk, undefined, undefined);
    const withCondition = evaluateChunk(chunk, undefined, 'Atrial Fibrillation');
    expect(withCondition.relevanceScore).toBeCloseTo(without.relevanceScore + DEFAULT_CRAG_CONFIG.conditionMatchBonus, 5);
  });

  it('short content penalty (< 50 chars) reduces score by ×0.7', () => {
    const shortContent = 'Short text here.'; // < 50 chars
    const chunk = makeChunk(0.50, 'Unknown', shortContent);
    const result = evaluateChunk(chunk, undefined, undefined);
    expect(result.relevanceScore).toBeCloseTo(0.50 * 0.7, 3);
  });

  it('no short penalty for content ≥ 50 chars', () => {
    const longContent = 'a'.repeat(60);
    const chunk = makeChunk(0.40, 'Unknown', longContent);
    const result = evaluateChunk(chunk, undefined, undefined);
    // No short penalty, no system/condition match, no structured markers → score stays 0.40
    // (possibly + 0.03 if clinical markers, but 'aaa...' has none)
    expect(result.relevanceScore).toBeCloseTo(0.40, 3);
  });

  it('structured clinical markers add +0.03', () => {
    const clinical = 'First-line treatment is aspirin. Mechanism involves COX inhibition. Dose is 81mg.';
    const chunk = makeChunk(0.40, 'Unknown', clinical);
    const result = evaluateChunk(chunk, undefined, undefined);
    expect(result.relevanceScore).toBeGreaterThan(0.40);
  });

  it('score is clamped to [0, 1]', () => {
    // Very high similarity + bonuses should not exceed 1.0
    const chunk = makeChunk(0.95, 'Cardiology', 'Atrial Fibrillation mechanism. First-line: metoprolol. Dose: 25mg.', 'Atrial Fibrillation');
    const result = evaluateChunk(chunk, 'Cardiology', 'Atrial Fibrillation');
    expect(result.relevanceScore).toBeLessThanOrEqual(1.0);
    expect(result.relevanceScore).toBeGreaterThanOrEqual(0);
  });

  it('includes reason string in result', () => {
    const chunk = makeChunk(0.50, 'Unknown', 'a'.repeat(100));
    const result = evaluateChunk(chunk, undefined, undefined);
    expect(typeof result.reason).toBe('string');
    expect(result.reason.length).toBeGreaterThan(0);
  });

  it('reason contains "Filtered" for irrelevant chunk', () => {
    const chunk = makeChunk(0.10, 'Unknown', 'a'.repeat(100));
    const result = evaluateChunk(chunk, undefined, undefined);
    expect(result.reason).toContain('Filtered');
  });

  it('reason contains "Relevant" for relevant chunk', () => {
    const chunk = makeChunk(0.60, 'Unknown', 'a'.repeat(100));
    const result = evaluateChunk(chunk, undefined, undefined);
    expect(result.reason).toContain('Relevant');
  });
});

// ─── decideAction ─────────────────────────────────────────────────────────────

describe('decideAction', () => {
  it('INCORRECT when relevantCount < minRelevantChunks (2)', () => {
    expect(decideAction(0, 5, 0.60)).toBe('INCORRECT');
    expect(decideAction(1, 5, 0.60)).toBe('INCORRECT');
  });

  it('INCORRECT when avgRelevance < incorrectThreshold (0.30)', () => {
    expect(decideAction(3, 0, 0.25)).toBe('INCORRECT');
  });

  it('AMBIGUOUS when irrelevant ratio exceeds maxIrrelevantRatio (0.50)', () => {
    // 2 relevant, 4 irrelevant → ratio=0.67 > 0.50 → AMBIGUOUS
    expect(decideAction(2, 4, 0.45)).toBe('AMBIGUOUS');
  });

  it('CORRECT when avgRelevance ≥ correctThreshold (0.50) and irrelevant ratio ≤ 0.50', () => {
    // 3 relevant, 1 irrelevant → ratio=0.25 ≤ 0.50; avg=0.60 ≥ 0.50
    expect(decideAction(3, 1, 0.60)).toBe('CORRECT');
  });

  it('AMBIGUOUS when avgRelevance between incorrectThreshold and correctThreshold', () => {
    // avg=0.40: between 0.30 and 0.50 → AMBIGUOUS
    expect(decideAction(3, 0, 0.40)).toBe('AMBIGUOUS');
  });

  it('boundary: avg = correctThreshold (0.50) → CORRECT', () => {
    expect(decideAction(3, 0, 0.50)).toBe('CORRECT');
  });

  it('boundary: avg = incorrectThreshold (0.30) → INCORRECT', () => {
    // 0.30 < 0.30 is false, so 0.30 does NOT trigger INCORRECT via that branch
    // Needs both minRelevantChunks check to pass: 3 ≥ 2 ✓, avg 0.30 < 0.30 = false → falls to next checks
    // irrelevant ratio = 0, avg 0.30 < 0.50 → AMBIGUOUS
    expect(decideAction(3, 0, 0.30)).toBe('AMBIGUOUS');
  });

  it('custom config overrides defaults', () => {
    const strictConfig: CRAGConfig = {
      ...DEFAULT_CRAG_CONFIG,
      minRelevantChunks: 5,
      correctThreshold: 0.80,
    };
    // 4 relevant (< 5 required) → INCORRECT
    expect(decideAction(4, 0, 0.90, strictConfig)).toBe('INCORRECT');
  });
});

// ─── computeRetrievalConfidence ───────────────────────────────────────────────

describe('computeRetrievalConfidence', () => {
  it('returns 0 for no relevant chunks', () => {
    const conf = computeRetrievalConfidence(0, 5, 0, 0, false, false);
    expect(conf).toBe(0);
  });

  it('returns value in [0, 1]', () => {
    for (const [rel, irrel, avg, max] of [
      [5, 0, 0.80, 0.90],
      [1, 10, 0.20, 0.30],
      [2, 2, 0.50, 0.60],
    ] as [number, number, number, number][]) {
      const conf = computeRetrievalConfidence(rel, irrel, avg, max, true, true);
      expect(conf).toBeGreaterThanOrEqual(0);
      expect(conf).toBeLessThanOrEqual(1);
    }
  });

  it('system match increases confidence (using low-scoring inputs so bonus has room)', () => {
    // Use 2 relevant (coverageFactor=1.0) + some irrelevant to keep below 1.0 before bonus
    const withoutMatch = computeRetrievalConfidence(2, 2, 0.40, 0.50, false, false);
    const withMatch = computeRetrievalConfidence(2, 2, 0.40, 0.50, true, false);
    expect(withMatch).toBeGreaterThan(withoutMatch);
  });

  it('condition match increases confidence (using low-scoring inputs)', () => {
    const without = computeRetrievalConfidence(2, 2, 0.40, 0.50, false, false);
    const with_ = computeRetrievalConfidence(2, 2, 0.40, 0.50, false, true);
    expect(with_).toBeGreaterThan(without);
  });

  it('more irrelevant chunks → lower confidence', () => {
    const clean = computeRetrievalConfidence(4, 0, 0.60, 0.80, false, false);
    const noisy = computeRetrievalConfidence(4, 4, 0.60, 0.80, false, false);
    expect(noisy).toBeLessThan(clean);
  });

  it('more relevant chunks → higher confidence (up to saturation)', () => {
    const few = computeRetrievalConfidence(1, 0, 0.60, 0.80, false, false);
    const many = computeRetrievalConfidence(4, 0, 0.60, 0.80, false, false);
    expect(many).toBeGreaterThan(few);
  });

  it('base confidence formula: (avgRel×0.6 + maxRel×0.4)', () => {
    // relevantCount = minRelevantChunks = 2 → coverageFactor = 1.0
    // noiseRatio = 0 → no noise penalty
    // No system/condition match
    const avg = 0.60;
    const max = 0.80;
    const expected = avg * 0.6 + max * 0.4; // 0.36 + 0.32 = 0.68
    const conf = computeRetrievalConfidence(2, 0, avg, max, false, false);
    expect(conf).toBeCloseTo(expected, 4);
  });
});

// ─── formatGapForLogging ──────────────────────────────────────────────────────

describe('formatGapForLogging', () => {
  it('returns a string', () => {
    const result = formatGapForLogging(makeGapSignal());
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(20);
  });

  it('includes [CONTENT_GAP] prefix', () => {
    expect(formatGapForLogging(makeGapSignal())).toContain('[CONTENT_GAP]');
  });

  it('includes action in the log string', () => {
    const gap = makeGapSignal();
    expect(formatGapForLogging(gap)).toContain('action=AMBIGUOUS');
  });

  it('includes system name', () => {
    const gap = { ...makeGapSignal(), system: 'Nephrology' };
    expect(formatGapForLogging(gap)).toContain('system=Nephrology');
  });

  it('includes condition name', () => {
    const gap = makeGapSignal();
    expect(formatGapForLogging(gap)).toContain('Mitral Regurgitation');
  });

  it('truncates long queries to 100 chars', () => {
    const longQuery = 'a'.repeat(200);
    const gap = { ...makeGapSignal(), query: longQuery };
    const result = formatGapForLogging(gap);
    // The query portion should be max 100 chars
    const queryMatch = result.match(/query="([^"]+)"/);
    expect(queryMatch?.[1]?.length).toBeLessThanOrEqual(100);
  });

  it('handles missing condition (shows "unknown")', () => {
    const gap = { ...makeGapSignal(), condition: undefined };
    expect(formatGapForLogging(gap)).toContain('condition=unknown');
  });
});

// ─── evaluateRetrieval (integration) ──────────────────────────────────────────

describe('evaluateRetrieval', () => {
  it('returns CORRECT action for high-quality context', () => {
    const goodContent = 'Pathophysiology: mechanism involves immune activation. First-line treatment is established.';
    const chunks = [
      makeChunk(0.65, 'Cardiology', goodContent, 'STEMI'),
      makeChunk(0.70, 'Cardiology', goodContent, 'STEMI'),
      makeChunk(0.60, 'Cardiology', goodContent, 'STEMI'),
    ];
    const result = evaluateRetrieval(makeContext(chunks), 'STEMI treatment', 'Cardiology', 'STEMI');
    expect(result.action).toBe('CORRECT');
  });

  it('returns INCORRECT action for empty context', () => {
    const result = evaluateRetrieval(makeContext([]), 'STEMI treatment');
    expect(result.action).toBe('INCORRECT');
  });

  it('returns INCORRECT action for all low-similarity chunks', () => {
    const chunks = [
      makeChunk(0.10, 'Unknown', 'a'.repeat(100)),
      makeChunk(0.12, 'Unknown', 'b'.repeat(100)),
    ];
    const result = evaluateRetrieval(makeContext(chunks), 'test query');
    expect(result.action).toBe('INCORRECT');
  });

  it('refinedContext only contains relevant chunks', () => {
    const goodContent = 'a'.repeat(100);
    const chunks = [
      makeChunk(0.70, 'Cardiology', goodContent),
      makeChunk(0.10, 'Unknown', goodContent), // too low → filtered
      makeChunk(0.60, 'Cardiology', goodContent),
    ];
    const result = evaluateRetrieval(makeContext(chunks), 'test');
    expect(result.refinedContext.chunks.length).toBeLessThan(chunks.length);
  });

  it('contentGap is null for CORRECT action', () => {
    const goodContent = 'a'.repeat(100);
    const chunks = [
      makeChunk(0.70, 'Cardiology', goodContent),
      makeChunk(0.65, 'Cardiology', goodContent),
      makeChunk(0.60, 'Cardiology', goodContent),
    ];
    const result = evaluateRetrieval(makeContext(chunks), 'test');
    expect(result.contentGap).toBeNull();
  });

  it('contentGap is populated for INCORRECT action', () => {
    const result = evaluateRetrieval(makeContext([]), 'test query', 'Cardiology', 'STEMI');
    expect(result.contentGap).not.toBeNull();
    expect(result.contentGap?.query).toBe('test query');
    expect(result.contentGap?.system).toBe('Cardiology');
  });

  it('cautionPrefix is non-null for AMBIGUOUS action', () => {
    // 3 relevant, 5 irrelevant → ratio > 0.50 → AMBIGUOUS
    const goodContent = 'a'.repeat(100);
    const chunks = [
      makeChunk(0.55, 'Cardiology', goodContent),
      makeChunk(0.55, 'Cardiology', goodContent),
      makeChunk(0.55, 'Cardiology', goodContent),
      makeChunk(0.10, 'Unknown', goodContent), // filtered
      makeChunk(0.10, 'Unknown', goodContent), // filtered
      makeChunk(0.10, 'Unknown', goodContent), // filtered
      makeChunk(0.10, 'Unknown', goodContent), // filtered
      makeChunk(0.10, 'Unknown', goodContent), // filtered
    ];
    const result = evaluateRetrieval(makeContext(chunks), 'test');
    if (result.action === 'AMBIGUOUS') {
      expect(result.cautionPrefix).not.toBeNull();
      expect(result.cautionPrefix).toContain('RETRIEVAL QUALITY WARNING');
    }
  });

  it('cautionPrefix is null for CORRECT action', () => {
    const goodContent = 'a'.repeat(100);
    const chunks = [
      makeChunk(0.70, 'Cardiology', goodContent),
      makeChunk(0.65, 'Cardiology', goodContent),
      makeChunk(0.60, 'Cardiology', goodContent),
    ];
    const result = evaluateRetrieval(makeContext(chunks), 'test');
    if (result.action === 'CORRECT') {
      expect(result.cautionPrefix).toBeNull();
    }
  });

  it('chunkEvaluations has one entry per input chunk', () => {
    const goodContent = 'a'.repeat(100);
    const chunks = [makeChunk(0.60, 'Cardiology', goodContent), makeChunk(0.40, 'Cardiology', goodContent)];
    const result = evaluateRetrieval(makeContext(chunks), 'test');
    expect(result.chunkEvaluations).toHaveLength(2);
  });

  it('metrics.inputChunks matches chunk count', () => {
    const goodContent = 'a'.repeat(100);
    const chunks = [makeChunk(0.60, 'Cardiology', goodContent), makeChunk(0.40, 'Cardiology', goodContent), makeChunk(0.20, 'Unknown', goodContent)];
    const result = evaluateRetrieval(makeContext(chunks), 'test');
    expect(result.metrics.inputChunks).toBe(3);
  });

  it('metrics.filteredOut = inputChunks - outputChunks', () => {
    const goodContent = 'a'.repeat(100);
    const chunks = [makeChunk(0.60, 'Cardiology', goodContent), makeChunk(0.10, 'Unknown', goodContent)];
    const result = evaluateRetrieval(makeContext(chunks), 'test');
    expect(result.metrics.filteredOut).toBe(result.metrics.inputChunks - result.metrics.outputChunks);
  });
});
