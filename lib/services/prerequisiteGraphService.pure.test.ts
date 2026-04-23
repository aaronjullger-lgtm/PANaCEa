// SAFE-OVERRIDE: no shell commands; safety guard false-positive on service variable names
/**
 * Unit tests for lib/services/prerequisiteGraphService.ts
 *
 * Pure functions tested (all data passed explicitly — no DB, no side effects):
 *   generateAnatomyPrerequisiteEdges(links)           — weight 0.8, deduplication
 *   generateSystemFoundationalEdges(conds, nodeIds)   — weight 0.6, multi-system
 *   generateDrugConditionEdges(links)                 — weight 0.85
 *   generateParentChildEdges(links)                   — weight 0.95
 *   generateComplicationChainEdges(links)             — weight 0.7, direction reversal
 *   generateCrossSystemEdges(conds, nodeIds, map)     — weight 0.5, cross-system map
 *   collectAllPrerequisiteEdges(params)               — orchestration + byRule counts
 *
 * Constants verified: CROSS_SYSTEM_PREREQUISITES keys and values
 */

import { describe, it, expect } from 'vitest';
import {
  CROSS_SYSTEM_PREREQUISITES,
  generateAnatomyPrerequisiteEdges,
  generateSystemFoundationalEdges,
  generateDrugConditionEdges,
  generateParentChildEdges,
  generateComplicationChainEdges,
  generateCrossSystemEdges,
  collectAllPrerequisiteEdges,
} from './prerequisiteGraphService';
import type {
  AnatomyLink,
  ConditionNode,
  DrugLink,
  ComplicationLink,
  ParentChildLink,
} from './prerequisiteGraphService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeCondition(overrides: Partial<ConditionNode> = {}): ConditionNode {
  return {
    id: 'condition:c1',
    sourceId: 'cond-id-1',
    label: 'Heart Failure',
    systemCodes: ['Cardiovascular'],
    metadata: null,
    ...overrides,
  };
}

function makeAnatomyLink(overrides: Partial<AnatomyLink> = {}): AnatomyLink {
  return {
    conditionNodeId: 'condition:c1',
    anatomyNodeId: 'anatomy:a1',
    conditionLabel: 'Heart Failure',
    anatomyLabel: 'Heart',
    ...overrides,
  };
}

function makeDrugLink(overrides: Partial<DrugLink> = {}): DrugLink {
  return {
    drugNodeId: 'drug:d1',
    conditionNodeId: 'condition:c1',
    drugLabel: 'Metoprolol',
    conditionLabel: 'Heart Failure',
    ...overrides,
  };
}

function makeComplicationLink(overrides: Partial<ComplicationLink> = {}): ComplicationLink {
  return {
    sourceNodeId: 'condition:c1',
    targetNodeId: 'condition:c2',
    sourceLabel: 'Heart Failure',
    targetLabel: 'Pulmonary Edema',
    ...overrides,
  };
}

function makeParentChildLink(overrides: Partial<ParentChildLink> = {}): ParentChildLink {
  return {
    childNodeId: 'condition:child',
    parentNodeId: 'condition:parent',
    childLabel: 'Systolic HF',
    parentLabel: 'Heart Failure',
    ...overrides,
  };
}

// ─── CROSS_SYSTEM_PREREQUISITES constant ──────────────────────────────────────

describe('CROSS_SYSTEM_PREREQUISITES', () => {
  it('contains "Renal" depending on "Cardiovascular"', () => {
    expect(CROSS_SYSTEM_PREREQUISITES['Renal']).toContain('Cardiovascular');
  });

  it('contains "Endocrine" depending on "Renal"', () => {
    expect(CROSS_SYSTEM_PREREQUISITES['Endocrine']).toContain('Renal');
  });

  it('contains "Hematology" depending on "Cardiovascular" and "Renal"', () => {
    expect(CROSS_SYSTEM_PREREQUISITES['Hematology']).toContain('Cardiovascular');
    expect(CROSS_SYSTEM_PREREQUISITES['Hematology']).toContain('Renal');
  });

  it('has at least 6 systems defined', () => {
    expect(Object.keys(CROSS_SYSTEM_PREREQUISITES).length).toBeGreaterThanOrEqual(6);
  });
});

