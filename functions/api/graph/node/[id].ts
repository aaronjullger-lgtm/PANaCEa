/**
 * GET /api/graph/node/:id
 * Returns a single graph node with its immediate edges.
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../../_shared/middleware';
import {
  createEdgePrismaClient,
  safePrismaDisconnect,
  type EdgePrismaClient,
} from '../../_shared/prisma-edge';
import { createEndpointLogger } from '../../_shared/secureLogger';

const ParamsSchema = z.object({
  id: z.string().min(1),
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
  outgoingEdges: GraphEdgeResponse[];
  incomingEdges: GraphEdgeResponse[];
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

export const onRequestGet = authenticatedEndpoint(
  ParamsSchema,
  async (context) => {
    const { env, validated, auth } = context;
    const log = createEndpointLogger('/api/graph/node/[id]', auth.userId);
    const prisma = createEdgePrismaClient(env.DATABASE_URL) as EdgePrismaClient;
    const nodeId = (validated as { id?: string }).id ??
      (context as { params?: { id?: string } }).params?.id;

    if (!nodeId) {
      return { status: 400, error: 'Node ID required' };
    }

    try {
      const node = await prisma.graphNode.findUnique({
        where: { id: nodeId },
        include: {
          outgoingEdges: true,
          incomingEdges: true,
        },
      });

      if (!node) {
        return { status: 404, error: 'Graph node not found' };
      }

      // Enrich with taxonomy and mapping data if needed
      let taxonomyDetails = null;
      if (node.taxonomyCode) {
        taxonomyDetails = await prisma.medicalTaxonomy.findUnique({
          where: { code: node.taxonomyCode },
          select: { name: true, description: true, weight: true },
        });
      }

      const response: GraphNodeResponse = {
        id: node.id,
        nodeType: node.nodeType,
        label: node.label,
        description: node.description ?? undefined,
        sourceType: node.sourceType,
        sourceId: node.sourceId,
        taxonomyCode: node.taxonomyCode ?? undefined,
        systemCodes: node.systemCodes,
        metadata: node.metadata as Record<string, unknown> | undefined,
        outgoingEdges: node.outgoingEdges.map(edge => ({
          id: edge.id,
          sourceId: edge.sourceId,
          targetId: edge.targetId,
          edgeType: edge.edgeType,
          weight: edge.weight ?? undefined,
          description: edge.description ?? undefined,
          evidenceCount: edge.evidenceCount ?? undefined,
        })),
        incomingEdges: node.incomingEdges.map(edge => ({
          id: edge.id,
          sourceId: edge.sourceId,
          targetId: edge.targetId,
          edgeType: edge.edgeType,
          weight: edge.weight ?? undefined,
          description: edge.description ?? undefined,
          evidenceCount: edge.evidenceCount ?? undefined,
        })),
      };

      // Include taxonomy details in metadata if available
      if (taxonomyDetails) {
        response.metadata = {
          ...response.metadata,
          taxonomyName: taxonomyDetails.name,
          taxonomyDescription: taxonomyDetails.description,
          taxonomyWeight: taxonomyDetails.weight,
        };
      }

      log.info('Graph node retrieved', { nodeId, nodeType: node.nodeType });
      return {
        data: response,
      };
    } catch (e) {
      log.error('Graph node error', e);
      return { status: 500, error: 'Failed to retrieve graph node' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { source: 'params' }
);