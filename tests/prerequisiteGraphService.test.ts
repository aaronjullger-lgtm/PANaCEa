/**
 * Tests for prerequisiteGraphService — Clinical prerequisite edge generation
 *
 * @see lib/services/prerequisiteGraphService.ts
 */

import { describe, it, expect } from 'vitest';
import {
  generateAnatomyPrerequisiteEdges,
  generateSystemFoundationalEdges,
  generateDrugConditionEdges,
  generateParentChildEdges,
  generateComplicationChainEdges,
  generateCrossSystemEdges,
  collectAllPrerequisiteEdges,
  CROSS_SYSTEM_PREREQUISITES,
  type ConditionNode,
  type AnatomyLink,
  type DrugLink,
  type ComplicationLink,
  type ParentChildLink,
} from '../lib/services/prerequisiteGraphService';

// ─── Fixtures ────────────────────────────────────────────────────────

const CONDITION_CHF: ConditionNode = {
  id: 'condition:chf-001',
  sourceId: 'chf-001',
  label: 'Congestive Heart Failure',
  systemCodes: ['Cardiovascular'],
  metadata: null,
};

const CONDITION_CKD: ConditionNode = {
  id: 'condition:ckd-001',
  sourceId: 'ckd-001',
  label: 'Chronic Kidney Disease',
  systemCodes: ['Renal'],
  metadata: null,
};

const CONDITION_HF_SYSTOLIC: ConditionNode = {
  id: 'condition:hf-sys-001',
  sourceId: 'hf-sys-001',
  label: 'Systolic Heart Failure',
  systemCodes: ['Cardiovascular'],
  metadata: { parentId: 'chf-001' },
};

const CONDITION_DKA: ConditionNode = {
  id: 'condition:dka-001',
  sourceId: 'dka-001',
  label: 'Diabetic Ketoacidosis',
  systemCodes: ['Endocrine'],
  metadata: null,
};

const SYSTEM_NODE_IDS = new Map<string, string>([
  ['Cardiovascular', 'system:Cardiovascular'],
  ['Renal', 'system:Renal'],
  ['Endocrine', 'system:Endocrine'],
  ['Pulmonary', 'system:Pulmonary'],
  ['Neurology', 'system:Neurology'],
]);

// ─── Anatomy Prerequisites ───────────────────────────────────────────

describe('generateAnatomyPrerequisiteEdges', () => {
  it('creates SEMANTIC edges from condition → anatomy', () => {
    const links: AnatomyLink[] = [
      {
        conditionNodeId: 'condition:chf-001',
        anatomyNodeId: 'anatomy:heart-001',
        conditionLabel: 'Congestive Heart Failure',
        anatomyLabel: 'Heart',
      },
    ];

    const edges = generateAnatomyPrerequisiteEdges(links);
    expect(edges).toHaveLength(1);
    expect(edges[0].sourceId).toBe('condition:chf-001');
    expect(edges[0].targetId).toBe('anatomy:heart-001');
    expect(edges[0].edgeType).toBe('SEMANTIC');
    expect(edges[0].weight).toBe(0.8);
    expect(edges[0].metadata).toHaveProperty('rule', 'anatomy_prerequisite');
  });

  it('deduplicates identical links', () => {
    const links: AnatomyLink[] = [
      { conditionNodeId: 'c:1', anatomyNodeId: 'a:1', conditionLabel: 'C1', anatomyLabel: 'A1' },
      { conditionNodeId: 'c:1', anatomyNodeId: 'a:1', conditionLabel: 'C1', anatomyLabel: 'A1' },
    ];

    const edges = generateAnatomyPrerequisiteEdges(links);
    expect(edges).toHaveLength(1);
  });

  it('returns empty for no links', () => {
    expect(generateAnatomyPrerequisiteEdges([])).toHaveLength(0);
  });
});

// ─── System Foundational ─────────────────────────────────────────────

