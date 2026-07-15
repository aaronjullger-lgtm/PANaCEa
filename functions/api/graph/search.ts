/**
 * GET /api/graph/search?q=...
 * Full‑text search over GraphNode labels and descriptions.
 * Supports filtering by nodeType and limit.
 */

import { z } from 'zod';
import { authenticatedEndpoint } from '../_shared/middleware';
import {
  createEdgePrismaClient,
  safePrismaDisconnect,
  type EdgePrismaClient,
} from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

const SearchQuerySchema = z.object({
  q: z.string().min(1).max(200),
  limit: z.string().regex(/^\d+$/).transform(Number).optional().default('20'),
  nodeType: z.string().optional(),
});

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

export interface GraphSearchResponse {
  nodes: GraphNodeResponse[];
  totalCount: number;
  query: string;
}

export const onRequestGet = authenticatedEndpoint(
  SearchQuerySchema,
  async (context) => {
    const { env, validated, auth } = context;
    const log = createEndpointLogger('/api/graph/search', auth.userId);
    const prisma = createEdgePrismaClient(env.DATABASE_URL) as EdgePrismaClient;
    const { q, limit, nodeType } = validated;

    try {
      const where: any = {
        OR: [
          { label: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
        ],
      };
      if (nodeType) {
        where.nodeType = nodeType;
      }

      const nodes = await prisma.graphNode.findMany({
        where,
        take: limit,
        orderBy: { label: 'asc' },
      });

      const totalCount = await prisma.graphNode.count({ where });

      const response: GraphSearchResponse = {
        nodes: nodes.map(node => ({
          id: node.id,
          nodeType: node.nodeType,
          label: node.label,
          description: node.description ?? undefined,
          sourceType: node.sourceType,
          sourceId: node.sourceId,
          taxonomyCode: node.taxonomyCode ?? undefined,
          systemCodes: node.systemCodes,
          metadata: node.metadata as Record<string, unknown> | undefined,
        })),
        totalCount,
        query: q,
      };

      log.info('Graph search completed', {
        query: q,
        nodeCount: nodes.length,
        totalCount,
      });

      return {
        data: response,
        headers: { 'Cache-Control': 'private, max-age=60' },
      };
    } catch (error) {
      log.error('Graph search error', error);
      return {
        status: 500,
        error: 'Graph search failed. Please try again.',
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { source: 'query' }
);