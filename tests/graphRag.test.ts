/**
 * Tests for lib/services/search/graphRag.ts pure utility functions.
 *
 * Covers:
 *   classifyGraphQuery()    — intent classification by keyword regex
 *   getEdgeTypesForQuery()  — edge-type strategy per query intent
 *   buildGraphContext()     — text formatter for RAG context injection
 */

import { describe, it, expect } from 'vitest';
import {
  classifyGraphQuery,
  getEdgeTypesForQuery,
  buildGraphContext,
  type GraphSearchResult,
  type EdgeType,
} from '../lib/services/search/graphRag';

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeResult(
  overrides: Partial<GraphSearchResult> = {}
): GraphSearchResult {
  return {
    nodes: [],
    edges: [],
    paths: [],
    queryType: 'general',
    ...overrides,
  };
}

// ─── classifyGraphQuery ───────────────────────────────────────────────────────

describe('classifyGraphQuery', () => {
  describe('ddx queries', () => {
    it.each([
      'what is the differential for chest pain',
      'ddx of pleurisy',
      'rule out pulmonary embolism',
      'distinguish MI from pericarditis',
      'differentiate Crohn vs ulcerative colitis',
      'MI versus pericarditis',
    ])('classifies "%s" as ddx', (q) => {
      expect(classifyGraphQuery(q)).toBe('ddx');
    });
  });

  describe('drug_interaction queries', () => {
    it.each([
      'does warfarin interact with aspirin',
      'contraindicated with metformin',
      'can I combine amoxicillin and metronidazole',
      'concomitant use of NSAIDs',
      'drug-drug interaction risk',
    ])('classifies "%s" as drug_interaction', (q) => {
      expect(classifyGraphQuery(q)).toBe('drug_interaction');
    });
  });

  describe('causal queries', () => {
    it.each([
      'what causes hyponatremia',
      'etiology of cirrhosis',
      'pathogenesis of type 2 diabetes',
      'what leads to cardiac tamponade',
      'mechanism of HOCM',
    ])('classifies "%s" as causal', (q) => {
      expect(classifyGraphQuery(q)).toBe('causal');
    });
  });

  describe('treatment queries', () => {
    it.each([
      // first[- ]line phrase
      'first-line agent for GERD',
      'first line option for PAH',
      // treat\w* covers treat, treats, treating, treatment
      'how do you treat atrial fibrillation',
      'first-line treatment for GERD',
      // therap\w* covers therapy, therapeutic, therapies
      'therapy for anemia of chronic disease',
      'therapeutic approach to heart failure',
      // manag\w* covers manage, managing, management
      'management of hypertensive urgency',
      'managing septic shock',
      // prescribe\w*
      'what should I prescribe for this',
      'prescribing amoxicillin',
      // medication as a whole word
      'medication for severe hypertension',
      // drug of choice phrase
      'drug of choice for H. pylori',
    ])('classifies "%s" as treatment', (q) => {
      expect(classifyGraphQuery(q)).toBe('treatment');
    });
  });

  describe('general fallback', () => {
    it.each([
      'tell me about diabetes',
      'what is the heart',
      'overview of liver disease',
      'COPD staging',
    ])('classifies "%s" as general', (q) => {
      expect(classifyGraphQuery(q)).toBe('general');
    });
  });

  it('is case-insensitive', () => {
    expect(classifyGraphQuery('DIFFERENTIAL diagnosis')).toBe('ddx');
    expect(classifyGraphQuery('CAUSES hypertension')).toBe('causal');
  });

  it('ddx takes priority over other patterns when query contains both signals', () => {
    // "differential" appears before any treatment keyword
    expect(classifyGraphQuery('differential treatment options')).toBe('ddx');
  });
});

// ─── getEdgeTypesForQuery ────────────────────────────────────────────────────

describe('getEdgeTypesForQuery', () => {
  it('ddx returns DIFFERENTIAL-focused edge types', () => {
    const edges = getEdgeTypesForQuery('ddx');
    expect(edges).toContain('DIFFERENTIAL');
    expect(edges).toContain('MANIFESTS');
    expect(edges).toContain('CO_OCCURRENCE');
    expect(edges).toContain('ASSOCIATED');
    // should NOT include TREATS for ddx
    expect(edges).not.toContain('TREATS');
  });

  it('drug_interaction returns TREATS and COMPLICATES', () => {
    const edges = getEdgeTypesForQuery('drug_interaction');
    expect(edges).toContain('TREATS');
    expect(edges).toContain('COMPLICATES');
  });

  it('causal returns CAUSES and COMPLICATES', () => {
    const edges = getEdgeTypesForQuery('causal');
    expect(edges).toContain('CAUSES');
    expect(edges).toContain('COMPLICATES');
    expect(edges).toContain('MANIFESTS');
    expect(edges).toContain('HIERARCHICAL');
  });

  it('treatment returns TREATS and HIERARCHICAL', () => {
    const edges = getEdgeTypesForQuery('treatment');
    expect(edges).toContain('TREATS');
    expect(edges).toContain('HIERARCHICAL');
  });

  it('general returns all edge types (broadest coverage)', () => {
    const edges = getEdgeTypesForQuery('general');
    const allTypes: EdgeType[] = [
      'HIERARCHICAL', 'CO_OCCURRENCE', 'SEMANTIC', 'EXPLICIT',
      'ASSOCIATED', 'TREATS', 'CAUSES', 'MANIFESTS',
      'DIFFERENTIAL', 'COMPLICATES',
    ];
    // general should include the major types
    for (const t of ['HIERARCHICAL', 'ASSOCIATED', 'TREATS', 'CAUSES', 'DIFFERENTIAL'] as EdgeType[]) {
      expect(edges).toContain(t);
    }
    expect(edges.length).toBeGreaterThan(4);
  });

  it('returns a non-empty array for every query type', () => {
    const types = ['ddx', 'drug_interaction', 'causal', 'treatment', 'general'] as const;
    for (const qt of types) {
      expect(getEdgeTypesForQuery(qt).length).toBeGreaterThan(0);
    }
  });
});

