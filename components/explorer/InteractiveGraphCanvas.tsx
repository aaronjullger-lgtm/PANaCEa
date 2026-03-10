/**
 * InteractiveGraphCanvas – Cytoscape.js‑based graph visualization for Cross‑System Integration Explorer.
 * Features: zoom/pan, node selection, expand on click, filtering by system/edge type, performance overlay.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import cytoscape, { Core, ElementDefinition, NodeSingular, EdgeSingular } from 'cytoscape';
import { getApiEndpoint } from '@/lib/utils/apiConfig';
import { debounce, createDebouncedFunction } from '@/lib/utils/debounce';
import {
  GraphNodeResponse,
  GraphEdgeResponse,
  GraphExpandResponse,
  GraphNodeType,
  GraphEdgeType,
  CytoscapeNodeData,
  CytoscapeEdgeData,
  GraphFilter,
} from '@/lib/types/graph';
import { getConfidenceHex } from '@/lib/confidenceColorUtils';

// Import Cytoscape extensions if needed (e.g., for layout)
// import cytoscapeGridGuide from 'cytoscape-grid-guide';

// Extend cytoscape types
// if (typeof window !== 'undefined') {
//   cytoscape.use(cytoscapeGridGuide);
// }

interface InteractiveGraphCanvasProps {
  /** Initial node IDs to load (if empty, a default seed will be used) */
  initialNodeIds?: string[];
  /** Width of the canvas (default: 100%) */
  width?: number | string;
  /** Height of the canvas (default: 600px) */
  height?: number | string;
  /** Callback when a node is clicked */
  onNodeClick?: (node: GraphNodeResponse) => void;
  /** Callback when a node is selected (alias for onNodeClick) */
  onNodeSelect?: (nodeId: string) => void;
  /** Callback when an edge is clicked */
  onEdgeClick?: (edge: GraphEdgeResponse) => void;
  /** Callback when graph data changes (nodes/edges) */
  onGraphChange?: (data: { nodes: GraphNodeResponse[]; edges: GraphEdgeResponse[] }) => void;
  /** Enable double‑click to expand node (default: true) */
  enableExpand?: boolean;
  /** Enable zoom/pan controls (default: true) */
  enableZoomPan?: boolean;
  /** Show loading indicator */
  loading?: boolean;
  /** Custom CSS class for container */
  className?: string;
  /** Filter state for system/edge/node type filtering */
  filter?: GraphFilter;
  /** Array of node IDs to highlight (e.g., a shortest path) */
  highlightedPath?: string[];
  /** Toggle performance overlay (color nodes by learner confidence) */
  performanceOverlay?: boolean;
}

const NODE_TYPE_COLORS: Record<string, string> = {
  CONDITION: '#dc2626',
  FINDING: '#2563eb',
  DRUG: '#16a34a',
  PROCEDURE: '#d97706',
  SYSTEM: '#7c3aed',
  ANATOMY: '#64748b',
  LAB_TEST: '#0891b2',
  IMAGING: '#db2777',
  VITAL_SIGN: '#059669',
  OTHER: '#6b7280',
};

const EDGE_TYPE_STYLES: Record<string, { lineColor: string; lineStyle: 'solid' | 'dashed' | 'dotted' }> = {
  HIERARCHICAL: { lineColor: '#4b5563', lineStyle: 'solid' },
  CO_OCCURRENCE: { lineColor: '#3b82f6', lineStyle: 'solid' },
  SEMANTIC: { lineColor: '#10b981', lineStyle: 'dashed' },
  EXPLICIT: { lineColor: '#f59e0b', lineStyle: 'solid' },
  ASSOCIATED: { lineColor: '#8b5cf6', lineStyle: 'dotted' },
  TREATS: { lineColor: '#ef4444', lineStyle: 'solid' },
  CAUSES: { lineColor: '#f97316', lineStyle: 'solid' },
  MANIFESTS: { lineColor: '#ec4899', lineStyle: 'dashed' },
  DIFFERENTIAL: { lineColor: '#14b8a6', lineStyle: 'dotted' },
  COMPLICATES: { lineColor: '#b91c1c', lineStyle: 'solid' },
};