describe('generateSystemFoundationalEdges', () => {
  it('creates edges from condition → system node', () => {
    const edges = generateSystemFoundationalEdges([CONDITION_CHF], SYSTEM_NODE_IDS);
    expect(edges).toHaveLength(1);
    expect(edges[0].sourceId).toBe('condition:chf-001');
    expect(edges[0].targetId).toBe('system:Cardiovascular');
    expect(edges[0].weight).toBe(0.6);
    expect(edges[0].metadata).toHaveProperty('rule', 'system_foundational');
  });

  it('skips conditions with unknown system codes', () => {
    const cond: ConditionNode = {
      id: 'condition:x', sourceId: 'x', label: 'X',
      systemCodes: ['UnknownSystem'], metadata: null,
    };
    const edges = generateSystemFoundationalEdges([cond], SYSTEM_NODE_IDS);
    expect(edges).toHaveLength(0);
  });

  it('creates edges for all system codes on a condition', () => {
    const multiSystem: ConditionNode = {
      id: 'condition:multi', sourceId: 'multi', label: 'Multi',
      systemCodes: ['Cardiovascular', 'Renal'], metadata: null,
    };
    const edges = generateSystemFoundationalEdges([multiSystem], SYSTEM_NODE_IDS);
    expect(edges).toHaveLength(2);
  });
});

// ─── Drug-Condition ──────────────────────────────────────────────────

describe('generateDrugConditionEdges', () => {
  it('creates edges from drug → condition', () => {
    const links: DrugLink[] = [
      {
        drugNodeId: 'drug:lisinopril-001',
        conditionNodeId: 'condition:chf-001',
        drugLabel: 'Lisinopril',
        conditionLabel: 'Congestive Heart Failure',
      },
    ];

    const edges = generateDrugConditionEdges(links);
    expect(edges).toHaveLength(1);
    expect(edges[0].sourceId).toBe('drug:lisinopril-001');
    expect(edges[0].targetId).toBe('condition:chf-001');
    expect(edges[0].weight).toBe(0.85);
    expect(edges[0].metadata).toHaveProperty('rule', 'drug_condition');
  });

  it('deduplicates drug-condition pairs', () => {
    const links: DrugLink[] = [
      { drugNodeId: 'd:1', conditionNodeId: 'c:1', drugLabel: 'D', conditionLabel: 'C' },
      { drugNodeId: 'd:1', conditionNodeId: 'c:1', drugLabel: 'D', conditionLabel: 'C' },
    ];
    expect(generateDrugConditionEdges(links)).toHaveLength(1);
  });
});

// ─── Parent-Child ────────────────────────────────────────────────────

describe('generateParentChildEdges', () => {
  it('creates edges from child → parent', () => {
    const links: ParentChildLink[] = [
      {
        parentNodeId: 'condition:chf-001',
        childNodeId: 'condition:hf-sys-001',
        parentLabel: 'Heart Failure',
        childLabel: 'Systolic Heart Failure',
      },
    ];

    const edges = generateParentChildEdges(links);
    expect(edges).toHaveLength(1);
    expect(edges[0].sourceId).toBe('condition:hf-sys-001');
    expect(edges[0].targetId).toBe('condition:chf-001');
    expect(edges[0].weight).toBe(0.95);
    expect(edges[0].metadata).toHaveProperty('rule', 'parent_child');
  });
});

// ─── Complication Chains ─────────────────────────────────────────────

describe('generateComplicationChainEdges', () => {
  it('creates edges from complication target → source', () => {
    const links: ComplicationLink[] = [
      {
        sourceNodeId: 'condition:chf-001',
        targetNodeId: 'condition:ckd-001',
        sourceLabel: 'CHF',
        targetLabel: 'CKD',
      },
    ];

    const edges = generateComplicationChainEdges(links);
    expect(edges).toHaveLength(1);
    // Direction: target → source (managing CKD requires understanding CHF as complication source)
    expect(edges[0].sourceId).toBe('condition:ckd-001');
    expect(edges[0].targetId).toBe('condition:chf-001');
    expect(edges[0].weight).toBe(0.7);
    expect(edges[0].metadata).toHaveProperty('rule', 'complication_chain');
  });
});

