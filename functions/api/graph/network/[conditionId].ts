/**
 * GET /api/graph/network/:conditionId
 * Recursive Clinical Graph (GraphRAG): nodes and edges for react-force-graph.
 * Condition + DrugConditionLink, AnatomyConditionLink, DifferentialConditionLink, LabConditionLink.
 */

import { z } from 'zod';
import { authenticatedEndpoint } from '../../_shared/middleware';
import {
  createEdgePrismaClient,
  safePrismaDisconnect,
  type EdgePrismaClient,
} from '../../_shared/prisma-edge';
import { createEndpointLogger } from '../../_shared/secureLogger';

const ParamsSchema = z.object({
  conditionId: z.string().min(1),
});

export interface GraphNode {
  id: string;
  type: 'condition' | 'drug' | 'anatomy' | 'lab' | 'differential';
  label: string;
  system?: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  relationshipType?: string;
}

export interface GraphPayload {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

const NODE_CONDITION = 'condition';
const NODE_DRUG = 'drug';
const NODE_ANATOMY = 'anatomy';
const NODE_LAB = 'lab';
const NODE_DIFFERENTIAL = 'differential';

export const onRequestGet = authenticatedEndpoint(
  ParamsSchema,
  async (context) => {
    const { env, validated, auth } = context;
    const log = createEndpointLogger('/api/graph/network/[conditionId]', auth.userId);
    const prisma = createEdgePrismaClient(env.DATABASE_URL) as EdgePrismaClient;
    const conditionId =
      (validated as { conditionId?: string }).conditionId ??
      (context as { params?: { conditionId?: string } }).params?.conditionId;

    if (!conditionId) {
      return { status: 400, error: 'conditionId required' };
    }

    try {
      const condition = await prisma.condition.findUnique({
        where: { id: conditionId },
        select: { id: true, name: true, displayName: true, system: true },
      });
      if (!condition) {
        return { status: 404, error: 'Condition not found' };
      }

      const [drugLinks, anatomyLinks, differentialLinks, labLinks] = await Promise.all([
        prisma.drugConditionLink.findMany({
          where: { conditionId },
          include: { Drug: { select: { id: true, genericName: true, displayName: true } } },
        }),
        prisma.anatomyConditionLink.findMany({
          where: { conditionId },
          include: {
            AnatomyStructure: { select: { id: true, name: true, system: true } },
          },
        }),
        prisma.differentialConditionLink.findMany({
          where: { conditionId },
          include: {
            DifferentialDiagnosis: {
              select: { id: true, presentingComplaint: true, category: true },
            },
          },
        }),
        prisma.labConditionLink.findMany({
          where: { conditionId },
          include: { LabTest: { select: { id: true, name: true, category: true } } },
        }),
      ]);

      const nodes: GraphNode[] = [];
      const edges: GraphEdge[] = [];
      const seen = new Set<string>();

      const addNode = (id: string, type: GraphNode['type'], label: string, system?: string) => {
        if (seen.has(id)) return;
        seen.add(id);
        nodes.push({ id, type, label, system });
      };

      addNode(
        condition.id,
        NODE_CONDITION,
        condition.displayName ?? condition.name,
        condition.system
      );

      for (const link of drugLinks) {
        const drug = link.Drug;
        if (drug) {
          addNode(drug.id, NODE_DRUG, drug.displayName ?? drug.genericName);
          edges.push({
            source: condition.id,
            target: drug.id,
            relationshipType: link.relationshipType,
          });
        }
      }
      for (const link of anatomyLinks) {
        const anat = link.AnatomyStructure;
        if (anat) {
          addNode(anat.id, NODE_ANATOMY, anat.name, anat.system);
          edges.push({
            source: condition.id,
            target: anat.id,
            relationshipType: link.relationshipType,
          });
        }
      }
      for (const link of differentialLinks) {
        const dd = link.DifferentialDiagnosis;
        if (dd) {
          addNode(dd.id, NODE_DIFFERENTIAL, dd.presentingComplaint, dd.category);
          edges.push({
            source: condition.id,
            target: dd.id,
            relationshipType: link.likelihood ?? 'differential',
          });
        }
      }
      for (const link of labLinks) {
        const lab = link.LabTest;
        if (lab) {
          addNode(lab.id, NODE_LAB, lab.name, lab.category);
          edges.push({
            source: condition.id,
            target: lab.id,
            relationshipType: link.relationshipType,
          });
        }
      }

      log.info('Graph built', { conditionId, nodes: nodes.length, edges: edges.length });

      return {
        data: { nodes, edges } as GraphPayload,
      };
    } catch (e) {
      log.error('Graph network error', e);
      return { status: 500, error: 'Failed to build graph' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { source: 'params' }
);
