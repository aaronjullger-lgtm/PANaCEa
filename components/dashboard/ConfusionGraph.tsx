/**
 * ConfusionGraph — Force-directed network visualization of confusion pairs
 *
 * Nodes represent conditions the student confuses. Edges connect pairs that
 * have been mixed up, with thickness proportional to frequency. Nodes are
 * colored by organ system and sized by total confusion involvement.
 *
 * Built with pure SVG + a lightweight spring-force simulation (no D3 dep).
 * Hover reveals condition details; click navigates to DDx comparison drill.
 *
 * @module components/dashboard/ConfusionGraph
 */

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConfusionPairs, type ConfusionPairData } from '@/hooks/useConfusionPairs';

// ── System color palette ─────────────────────────────────────────────────

const SYSTEM_COLORS: Record<string, string> = {
  Cardiovascular: '#ef4444',
  Pulmonary: '#3b82f6',
  Gastrointestinal: '#f59e0b',
  Musculoskeletal: '#8b5cf6',
  HEENT: '#06b6d4',
  Reproductive: '#ec4899',
  Neurological: '#6366f1',
  Psychiatry: '#a78bfa',
  Endocrine: '#14b8a6',
  Dermatology: '#f97316',
  Genitourinary: '#84cc16',
  Hematology: '#dc2626',
  'Infectious Disease': '#10b981',
  Nephrology: '#0ea5e9',
  'Emergency Medicine': '#e11d48',
  Pharmacology: '#7c3aed',
};

function getSystemColor(system: string | null): string {
  if (!system) return '#6b7280';
  // Try direct match, then case-insensitive
  return SYSTEM_COLORS[system] ?? SYSTEM_COLORS[
    Object.keys(SYSTEM_COLORS).find(k => k.toLowerCase() === system.toLowerCase()) ?? ''
  ] ?? '#6b7280';
}

// ── Force simulation types ───────────────────────────────────────────────

interface GraphNode {
  id: string;
  label: string;
  system: string | null;
  weight: number; // sum of confusion frequencies involving this node
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface GraphEdge {
  source: string;
  target: string;
  frequency: number;
  system: string | null;
}

// ── Force simulation ─────────────────────────────────────────────────────

const SIMULATION_CONFIG = {
  repulsion: 3000,
  springLength: 90,
  springStrength: 0.04,
  damping: 0.85,
  centerGravity: 0.02,
  iterations: 120,
};

function buildGraph(pairs: ConfusionPairData[]): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodeMap = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];

  for (const pair of pairs) {
    const srcId = pair.correctConditionId;
    const tgtId = pair.selectedConditionId;
    const srcLabel = pair.correctConditionName || srcId.replace(/_/g, ' ');
    const tgtLabel = pair.selectedConditionName || tgtId.replace(/_/g, ' ');

    if (!nodeMap.has(srcId)) {
      nodeMap.set(srcId, {
        id: srcId, label: srcLabel, system: pair.system,
        weight: 0, x: 0, y: 0, vx: 0, vy: 0,
      });
    }
    if (!nodeMap.has(tgtId)) {
      nodeMap.set(tgtId, {
        id: tgtId, label: tgtLabel, system: pair.system,
        weight: 0, x: 0, y: 0, vx: 0, vy: 0,
      });
    }

    nodeMap.get(srcId)!.weight += pair.frequency;
    nodeMap.get(tgtId)!.weight += pair.frequency;

    edges.push({
      source: srcId,
      target: tgtId,
      frequency: pair.frequency,
      system: pair.system,
    });
  }

  const nodes = Array.from(nodeMap.values());

  // Initial layout: circle
  const cx = 200;
  const cy = 150;
  const radius = Math.min(cx, cy) * 0.7;
  nodes.forEach((n, i) => {
    const angle = (2 * Math.PI * i) / nodes.length;
    n.x = cx + radius * Math.cos(angle) + (Math.random() - 0.5) * 20;
    n.y = cy + radius * Math.sin(angle) + (Math.random() - 0.5) * 20;
  });

  return { nodes, edges };
}

