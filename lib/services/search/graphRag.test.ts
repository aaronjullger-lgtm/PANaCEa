/**
 * Unit tests for lib/services/search/graphRag.ts
 *
 * Pure functions tested without DB:
 *   - classifyGraphQuery   — pattern-based intent detection
 *   - getEdgeTypesForQuery — edge-type mapping per query type
 *   - buildGraphContext    — NL summary string for LLM augmentation
 *   - findSeedNodes        — relevance scoring with mocked PrismaGraphClient
 *
 * traverseGraph / graphRAGQuery require full BFS over Prisma; those belong
 * in integration tests (not included here).
 */

import { describe, it, expect, vi } from 'vitest';
import {
  classifyGraphQuery,
  getEdgeTypesForQuery,
  buildGraphContext,
  findSeedNodes,
  type GraphSearchResult,
  type GraphNodeResult,
  type GraphEdgeResult,
  type GraphPath,
  type EdgeType,
  type NodeType,
} from './graphRag';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeNode(partial: Partial<GraphNodeResult> & { id: string }): GraphNodeResult {
  return {
    nodeType: 'CONDITION',
    label: partial.label ?? 'Hypertension',
    sourceType: 'MedicalContent',
    sourceId: partial.id,
    relevance: 0.9,
    ...partial,
  };
}

function makeEdge(
  sourceLabel: string,
  targetLabel: string,
  edgeType: EdgeType = 'ASSOCIATED',
  weight = 0.8
): GraphEdgeResult {
  return { sourceLabel, targetLabel, edgeType, weight };
}

function makePath(nodes: string[], edges: string[], totalWeight = 0.5): GraphPath {
  return { nodes, edges, totalWeight };
}

function makeGraphResult(partial: Partial<GraphSearchResult> = {}): GraphSearchResult {
  return {
    nodes: [],
    edges: [],
    paths: [],
    queryType: 'general',
    ...partial,
  };
}

// ─── classifyGraphQuery ───────────────────────────────────────────────────────

describe('classifyGraphQuery', () => {
  // DDX
  it('classifies "differential" as ddx', () => {
    expect(classifyGraphQuery('differential diagnosis for chest pain')).toBe('ddx');
  });

  it('classifies "ddx" abbreviation as ddx', () => {
    expect(classifyGraphQuery('ddx for acute abdomen')).toBe('ddx');
  });

  it('classifies "rule out" as ddx', () => {
    expect(classifyGraphQuery('rule out pulmonary embolism in this presentation')).toBe('ddx');
  });

  it('classifies "differentiate" as ddx', () => {
    expect(classifyGraphQuery('how to differentiate Crohn from ulcerative colitis')).toBe('ddx');
  });

  it('classifies "versus" as ddx', () => {
    expect(classifyGraphQuery('STEMI versus NSTEMI versus Prinzmetal angina')).toBe('ddx');
  });

  it('classifies "vs." as ddx', () => {
    expect(classifyGraphQuery('community acquired pneumonia vs. hospital acquired pneumonia')).toBe('ddx');
  });

  // Drug interaction
  it('classifies "interact" as drug_interaction', () => {
    expect(classifyGraphQuery('does warfarin interact with fluconazole')).toBe('drug_interaction');
  });

  it('classifies "contraindicated" as drug_interaction', () => {
    expect(classifyGraphQuery('beta blockers are contraindicated in asthma')).toBe('drug_interaction');
  });

  it('classifies "concomitant" as drug_interaction', () => {
    expect(classifyGraphQuery('concomitant use of MAOIs and SSRIs')).toBe('drug_interaction');
  });

  it('classifies "drug-drug" pattern as drug_interaction', () => {
    expect(classifyGraphQuery('drug drug interaction between metformin and contrast')).toBe('drug_interaction');
  });

  // Causal
  it('classifies "causes" as causal', () => {
    expect(classifyGraphQuery('what causes diabetic ketoacidosis')).toBe('causal');
  });

  it('classifies "etiology" as causal', () => {
    expect(classifyGraphQuery('etiology of secondary hypertension')).toBe('causal');
  });

  it('classifies "pathogenesis" as causal', () => {
    expect(classifyGraphQuery('pathogenesis of type 2 diabetes mellitus')).toBe('causal');
  });

  it('classifies "leads to" as causal', () => {
    expect(classifyGraphQuery('chronic hypertension leads to left ventricular hypertrophy')).toBe('causal');
  });

  it('classifies "results in" as causal', () => {
    expect(classifyGraphQuery('portal hypertension results in varices')).toBe('causal');
  });

  // Treatment
  it('classifies "treat" as treatment', () => {
    expect(classifyGraphQuery('how to treat septic shock with vasopressors')).toBe('treatment');
  });

  it('classifies "first-line" as treatment', () => {
    expect(classifyGraphQuery('first-line therapy for atrial fibrillation with rapid ventricular response')).toBe('treatment');
  });

  it('classifies "medication" as treatment', () => {
    expect(classifyGraphQuery('medication for GERD management')).toBe('treatment');
  });

  it('classifies "drug of choice" as treatment', () => {
    expect(classifyGraphQuery('drug of choice for Pneumocystis jiroveci pneumonia')).toBe('treatment');
  });

  it('classifies "manage" (whole word) as treatment', () => {
    // TREATMENT_PATTERNS uses \bmanage\b — "manage" not "management"
    expect(classifyGraphQuery('how to manage acute heart failure exacerbation')).toBe('treatment');
  });

  // General fallback
  it('classifies plain condition lookup as general', () => {
    expect(classifyGraphQuery('atrial fibrillation overview')).toBe('general');
  });

  it('classifies short unclassified query as general', () => {
    expect(classifyGraphQuery('COPD')).toBe('general');
  });

  it('classifies empty query as general', () => {
    expect(classifyGraphQuery('')).toBe('general');
  });

  // Priority: ddx > drug_interaction (first match wins)
  it('classifies query matching both ddx and treatment as ddx (pattern order)', () => {
    // "differential" matches ddx first in the if-chain
    const result = classifyGraphQuery('differential diagnosis and treatment plan for DVT');
    expect(result).toBe('ddx');
  });
});