// ─── generateAnatomyPrerequisiteEdges ─────────────────────────────────────────

describe('generateAnatomyPrerequisiteEdges', () => {
  it('returns empty array for empty input', () => {
    expect(generateAnatomyPrerequisiteEdges([])).toHaveLength(0);
  });

  it('returns one edge per unique anatomy link', () => {
    const links = [makeAnatomyLink(), makeAnatomyLink({ anatomyNodeId: 'anatomy:a2', anatomyLabel: 'Lungs' })];
    expect(generateAnatomyPrerequisiteEdges(links)).toHaveLength(2);
  });

  it('deduplicates identical condition→anatomy pairs', () => {
    const link = makeAnatomyLink();
    expect(generateAnatomyPrerequisiteEdges([link, link])).toHaveLength(1);
  });

  it('skips links with empty conditionNodeId', () => {
    const invalid = makeAnatomyLink({ conditionNodeId: '' });
    expect(generateAnatomyPrerequisiteEdges([invalid])).toHaveLength(0);
  });

  it('skips links with empty anatomyNodeId', () => {
    const invalid = makeAnatomyLink({ anatomyNodeId: '' });
    expect(generateAnatomyPrerequisiteEdges([invalid])).toHaveLength(0);
  });

  it('edge has weight 0.8', () => {
    const edges = generateAnatomyPrerequisiteEdges([makeAnatomyLink()]);
    expect(edges[0]!.weight).toBe(0.8);
  });

  it('edge sourceId = conditionNodeId (condition requires anatomy)', () => {
    const link = makeAnatomyLink({ conditionNodeId: 'condition:hf', anatomyNodeId: 'anatomy:heart' });
    const edge = generateAnatomyPrerequisiteEdges([link])[0]!;
    expect(edge.sourceId).toBe('condition:hf');
    expect(edge.targetId).toBe('anatomy:heart');
  });

  it('edge id contains "prereq:anatomy:"', () => {
    const edge = generateAnatomyPrerequisiteEdges([makeAnatomyLink()])[0]!;
    expect(edge.id).toContain('prereq:anatomy:');
  });

  it('edge edgeType is "SEMANTIC"', () => {
    const edge = generateAnatomyPrerequisiteEdges([makeAnatomyLink()])[0]!;
    expect(edge.edgeType).toBe('SEMANTIC');
  });

  it('edge description mentions condition and anatomy labels', () => {
    const link = makeAnatomyLink({ conditionLabel: 'MI', anatomyLabel: 'Coronary Artery' });
    const edge = generateAnatomyPrerequisiteEdges([link])[0]!;
    expect(edge.description).toContain('MI');
    expect(edge.description).toContain('Coronary Artery');
  });
});

// ─── generateSystemFoundationalEdges ─────────────────────────────────────────

describe('generateSystemFoundationalEdges', () => {
  it('returns empty for empty conditions', () => {
    const nodeIds = new Map([['Cardiovascular', 'sys:cv']]);
    expect(generateSystemFoundationalEdges([], nodeIds)).toHaveLength(0);
  });

  it('returns empty when system code has no matching node', () => {
    const cond = makeCondition({ systemCodes: ['Cardiovascular'] });
    const nodeIds = new Map<string, string>(); // empty map
    expect(generateSystemFoundationalEdges([cond], nodeIds)).toHaveLength(0);
  });

  it('returns one edge per condition-system pair', () => {
    const cond = makeCondition({ systemCodes: ['Cardiovascular'] });
    const nodeIds = new Map([['Cardiovascular', 'sys:cv']]);
    const edges = generateSystemFoundationalEdges([cond], nodeIds);
    expect(edges).toHaveLength(1);
  });

  it('generates multiple edges for a condition with multiple systemCodes', () => {
    const cond = makeCondition({ systemCodes: ['Cardiovascular', 'Pulmonary'] });
    const nodeIds = new Map([['Cardiovascular', 'sys:cv'], ['Pulmonary', 'sys:pulm']]);
    const edges = generateSystemFoundationalEdges([cond], nodeIds);
    expect(edges).toHaveLength(2);
  });

  it('deduplicates same condition→system pair across conditions', () => {
    const c1 = makeCondition({ id: 'condition:c1', systemCodes: ['Cardiovascular'] });
    const c2 = makeCondition({ id: 'condition:c1', systemCodes: ['Cardiovascular'] });
    const nodeIds = new Map([['Cardiovascular', 'sys:cv']]);
    const edges = generateSystemFoundationalEdges([c1, c2], nodeIds);
    expect(edges).toHaveLength(1);
  });

  it('edge weight is 0.6', () => {
    const cond = makeCondition({ systemCodes: ['Cardiovascular'] });
    const nodeIds = new Map([['Cardiovascular', 'sys:cv']]);
    const edge = generateSystemFoundationalEdges([cond], nodeIds)[0]!;
    expect(edge.weight).toBe(0.6);
  });

  it('edge sourceId = condition id, targetId = system node', () => {
    const cond = makeCondition({ id: 'condition:hf', systemCodes: ['Cardiovascular'] });
    const nodeIds = new Map([['Cardiovascular', 'sys:cv']]);
    const edge = generateSystemFoundationalEdges([cond], nodeIds)[0]!;
    expect(edge.sourceId).toBe('condition:hf');
    expect(edge.targetId).toBe('sys:cv');
  });
});