// ─── Cross-System ────────────────────────────────────────────────────

describe('generateCrossSystemEdges', () => {
  it('creates cross-system prerequisite edges for Renal → Cardiovascular', () => {
    const edges = generateCrossSystemEdges([CONDITION_CKD], SYSTEM_NODE_IDS);
    expect(edges).toHaveLength(1);
    expect(edges[0].sourceId).toBe('condition:ckd-001');
    expect(edges[0].targetId).toBe('system:Cardiovascular');
    expect(edges[0].weight).toBe(0.5);
    expect(edges[0].metadata).toHaveProperty('rule', 'cross_system');
    expect(edges[0].metadata).toHaveProperty('sourceSystem', 'Renal');
    expect(edges[0].metadata).toHaveProperty('prerequisiteSystem', 'Cardiovascular');
  });

  it('creates multiple cross-system edges for Endocrine → Renal', () => {
    const edges = generateCrossSystemEdges([CONDITION_DKA], SYSTEM_NODE_IDS);
    expect(edges).toHaveLength(1);
    expect(edges[0].targetId).toBe('system:Renal');
  });

  it('skips conditions in systems without cross-dependencies', () => {
    const edges = generateCrossSystemEdges([CONDITION_CHF], SYSTEM_NODE_IDS);
    // Cardiovascular has no cross-system prerequisites defined
    expect(edges).toHaveLength(0);
  });

  it('supports custom cross-system map', () => {
    const customMap = { 'Cardiovascular': ['Pulmonary'] };
    const edges = generateCrossSystemEdges([CONDITION_CHF], SYSTEM_NODE_IDS, customMap);
    expect(edges).toHaveLength(1);
    expect(edges[0].targetId).toBe('system:Pulmonary');
  });
});

// ─── Cross-System Prerequisites Map ─────────────────────────────────

describe('CROSS_SYSTEM_PREREQUISITES', () => {
  it('contains clinically valid dependencies', () => {
    expect(CROSS_SYSTEM_PREREQUISITES['Renal']).toContain('Cardiovascular');
    expect(CROSS_SYSTEM_PREREQUISITES['Endocrine']).toContain('Renal');
    expect(CROSS_SYSTEM_PREREQUISITES['Hematology']).toContain('Cardiovascular');
    expect(CROSS_SYSTEM_PREREQUISITES['Emergency Medicine']).toContain('Cardiovascular');
  });

  it('does not have circular dependencies at depth 1', () => {
    for (const [system, prereqs] of Object.entries(CROSS_SYSTEM_PREREQUISITES)) {
      for (const prereq of prereqs) {
        const prereqDeps = CROSS_SYSTEM_PREREQUISITES[prereq] ?? [];
        // A system should not be a direct prerequisite of its own prerequisite
        expect(prereqDeps).not.toContain(system);
      }
    }
  });
});

// ─── collectAllPrerequisiteEdges ─────────────────────────────────────

