/**
 * PathFinder Service - Graph traversal and search for Cross‑System Integration Explorer
 * Implements shortest‑path algorithms (BFS, Dijkstra) and full‑text search over GraphNode labels.
 *
 * @example
 * import { pathFinder } from '@/services/domain/pathFinderService';
 * const path = await pathFinder.findShortestPath(prisma, startId, endId);
 */

import type { EdgePrismaClient } from '../../functions/api/_shared/prisma-edge';
import { GraphEdgeType, GraphNodeType } from '@prisma/client';

export interface GraphNodeResponse {
  id: string;
  nodeType: string;
  label: string;
  description?: string;
  sourceType: string;
  sourceId: string;
  taxonomyCode?: string;
  systemCodes: string[];
  metadata?: Record<string, unknown>;
}

export interface GraphEdgeResponse {
  id: string;
  sourceId: string;
  targetId: string;
  edgeType: string;
  weight?: number;
  description?: string;
  evidenceCount?: number;
}

export interface ShortestPathResult {
  path: string[]; // node IDs in order from start to end
  edges: string[]; // edge IDs connecting consecutive nodes
  totalWeight: number;
  nodes: GraphNodeResponse[];
  edgesDetail: GraphEdgeResponse[];
}

export interface SearchResult {
  nodes: GraphNodeResponse[];
  totalCount: number;
  query: string;
}

