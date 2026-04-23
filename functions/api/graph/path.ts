/**
 * POST /api/graph/path
 * Find shortest path between two graph nodes.
 * Supports BFS (unweighted) and Dijkstra (weighted) algorithms.
 */

import { z } from 'zod';
import { authenticatedEndpoint } from '../_shared/middleware';
import {
  createEdgePrismaClient,
  safePrismaDisconnect,
  type EdgePrismaClient,
} from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { pathFinder } from '@/services/domain/pathFinderService';

const BodySchema = z.object({
  startNodeId: z.string().min(1),
  endNodeId: z.string().min(1),
  algorithm: z.enum(['bfs', 'dijkstra']).default('bfs'),
  maxDepth: z.number().int().min(1).max(20).optional().default(10),
  maxVisits: z.number().int().min(1).max(5000).optional().default(1000),
  edgeTypes: z.array(z.string()).optional(),
  includeNodes: z.boolean().default(true),
  includeEdges: z.boolean().default(true),
});

export interface GraphPathResponse {
  path: string[];
  edges: string[];
  totalWeight: number;
  nodes?: any[]; // GraphNodeResponse[]
  edgesDetail?: any[]; // GraphEdgeResponse[]
  algorithm: string;
  depth: number;
  visitedCount: number;
}

export const onRequestPost = authenticatedEndpoint(
  BodySchema,
  async (context) => {
    const { env, validated, auth } = context;
    const log = createEndpointLogger('/api/graph/path', auth.userId);
    const prisma = createEdgePrismaClient(env.DATABASE_URL) as EdgePrismaClient;
    const {
      startNodeId,
      endNodeId,
      algorithm,
      maxDepth,
      maxVisits,
      edgeTypes,
      includeNodes,
      includeEdges,
    } = validated;

    try {
      log.info('Finding graph path', {
        startNodeId,
        endNodeId,
        algorithm,
        maxDepth,
        edgeTypes,
      });

      let result;
      if (algorithm === 'dijkstra') {
        result = await pathFinder.findShortestPathDijkstra(
          prisma,
          startNodeId,
          endNodeId,
          maxVisits,
          edgeTypes
        );
      } else {
        result = await pathFinder.findShortestPathBFS(
          prisma,
          startNodeId,
          endNodeId,
          maxDepth,
          edgeTypes
        );
      }

      if (!result) {
        return {
          status: 404,
          error: 'No path found between the specified nodes',
        };
      }

      const response: GraphPathResponse = {
        path: result.path,
        edges: result.edges,
        totalWeight: result.totalWeight,
        algorithm,
        depth: result.path.length - 1,
        visitedCount: result.path.length,
      };

      if (includeNodes) {
        response.nodes = result.nodes;
      }
      if (includeEdges) {
        response.edgesDetail = result.edgesDetail;
      }

      log.info('Graph path found', {
        pathLength: result.path.length,
        totalWeight: result.totalWeight,
        algorithm,
      });

      return {
        data: response,
        headers: { 'Cache-Control': 'private, max-age=60' },
      };
    } catch (error) {
      log.error('Graph path error', error);
      return {
        status: 500,
        error: error instanceof Error ? error.message : 'Path finding failed',
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { source: 'body' }
);