describe('collectAllPrerequisiteEdges', () => {
  it('combines all rule outputs and counts correctly', () => {
    const anatomyLinks: AnatomyLink[] = [
      { conditionNodeId: 'c:1', anatomyNodeId: 'a:1', conditionLabel: 'C1', anatomyLabel: 'A1' },
    ];
    const drugLinks: DrugLink[] = [
      { drugNodeId: 'd:1', conditionNodeId: 'c:1', drugLabel: 'D1', conditionLabel: 'C1' },
    ];
    const parentChildLinks: ParentChildLink[] = [
      { parentNodeId: 'c:1', childNodeId: 'c:2', parentLabel: 'C1', childLabel: 'C2' },
    ];
    const complicationLinks: ComplicationLink[] = [];

    const conditions: ConditionNode[] = [
      { id: 'c:1', sourceId: '1', label: 'C1', systemCodes: ['Cardiovascular'], metadata: null },
    ];

    const { edges, byRule } = collectAllPrerequisiteEdges({
      conditions,
      systemNodeIds: SYSTEM_NODE_IDS,
      anatomyLinks,
      drugLinks,
      complicationLinks,
      parentChildLinks,
    });

    expect(byRule.anatomyPrerequisites).toBe(1);
    expect(byRule.drugCondition).toBe(1);
    expect(byRule.parentChild).toBe(1);
    expect(byRule.systemFoundational).toBe(1);
    expect(byRule.complicationChains).toBe(0);
    expect(byRule.crossSystem).toBe(0); // Cardiovascular has no cross-system prereqs

    const totalFromRules = Object.values(byRule).reduce((a, b) => a + b, 0);
    expect(edges).toHaveLength(totalFromRules);
  });

  it('returns empty for empty input', () => {
    const { edges, byRule } = collectAllPrerequisiteEdges({
      conditions: [],
      systemNodeIds: new Map(),
      anatomyLinks: [],
      drugLinks: [],
      complicationLinks: [],
      parentChildLinks: [],
    });

    expect(edges).toHaveLength(0);
    expect(Object.values(byRule).every((v) => v === 0)).toBe(true);
  });

  it('all edges have SEMANTIC edgeType', () => {
    const { edges } = collectAllPrerequisiteEdges({
      conditions: [CONDITION_CKD],
      systemNodeIds: SYSTEM_NODE_IDS,
      anatomyLinks: [
        { conditionNodeId: 'condition:ckd-001', anatomyNodeId: 'a:kidney', conditionLabel: 'CKD', anatomyLabel: 'Kidney' },
      ],
      drugLinks: [],
      complicationLinks: [],
      parentChildLinks: [],
    });

    for (const edge of edges) {
      expect(edge.edgeType).toBe('SEMANTIC');
    }
  });

  it('all edges have generatedBy metadata', () => {
    const { edges } = collectAllPrerequisiteEdges({
      conditions: [CONDITION_CHF],
      systemNodeIds: SYSTEM_NODE_IDS,
      anatomyLinks: [],
      drugLinks: [],
      complicationLinks: [],
      parentChildLinks: [],
    });

    for (const edge of edges) {
      expect(edge.metadata).toHaveProperty('generatedBy', 'prerequisiteGraphService');
    }
  });

  it('edge weights follow expected hierarchy: parent > drug > anatomy > complication > system > cross-system', () => {
    // Verify the weight constants are properly ordered
    const parentEdges = generateParentChildEdges([
      { parentNodeId: 'p', childNodeId: 'c', parentLabel: 'P', childLabel: 'C' },
    ]);
    const drugEdges = generateDrugConditionEdges([
      { drugNodeId: 'd', conditionNodeId: 'c', drugLabel: 'D', conditionLabel: 'C' },
    ]);
    const anatomyEdges = generateAnatomyPrerequisiteEdges([
      { conditionNodeId: 'c', anatomyNodeId: 'a', conditionLabel: 'C', anatomyLabel: 'A' },
    ]);
    const complicationEdges = generateComplicationChainEdges([
      { sourceNodeId: 's', targetNodeId: 't', sourceLabel: 'S', targetLabel: 'T' },
    ]);
    const systemEdges = generateSystemFoundationalEdges(
      [{ id: 'c', sourceId: 'x', label: 'C', systemCodes: ['Renal'], metadata: null }],
      SYSTEM_NODE_IDS
    );
    const crossEdges = generateCrossSystemEdges(
      [{ id: 'c', sourceId: 'x', label: 'C', systemCodes: ['Renal'], metadata: null }],
      SYSTEM_NODE_IDS
    );

    expect(parentEdges[0].weight).toBeGreaterThan(drugEdges[0].weight!);
    expect(drugEdges[0].weight).toBeGreaterThan(anatomyEdges[0].weight!);
    expect(anatomyEdges[0].weight).toBeGreaterThan(complicationEdges[0].weight!);
    expect(complicationEdges[0].weight).toBeGreaterThan(systemEdges[0].weight!);
    expect(systemEdges[0].weight).toBeGreaterThan(crossEdges[0].weight!);
  });
});
