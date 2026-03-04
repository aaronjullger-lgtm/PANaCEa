/**
 * POST /api/graph/expand
 * Expands a set of nodes to include neighbors up to a given depth.
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import {
  createEdgePrismaClient,
  safePrismaDisconnect,
  type EdgePrismaClient,
} from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { getOrSet } from '../_shared/kv-cache';

const BodySchema = z.object({
  nodeIds: z.array(z.string().min(1)).min(1).max(100),
  depth: z.number().int().min(1).max(3).default(1),
  edgeTypes: z.array(z.string()).optional(),
  includeOriginalNodes: z.boolean().default(true),
});

export interface GraphExpandResponse {
  nodes: GraphNodeResponse[];
  edges: GraphEdgeResponse[];
  depth: number;
  expandedNodeIds: string[];
}

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

export const onRequestOptions = withCors();

export const onRequestPost = authenticatedEndpoint(
  BodySchema,
  async (context) => {
    const { env, validated, auth } = context;
    const log = createEndpointLogger('/api/graph/expand', auth.userId);
    const { nodeIds, depth, edgeTypes, includeOriginalNodes } = validated;

    // Generate deterministic cache key
    const cacheKey = `graph:expand:${
      [...nodeIds].sort().join(',')
    }:${depth}:${
      [...(edgeTypes || [])].sort().join(',')
    }:${includeOriginalNodes}`;

    try {
      const graphData = await getOrSet<GraphExpandResponse>(
        env,
        cacheKey,
        async () => {
          const prisma = createEdgePrismaClient(env.DATABASE_URL) as EdgePrismaClient;
          try {
            // Step 1: Collect nodes and edges via BFS
            const visitedNodeIds = new Set<string>();
            const visitedEdgeIds = new Set<string>();
            const nodes: GraphNodeResponse[] = [];
            const edges: GraphEdgeResponse[] = [];

            let currentFrontier = [...nodeIds];
            let currentDepth = 0;

            while (currentDepth < depth && currentFrontier.length > 0) {
              const nextFrontier: string[] = [];

              // Fetch edges where source is in current frontier (outgoing)
              const outgoingEdges = await prisma.graphEdge.findMany({
                where: {
                  sourceId: { in: currentFrontier },
                  ...(edgeTypes && edgeTypes.length > 0 ? { edgeType: { in: edgeTypes } } : {}),
                },
                include: {
                  target: true,
                  source: true,
                },
              });

              // Also incoming edges if we want bidirectional expansion? For now only outgoing.
              // Could also include incoming edges for undirected graph.
              const incomingEdges = await prisma.graphEdge.findMany({
                where: {
                  targetId: { in: currentFrontier },
                  ...(edgeTypes && edgeTypes.length > 0 ? { edgeType: { in: edgeTypes } } : {}),
                },
                include: {
                  source: true,
                  target: true,
                },
              });

              const allEdges = [...outgoingEdges, ...incomingEdges];

              for (const edge of allEdges) {
                if (visitedEdgeIds.has(edge.id)) continue;
                visitedEdgeIds.add(edge.id);

                edges.push({
                  id: edge.id,
                  sourceId: edge.sourceId,
                  targetId: edge.targetId,
                  edgeType: edge.edgeType,
                  weight: edge.weight ?? undefined,
                  description: edge.description ?? undefined,
                  evidenceCount: edge.evidenceCount ?? undefined,
                });

                // Add source node if not already visited
                if (!visitedNodeIds.has(edge.sourceId)) {
                  visitedNodeIds.add(edge.sourceId);
                  nodes.push(mapGraphNodeToResponse(edge.source));
                }

                // Add target node if not already visited
                if (!visitedNodeIds.has(edge.targetId)) {
                  visitedNodeIds.add(edge.targetId);
                  nodes.push(mapGraphNodeToResponse(edge.target));
                }

                // Add neighbor to next frontier if not already visited and not in original frontier
                const neighborId = edge.sourceId === edge.targetId ? undefined :
                  (edge.sourceId === edge.source.id ? edge.targetId : edge.sourceId);
                if (neighborId && !visitedNodeIds.has(neighborId) && !currentFrontier.includes(neighborId)) {
                  nextFrontier.push(neighborId);
                }
              }

              currentFrontier = [...new Set(nextFrontier)];
              currentDepth++;
            }

            // If includeOriginalNodes is false, filter out nodes that are not in the original list
            let finalNodes = nodes;
            if (!includeOriginalNodes) {
              finalNodes = nodes.filter(node => !nodeIds.includes(node.id));
            }

            return {
              nodes: finalNodes,
              edges,
              depth,
              expandedNodeIds: Array.from(visitedNodeIds),
            };
          } finally {
            await safePrismaDisconnect(prisma);
          }
        },
        { ttl: 3600 } // 1 hour
      );

      log.info('Graph expand completed', {
        nodeCount: graphData.nodes.length,
        edgeCount: graphData.edges.length,
        depth: graphData.depth,
        originalNodeCount: nodeIds.length,
      });

      return {
        data: graphData,
      };
    } catch (e) {
      log.error('Graph expand error', e);
      return { status: 500, error: 'Failed to expand graph' };
    }
  },
  { source: 'body' }
);

// Helper to map Prisma GraphNode to response
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