// ─── generateDrugConditionEdges ───────────────────────────────────────────────

describe('generateDrugConditionEdges', () => {
  it('returns empty for empty input', () => {
    expect(generateDrugConditionEdges([])).toHaveLength(0);
  });

  it('skips links with empty drugNodeId', () => {
    expect(generateDrugConditionEdges([makeDrugLink({ drugNodeId: '' })])).toHaveLength(0);
  });

  it('skips links with empty conditionNodeId', () => {
    expect(generateDrugConditionEdges([makeDrugLink({ conditionNodeId: '' })])).toHaveLength(0);
  });

  it('deduplicates duplicate drug→condition pairs', () => {
    const link = makeDrugLink();
    expect(generateDrugConditionEdges([link, link])).toHaveLength(1);
  });

  it('edge weight is 0.85', () => {
    const edge = generateDrugConditionEdges([makeDrugLink()])[0]!;
    expect(edge.weight).toBe(0.85);
  });

  it('edge sourceId = drug, targetId = condition', () => {
    const link = makeDrugLink({ drugNodeId: 'drug:metoprolol', conditionNodeId: 'condition:hf' });
    const edge = generateDrugConditionEdges([link])[0]!;
    expect(edge.sourceId).toBe('drug:metoprolol');
    expect(edge.targetId).toBe('condition:hf');
  });

  it('edge id contains "prereq:drug:"', () => {
    const edge = generateDrugConditionEdges([makeDrugLink()])[0]!;
    expect(edge.id).toContain('prereq:drug:');
  });
});

// ─── generateParentChildEdges ─────────────────────────────────────────────────

describe('generateParentChildEdges', () => {
  it('returns empty for empty input', () => {
    expect(generateParentChildEdges([])).toHaveLength(0);
  });

  it('skips links with empty childNodeId or parentNodeId', () => {
    expect(generateParentChildEdges([makeParentChildLink({ childNodeId: '' })])).toHaveLength(0);
    expect(generateParentChildEdges([makeParentChildLink({ parentNodeId: '' })])).toHaveLength(0);
  });

  it('deduplicates identical child→parent pairs', () => {
    const link = makeParentChildLink();
    expect(generateParentChildEdges([link, link])).toHaveLength(1);
  });

  it('edge weight is 0.95 (strongest prerequisite)', () => {
    const edge = generateParentChildEdges([makeParentChildLink()])[0]!;
    expect(edge.weight).toBe(0.95);
  });

  it('edge sourceId = child, targetId = parent', () => {
    const link = makeParentChildLink({ childNodeId: 'condition:systolic_hf', parentNodeId: 'condition:hf' });
    const edge = generateParentChildEdges([link])[0]!;
    expect(edge.sourceId).toBe('condition:systolic_hf');
    expect(edge.targetId).toBe('condition:hf');
  });

  it('edge id contains "prereq:parent:"', () => {
    const edge = generateParentChildEdges([makeParentChildLink()])[0]!;
    expect(edge.id).toContain('prereq:parent:');
  });
});

