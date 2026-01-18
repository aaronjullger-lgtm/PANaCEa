/**
 * Knowledge Graph Service - Sprint 4
 *
 * Builds and traverses concept relationship graphs for intelligent learning paths.
 */

export interface ConceptNode {
  id: string;
  name: string;
  system: string;
  mastery: number;
  prerequisites: string[];
  relatedConcepts: string[];
  blockedBy: string[];
}

export interface KnowledgeEdge {
  from: string;
  to: string;
  type: 'prerequisite' | 'related' | 'differential' | 'complication';
  strength: number;
}

export interface LearningPath {
  nodes: string[];
  estimatedHours: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  unlocks: string[];
}

export interface KnowledgeGraph {
  nodes: Map<string, ConceptNode>;
  edges: KnowledgeEdge[];
}

export function buildKnowledgeGraph(
  concepts: { id: string; name: string; system: string; mastery: number }[],
  relationships: { from: string; to: string; type: KnowledgeEdge['type'] }[]
): KnowledgeGraph {
  const nodes = new Map<string, ConceptNode>();

  // Initialize nodes
  for (const c of concepts) {
    nodes.set(c.id, {
      id: c.id,
      name: c.name,
      system: c.system,
      mastery: c.mastery,
      prerequisites: [],
      relatedConcepts: [],
      blockedBy: [],
    });
  }

  // Build edges and update node relationships
  const edges: KnowledgeEdge[] = [];
  for (const rel of relationships) {
    const fromNode = nodes.get(rel.from);
    const toNode = nodes.get(rel.to);
    if (!fromNode || !toNode) continue;

    edges.push({ from: rel.from, to: rel.to, type: rel.type, strength: 1 });

    if (rel.type === 'prerequisite') {
      toNode.prerequisites.push(rel.from);
      if (fromNode.mastery < 70) {
        toNode.blockedBy.push(rel.from);
      }
    } else if (rel.type === 'related' || rel.type === 'differential') {
      fromNode.relatedConcepts.push(rel.to);
      toNode.relatedConcepts.push(rel.from);
    }
  }

  return { nodes, edges };
}

export function findOptimalLearningPath(
  graph: KnowledgeGraph,
  targetConceptId: string,
  currentMastery: Record<string, number>
): LearningPath {
  const path: string[] = [];
  const visited = new Set<string>();

  function collectPrerequisites(conceptId: string): void {
    if (visited.has(conceptId)) return;
    visited.add(conceptId);

    const node = graph.nodes.get(conceptId);
    if (!node) return;

    // First, collect all prerequisites recursively
    for (const prereq of node.prerequisites) {
      if ((currentMastery[prereq] || 0) < 70) {
        collectPrerequisites(prereq);
      }
    }

    // Then add this concept if not mastered
    if ((currentMastery[conceptId] || 0) < 70) {
      path.push(conceptId);
    }
  }

  collectPrerequisites(targetConceptId);

  // Calculate estimated hours (2 hours per concept on average)
  const estimatedHours = path.length * 2;

  // Determine difficulty
  const avgMastery =
    path.length > 0
      ? path.reduce((sum, id) => sum + (currentMastery[id] || 0), 0) / path.length
      : 50;
  const difficulty: LearningPath['difficulty'] =
    avgMastery < 30 ? 'beginner' : avgMastery < 60 ? 'intermediate' : 'advanced';

  // Find what this unlocks
  const unlocks: string[] = [];
  for (const [id, node] of graph.nodes) {
    if (node.blockedBy.includes(targetConceptId)) {
      unlocks.push(id);
    }
  }

  return { nodes: path, estimatedHours, difficulty, unlocks };
}

export function findKeystoneConcepts(
  graph: KnowledgeGraph,
  currentMastery: Record<string, number>
): { conceptId: string; conceptName: string; unlocksCount: number; priority: number }[] {
  const keystones: {
    conceptId: string;
    conceptName: string;
    unlocksCount: number;
    priority: number;
  }[] = [];

  for (const [id, node] of graph.nodes) {
    // Count how many concepts this one blocks
    let blocksCount = 0;
    for (const [, otherNode] of graph.nodes) {
      if (otherNode.blockedBy.includes(id)) blocksCount++;
    }

    // Only consider unmastered concepts that block others
    if (blocksCount > 0 && (currentMastery[id] || 0) < 70) {
      const priority = (blocksCount * (100 - (currentMastery[id] || 0))) / 100;
      keystones.push({
        conceptId: id,
        conceptName: node.name,
        unlocksCount: blocksCount,
        priority,
      });
    }
  }

  return keystones.sort((a, b) => b.priority - a.priority);
}

export function getRelatedConcepts(
  graph: KnowledgeGraph,
  conceptId: string,
  depth: number = 2
): { id: string; name: string; relationship: string; distance: number }[] {
  const related: { id: string; name: string; relationship: string; distance: number }[] = [];
  const visited = new Set<string>([conceptId]);
  const queue: { id: string; distance: number }[] = [{ id: conceptId, distance: 0 }];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.distance >= depth) continue;

    const node = graph.nodes.get(current.id);
    if (!node) continue;

    // Add related concepts
    for (const relatedId of node.relatedConcepts) {
      if (visited.has(relatedId)) continue;
      visited.add(relatedId);

      const relatedNode = graph.nodes.get(relatedId);
      if (relatedNode) {
        related.push({
          id: relatedId,
          name: relatedNode.name,
          relationship: 'related',
          distance: current.distance + 1,
        });
        queue.push({ id: relatedId, distance: current.distance + 1 });
      }
    }

    // Add prerequisites
    for (const prereqId of node.prerequisites) {
      if (visited.has(prereqId)) continue;
      visited.add(prereqId);

      const prereqNode = graph.nodes.get(prereqId);
      if (prereqNode) {
        related.push({
          id: prereqId,
          name: prereqNode.name,
          relationship: 'prerequisite',
          distance: current.distance + 1,
        });
        queue.push({ id: prereqId, distance: current.distance + 1 });
      }
    }
  }

  return related;
}
