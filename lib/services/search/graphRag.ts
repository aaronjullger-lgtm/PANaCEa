/**
 * GraphRAG — Knowledge Graph Traversal for Clinical Retrieval
 *
 * Leverages PANaCEa's existing GraphNode/GraphEdge schema to enhance
 * retrieval for relationship-heavy queries:
 * - Differential diagnosis ("what else could this be?")
 * - Drug interactions ("does X interact with Y?")
 * - Causal chains ("what causes X?")
 * - Treatment pathways ("what treats X?")
 *
 * Combines graph traversal with vector similarity for hybrid GraphRAG.
 * Uses Prisma queries against PostgreSQL — no Neo4j needed.
 *
 * @module lib/services/search/graphRag
 */

// ─── Types ─────────────────────────────────────────────────────────────────

export type NodeType =
  | 'CONDITION' | 'FINDING' | 'DRUG' | 'PROCEDURE'
  | 'SYSTEM' | 'ANATOMY' | 'LAB_TEST' | 'IMAGING'
  | 'VITAL_SIGN' | 'OTHER';

export type EdgeType =
  | 'HIERARCHICAL' | 'CO_OCCURRENCE' | 'SEMANTIC' | 'EXPLICIT'
  | 'ASSOCIATED' | 'TREATS' | 'CAUSES' | 'MANIFESTS'
  | 'DIFFERENTIAL' | 'COMPLICATES';

export interface GraphSearchResult {
  nodes: GraphNodeResult[];
  edges: GraphEdgeResult[];
  paths: GraphPath[];
  queryType: 'ddx' | 'drug_interaction' | 'causal' | 'treatment' | 'general';
}

export interface GraphNodeResult {
  id: string;
  nodeType: NodeType;
  label: string;
  description?: string;
  sourceType: string;
  sourceId: string;
  relevance: number;  // 0-1
}

export interface GraphEdgeResult {
  sourceLabel: string;
  targetLabel: string;
  edgeType: EdgeType;
  weight: number;
  description?: string;
}

export interface GraphPath {
  nodes: string[];   // labels
  edges: string[];   // edge types
  totalWeight: number;
}

export interface TraversalOptions {
  maxDepth?: number;      // Default: 2
  maxResults?: number;    // Default: 20
  edgeTypes?: EdgeType[]; // Filter to specific edge types
  nodeTypes?: NodeType[]; // Filter to specific node types
  minWeight?: number;     // Default: 0.1
}

// ─── Query Classification ──────────────────────────────────────────────────

const DDX_PATTERNS = /\b(differential|ddx|rule\s*out|distinguish|differentiate|vs\.?|versus)\b/i;
const DRUG_INTERACTION_PATTERNS = /\b(interact\w*|contraindic\w*|combine|concomitant|co-administ\w*|drug.+drug)\b/i;
const CAUSAL_PATTERNS = /\b(cause[sd]?|etiology|pathogenesis|leads?\s+to|results?\s+in|mechanism\w*)\b/i;
const TREATMENT_PATTERNS = /\b(treat|therap|manage|first[- ]line|prescribe|medication|drug\s+of\s+choice)\b/i;

/**
 * Classify query intent for graph traversal strategy.
 */
export function classifyGraphQuery(query: string): GraphSearchResult['queryType'] {
  if (DDX_PATTERNS.test(query)) return 'ddx';
  if (DRUG_INTERACTION_PATTERNS.test(query)) return 'drug_interaction';
  if (CAUSAL_PATTERNS.test(query)) return 'causal';
  if (TREATMENT_PATTERNS.test(query)) return 'treatment';
  return 'general';
}

/**
 * Get the relevant edge types for each query type.
 */
export function getEdgeTypesForQuery(queryType: GraphSearchResult['queryType']): EdgeType[] {
  switch (queryType) {
    case 'ddx':
      return ['DIFFERENTIAL', 'MANIFESTS', 'CO_OCCURRENCE', 'ASSOCIATED'];
    case 'drug_interaction':
      return ['TREATS', 'COMPLICATES', 'ASSOCIATED', 'CO_OCCURRENCE'];
    case 'causal':
      return ['CAUSES', 'COMPLICATES', 'MANIFESTS', 'HIERARCHICAL'];
    case 'treatment':
      return ['TREATS', 'ASSOCIATED', 'HIERARCHICAL'];
    case 'general':
      return ['HIERARCHICAL', 'ASSOCIATED', 'SEMANTIC', 'CO_OCCURRENCE', 'TREATS', 'CAUSES', 'MANIFESTS', 'DIFFERENTIAL', 'COMPLICATES'];
  }
}

// ─── Graph Traversal (Prisma-based) ──────────────────────────────────────

