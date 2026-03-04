/**
 * Graph types for Cross‑System Integration Explorer.
 * Mirror of backend GraphNodeResponse, GraphEdgeResponse, GraphExpandResponse.
 */

export type GraphNodeType =
  | 'CONDITION'
  | 'FINDING'
  | 'DRUG'
  | 'PROCEDURE'
  | 'SYSTEM'
  | 'ANATOMY'
  | 'LAB_TEST'
  | 'IMAGING'
  | 'VITAL_SIGN'
  | 'OTHER';

export type GraphEdgeType =
  | 'HIERARCHICAL'
  | 'CO_OCCURRENCE'
  | 'SEMANTIC'
  | 'EXPLICIT'
  | 'ASSOCIATED'
  | 'TREATS'
  | 'CAUSES'
  | 'MANIFESTS'
  | 'DIFFERENTIAL'
  | 'COMPLICATES';

export interface GraphNodeResponse {
  id: string;
  nodeType: string; // GraphNodeType but backend returns string
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
  edgeType: string; // GraphEdgeType but backend returns string
  weight?: number;
  description?: string;
  evidenceCount?: number;
}

export interface GraphExpandResponse {
  nodes: GraphNodeResponse[];
  edges: GraphEdgeResponse[];
  depth: number;
  expandedNodeIds: string[];
}

export interface GraphNodeDetailResponse extends GraphNodeResponse {
  outgoingEdges: GraphEdgeResponse[];
  incomingEdges: GraphEdgeResponse[];
}

// Cytoscape element data format
export interface CytoscapeNodeData {
  id: string;
  label: string;
  nodeType: string;
  systemCodes: string[];
  description?: string;
  weight?: number;
}

export interface CytoscapeEdgeData {
  id: string;
  source: string;
  target: string;
  edgeType: string;
  weight?: number;
  description?: string;
}

export interface CytoscapeElement {
  group: 'nodes' | 'edges';
  data: CytoscapeNodeData | CytoscapeEdgeData;
}

// Filter state
export interface GraphFilter {
  systemCodes: string[];
  edgeTypes: string[];
  nodeTypes: string[];
  minWeight: number;
  maxDepth: number;
}