export const pathFinder = {
  /**
   * Find shortest path between two graph nodes using BFS (unweighted edges).
   * Suitable for hierarchical or co‑occurrence edges where weight is not considered.
   *
   * @param prisma EdgePrismaClient
   * @param startNodeId Starting node ID
   * @param endNodeId Target node ID
   * @param maxDepth Maximum traversal depth (default 10)
   * @param edgeTypes Optional filter on edge types
   */
  async findShortestPathBFS(
    prisma: EdgePrismaClient,
    startNodeId: string,
    endNodeId: string,
    maxDepth: number = 10,
    edgeTypes?: GraphEdgeType[]
  ): Promise<ShortestPathResult | null> {
    // Early exit if start == end
    if (startNodeId === endNodeId) {
      const node = await prisma.graphNode.findUnique({
        where: { id: startNodeId },
      });
      if (!node) return null;
      return {
        path: [startNodeId],
        edges: [],
        totalWeight: 0,
        nodes: [mapGraphNodeToResponse(node)],
        edgesDetail: [],
      };
    }

    // BFS queue: each entry is { nodeId, path, edges }
    const queue: Array<{
      nodeId: string;
      path: string[];
      edges: string[];
    }> = [{ nodeId: startNodeId, path: [startNodeId], edges: [] }];
    const visited = new Set<string>([startNodeId]);

    while (queue.length > 0) {
      const { nodeId, path, edges } = queue.shift()!;
      if (path.length > maxDepth) continue;

      // Fetch outgoing edges (optionally also incoming for undirected graph)
      const outgoing = await prisma.graphEdge.findMany({
        where: {
          sourceId: nodeId,
          ...(edgeTypes && edgeTypes.length > 0 ? { edgeType: { in: edgeTypes } } : {}),
        },
        select: { id: true, targetId: true, weight: true },
      });
      const incoming = await prisma.graphEdge.findMany({
        where: {
          targetId: nodeId,
          ...(edgeTypes && edgeTypes.length > 0 ? { edgeType: { in: edgeTypes } } : {}),
        },
        select: { id: true, sourceId: true, weight: true },
      });

      const neighbors = [
        ...outgoing.map(e => ({ neighborId: e.targetId, edgeId: e.id, weight: e.weight ?? 1 })),
        ...incoming.map(e => ({ neighborId: e.sourceId, edgeId: e.id, weight: e.weight ?? 1 })),
      ];

      for (const { neighborId, edgeId, weight } of neighbors) {
        if (visited.has(neighborId)) continue;
        visited.add(neighborId);

        const newPath = [...path, neighborId];
        const newEdges = [...edges, edgeId];

        if (neighborId === endNodeId) {
          // Found path, retrieve node details
          const nodes = await prisma.graphNode.findMany({
            where: { id: { in: newPath } },
          });
          const edgesDetail = await prisma.graphEdge.findMany({
            where: { id: { in: newEdges } },
          });
          return {
            path: newPath,
            edges: newEdges,
            totalWeight: newEdges.reduce((sum, _, idx) => sum + (neighbors[idx]?.weight ?? 1), 0),
            nodes: nodes.map(mapGraphNodeToResponse),
            edgesDetail: edgesDetail.map(mapGraphEdgeToResponse),
          };
        }

        queue.push({ nodeId: neighborId, path: newPath, edges: newEdges });
      }
    }

    return null; // No path found within maxDepth
  },

  /**
   * Find shortest path using Dijkstra's algorithm (weighted edges).
   * Uses edge weight (default 1.0) as cost.
   *
   * @param prisma EdgePrismaClient
   * @param startNodeId Starting node ID
   * @param endNodeId Target node ID
   * @param maxVisits Limit on number of nodes to explore (default 1000)
   * @param edgeTypes Optional filter on edge types
   */
  async findShortestPathDijkstra(
    prisma: EdgePrismaClient,
    startNodeId: string,
    endNodeId: string,
    maxVisits: number = 1000,
    edgeTypes?: GraphEdgeType[]
  ): Promise<ShortestPathResult | null> {
    // Early equality check
    if (startNodeId === endNodeId) {
      const node = await prisma.graphNode.findUnique({
        where: { id: startNodeId },
      });
      if (!node) return null;
      return {
        path: [startNodeId],
        edges: [],
        totalWeight: 0,
        nodes: [mapGraphNodeToResponse(node)],
        edgesDetail: [],
      };
    }

    // Distance map, previous node map, previous edge map
    const dist = new Map<string, number>();
    const prevNode = new Map<string, string>();
    const prevEdge = new Map<string, string>();
    const visited = new Set<string>();

    dist.set(startNodeId, 0);
    // Simple priority queue using array (for small graphs; could be optimized)
    const queue: Array<{ nodeId: string; distance: number }> = [
      { nodeId: startNodeId, distance: 0 },
    ];

    while (queue.length > 0 && visited.size < maxVisits) {
      // Sort by distance ascending (inefficient for large N; acceptable for now)
      queue.sort((a, b) => a.distance - b.distance);
      const { nodeId, distance } = queue.shift()!;
      if (visited.has(nodeId)) continue;
      visited.add(nodeId);

      // If we reached the target, reconstruct path
      if (nodeId === endNodeId) {
        return reconstructPath(
          prisma,
          startNodeId,
          endNodeId,
          prevNode,
          prevEdge,
          dist.get(endNodeId)!
        );
      }

      // Fetch outgoing and incoming edges
      const [outgoing, incoming] = await Promise.all([
        prisma.graphEdge.findMany({
          where: {
            sourceId: nodeId,
            ...(edgeTypes && edgeTypes.length > 0 ? { edgeType: { in: edgeTypes } } : {}),
          },
          select: { id: true, targetId: true, weight: true },
        }),
        prisma.graphEdge.findMany({
          where: {
            targetId: nodeId,
            ...(edgeTypes && edgeTypes.length > 0 ? { edgeType: { in: edgeTypes } } : {}),
          },
          select: { id: true, sourceId: true, weight: true },
        }),
      ]);

      const neighbors = [
        ...outgoing.map(e => ({
          neighborId: e.targetId,
          edgeId: e.id,
          weight: e.weight ?? 1.0,
        })),
        ...incoming.map(e => ({
          neighborId: e.sourceId,
          edgeId: e.id,
          weight: e.weight ?? 1.0,
        })),
      ];

      for (const { neighborId, edgeId, weight } of neighbors) {
        if (visited.has(neighborId)) continue;
        const newDist = distance + weight;
        if (!dist.has(neighborId) || newDist < dist.get(neighborId)!) {
          dist.set(neighborId, newDist);
          prevNode.set(neighborId, nodeId);
          prevEdge.set(neighborId, edgeId);
          queue.push({ nodeId: neighborId, distance: newDist });
        }
      }
    }

    // No path found
    return null;
  },

  /**
   * Full‑text search over GraphNode labels and descriptions using PostgreSQL ILIKE.
   * For production, consider adding a proper FTS column (tsvector) to the schema.
   *
   * @param prisma EdgePrismaClient
   * @param query Search string (case‑insensitive)
   * @param limit Maximum results (default 20)
   * @param nodeTypes Optional filter on node types
   */
  async searchNodes(
    prisma: EdgePrismaClient,
    query: string,
    limit: number = 20,
    nodeTypes?: GraphNodeType[]
  ): Promise<SearchResult> {
    const where: any = {
      OR: [
        { label: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
      ],
    };
    if (nodeTypes && nodeTypes.length > 0) {
      where.nodeType = { in: nodeTypes };
    }

    const nodes = await prisma.graphNode.findMany({
      where,
      take: limit,
      orderBy: { label: 'asc' },
    });

    const totalCount = await prisma.graphNode.count({ where });

    return {
      nodes: nodes.map(mapGraphNodeToResponse),
      totalCount,
      query,
    };
  },

  /**
   * Retrieve a node by its label (exact match, case‑insensitive).
   */
  async getNodeByLabel(
    prisma: EdgePrismaClient,
    label: string
  ): Promise<GraphNodeResponse | null> {
    const node = await prisma.graphNode.findFirst({
      where: { label: { equals: label, mode: 'insensitive' } },
    });
    return node ? mapGraphNodeToResponse(node) : null;
  },
};

// ----------------------------------------------------------------------------
// Internal helpers
// ----------------------------------------------------------------------------

function mapGraphNodeToResponse(node: any): GraphNodeResponse {
  return {
    id: node.id,
    nodeType: node.nodeType,
    label: node.label,
    description: node.description ?? undefined,
    sourceType: node.sourceType,
    sourceId: node.sourceId,
    taxonomyCode: node.taxonomyCode ?? undefined,
    systemCodes: node.systemCodes,
    metadata: node.metadata as Record<string, unknown> | undefined,
  };
}

function mapGraphEdgeToResponse(edge: any): GraphEdgeResponse {
  return {
    id: edge.id,
    sourceId: edge.sourceId,
    targetId: edge.targetId,
    edgeType: edge.edgeType,
    weight: edge.weight ?? undefined,
    description: edge.description ?? undefined,
    evidenceCount: edge.evidenceCount ?? undefined,
  };
}

async function reconstructPath(
  prisma: EdgePrismaClient,
  startId: string,
  endId: string,
  prevNode: Map<string, string>,
  prevEdge: Map<string, string>,
  totalWeight: number
): Promise<ShortestPathResult> {
  const path: string[] = [];
  const edges: string[] = [];
  let current = endId;
  while (current !== startId) {
    path.unshift(current);
    const edgeId = prevEdge.get(current);
    if (!edgeId) break;
    edges.unshift(edgeId);
    current = prevNode.get(current)!;
  }
  path.unshift(startId);
  // edges length = path length - 1

  const nodes = await prisma.graphNode.findMany({
    where: { id: { in: path } },
  });
  const edgesDetail = await prisma.graphEdge.findMany({
    where: { id: { in: edges } },
  });

  return {
    path,
    edges,
    totalWeight,
    nodes: nodes.map(mapGraphNodeToResponse),
    edgesDetail: edgesDetail.map(mapGraphEdgeToResponse),
  };
}