/** Minimal Prisma client interface for graph queries */
interface PrismaGraphClient {
  graphNode: {
    findMany: (args: Record<string, unknown>) => Promise<Array<{
      id: string;
      nodeType: string;
      label: string;
      description: string | null;
      sourceType: string;
      sourceId: string;
      outgoingEdges: Array<{
        edgeType: string;
        weight: number | null;
        description: string | null;
        target: { id: string; nodeType: string; label: string; description: string | null; sourceType: string; sourceId: string };
      }>;
      incomingEdges: Array<{
        edgeType: string;
        weight: number | null;
        description: string | null;
        source: { id: string; nodeType: string; label: string; description: string | null; sourceType: string; sourceId: string };
      }>;
    }>>;
  };
}

/**
 * Find seed nodes matching a query term.
 */
export async function findSeedNodes(
  prisma: PrismaGraphClient,
  query: string,
  options?: { nodeTypes?: NodeType[]; limit?: number }
): Promise<GraphNodeResult[]> {
  const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);

  const where: Record<string, unknown> = {
    OR: [
      { label: { contains: query, mode: 'insensitive' } },
      ...terms.slice(0, 5).map((term) => ({
        label: { contains: term, mode: 'insensitive' },
      })),
    ],
  };

  if (options?.nodeTypes?.length) {
    where.nodeType = { in: options.nodeTypes };
  }

  const nodes = await prisma.graphNode.findMany({
    where,
    take: options?.limit ?? 10,
    include: {
      outgoingEdges: { select: { edgeType: true } },
      incomingEdges: { select: { edgeType: true } },
    },
  });

  return (nodes as Array<{
    id: string;
    nodeType: string;
    label: string;
    description: string | null;
    sourceType: string;
    sourceId: string;
    outgoingEdges: Array<{ edgeType: string }>;
    incomingEdges: Array<{ edgeType: string }>;
  }>).map((n) => {
    // Compute relevance based on label match quality
    const labelLower = n.label.toLowerCase();
    const queryLower = query.toLowerCase();
    const exactMatch = labelLower === queryLower ? 1.0 : 0;
    const containsMatch = labelLower.includes(queryLower) ? 0.8 : 0;
    const termOverlap = terms.filter((t) => labelLower.includes(t)).length / Math.max(terms.length, 1) * 0.6;
    const connectionBoost = Math.min((n.outgoingEdges.length + n.incomingEdges.length) / 20, 0.2);

    return {
      id: n.id,
      nodeType: n.nodeType as NodeType,
      label: n.label,
      description: n.description ?? undefined,
      sourceType: n.sourceType,
      sourceId: n.sourceId,
      relevance: Math.min(exactMatch || containsMatch || termOverlap + connectionBoost, 1),
    };
  });
}

/**
 * Traverse the knowledge graph from seed nodes, following specified edge types.
 * BFS traversal with depth limiting and weight-based pruning.
 */