/**
 * Convert GraphNodeResponse and GraphEdgeResponse to Cytoscape elements.
 */
function graphDataToElements(
  nodes: GraphNodeResponse[],
  edges: GraphEdgeResponse[]
): ElementDefinition[] {
  const nodeElements: ElementDefinition[] = nodes.map(node => ({
    group: 'nodes',
    data: {
      id: node.id,
      label: node.label,
      nodeType: node.nodeType,
      systemCodes: node.systemCodes,
      description: node.description,
      weight: 1.0,
      original: node,
    } as CytoscapeNodeData,
  }));

  const edgeElements: ElementDefinition[] = edges.map(edge => ({
    group: 'edges',
    data: {
      id: edge.id,
      source: edge.sourceId,
      target: edge.targetId,
      edgeType: edge.edgeType,
      weight: edge.weight,
      description: edge.description,
      original: edge,
    } as CytoscapeEdgeData,
  }));

  return [...nodeElements, ...edgeElements];
}

/**
 * Default layout options for Cytoscape.
 */
const DEFAULT_LAYOUT = {
  name: 'cose',
  idealEdgeLength: 100,
  nodeOverlap: 20,
  refresh: 20,
  fit: true,
  padding: 30,
  randomize: true,
  componentSpacing: 100,
  nodeRepulsion: 400000,
  edgeElasticity: 100,
  nestingFactor: 5,
  gravity: 80,
  numIter: 1000,
  initialTemp: 200,
  coolingFactor: 0.95,
  minTemp: 1.0,
};

