import { GraphNodeType, GraphEdgeType } from '@prisma/client';

export interface GraphNodeData {
  id: string;
  nodeType: GraphNodeType;
  label: string;
  description?: string;
  sourceType: string;
  sourceId: string;
  taxonomyCode?: string;
  systemCodes: string[];
  metadata?: {
    depth?: number;
    parentId?: string;
    contentCount?: number;
    averageAccuracy?: number;
    stability?: number;
    [key: string]: unknown;
  };
}

export interface GraphEdgeData {
  id: string;
  sourceId: string;
  targetId: string;
  edgeType: GraphEdgeType;
  weight?: number;
  description?: string;
  evidenceCount?: number;
  metadata?: Record<string, unknown>;
}

export interface GraphBuildOptions {
  rebuild?: boolean;
  batchSize?: number;
  includeNodes?: GraphNodeType[];
  includeEdgeTypes?: GraphEdgeType[];
}

export interface GraphNodeWithEdges extends GraphNodeData {
  outgoingEdges: GraphEdgeData[];
  incomingEdges: GraphEdgeData[];
}

export interface GraphExpandRequest {
  nodeIds: string[];
  depth?: number;
  edgeTypes?: GraphEdgeType[];
}