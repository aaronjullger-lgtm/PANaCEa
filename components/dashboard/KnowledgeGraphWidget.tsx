/**
 * KnowledgeGraphWidget — Prerequisite knowledge graph mastery overview
 *
 * Fetches from GET /api/analytics/knowledge-graph and displays:
 * - Compact bubble grid of concepts colored by mastery
 * - Summary stats (avg mastery, nodes studied, edge count)
 * - System filter toggle
 *
 * @see lib/services/prerequisiteGraphService.ts
 * @see functions/api/analytics/knowledge-graph.ts
 */

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import useSWR from 'swr';
import { useAuth } from '@clerk/clerk-react';
import { GitBranch, RefreshCw, Circle } from 'lucide-react';
import { ClinicalSkeleton } from '@/components/loading';
import { useReducedMotion } from '@/hooks/useReducedMotion';

interface GraphNode {
  id: string;
  type: string;
  label: string;
  description: string | null;
  sourceType: string;
  sourceId: string;
  systems: string[];
  mastery: {
    accuracy: number;
    stability: number;
    attempts: number;
    mastery: number;
  } | null;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  weight: number;
}

interface KnowledgeGraphResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
  summary: {
    totalNodes: number;
    totalEdges: number;
    avgMastery: number;
    nodesWithMastery: number;
  };
}

function createFetcher(getToken: () => Promise<string | null>) {
  return async (url: string): Promise<KnowledgeGraphResponse> => {
    const token = await getToken();
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to fetch knowledge graph');
    return res.json() as Promise<KnowledgeGraphResponse>;
  };
}

function getMasteryColor(mastery: number | null): string {
  if (mastery === null) return 'var(--color-bg-tertiary)';
  if (mastery >= 0.7) return 'var(--color-data-pass)';
  if (mastery >= 0.4) return 'var(--color-data-provisional)';
  if (mastery > 0) return 'var(--color-data-fail)';
  return 'var(--color-bg-tertiary)';
}

function getMasteryLabel(mastery: number | null): string {
  if (mastery === null) return 'Not studied';
  if (mastery >= 0.7) return 'Strong';
  if (mastery >= 0.4) return 'Developing';
  if (mastery > 0) return 'Weak';
  return 'Not studied';
}

function ConceptBubble({
  node,
  index,
  prefersReducedMotion,
}: {
  node: GraphNode;
  index: number;
  prefersReducedMotion: boolean;
}) {
  const mastery = node.mastery?.mastery ?? null;
  const color = getMasteryColor(mastery);
  const label = node.label.length > 18 ? node.label.slice(0, 16) + '…' : node.label;

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.02, 0.5) }}
      className="flex flex-col items-center gap-1 group cursor-default"
      title={`${node.label}: ${getMasteryLabel(mastery)}${node.mastery ? ` (${Math.round(node.mastery.mastery * 100)}%)` : ''}`}
    >
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center border-2 transition-transform group-hover:scale-110"
        style={{
          backgroundColor: `color-mix(in srgb, ${color} 20%, transparent)`,
          borderColor: `color-mix(in srgb, ${color} 60%, transparent)`,
        }}
      >
        <div
          className="w-4 h-4 rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>
      <span className="text-[10px] text-[var(--color-text-muted)] text-center leading-tight max-w-[64px] truncate">
        {label}
      </span>
    </motion.div>
  );
}