// ─── generateComplicationChainEdges ───────────────────────────────────────────

describe('generateComplicationChainEdges', () => {
  it('returns empty for empty input', () => {
    expect(generateComplicationChainEdges([])).toHaveLength(0);
  });

  it('skips links with empty source or target', () => {
    expect(generateComplicationChainEdges([makeComplicationLink({ sourceNodeId: '' })])).toHaveLength(0);
    expect(generateComplicationChainEdges([makeComplicationLink({ targetNodeId: '' })])).toHaveLength(0);
  });

  it('deduplicates identical pairs', () => {
    const link = makeComplicationLink();
    expect(generateComplicationChainEdges([link, link])).toHaveLength(1);
  });

  it('edge weight is 0.7', () => {
    const edge = generateComplicationChainEdges([makeComplicationLink()])[0]!;
    expect(edge.weight).toBe(0.7);
  });

  it('direction: target→source (managing complication requires understanding source)', () => {
    // complication: HF → Pulmonary Edema
    // edge: Pulmonary Edema (target) requires HF (source)
    const link = makeComplicationLink({ sourceNodeId: 'condition:hf', targetNodeId: 'condition:pe' });
    const edge = generateComplicationChainEdges([link])[0]!;
    expect(edge.sourceId).toBe('condition:pe'); // target is the edge source
    expect(edge.targetId).toBe('condition:hf'); // source is the edge target
  });

  it('edge id contains "prereq:complication:"', () => {
    const edge = generateComplicationChainEdges([makeComplicationLink()])[0]!;
    expect(edge.id).toContain('prereq:complication:');
  });
});

// ─── generateCrossSystemEdges ─────────────────────────────────────────────────

describe('generateCrossSystemEdges', () => {
  it('returns empty for empty conditions', () => {
    const nodeIds = new Map([['Cardiovascular', 'sys:cv']]);
    expect(generateCrossSystemEdges([], nodeIds)).toHaveLength(0);
  });

  it('returns empty when system has no cross-system prerequisites in default map', () => {
    // 'Cardiovascular' is NOT a key in CROSS_SYSTEM_PREREQUISITES (it's a VALUE)
    const cond = makeCondition({ systemCodes: ['Cardiovascular'] });
    const nodeIds = new Map([['Cardiovascular', 'sys:cv']]);
    expect(generateCrossSystemEdges([cond], nodeIds)).toHaveLength(0);
  });

  it('generates edges for Renal conditions (depends on Cardiovascular)', () => {
    const renalCond = makeCondition({ id: 'condition:ckd', systemCodes: ['Renal'] });
    const nodeIds = new Map([['Renal', 'sys:renal'], ['Cardiovascular', 'sys:cv']]);
    const edges = generateCrossSystemEdges([renalCond], nodeIds);
    expect(edges.length).toBeGreaterThanOrEqual(1);
    const cvEdge = edges.find((e) => e.targetId === 'sys:cv');
    expect(cvEdge).toBeDefined();
    expect(cvEdge!.weight).toBe(0.5);
  });

  it('edge weight is 0.5', () => {
    const cond = makeCondition({ systemCodes: ['Renal'] });
    const nodeIds = new Map([['Renal', 'sys:renal'], ['Cardiovascular', 'sys:cv']]);
    const edges = generateCrossSystemEdges([cond], nodeIds);
    for (const edge of edges) {
      expect(edge.weight).toBe(0.5);
    }
  });

  it('deduplicates same condition→prereqSystem pairs', () => {
    const cond = makeCondition({ id: 'condition:c1', systemCodes: ['Renal'] });
    const nodeIds = new Map([['Renal', 'sys:renal'], ['Cardiovascular', 'sys:cv']]);
    // Two identical conditions → should produce same deduped edges
    const edges = generateCrossSystemEdges([cond, cond], nodeIds);
    // cond repeated → same condition:c1→sys:cv key → only 1 edge
    const cvEdges = edges.filter((e) => e.targetId === 'sys:cv');
    expect(cvEdges).toHaveLength(1);
  });

  it('uses custom crossSystemMap when provided', () => {
    const customMap = { TestSystem: ['OtherSystem'] };
    const cond = makeCondition({ systemCodes: ['TestSystem'] });
    const nodeIds = new Map([['OtherSystem', 'sys:other']]);
    const edges = generateCrossSystemEdges([cond], nodeIds, customMap);
    expect(edges).toHaveLength(1);
    expect(edges[0]!.targetId).toBe('sys:other');
  });

  it('edge id contains "prereq:crosssystem:"', () => {
    const cond = makeCondition({ systemCodes: ['Renal'] });
    const nodeIds = new Map([['Renal', 'sys:r'], ['Cardiovascular', 'sys:cv']]);
    const edges = generateCrossSystemEdges([cond], nodeIds);
    expect(edges[0]!.id).toContain('prereq:crosssystem:');
  });
});