// ─── getEdgeTypesForQuery ─────────────────────────────────────────────────────

describe('getEdgeTypesForQuery', () => {
  it('ddx → includes DIFFERENTIAL, MANIFESTS, CO_OCCURRENCE, ASSOCIATED', () => {
    const edges = getEdgeTypesForQuery('ddx');
    expect(edges).toContain('DIFFERENTIAL');
    expect(edges).toContain('MANIFESTS');
    expect(edges).toContain('CO_OCCURRENCE');
    expect(edges).toContain('ASSOCIATED');
  });

  it('ddx → does NOT include TREATS or HIERARCHICAL', () => {
    const edges = getEdgeTypesForQuery('ddx');
    expect(edges).not.toContain('TREATS');
    expect(edges).not.toContain('HIERARCHICAL');
  });

  it('drug_interaction → includes TREATS, COMPLICATES, ASSOCIATED', () => {
    const edges = getEdgeTypesForQuery('drug_interaction');
    expect(edges).toContain('TREATS');
    expect(edges).toContain('COMPLICATES');
    expect(edges).toContain('ASSOCIATED');
  });

  it('causal → includes CAUSES, COMPLICATES, MANIFESTS, HIERARCHICAL', () => {
    const edges = getEdgeTypesForQuery('causal');
    expect(edges).toContain('CAUSES');
    expect(edges).toContain('COMPLICATES');
    expect(edges).toContain('MANIFESTS');
    expect(edges).toContain('HIERARCHICAL');
  });

  it('causal → does NOT include TREATS', () => {
    const edges = getEdgeTypesForQuery('causal');
    expect(edges).not.toContain('TREATS');
  });

  it('treatment → includes TREATS, ASSOCIATED, HIERARCHICAL', () => {
    const edges = getEdgeTypesForQuery('treatment');
    expect(edges).toContain('TREATS');
    expect(edges).toContain('ASSOCIATED');
    expect(edges).toContain('HIERARCHICAL');
  });

  it('treatment → does NOT include DIFFERENTIAL', () => {
    const edges = getEdgeTypesForQuery('treatment');
    expect(edges).not.toContain('DIFFERENTIAL');
  });

  it('general → returns all 9 edge types', () => {
    const edges = getEdgeTypesForQuery('general');
    const allExpected: EdgeType[] = [
      'HIERARCHICAL', 'ASSOCIATED', 'SEMANTIC', 'CO_OCCURRENCE',
      'TREATS', 'CAUSES', 'MANIFESTS', 'DIFFERENTIAL', 'COMPLICATES',
    ];
    for (const e of allExpected) {
      expect(edges).toContain(e);
    }
  });

  it('returns an array for every valid queryType', () => {
    const queryTypes: Array<GraphSearchResult['queryType']> = [
      'ddx', 'drug_interaction', 'causal', 'treatment', 'general',
    ];
    for (const qt of queryTypes) {
      const result = getEdgeTypesForQuery(qt);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    }
  });
});