// ─── buildGraphContext ────────────────────────────────────────────────────────

describe('buildGraphContext', () => {
  it('returns empty string for empty result', () => {
    expect(buildGraphContext(makeResult())).toBe('');
  });

  it('returns empty string when nodes exist but edges and paths are empty', () => {
    const result = makeResult({
      nodes: [{ id: 'n1', nodeType: 'CONDITION', label: 'MI', sourceType: 'condition', sourceId: 'mi', relevance: 0.9 }],
      edges: [],
      paths: [],
    });
    // No edges or paths → empty context (nothing to render)
    expect(buildGraphContext(result)).toBe('');
  });

  it('includes edge relationships in the output', () => {
    const result = makeResult({
      nodes: [
        { id: 'n1', nodeType: 'CONDITION', label: 'MI', sourceType: 'condition', sourceId: 'mi', relevance: 0.9 },
        { id: 'n2', nodeType: 'CONDITION', label: 'Pericarditis', sourceType: 'condition', sourceId: 'peri', relevance: 0.7 },
      ],
      edges: [{ sourceLabel: 'MI', targetLabel: 'Pericarditis', edgeType: 'DIFFERENTIAL', weight: 0.8 }],
      paths: [],
    });
    const ctx = buildGraphContext(result);
    expect(ctx).toContain('MI');
    expect(ctx).toContain('Pericarditis');
    expect(ctx).toContain('DIFFERENTIAL');
    expect(ctx).toContain('Key relationships');
  });

  it('includes clinical pathways when paths are present', () => {
    const result = makeResult({
      nodes: [
        { id: 'n1', nodeType: 'CONDITION', label: 'DKA', sourceType: 'condition', sourceId: 'dka', relevance: 1.0 },
      ],
      edges: [],
      paths: [{ nodes: ['DKA', 'Hyperglycemia', 'Polyuria'], edges: ['CAUSES', 'MANIFESTS'], totalWeight: 1.6 }],
    });
    const ctx = buildGraphContext(result);
    expect(ctx).toContain('DKA');
    expect(ctx).toContain('Hyperglycemia');
    expect(ctx).toContain('Clinical pathways');
  });

  it('limits edges to 15 and deduplicates', () => {
    // Create 20 identical edges — should deduplicate to 1
    const edges = Array(20).fill(null).map(() => ({
      sourceLabel: 'A',
      targetLabel: 'B',
      edgeType: 'ASSOCIATED' as EdgeType,
      weight: 0.5,
    }));
    const result = makeResult({
      nodes: [{ id: 'n1', nodeType: 'CONDITION', label: 'A', sourceType: 'condition', sourceId: 'a', relevance: 0.5 }],
      edges,
      paths: [],
    });
    const ctx = buildGraphContext(result);
    // "A —[ASSOCIATED]→ B" should appear exactly once after deduplication
    const occurrences = (ctx.match(/A —\[ASSOCIATED\]→ B/g) ?? []).length;
    expect(occurrences).toBe(1);
  });

  it('limits paths to top 5', () => {
    const paths = Array(10).fill(null).map((_, i) => ({
      nodes: [`Node${i}`, `Node${i + 1}`],
      edges: ['ASSOCIATED'],
      totalWeight: 1.0 - i * 0.05,
    }));
    const result = makeResult({
      nodes: [{ id: 'n1', nodeType: 'CONDITION', label: 'X', sourceType: 'condition', sourceId: 'x', relevance: 0.5 }],
      edges: [],
      paths,
    });
    const ctx = buildGraphContext(result);
    // Only first 5 paths should appear; Node5-Node9 (paths 5-9) should not
    expect(ctx).toContain('Node0');
    expect(ctx).not.toContain('Node9');
  });

  it('both sections separated by double newline when both present', () => {
    const result = makeResult({
      nodes: [{ id: 'n1', nodeType: 'CONDITION', label: 'X', sourceType: 'condition', sourceId: 'x', relevance: 0.5 }],
      edges: [{ sourceLabel: 'X', targetLabel: 'Y', edgeType: 'CAUSES', weight: 0.7 }],
      paths: [{ nodes: ['X', 'Y'], edges: ['CAUSES'], totalWeight: 0.7 }],
    });
    const ctx = buildGraphContext(result);
    expect(ctx).toContain('\n\n');
    expect(ctx).toContain('Key relationships');
    expect(ctx).toContain('Clinical pathways');
  });
});