export async function traverseGraph(
  prisma: PrismaGraphClient,
  seedNodeIds: string[],
  options: TraversalOptions = {}
): Promise<{ nodes: GraphNodeResult[]; edges: GraphEdgeResult[]; paths: GraphPath[] }> {
  const { maxDepth = 2, maxResults = 20, edgeTypes, nodeTypes, minWeight = 0.1 } = options;

  const visited = new Set<string>();
  const resultNodes: Map<string, GraphNodeResult> = new Map();
  const resultEdges: GraphEdgeResult[] = [];
  const paths: GraphPath[] = [];

  // BFS queue: [nodeId, depth, pathLabels, pathEdgeTypes, totalWeight]
  type QueueItem = [string, number, string[], string[], number];
  const queue: QueueItem[] = seedNodeIds.map((id) => [id, 0, [], [], 1.0]);

  while (queue.length > 0 && resultNodes.size < maxResults) {
    const [nodeId, depth, pathLabels, pathEdgeTypes, pathWeight] = queue.shift()!;

    if (visited.has(nodeId) || depth > maxDepth) continue;
    visited.add(nodeId);

    // Fetch node with edges
    const edgeFilter: Record<string, unknown> = {};
    if (edgeTypes?.length) edgeFilter.edgeType = { in: edgeTypes };
    if (minWeight > 0) edgeFilter.weight = { gte: minWeight };

    const nodes = await prisma.graphNode.findMany({
      where: { id: nodeId },
      include: {
        outgoingEdges: {
          where: edgeFilter,
          include: { target: true },
          orderBy: { weight: 'desc' },
          take: 10,
        },
        incomingEdges: {
          where: edgeFilter,
          include: { source: true },
          orderBy: { weight: 'desc' },
          take: 10,
        },
      },
    });

    const node = nodes[0];
    if (!node) continue;

    // Filter by node types if specified
    if (nodeTypes?.length && !nodeTypes.includes(node.nodeType as NodeType)) continue;

    const nodeResult: GraphNodeResult = {
      id: node.id,
      nodeType: node.nodeType as NodeType,
      label: node.label,
      description: node.description ?? undefined,
      sourceType: node.sourceType,
      sourceId: node.sourceId,
      relevance: Math.max(1 - depth * 0.3, 0.1),
    };
    resultNodes.set(node.id, nodeResult);

    const currentPath = [...pathLabels, node.label];

    // Process outgoing edges
    for (const edge of node.outgoingEdges) {
      const edgeResult: GraphEdgeResult = {
        sourceLabel: node.label,
        targetLabel: edge.target.label,
        edgeType: edge.edgeType as EdgeType,
        weight: edge.weight ?? 1.0,
        description: edge.description ?? undefined,
      };
      resultEdges.push(edgeResult);

      const newWeight = pathWeight * (edge.weight ?? 1.0);
      const newPathEdges = [...pathEdgeTypes, edge.edgeType];

      if (!visited.has(edge.target.id)) {
        queue.push([edge.target.id, depth + 1, currentPath, newPathEdges, newWeight]);
      }

      // Record path if it reaches another node
      if (currentPath.length >= 2) {
        paths.push({
          nodes: [...currentPath, edge.target.label],
          edges: newPathEdges,
          totalWeight: newWeight,
        });
      }
    }

    // Process incoming edges (reverse traversal)
    for (const edge of node.incomingEdges) {
      const edgeResult: GraphEdgeResult = {
        sourceLabel: edge.source.label,
        targetLabel: node.label,
        edgeType: edge.edgeType as EdgeType,
        weight: edge.weight ?? 1.0,
        description: edge.description ?? undefined,
      };
      resultEdges.push(edgeResult);

      if (!visited.has(edge.source.id)) {
        queue.push([edge.source.id, depth + 1, currentPath, [...pathEdgeTypes, edge.edgeType], pathWeight * (edge.weight ?? 1.0)]);
      }
    }
  }

  // Sort paths by total weight
  paths.sort((a, b) => b.totalWeight - a.totalWeight);

  return {
    nodes: [...resultNodes.values()],
    edges: resultEdges,
    paths: paths.slice(0, 10),
  };
}

// ─── High-Level Query Functions ──────────────────────────────────────────

/**
 * Full GraphRAG query: classify → seed → traverse → format.
 *
 * @example
 * ```ts
 * const result = await graphRAGQuery(prisma, 'differential diagnosis for chest pain');
 * // { queryType: 'ddx', nodes: [...], edges: [...], paths: [...] }
 * ```
 */
export async function graphRAGQuery(
  prisma: PrismaGraphClient,
  query: string,
  options?: TraversalOptions
): Promise<GraphSearchResult> {
  const queryType = classifyGraphQuery(query);
  const edgeTypes = options?.edgeTypes ?? getEdgeTypesForQuery(queryType);

  // Determine seed node types based on query type
  const seedNodeTypes: NodeType[] | undefined =
    queryType === 'drug_interaction' ? ['DRUG'] :
    queryType === 'ddx' ? ['CONDITION', 'FINDING'] :
    queryType === 'treatment' ? ['CONDITION', 'DRUG'] :
    undefined;

  const seeds = await findSeedNodes(prisma, query, { nodeTypes: seedNodeTypes });

  if (seeds.length === 0) {
    return { nodes: [], edges: [], paths: [], queryType };
  }

  const seedIds = seeds.slice(0, 3).map((s) => s.id); // Top 3 seeds
  const traversal = await traverseGraph(prisma, seedIds, {
    ...options,
    edgeTypes,
  });

  return {
    ...traversal,
    queryType,
  };
}

/**
 * Build a natural language context string from graph results
 * for augmenting LLM prompts.
 */
export function buildGraphContext(result: GraphSearchResult): string {
  if (result.nodes.length === 0) return '';

  const sections: string[] = [];

  // Key relationships
  if (result.edges.length > 0) {
    const uniqueEdges = result.edges
      .slice(0, 15)
      .map((e) => `${e.sourceLabel} —[${e.edgeType}]→ ${e.targetLabel}`)
      .filter((e, i, arr) => arr.indexOf(e) === i);
    sections.push(`Key relationships:\n${uniqueEdges.join('\n')}`);
  }

  // Top paths
  if (result.paths.length > 0) {
    const pathStrings = result.paths
      .slice(0, 5)
      .map((p) => p.nodes.join(' → '));
    sections.push(`Clinical pathways:\n${pathStrings.join('\n')}`);
  }

  return sections.join('\n\n');
}