// ─── buildGraphContext ────────────────────────────────────────────────────────

describe('buildGraphContext', () => {
  it('returns empty string when no nodes', () => {
    const result = makeGraphResult({ nodes: [], edges: [], paths: [] });
    expect(buildGraphContext(result)).toBe('');
  });

  it('returns empty string when nodes array is empty regardless of edges', () => {
    const result = makeGraphResult({
      nodes: [],
      edges: [makeEdge('Hypertension', 'Beta Blocker', 'TREATS')],
    });
    expect(buildGraphContext(result)).toBe('');
  });

  it('includes edge relationships section when edges present', () => {
    const result = makeGraphResult({
      nodes: [makeNode({ id: 'n1', label: 'Hypertension' })],
      edges: [makeEdge('Hypertension', 'Lisinopril', 'TREATS')],
    });
    const ctx = buildGraphContext(result);
    expect(ctx).toContain('Key relationships');
    expect(ctx).toContain('Hypertension');
    expect(ctx).toContain('Lisinopril');
    expect(ctx).toContain('TREATS');
  });

  it('formats edge as "Source —[TYPE]→ Target"', () => {
    const result = makeGraphResult({
      nodes: [makeNode({ id: 'n1', label: 'STEMI' })],
      edges: [makeEdge('STEMI', 'Troponin', 'MANIFESTS')],
    });
    const ctx = buildGraphContext(result);
    expect(ctx).toContain('STEMI —[MANIFESTS]→ Troponin');
  });

  it('includes clinical pathways section when paths present', () => {
    const result = makeGraphResult({
      nodes: [makeNode({ id: 'n1' })],
      paths: [makePath(['Sepsis', 'Vasopressors', 'Norepinephrine'], ['TREATS', 'TREATS'])],
    });
    const ctx = buildGraphContext(result);
    expect(ctx).toContain('Clinical pathways');
    expect(ctx).toContain('Sepsis → Vasopressors → Norepinephrine');
  });

  it('caps edges at 15 unique entries', () => {
    const edges = Array.from({ length: 20 }, (_, i) =>
      makeEdge(`Source${i}`, `Target${i}`, 'ASSOCIATED')
    );
    const result = makeGraphResult({
      nodes: [makeNode({ id: 'n1' })],
      edges,
    });
    const ctx = buildGraphContext(result);
    // Should not include all 20 edges — only first 15
    const matchCount = (ctx.match(/ASSOCIATED/g) ?? []).length;
    expect(matchCount).toBeLessThanOrEqual(15);
  });

  it('caps paths at 5 entries', () => {
    const paths = Array.from({ length: 10 }, (_, i) =>
      makePath([`A${i}`, `B${i}`], ['TREATS'], 0.5)
    );
    const result = makeGraphResult({
      nodes: [makeNode({ id: 'n1' })],
      paths,
    });
    const ctx = buildGraphContext(result);
    // Count arrows (each path has 1 → for 2-node path): should be ≤ 5
    const arrowCount = (ctx.match(/ → /g) ?? []).length;
    expect(arrowCount).toBeLessThanOrEqual(5);
  });

  it('deduplicates identical edge strings', () => {
    const result = makeGraphResult({
      nodes: [makeNode({ id: 'n1' })],
      edges: [
        makeEdge('Diabetes', 'Metformin', 'TREATS'),
        makeEdge('Diabetes', 'Metformin', 'TREATS'), // duplicate
      ],
    });
    const ctx = buildGraphContext(result);
    // The relationship string should appear only once
    const occurrences = (ctx.match(/Diabetes —\[TREATS\]→ Metformin/g) ?? []).length;
    expect(occurrences).toBe(1);
  });

  it('returns a non-empty string when both edges and paths are present', () => {
    const result = makeGraphResult({
      nodes: [makeNode({ id: 'n1' })],
      edges: [makeEdge('A', 'B', 'CAUSES')],
      paths: [makePath(['A', 'B', 'C'], ['CAUSES', 'COMPLICATES'])],
    });
    const ctx = buildGraphContext(result);
    expect(ctx.trim().length).toBeGreaterThan(0);
  });
});

// ─── findSeedNodes (mocked Prisma) ───────────────────────────────────────────

function makePrismaMock(returnNodes: Array<{
  id: string;
  nodeType: string;
  label: string;
  description: string | null;
  sourceType: string;
  sourceId: string;
  outgoingEdges: Array<{ edgeType: string }>;
  incomingEdges: Array<{ edgeType: string }>;
}>) {
  return {
    graphNode: {
      findMany: vi.fn().mockResolvedValue(returnNodes),
    },
  };
}