export default function KnowledgeGraphWidget() {
  const { getToken } = useAuth();
  const prefersReducedMotion = useReducedMotion();
  const [systemFilter, setSystemFilter] = useState<string | null>(null);

  const url = systemFilter
    ? `/api/analytics/knowledge-graph?system=${encodeURIComponent(systemFilter)}&limit=40`
    : '/api/analytics/knowledge-graph?limit=40';

  const { data, error, isLoading, mutate } = useSWR(
    url,
    createFetcher(getToken),
    { revalidateOnFocus: false, dedupingInterval: 600_000 }
  );

  // Extract unique systems from loaded nodes
  const availableSystems = useMemo(() => {
    if (!data) return [];
    const systems = new Set<string>();
    for (const node of data.nodes) {
      for (const s of node.systems) systems.add(s);
    }
    return [...systems].sort();
  }, [data]);

  if (isLoading) {
    return (
      <div className="p-5">
        <ClinicalSkeleton lines={4} className="min-h-[140px]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-5 text-center">
        <p className="text-sm text-[var(--color-text-muted)] mb-3">Couldn't load knowledge graph</p>
        <button
          onClick={() => mutate()}
          className="text-xs text-[var(--color-accent)] hover:underline flex items-center gap-1 mx-auto"
        >
          <RefreshCw size={12} /> Retry
        </button>
      </div>
    );
  }

  if (data.nodes.length === 0) {
    return (
      <div className="p-5 text-center">
        <GitBranch size={24} className="mx-auto mb-2 text-[var(--color-text-muted)]" />
        <p className="text-sm text-[var(--color-text-primary)] font-medium">Knowledge Graph Empty</p>
        <p className="text-xs text-[var(--color-text-muted)] mt-1">
          Complete study sessions to populate your knowledge graph
        </p>
      </div>
    );
  }

  const sortedNodes = [...data.nodes].sort((a, b) => {
    const ma = a.mastery?.mastery ?? -1;
    const mb = b.mastery?.mastery ?? -1;
    return mb - ma; // Highest mastery first
  });

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="p-5 space-y-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitBranch size={18} className="text-[var(--color-accent)]" />
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] tracking-wide uppercase">
            Knowledge Graph
          </h3>
        </div>
        <span className="text-xs text-[var(--color-text-muted)]">
          {data.summary.totalNodes} concepts · {data.summary.totalEdges} links
        </span>
      </div>

      {/* System filter */}
      {availableSystems.length > 1 && (
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => setSystemFilter(null)}
            className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
              !systemFilter
                ? 'bg-[var(--color-accent)]/15 border-[var(--color-accent)]/30 text-[var(--color-accent)]'
                : 'border-[var(--color-border)]/50 text-[var(--color-text-muted)] hover:border-[var(--color-accent)]/30'
            }`}
          >
            All
          </button>
          {availableSystems.slice(0, 6).map((s) => (
            <button
              key={s}
              onClick={() => setSystemFilter(s === systemFilter ? null : s)}
              className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                systemFilter === s
                  ? 'bg-[var(--color-accent)]/15 border-[var(--color-accent)]/30 text-[var(--color-accent)]'
                  : 'border-[var(--color-border)]/50 text-[var(--color-text-muted)] hover:border-[var(--color-accent)]/30'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Concept bubble grid */}
      <div className="flex flex-wrap gap-3 justify-center">
        {sortedNodes.slice(0, 24).map((node, i) => (
          <ConceptBubble
            key={node.id}
            node={node}
            index={i}
            prefersReducedMotion={prefersReducedMotion}
          />
        ))}
      </div>

      {/* Legend + avg mastery */}
      <div className="flex items-center justify-between text-[10px] text-[var(--color-text-muted)]">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Circle size={8} fill="var(--color-data-pass)" stroke="none" /> Strong
          </span>
          <span className="flex items-center gap-1">
            <Circle size={8} fill="var(--color-data-provisional)" stroke="none" /> Developing
          </span>
          <span className="flex items-center gap-1">
            <Circle size={8} fill="var(--color-data-fail)" stroke="none" /> Weak
          </span>
          <span className="flex items-center gap-1">
            <Circle size={8} fill="var(--color-bg-tertiary)" stroke="none" /> Unseen
          </span>
        </div>
        <span>Avg: {Math.round(data.summary.avgMastery * 100)}%</span>
      </div>
    </motion.div>
  );
}
