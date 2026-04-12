/**
 * Prerequisite Knowledge Graph Population Service
 *
 * Generates SEMANTIC prerequisite edges in the knowledge graph by analyzing
 * existing clinical relationships. These edges encode "to understand X, you
 * must first understand Y" relationships that power:
 *   - Error-driven prerequisite remediation (prerequisiteRemediationService)
 *   - FIRe-style implicit review compression
 *   - Contextual item selection
 *
 * Edge generation rules (deterministic, no AI required):
 *   1. Anatomy prerequisites — conditions linked to anatomy structures
 *   2. System foundational — conditions require their organ system node
 *   3. Drug-condition — understanding drug mechanism requires the condition
 *   4. Parent-child hierarchy — child conditions require parent understanding
 *   5. Pathophysiology chains — complication targets require source condition
 *   6. Cross-system bridges — conditions with cross-system dependencies
 *
 * All generated edges use edgeType = SEMANTIC, which the prerequisite
 * remediation CTE traverses alongside HIERARCHICAL edges.
 *
 * Research basis:
 *   - Skycak (2023, Math Academy): FIRe — Fractional Implicit Repetition
 *   - Piech et al. (2015, Stanford): Deep Knowledge Tracing
 *   - Research Report 3: prerequisite knowledge graph for review compression
 *
 * @see lib/services/prerequisiteRemediationService.ts — Consumes these edges
 * @see services/graph/GraphBuilder.ts — Builds base nodes and HIERARCHICAL edges
 * @see services/graph/RelationshipExtractor.ts — Builds DIFFERENTIAL/COMPLICATES edges
 * @module lib/services/prerequisiteGraphService
 */

import type { GraphEdgeData } from '@/services/graph/types';

// ─── Types ───────────────────────────────────────────────────────────────

export interface PrerequisitePopulationResult {
  /** Total prerequisite edges created or updated */
  edgesUpserted: number;
  /** Breakdown by rule */
  byRule: {
    anatomyPrerequisites: number;
    systemFoundational: number;
    drugCondition: number;
    parentChild: number;
    complicationChains: number;
    crossSystem: number;
  };
  /** Duration in ms */
  durationMs: number;
  /** Errors encountered (non-fatal) */
  errors: string[];
}

export interface ConditionNode {
  id: string;          // GraphNode.id (e.g., "condition:abc123")
  sourceId: string;    // MedicalContent.conditionId
  label: string;
  systemCodes: string[];
  metadata: Record<string, unknown> | null;
}

export interface AnatomyLink {
  conditionNodeId: string;
  anatomyNodeId: string;
  conditionLabel: string;
  anatomyLabel: string;
}

export interface DrugLink {
  drugNodeId: string;
  conditionNodeId: string;
  drugLabel: string;
  conditionLabel: string;
}

export interface ComplicationLink {
  sourceNodeId: string;
  targetNodeId: string;
  sourceLabel: string;
  targetLabel: string;
}

export interface ParentChildLink {
  parentNodeId: string;
  childNodeId: string;
  parentLabel: string;
  childLabel: string;
}

// ─── Cross-System Dependency Map ─────────────────────────────────────────

/**
 * Clinical cross-system dependencies where understanding one system
 * is prerequisite to understanding conditions in another.
 *
 * Key: target system (the system whose conditions need prerequisites)
 * Value: array of prerequisite systems
 *
 * Example: Renal conditions often require Cardiovascular understanding
 * (cardiorenal syndrome, renal perfusion, etc.)
 */
export const CROSS_SYSTEM_PREREQUISITES: Record<string, string[]> = {
  'Renal': ['Cardiovascular'],
  'Endocrine': ['Renal'],
  'Hematology': ['Cardiovascular', 'Renal'],
  'Infectious Disease': ['Hematology'],
  'Obstetrics & Gynecology': ['Endocrine', 'Cardiovascular'],
  'Emergency Medicine': ['Cardiovascular', 'Pulmonary', 'Neurology'],
};

// ─── Edge Generation Functions ───────────────────────────────────────────

/**
 * Generate anatomy prerequisite edges.
 *
 * Rule: If a condition is linked to anatomy structures, understanding
 * that anatomy is a prerequisite for understanding the condition.
 * Direction: condition → anatomy (condition requires anatomy knowledge)
 *
 * Weight: 0.8 (strong prerequisite — anatomy is foundational)
 */