describe('findSeedNodes', () => {
  it('returns empty array when prisma returns no nodes', async () => {
    const prisma = makePrismaMock([]);
    const result = await findSeedNodes(prisma, 'hypertension');
    expect(result).toEqual([]);
  });

  it('assigns relevance = 1.0 for exact label match', async () => {
    const prisma = makePrismaMock([{
      id: 'n1',
      nodeType: 'CONDITION',
      label: 'hypertension',
      description: null,
      sourceType: 'MedicalContent',
      sourceId: 'mc1',
      outgoingEdges: [],
      incomingEdges: [],
    }]);
    const result = await findSeedNodes(prisma, 'hypertension');
    expect(result[0].relevance).toBe(1.0);
  });

  it('assigns relevance = 0.8 for contains match (not exact)', async () => {
    const prisma = makePrismaMock([{
      id: 'n2',
      nodeType: 'CONDITION',
      label: 'hypertension stage 2',
      description: null,
      sourceType: 'MedicalContent',
      sourceId: 'mc2',
      outgoingEdges: [],
      incomingEdges: [],
    }]);
    const result = await findSeedNodes(prisma, 'hypertension');
    expect(result[0].relevance).toBe(0.8);
  });

  it('includes connection boost for nodes with many edges', async () => {
    // 10 outgoing + 10 incoming = 20 → connectionBoost = min(20/20, 0.2) = 0.2
    const manyEdges = Array.from({ length: 10 }, (_, i) => ({ edgeType: 'TREATS' }));
    const prisma = makePrismaMock([{
      id: 'n3',
      nodeType: 'CONDITION',
      label: 'unrelated label xyzabc',
      description: null,
      sourceType: 'MedicalContent',
      sourceId: 'mc3',
      outgoingEdges: manyEdges,
      incomingEdges: manyEdges,
    }]);
    // Query with 0 term overlap, no label match → relevance driven only by connectionBoost
    const result = await findSeedNodes(prisma, 'query with no match xyzzy');
    // connectionBoost = min(20/20, 0.2) = 0.2; termOverlap is 0; result = min(0 + 0.2, 1)
    expect(result[0].relevance).toBeCloseTo(0.2, 5);
  });

  it('maps nodeType string to NodeType correctly', async () => {
    const prisma = makePrismaMock([{
      id: 'n4',
      nodeType: 'DRUG',
      label: 'Metformin',
      description: 'Biguanide antidiabetic',
      sourceType: 'Drug',
      sourceId: 'drug1',
      outgoingEdges: [],
      incomingEdges: [],
    }]);
    const result = await findSeedNodes(prisma, 'metformin');
    expect(result[0].nodeType).toBe('DRUG');
    expect(result[0].description).toBe('Biguanide antidiabetic');
  });

  it('calls prisma.graphNode.findMany exactly once', async () => {
    const prisma = makePrismaMock([]);
    await findSeedNodes(prisma, 'some query');
    expect(prisma.graphNode.findMany).toHaveBeenCalledOnce();
  });

  it('respects nodeTypes filter option', async () => {
    const prisma = makePrismaMock([]);
    await findSeedNodes(prisma, 'aspirin', { nodeTypes: ['DRUG'] });
    const call = (prisma.graphNode.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.where.nodeType).toEqual({ in: ['DRUG'] });
  });

  it('respects limit option', async () => {
    const prisma = makePrismaMock([]);
    await findSeedNodes(prisma, 'query', { limit: 3 });
    const call = (prisma.graphNode.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.take).toBe(3);
  });

  it('returns relevance clamped to [0, 1]', async () => {
    const prisma = makePrismaMock([{
      id: 'n5',
      nodeType: 'CONDITION',
      label: 'atrial fibrillation',
      description: null,
      sourceType: 'MedicalContent',
      sourceId: 'mc5',
      // 20+ edges → connectionBoost maxed at 0.2
      outgoingEdges: Array.from({ length: 15 }, () => ({ edgeType: 'TREATS' })),
      incomingEdges: Array.from({ length: 15 }, () => ({ edgeType: 'MANIFESTS' })),
    }]);
    const result = await findSeedNodes(prisma, 'atrial fibrillation');
    expect(result[0].relevance).toBeLessThanOrEqual(1.0);
    expect(result[0].relevance).toBeGreaterThanOrEqual(0);
  });
});