// ─── collectAllPrerequisiteEdges ──────────────────────────────────────────────

describe('collectAllPrerequisiteEdges', () => {
  it('returns empty edges and zero byRule counts for empty params', () => {
    const result = collectAllPrerequisiteEdges({
      conditions: [],
      systemNodeIds: new Map(),
      anatomyLinks: [],
      drugLinks: [],
      complicationLinks: [],
      parentChildLinks: [],
    });
    expect(result.edges).toHaveLength(0);
    expect(result.byRule.anatomyPrerequisites).toBe(0);
    expect(result.byRule.systemFoundational).toBe(0);
    expect(result.byRule.drugCondition).toBe(0);
    expect(result.byRule.parentChild).toBe(0);
    expect(result.byRule.complicationChains).toBe(0);
    expect(result.byRule.crossSystem).toBe(0);
  });

  it('total edges = sum of all byRule counts', () => {
    const cond = makeCondition({ systemCodes: ['Renal'] });
    const nodeIds = new Map([['Renal', 'sys:r'], ['Cardiovascular', 'sys:cv']]);
    const result = collectAllPrerequisiteEdges({
      conditions: [cond],
      systemNodeIds: nodeIds,
      anatomyLinks: [makeAnatomyLink()],
      drugLinks: [makeDrugLink()],
      complicationLinks: [makeComplicationLink()],
      parentChildLinks: [makeParentChildLink()],
    });
    const byRuleTotal = Object.values(result.byRule).reduce((a, b) => a + b, 0);
    expect(result.edges.length).toBe(byRuleTotal);
  });

  it('byRule reflects correct counts per rule', () => {
    const result = collectAllPrerequisiteEdges({
      conditions: [],
      systemNodeIds: new Map(),
      anatomyLinks: [makeAnatomyLink(), makeAnatomyLink({ anatomyNodeId: 'a2' })],
      drugLinks: [makeDrugLink()],
      complicationLinks: [],
      parentChildLinks: [makeParentChildLink()],
    });
    expect(result.byRule.anatomyPrerequisites).toBe(2);
    expect(result.byRule.drugCondition).toBe(1);
    expect(result.byRule.complicationChains).toBe(0);
    expect(result.byRule.parentChild).toBe(1);
  });

  it('all edges have edgeType SEMANTIC', () => {
    const cond = makeCondition({ systemCodes: ['Renal'] });
    const nodeIds = new Map([['Renal', 'sys:r'], ['Cardiovascular', 'sys:cv']]);
    const result = collectAllPrerequisiteEdges({
      conditions: [cond],
      systemNodeIds: nodeIds,
      anatomyLinks: [makeAnatomyLink()],
      drugLinks: [makeDrugLink()],
      complicationLinks: [makeComplicationLink()],
      parentChildLinks: [makeParentChildLink()],
    });
    for (const edge of result.edges) {
      expect(edge.edgeType).toBe('SEMANTIC');
    }
  });

  it('all edges have evidenceCount = 1', () => {
    const result = collectAllPrerequisiteEdges({
      conditions: [],
      systemNodeIds: new Map(),
      anatomyLinks: [makeAnatomyLink()],
      drugLinks: [],
      complicationLinks: [],
      parentChildLinks: [],
    });
    for (const edge of result.edges) {
      expect(edge.evidenceCount).toBe(1);
    }
  });
});