function runSimulation(nodes: GraphNode[], edges: GraphEdge[], width: number, height: number): void {
  const { repulsion, springLength, springStrength, damping, centerGravity, iterations } = SIMULATION_CONFIG;
  const cx = width / 2;
  const cy = height / 2;

  const nodeIndex = new Map(nodes.map((n, i) => [n.id, i]));

  for (let iter = 0; iter < iterations; iter++) {
    // Repulsion between all pairs
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i]!;
        const b = nodes[j]!;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = repulsion / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx -= fx;
        a.vy -= fy;
        b.vx += fx;
        b.vy += fy;
      }
    }

    // Spring forces along edges
    for (const edge of edges) {
      const ai = nodeIndex.get(edge.source);
      const bi = nodeIndex.get(edge.target);
      if (ai === undefined || bi === undefined) continue;
      const a = nodes[ai]!;
      const b = nodes[bi]!;
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const displacement = dist - springLength;
      const force = springStrength * displacement;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      a.vx += fx;
      a.vy += fy;
      b.vx -= fx;
      b.vy -= fy;
    }

    // Center gravity
    for (const n of nodes) {
      n.vx += (cx - n.x) * centerGravity;
      n.vy += (cy - n.y) * centerGravity;
    }

    // Apply velocity + damping
    for (const n of nodes) {
      n.vx *= damping;
      n.vy *= damping;
      n.x += n.vx;
      n.y += n.vy;
      // Clamp to bounds
      n.x = Math.max(30, Math.min(width - 30, n.x));
      n.y = Math.max(30, Math.min(height - 30, n.y));
    }
  }
}

// ── Tooltip ──────────────────────────────────────────────────────────────

interface TooltipState {
  x: number;
  y: number;
  node?: GraphNode;
  edge?: GraphEdge & { sourceLabel: string; targetLabel: string };
}

// ── Component ────────────────────────────────────────────────────────────

interface Props {
  /** Max confusion pairs to visualize (default 20) */
  maxPairs?: number;
}