export const InteractiveGraphCanvas: React.FC<InteractiveGraphCanvasProps> = ({
  initialNodeIds = [],
  width = '100%',
  height = '600px',
  onNodeClick,
  onNodeSelect,
  onEdgeClick,
  onGraphChange,
  enableExpand = true,
  enableZoomPan = true,
  loading = false,
  className = '',
  filter,
  highlightedPath = [],
  performanceOverlay = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const viewportExpandRef = useRef<{ cancel: () => void } | null>(null);
  const [nodes, setNodes] = useState<GraphNodeResponse[]>([]);
  const [edges, setEdges] = useState<GraphEdgeResponse[]>([]);
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(() => new Set());
  const expandedNodeIdsRef = useRef(expandedNodeIds);
  useEffect(() => {
    expandedNodeIdsRef.current = expandedNodeIds;
  }, [expandedNodeIds]);
  const [selectedNode, setSelectedNode] = useState<GraphNodeResponse | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<GraphEdgeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confidenceScores, setConfidenceScores] = useState<Record<string, number>>({});

  // Helper to merge new graph data with existing nodes/edges (deduplicate by id)
  const mergeGraphData = useCallback(
    (newNodes: GraphNodeResponse[], newEdges: GraphEdgeResponse[]) => {
      setNodes(prevNodes => {
        const nodeMap = new Map(prevNodes.map(n => [n.id, n]));
        newNodes.forEach(n => nodeMap.set(n.id, n));
        return Array.from(nodeMap.values());
      });
      setEdges(prevEdges => {
        const edgeMap = new Map(prevEdges.map(e => [e.id, e]));
        newEdges.forEach(e => edgeMap.set(e.id, e));
        return Array.from(edgeMap.values());
      });
    },
    []
  );

  // Fetch initial graph data (with merging)
  const fetchGraphData = useCallback(async (nodeIds: string[]) => {
    if (nodeIds.length === 0) {
      // If no IDs provided, maybe fetch a default seed (e.g., a high‑level system node)
      // For now, do nothing.
      return;
    }
    // Skip if all nodes already expanded (optional optimization)
    const newIds = nodeIds.filter(id => !expandedNodeIds.has(id));
    if (newIds.length === 0) return;

    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(getApiEndpoint('GRAPH_EXPAND'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeIds: newIds,
          depth: 1,
          edgeTypes: [],
          includeOriginalNodes: true,
        }),
      });
      if (!response.ok) {
        throw new Error(`Graph expand failed: ${response.statusText}`);
      }
      const result = await response.json();
      const data = result.data as GraphExpandResponse;
      // Merge new nodes/edges with existing ones
      mergeGraphData(data.nodes, data.edges);
      // Mark node IDs as expanded
      setExpandedNodeIds(prev => {
        const next = new Set(prev);
        newIds.forEach(id => next.add(id));
        return next;
      });
      // Notify parent with merged state (could compute but we don't have merged state synchronously)
      // We'll rely on nodes/edges state updates and onGraphChange will be called via useEffect?
      // For now, call onGraphChange with the newly fetched data (merging is already done).
      onGraphChange?.({ nodes: data.nodes, edges: data.edges });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Failed to fetch graph data', err);
    } finally {
      setIsLoading(false);
    }
  }, [onGraphChange, mergeGraphData, expandedNodeIds]);

  // Fetch confidence scores for nodes (used by performance overlay)
  const fetchConfidenceScores = useCallback(async (nodeIds: string[]) => {
    if (nodeIds.length === 0) return;
    try {
      const response = await fetch(getApiEndpoint('GRAPH_CONFIDENCE'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeIds }),
      });
      if (!response.ok) {
        throw new Error(`Confidence fetch failed: ${response.statusText}`);
      }
      const result = await response.json();
      const scores = result.scores as Record<string, number>;
      setConfidenceScores(prev => ({ ...prev, ...scores }));
    } catch (err) {
      console.error('Failed to fetch confidence scores', err);
      // Don't block UI; keep existing scores
    }
  }, []);

  // Fetch confidence scores when performance overlay is enabled and nodes change
  useEffect(() => {
    if (!performanceOverlay || nodes.length === 0) return;
    const nodeIds = nodes.map(n => n.id);
    // Determine which node IDs are missing confidence scores
    const missingIds = nodeIds.filter(id => confidenceScores[id] === undefined);
    if (missingIds.length > 0) {
      fetchConfidenceScores(missingIds);
    }
  }, [performanceOverlay, nodes, confidenceScores, fetchConfidenceScores]);

  // Filter graph data based on current filter state
  const applyFilter = useCallback((
    nodes: GraphNodeResponse[],
    edges: GraphEdgeResponse[],
    filter?: GraphFilter
  ): { filteredNodes: GraphNodeResponse[]; filteredEdges: GraphEdgeResponse[] } => {
    if (!filter) {
      return { filteredNodes: nodes, filteredEdges: edges };
    }
    // Filter nodes by system and node type
    const filteredNodes = nodes.filter(node => {
      // System filter
      if (filter.systemCodes.length > 0) {
        const nodeSystems = node.systemCodes || [];
        if (!nodeSystems.some(s => filter.systemCodes.includes(s))) {
          return false;
        }
      }
      // Node type filter
      if (filter.nodeTypes.length > 0) {
        if (!filter.nodeTypes.includes(node.type)) {
          return false;
        }
      }
      return true;
    });
    // Filter edges by edge type and weight
    const filteredEdges = edges.filter(edge => {
      // Edge type filter
      if (filter.edgeTypes.length > 0) {
        if (!filter.edgeTypes.includes(edge.type)) {
          return false;
        }
      }
      // Weight filter
      if (edge.weight !== undefined && edge.weight < filter.minWeight) {
        return false;
      }
      // Ensure both source and target nodes are still present (optional)
      const sourceExists = filteredNodes.some(n => n.id === edge.source);
      const targetExists = filteredNodes.some(n => n.id === edge.target);
      return sourceExists && targetExists;
    });
    return { filteredNodes, filteredEdges };
  }, []);

  // Initialize Cytoscape instance
  useEffect(() => {
    if (!containerRef.current) return;

    // Clear previous instance
    if (cyRef.current) {
      cyRef.current.destroy();
      cyRef.current = null;
    }

    // Apply current filter
    const { filteredNodes, filteredEdges } = applyFilter(nodes, edges, filter);
    const elements = graphDataToElements(filteredNodes, filteredEdges);

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': (ele: NodeSingular) => {
              const nodeType = ele.data('nodeType') as string;
              return NODE_TYPE_COLORS[nodeType] ?? '#6b7280';
            },
            'label': 'data(label)',
            'color': '#fff',
            'font-size': '12px',
            'font-weight': 'bold',
            'text-valign': 'center',
            'text-halign': 'center',
            'width': 40,
            'height': 40,
            'border-width': 2,
            'border-color': '#ffffff',
            'border-opacity': 0.8,
          },
        },
        {
          selector: 'edge',
          style: {
            'width': 2,
            'line-color': (ele: EdgeSingular) => {
              const edgeType = ele.data('edgeType') as string;
              return EDGE_TYPE_STYLES[edgeType]?.lineColor ?? '#9ca3af';
            },
            'line-style': (ele: EdgeSingular) => {
              const edgeType = ele.data('edgeType') as string;
              return EDGE_TYPE_STYLES[edgeType]?.lineStyle ?? 'solid';
            },
            'curve-style': 'bezier',
            'target-arrow-color': '#9ca3af',
            'target-arrow-shape': 'triangle',
            'arrow-scale': 1.2,
          },
        },
        {
          selector: 'node:selected',
          style: {
            'border-width': 4,
            'border-color': '#fbbf24',
          },
        },
        {
          selector: 'edge:selected',
          style: {
            'width': 4,
            'line-color': '#f59e0b',
          },
        },
      ],
      layout: DEFAULT_LAYOUT,
      minZoom: 0.1,
      maxZoom: 5,
      zoomingEnabled: enableZoomPan,
      userZoomingEnabled: enableZoomPan,
      panningEnabled: enableZoomPan,
      userPanningEnabled: enableZoomPan,
      boxSelectionEnabled: true,
    });

    // Event handlers
    cy.on('tap', 'node', (event) => {
      const node = event.target;
      const original = node.data('original') as GraphNodeResponse;
      setSelectedNode(original);
      setSelectedEdge(null);
      onNodeClick?.(original);
      onNodeSelect?.(original.id);
    });

    cy.on('tap', 'edge', (event) => {
      const edge = event.target;
      const original = edge.data('original') as GraphEdgeResponse;
      setSelectedEdge(original);
      setSelectedNode(null);
      onEdgeClick?.(original);
    });

    cy.on('dbltap', 'node', (event) => {
      if (!enableExpand) return;
      const node = event.target;
      const nodeId = node.id();
      // Expand this node (fetch its neighbors)
      fetchGraphData([nodeId]);
    });

    // Viewport‑based lazy loading
    const viewportExpandHandler = () => {
      if (!enableExpand || !cyRef.current) return;
      const cy = cyRef.current;
      const viewport = cy.extent(); // { x1, y1, x2, y2 }
      const nodesInViewport = cy.nodes().filter(node => {
        const pos = node.position();
        return pos.x >= viewport.x1 && pos.x <= viewport.x2 &&
               pos.y >= viewport.y1 && pos.y <= viewport.y2;
      });
      const nodeIds = nodesInViewport.map(node => node.id()).filter(id => !expandedNodeIdsRef.current.has(id));
      if (nodeIds.length > 0) {
        // Limit to 5 nodes to avoid overloading
        fetchGraphData(nodeIds.slice(0, 5));
      }
    };
    const { debounced: debouncedViewportExpand, cancel } = createDebouncedFunction(viewportExpandHandler, 500);
    viewportExpandRef.current = { cancel };
    cy.on('pan zoom resize', debouncedViewportExpand);

    cyRef.current = cy;

    // Cleanup on unmount
    return () => {
      viewportExpandRef.current?.cancel();
      if (cyRef.current) {
        cyRef.current.destroy();
        cyRef.current = null;
      }
    };
  }, [nodes, edges, enableExpand, enableZoomPan, onNodeClick, onNodeSelect, onEdgeClick, fetchGraphData, filter, applyFilter]);

  // Highlight path when highlightedPath changes
  useEffect(() => {
    if (!cyRef.current || !highlightedPath || highlightedPath.length === 0) {
      // Clear any previous selection
      cyRef.current?.$(':selected').unselect();
      return;
    }
    // Select nodes in the path
    const selector = highlightedPath.map(id => `#${id}`).join(', ');
    const nodes = cyRef.current.$(selector);
    nodes.select();
    // Optionally fit the view to the selected nodes
    cyRef.current.fit(nodes);
  }, [highlightedPath]);

  // Update node colors when performance overlay or confidence scores change
  useEffect(() => {
    if (!cyRef.current) return;
    const cy = cyRef.current;
    cy.nodes().forEach(node => {
      const nodeId = node.id();
      const confidence = confidenceScores[nodeId];
      if (performanceOverlay && confidence !== undefined) {
        const color = getConfidenceHex(confidence, false); // light theme for now
        node.style('background-color', color);
      } else {
        // Revert to node type color
        const nodeType = node.data('nodeType') as string;
        node.style('background-color', NODE_TYPE_COLORS[nodeType] ?? '#6b7280');
      }
    });
  }, [performanceOverlay, confidenceScores]);

  // Load initial data when component mounts or initialNodeIds changes
  useEffect(() => {
    fetchGraphData(initialNodeIds);
  }, [fetchGraphData, initialNodeIds]);

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    if (cyRef.current) {
      cyRef.current.zoom(cyRef.current.zoom() * 1.2);
    }
  }, []);

  const handleZoomOut = useCallback(() => {
    if (cyRef.current) {
      cyRef.current.zoom(cyRef.current.zoom() / 1.2);
    }
  }, []);

  const handleFit = useCallback(() => {
    if (cyRef.current) {
      cyRef.current.fit();
    }
  }, []);

  const handleReset = useCallback(() => {
    if (cyRef.current) {
      cyRef.current.reset();
    }
  }, []);

  return (
    <div className={`relative ${className}`}>
      {/* Canvas container */}
      <div
        ref={containerRef}
        style={{ width, height }}
        className="bg-surface-card rounded-lg border border-gray-300"
      />

      {/* Zoom/pan controls */}
      {enableZoomPan && (
        <div className="absolute top-4 right-4 flex flex-col gap-2 p-2 bg-white/90 backdrop-blur-sm rounded-lg shadow-md">
          <button
            type="button"
            onClick={handleZoomIn}
            className="p-2 hover:bg-gray-100 rounded"
            aria-label="Zoom in"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            className="p-2 hover:bg-gray-100 rounded"
            aria-label="Zoom out"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          <button
            type="button"
            onClick={handleFit}
            className="p-2 hover:bg-gray-100 rounded"
            aria-label="Fit to view"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
            </svg>
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="p-2 hover:bg-gray-100 rounded"
            aria-label="Reset view"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      )}

      {/* Loading overlay */}
      {(loading || isLoading) && (
        <div className="absolute inset-0 flex items-center justify-center bg-[var(--color-overlay)] rounded-lg">
          <div className="text-white bg-gray-800 px-4 py-2 rounded-lg">Loading graph…</div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="absolute top-4 left-4 right-4 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
          <strong>Error loading graph:</strong> {error}
        </div>
      )}

      {/* Selected node/edge info */}
      {(selectedNode || selectedEdge) && (
        <div className="absolute bottom-4 left-4 right-4 bg-white/90 backdrop-blur-sm p-4 rounded-lg shadow-lg max-w-md">
          {selectedNode && (
            <div>
              <h3 className="font-bold text-lg">{selectedNode.label}</h3>
              <p className="text-sm text-gray-600">{selectedNode.nodeType}</p>
              {selectedNode.description && (
                <p className="mt-2 text-gray-800">{selectedNode.description}</p>
              )}
              <div className="mt-2 flex flex-wrap gap-1">
                {selectedNode.systemCodes.map(code => (
                  <span key={code} className="px-2 py-1 bg-[var(--color-accent)]/10 text-[var(--color-accent)] text-xs rounded">
                    {code}
                  </span>
                ))}
              </div>
            </div>
          )}
          {selectedEdge && (
            <div>
              <h3 className="font-bold text-lg">Edge</h3>
              <p className="text-sm text-gray-600">{selectedEdge.edgeType}</p>
              {selectedEdge.description && (
                <p className="mt-2 text-gray-800">{selectedEdge.description}</p>
              )}
              <div className="mt-2 text-sm">
                <span className="font-semibold">Weight:</span> {selectedEdge.weight ?? 'N/A'}
                <span className="ml-4 font-semibold">Evidence count:</span> {selectedEdge.evidenceCount ?? 0}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default InteractiveGraphCanvas;