export function generateAnatomyPrerequisiteEdges(
  links: ReadonlyArray<AnatomyLink>
): GraphEdgeData[] {
  const edges: GraphEdgeData[] = [];
  const seen = new Set<string>();

  for (const link of links) {
    const key = `${link.conditionNodeId}→${link.anatomyNodeId}`;
    if (seen.has(key)) continue;
    seen.add(key);

    edges.push({
      id: `prereq:anatomy:${link.conditionNodeId}->${link.anatomyNodeId}`,
      sourceId: link.conditionNodeId,
      targetId: link.anatomyNodeId,
      edgeType: 'SEMANTIC' as GraphEdgeData['edgeType'],
      weight: 0.8,
      description: `${link.conditionLabel} requires knowledge of ${link.anatomyLabel}`,
      evidenceCount: 1,
      metadata: { rule: 'anatomy_prerequisite', generatedBy: 'prerequisiteGraphService' },
    });
  }

  return edges;
}

/**
 * Generate system foundational edges.
 *
 * Rule: Every condition has a prerequisite relationship with its
 * organ system node. Understanding the system is foundational.
 * Direction: condition → system (condition requires system knowledge)
 *
 * Weight: 0.6 (moderate — system is broad context, not specific prerequisite)
 */
export function generateSystemFoundationalEdges(
  conditions: ReadonlyArray<ConditionNode>,
  systemNodeIds: ReadonlyMap<string, string>
): GraphEdgeData[] {
  const edges: GraphEdgeData[] = [];
  const seen = new Set<string>();

  for (const cond of conditions) {
    for (const systemCode of cond.systemCodes) {
      const systemNodeId = systemNodeIds.get(systemCode);
      if (!systemNodeId) continue;

      const key = `${cond.id}→${systemNodeId}`;
      if (seen.has(key)) continue;
      seen.add(key);

      edges.push({
        id: `prereq:system:${cond.id}->${systemNodeId}`,
        sourceId: cond.id,
        targetId: systemNodeId,
        edgeType: 'SEMANTIC' as GraphEdgeData['edgeType'],
        weight: 0.6,
        description: `${cond.label} requires foundational ${systemCode} knowledge`,
        evidenceCount: 1,
        metadata: { rule: 'system_foundational', generatedBy: 'prerequisiteGraphService' },
      });
    }
  }

  return edges;
}

/**
 * Generate drug-condition prerequisite edges.
 *
 * Rule: Understanding a drug's mechanism requires understanding
 * the condition it treats. When studying pharmacology, the disease
 * pathophysiology is the prerequisite.
 * Direction: drug → condition (drug requires condition knowledge)
 *
 * Weight: 0.85 (strong — can't understand drug mechanism without disease context)
 */
export function generateDrugConditionEdges(
  links: ReadonlyArray<DrugLink>
): GraphEdgeData[] {
  const edges: GraphEdgeData[] = [];
  const seen = new Set<string>();

  for (const link of links) {
    const key = `${link.drugNodeId}→${link.conditionNodeId}`;
    if (seen.has(key)) continue;
    seen.add(key);

    edges.push({
      id: `prereq:drug:${link.drugNodeId}->${link.conditionNodeId}`,
      sourceId: link.drugNodeId,
      targetId: link.conditionNodeId,
      edgeType: 'SEMANTIC' as GraphEdgeData['edgeType'],
      weight: 0.85,
      description: `${link.drugLabel} requires understanding of ${link.conditionLabel}`,
      evidenceCount: 1,
      metadata: { rule: 'drug_condition', generatedBy: 'prerequisiteGraphService' },
    });
  }

  return edges;
}

/**
 * Generate parent-child prerequisite edges.
 *
 * Rule: Child conditions (e.g., "Systolic HF") require understanding
 * of the parent condition (e.g., "Heart Failure"). This supplements
 * the HIERARCHICAL edges from GraphBuilder with SEMANTIC edges
 * the remediation CTE also traverses.
 * Direction: child → parent (child requires parent knowledge)
 *
 * Weight: 0.95 (very strong — direct conceptual dependency)
 */
export function generateParentChildEdges(
  links: ReadonlyArray<ParentChildLink>
): GraphEdgeData[] {
  const edges: GraphEdgeData[] = [];
  const seen = new Set<string>();

  for (const link of links) {
    const key = `${link.childNodeId}→${link.parentNodeId}`;
    if (seen.has(key)) continue;
    seen.add(key);

    edges.push({
      id: `prereq:parent:${link.childNodeId}->${link.parentNodeId}`,
      sourceId: link.childNodeId,
      targetId: link.parentNodeId,
      edgeType: 'SEMANTIC' as GraphEdgeData['edgeType'],
      weight: 0.95,
      description: `${link.childLabel} requires understanding of ${link.parentLabel}`,
      evidenceCount: 1,
      metadata: { rule: 'parent_child', generatedBy: 'prerequisiteGraphService' },
    });
  }

  return edges;
}

/**
 * Generate complication chain prerequisite edges.
 *
 * Rule: If condition A complicates condition B, then understanding
 * condition A is a prerequisite for understanding B's complications
 * and management. Direction: target → source (managing the complicated
 * condition requires understanding the complication source)
 *
 * Weight: 0.7 (moderate-strong — complications are important but not
 * foundational prerequisites)
 */