export const ConfusionGraph: React.FC<Props> = ({ maxPairs = 20 }) => {
  const { data, isLoading, error } = useConfusionPairs(maxPairs);
  const navigate = useNavigate();
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [dimensions, setDimensions] = useState({ width: 400, height: 300 });

  // Responsive sizing
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(entries => {
      const entry = entries[0];
      if (entry) {
        const w = entry.contentRect.width;
        setDimensions({ width: w, height: Math.max(260, Math.min(w * 0.65, 400)) });
      }
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  // Build & simulate graph
  const { nodes, edges, maxFreq } = useMemo(() => {
    if (!data?.confusionPairs.length) return { nodes: [], edges: [], maxFreq: 1 };
    const { nodes: n, edges: e } = buildGraph(data.confusionPairs);
    runSimulation(n, e, dimensions.width, dimensions.height);
    const mf = Math.max(1, ...e.map(x => x.frequency));
    return { nodes: n, edges: e, maxFreq: mf };
  }, [data, dimensions.width, dimensions.height]);

  const nodeMap = useMemo(
    () => new Map(nodes.map(n => [n.id, n])),
    [nodes]
  );

  const maxWeight = useMemo(
    () => Math.max(1, ...nodes.map(n => n.weight)),
    [nodes]
  );

  const handleNodeClick = useCallback((node: GraphNode) => {
    // Find the top confusion pair involving this node
    const pair = data?.confusionPairs.find(
      p => p.correctConditionId === node.id || p.selectedConditionId === node.id
    );
    if (pair) {
      navigate(`/drills/ddx?conditions=${pair.correctConditionId},${pair.selectedConditionId}`);
    }
  }, [data, navigate]);

  const handleNodeHover = useCallback((node: GraphNode | null, event?: React.MouseEvent) => {
    if (!node || !event) {
      setTooltip(null);
      return;
    }
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top - 10,
      node,
    });
  }, []);

  const handleEdgeHover = useCallback((edge: GraphEdge | null, event?: React.MouseEvent) => {
    if (!edge || !event) {
      setTooltip(null);
      return;
    }
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const src = nodeMap.get(edge.source);
    const tgt = nodeMap.get(edge.target);
    setTooltip({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top - 10,
      edge: {
        ...edge,
        sourceLabel: src?.label ?? edge.source,
        targetLabel: tgt?.label ?? edge.target,
      },
    });
  }, [nodeMap]);

  // ── Loading ──

  if (isLoading) {
    return (
      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-5">
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
          Confusion Network
        </h2>
        <div className="h-64 rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)] animate-pulse" />
      </section>
    );
  }

  // ── Error / empty ──

  if (error || !nodes.length) {
    return (
      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-5">
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">
          Confusion Network
        </h2>
        <p className="text-sm text-[var(--color-text-muted)]">
          {error
            ? 'Unable to load confusion data.'
            : 'Not enough confusion pair data yet. Keep studying — the graph appears once patterns emerge.'}
        </p>
      </section>
    );
  }

  // ── Collect unique systems for legend ──

  const uniqueSystems = [...new Set(nodes.map(n => n.system).filter(Boolean))] as string[];

  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-5">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
          Confusion Network
        </h2>
        <span className="text-[10px] text-[var(--color-text-muted)]">
          {nodes.length} conditions &middot; {edges.length} links &middot; Click node to drill
        </span>
      </div>

      <div ref={containerRef} className="relative">
        <svg
          ref={svgRef}
          width={dimensions.width}
          height={dimensions.height}
          className="rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)]"
          onMouseLeave={() => setTooltip(null)}
        >
          {/* Edges */}
          {edges.map((edge, i) => {
            const src = nodeMap.get(edge.source);
            const tgt = nodeMap.get(edge.target);
            if (!src || !tgt) return null;

            const strokeWidth = 1 + (edge.frequency / maxFreq) * 4;
            const opacity = 0.25 + (edge.frequency / maxFreq) * 0.5;

            return (
              <line
                key={`e-${i}`}
                x1={src.x}
                y1={src.y}
                x2={tgt.x}
                y2={tgt.y}
                stroke={getSystemColor(edge.system)}
                strokeWidth={strokeWidth}
                strokeOpacity={opacity}
                strokeLinecap="round"
                className="cursor-pointer"
                onMouseEnter={(e) => handleEdgeHover(edge, e)}
                onMouseLeave={() => setTooltip(null)}
              />
            );
          })}

          {/* Nodes */}
          {nodes.map((node) => {
            const r = 6 + (node.weight / maxWeight) * 12;
            const color = getSystemColor(node.system);

            return (
              <g
                key={node.id}
                className="cursor-pointer"
                onClick={() => handleNodeClick(node)}
                onMouseEnter={(e) => handleNodeHover(node, e)}
                onMouseLeave={() => setTooltip(null)}
              >
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={r}
                  fill={color}
                  fillOpacity={0.85}
                  stroke={color}
                  strokeWidth={1.5}
                  strokeOpacity={0.4}
                />
                {/* Label — only show for larger nodes to avoid clutter */}
                {r >= 10 && (
                  <text
                    x={node.x}
                    y={node.y + r + 12}
                    textAnchor="middle"
                    className="text-[9px] fill-[var(--color-text-muted)] pointer-events-none select-none"
                  >
                    {node.label.length > 18 ? node.label.slice(0, 16) + '…' : node.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="absolute z-10 px-3 py-2 rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)] shadow-lg pointer-events-none max-w-[220px]"
            style={{
              left: Math.min(tooltip.x, dimensions.width - 230),
              top: tooltip.y - 50,
            }}
          >
            {tooltip.node && (
              <>
                <p className="text-xs font-semibold text-[var(--color-text-primary)] mb-0.5 leading-tight">
                  {tooltip.node.label}
                </p>
                <p className="text-[10px] text-[var(--color-text-muted)]">
                  {tooltip.node.system ?? 'Unknown system'} &middot; {tooltip.node.weight} confusions
                </p>
                <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                  Click to drill
                </p>
              </>
            )}
            {tooltip.edge && (
              <>
                <p className="text-xs font-semibold text-[var(--color-text-primary)] leading-tight">
                  {tooltip.edge.sourceLabel}
                </p>
                <p className="text-[10px] text-[var(--color-text-muted)] my-0.5">confused with</p>
                <p className="text-xs font-semibold text-[var(--color-text-primary)] leading-tight">
                  {tooltip.edge.targetLabel}
                </p>
                <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                  {tooltip.edge.frequency}× &middot; {tooltip.edge.system ?? 'Unknown'}
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* System legend */}
      {uniqueSystems.length > 1 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3">
          {uniqueSystems.slice(0, 8).map(sys => (
            <span key={sys} className="flex items-center gap-1 text-[10px] text-[var(--color-text-muted)]">
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ backgroundColor: getSystemColor(sys) }}
              />
              {sys}
            </span>
          ))}
          {uniqueSystems.length > 8 && (
            <span className="text-[10px] text-[var(--color-text-muted)]">
              +{uniqueSystems.length - 8} more
            </span>
          )}
        </div>
      )}
    </section>
  );
};

export default ConfusionGraph;
