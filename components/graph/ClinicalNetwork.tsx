/**
 * Clinical Network (GraphRAG) – Force-directed graph of Condition + Drugs, Anatomy, Differentials, Labs.
 * Fetches from GET /api/graph/network/:conditionId. Color-coded nodes; click navigates to resource detail.
 */

import React, { useCallback, useMemo, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { useNavigate } from 'react-router-dom';

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

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

interface ClinicalNetworkProps {
  conditionId: string;
  width?: number;
  height?: number;
  onNodeClick?: (node: GraphNode) => void;
}

const NODE_COLORS: Record<GraphNode['type'], string> = {
  condition: '#dc2626',
  drug: '#2563eb',
  anatomy: '#16a34a',
  lab: '#64748b',
  differential: '#d97706',
};

function buildGraphData(
  nodes: GraphNode[],
  edges: GraphEdge[]
): {
  nodes: Array<GraphNode & { x?: number; y?: number }>;
  links: Array<{ source: string; target: string; relationshipType?: string }>;
} {
  const nodeMap = new Map(nodes.map((n) => [n.id, { ...n }]));
  const links = edges.map((e) => ({
    source: typeof e.source === 'string' ? e.source : (e.source as GraphNode).id,
    target: typeof e.target === 'string' ? e.target : (e.target as GraphNode).id,
    relationshipType: e.relationshipType,
  }));
  return {
    nodes: Array.from(nodeMap.values()),
    links,
  };
}

function getDetailPath(node: GraphNode): string | null {
  switch (node.type) {
    case 'condition':
      return `/conditions/${node.id}`;
    case 'drug':
      return `/study?tab=reference&resource=drug&id=${node.id}`;
    case 'anatomy':
      return `/study?tab=reference&resource=anatomy&id=${node.id}`;
    case 'lab':
    case 'differential':
      return `/study?tab=reference&resource=${node.type}&id=${node.id}`;
    default:
      return null;
  }
}

export const ClinicalNetwork: React.FC<ClinicalNetworkProps> = ({
  conditionId,
  width = 700,
  height = 500,
  onNodeClick: onNodeClickProp,
}) => {
  const navigate = useNavigate();
  const [data, setData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const base = (import.meta as any).env?.VITE_API_URL ?? '';
    fetch(`${base}/api/graph/network/${encodeURIComponent(conditionId)}`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })
      .then((r) => {
        if (!r.ok) throw new Error(r.statusText || 'Failed to load graph');
        return r.json();
      })
      .then((res: unknown) => {
        if (cancelled) return;
        const r = res as {
          data?: { nodes?: unknown[]; edges?: unknown[] };
          nodes?: unknown[];
          edges?: unknown[];
        };
        const payload = r?.data ?? r;
        if (payload?.nodes && payload?.edges) {
          setData({
            nodes: payload.nodes as GraphNode[],
            edges: payload.edges as GraphEdge[],
          });
        } else {
          setError('Invalid graph response');
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load graph');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [conditionId]);

  const { nodes, links } = useMemo(() => {
    if (!data) return { nodes: [], links: [] };
    return buildGraphData(data.nodes, data.edges);
  }, [data]);

  const handleNodeClick = useCallback(
    (node: GraphNode & { x?: number; y?: number }) => {
      if (onNodeClickProp) {
        onNodeClickProp(node);
        return;
      }
      const path = getDetailPath(node);
      if (path) navigate(path);
    },
    [navigate, onNodeClickProp]
  );

  if (loading) {
    return (
      <div
        className="rounded-xl border border-slate-700 bg-slate-800/50 flex items-center justify-center text-slate-400"
        style={{ width, height }}
      >
        Loading graph…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div
        className="rounded-xl border border-slate-700 bg-slate-800/50 flex items-center justify-center text-red-400"
        style={{ width, height }}
      >
        {error ?? 'No graph data'}
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div
        className="rounded-xl border border-slate-700 bg-slate-800/50 flex items-center justify-center text-slate-400"
        style={{ width, height }}
      >
        No related entities for this condition.
      </div>
    );
  }

  return (
    <div
      className="rounded-xl border border-slate-700 bg-slate-900 overflow-hidden"
      style={{ width, height }}
    >
      <ForceGraph2D
        graphData={{ nodes, links }}
        width={width}
        height={height}
        nodeId="id"
        nodeLabel={(n) => (n as GraphNode).label ?? (n as GraphNode).id}
        nodeColor={(n) => NODE_COLORS[(n as GraphNode).type] ?? '#94a3b8'}
        nodeVal={() => 8}
        linkColor={() => 'rgba(148, 163, 184, 0.4)'}
        onNodeClick={(n) => handleNodeClick(n as GraphNode)}
        nodeCanvasObject={(node, ctx, globalScale) => {
          const label = (node as GraphNode).label ?? (node as GraphNode).id;
          const fontSize = 12 / globalScale;
          ctx.font = `${fontSize}px Sans-Serif`;
          const color = NODE_COLORS[(node as GraphNode).type] ?? '#94a3b8';
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(node.x ?? 0, node.y ?? 0, 5, 0, 2 * Math.PI);
          ctx.fill();
          ctx.fillStyle = 'rgba(248, 250, 252, 0.9)';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(label.slice(0, 20), node.x ?? 0, (node.y ?? 0) + 10);
        }}
      />
      <div className="flex flex-wrap gap-3 p-2 border-t border-slate-700 bg-slate-800/80 text-xs text-slate-300">
        <span>
          <span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1" />
          Condition
        </span>
        <span>
          <span className="inline-block w-2 h-2 rounded-full bg-blue-500 mr-1" />
          Drug
        </span>
        <span>
          <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1" />
          Anatomy
        </span>
        <span>
          <span className="inline-block w-2 h-2 rounded-full bg-slate-500 mr-1" />
          Lab
        </span>
        <span>
          <span className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-1" />
          Differential
        </span>
      </div>
    </div>
  );
};

export default ClinicalNetwork;