export function generateComplicationChainEdges(
  links: ReadonlyArray<ComplicationLink>
): GraphEdgeData[] {
  const edges: GraphEdgeData[] = [];
  const seen = new Set<string>();

  for (const link of links) {
    const key = `${link.targetNodeId}→${link.sourceNodeId}`;
    if (seen.has(key)) continue;
    seen.add(key);

    edges.push({
      id: `prereq:complication:${link.targetNodeId}->${link.sourceNodeId}`,
      sourceId: link.targetNodeId,
      targetId: link.sourceNodeId,
      edgeType: 'SEMANTIC' as GraphEdgeData['edgeType'],
      weight: 0.7,
      description: `Managing ${link.targetLabel} requires understanding ${link.sourceLabel} as complication source`,
      evidenceCount: 1,
      metadata: { rule: 'complication_chain', generatedBy: 'prerequisiteGraphService' },
    });
  }

  return edges;
}

/**
 * Generate cross-system bridge edges.
 *
 * Rule: Certain organ systems have clinical cross-dependencies.
 * Conditions in the target system require foundational knowledge
 * of the prerequisite system.
 * Direction: target system condition → prerequisite system node
 *
 * Weight: 0.5 (moderate — broad cross-system context)
 */
export function generateCrossSystemEdges(
  conditions: ReadonlyArray<ConditionNode>,
  systemNodeIds: ReadonlyMap<string, string>,
  crossSystemMap: Record<string, string[]> = CROSS_SYSTEM_PREREQUISITES
): GraphEdgeData[] {
  const edges: GraphEdgeData[] = [];
  const seen = new Set<string>();

  for (const cond of conditions) {
    for (const systemCode of cond.systemCodes) {
      const prereqSystems = crossSystemMap[systemCode];
      if (!prereqSystems) continue;

      for (const prereqSystem of prereqSystems) {
        const prereqNodeId = systemNodeIds.get(prereqSystem);
        if (!prereqNodeId) continue;

        const key = `${cond.id}→${prereqNodeId}`;
        if (seen.has(key)) continue;
        seen.add(key);

        edges.push({
          id: `prereq:crosssystem:${cond.id}->${prereqNodeId}`,
          sourceId: cond.id,
          targetId: prereqNodeId,
          edgeType: 'SEMANTIC' as GraphEdgeData['edgeType'],
          weight: 0.5,
          description: `${cond.label} (${systemCode}) has cross-system dependency on ${prereqSystem}`,
          evidenceCount: 1,
          metadata: {
            rule: 'cross_system',
            sourceSystem: systemCode,
            prerequisiteSystem: prereqSystem,
            generatedBy: 'prerequisiteGraphService',
          },
        });
      }
    }
  }

  return edges;
}

// ─── Orchestrator ────────────────────────────────────────────────────────

/**
 * Collect all prerequisite edges from all rules.
 *
 * This is a pure function that takes pre-fetched data and returns
 * the edges to upsert. The Edge API endpoint handles database queries
 * and upsert operations.
 */
export function collectAllPrerequisiteEdges(params: {
  conditions: ReadonlyArray<ConditionNode>;
  systemNodeIds: ReadonlyMap<string, string>;
  anatomyLinks: ReadonlyArray<AnatomyLink>;
  drugLinks: ReadonlyArray<DrugLink>;
  complicationLinks: ReadonlyArray<ComplicationLink>;
  parentChildLinks: ReadonlyArray<ParentChildLink>;
}): { edges: GraphEdgeData[]; byRule: PrerequisitePopulationResult['byRule'] } {
  const anatomyEdges = generateAnatomyPrerequisiteEdges(params.anatomyLinks);
  const systemEdges = generateSystemFoundationalEdges(params.conditions, params.systemNodeIds);
  const drugEdges = generateDrugConditionEdges(params.drugLinks);
  const parentChildEdges = generateParentChildEdges(params.parentChildLinks);
  const complicationEdges = generateComplicationChainEdges(params.complicationLinks);
  const crossSystemEdges = generateCrossSystemEdges(params.conditions, params.systemNodeIds);

  const allEdges = [
    ...anatomyEdges,
    ...systemEdges,
    ...drugEdges,
    ...parentChildEdges,
    ...complicationEdges,
    ...crossSystemEdges,
  ];

  return {
    edges: allEdges,
    byRule: {
      anatomyPrerequisites: anatomyEdges.length,
      systemFoundational: systemEdges.length,
      drugCondition: drugEdges.length,
      parentChild: parentChildEdges.length,
      complicationChains: complicationEdges.length,
      crossSystem: crossSystemEdges.length,
    },
  };
}
