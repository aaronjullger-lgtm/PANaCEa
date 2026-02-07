/**
 * PANCEReadinessTreemap – Multi-level interactive Treemap for PANCE readiness.
 * Size = question volume, color = mastery (red weak, green strong). Drill-down by system → topics.
 */

import React, { useState, useMemo } from 'react';
import { ResponsiveContainer, Treemap } from 'recharts';
import { ChevronLeft, Activity } from 'lucide-react';

export interface SystemNode {
  name: string;
  systemCode?: string;
  volume: number;
  masteryPercent: number; // 0–100
  children?: { name: string; volume: number; masteryPercent: number }[];
}

interface PANCEReadinessTreemapProps {
  /** Top-level systems with optional children (topics) */
  data: SystemNode[];
  /** Callback when a node is selected (e.g. drill into system) */
  onNodeSelect?: (node: SystemNode) => void;
  className?: string;
}

function getMasteryColor(pct: number): string {
  if (pct >= 80) return 'var(--color-data-pass)';
  if (pct >= 60) return 'var(--color-accent)';
  return 'var(--color-data-fail)';
}

/** Custom content for each Treemap cell: label + mastery tint */
function renderTreemapContent(props: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  name?: string;
  depth?: number;
  index?: number;
  masteryPercent?: number;
}) {
  const { x = 0, y = 0, width = 0, height = 0, name = '', depth = 0, masteryPercent = 0 } = props;
  if (width <= 0 || height <= 0) return <g />;
  const fill = getMasteryColor(masteryPercent);
  const opacity = depth === 0 ? 0.85 : 0.75;
  const showLabel = width > 60 && height > 24;

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={fill}
        fillOpacity={opacity}
        stroke="var(--color-border)"
        strokeWidth={1}
        rx={4}
      />
      {showLabel && (
        <text
          x={x + width / 2}
          y={y + height / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="var(--color-text-primary)"
          fontSize={Math.min(12, width / 8)}
          fontWeight={600}
        >
          {name}
        </text>
      )}
    </g>
  );
}

export const PANCEReadinessTreemap: React.FC<PANCEReadinessTreemapProps> = ({
  data,
  onNodeSelect,
  className = '',
}) => {
  const [drilled, setDrilled] = useState<SystemNode | null>(null);

  const chartData = useMemo(() => {
    if (drilled?.children?.length) {
      return [
        {
          name: drilled.name,
          volume: drilled.volume,
          masteryPercent: drilled.masteryPercent,
          children: drilled.children.map((c) => ({
            name: c.name,
            volume: c.volume,
            masteryPercent: c.masteryPercent,
            fill: getMasteryColor(c.masteryPercent),
          })),
        },
      ];
    }
    return data.map((d) => ({
      name: d.name,
      volume: d.volume,
      masteryPercent: d.masteryPercent,
      fill: getMasteryColor(d.masteryPercent),
      children: d.children?.map((c) => ({
        name: c.name,
        volume: c.volume,
        masteryPercent: c.masteryPercent,
        fill: getMasteryColor(c.masteryPercent),
      })),
    }));
  }, [data, drilled]);

  const handleClick = (node: { name?: string; volume?: number; masteryPercent?: number }) => {
    if (!node?.name) return;
    const system = data.find((d) => d.name === node.name);
    if (system?.children?.length && onNodeSelect) {
      setDrilled(system);
      onNodeSelect(system);
    }
  };

  return (
    <div className={`rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-4 ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        {drilled && (
          <button
            type="button"
            onClick={() => setDrilled(null)}
            className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
            aria-label="Back to all systems"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
        <Activity className="w-5 h-5 text-[var(--color-accent)]" />
        <h3 className="font-semibold text-[var(--color-text-primary)]">
          {drilled ? drilled.name : 'PANCE readiness by system'}
        </h3>
      </div>
      <div className="h-[320px] min-h-[200px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%" minHeight={200}>
          <Treemap
            data={chartData}
            dataKey="volume"
            aspectRatio={4 / 3}
            stroke="var(--color-border)"
            content={(props) => {
              const p = props as unknown as { payload?: { name?: string; masteryPercent?: number }; x?: number; y?: number; width?: number; height?: number; depth?: number };
              return renderTreemapContent({
                ...p,
                name: p.payload?.name,
                masteryPercent: p.payload?.masteryPercent ?? 0,
              });
            }}
            onClick={(node) => handleClick(node)}
          />
        </ResponsiveContainer>
      </div>
      <div className="flex gap-4 mt-2 text-xs text-[var(--color-text-muted)]">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-[var(--color-data-fail)] opacity-80" /> Weak
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-[var(--color-accent)] opacity-80" /> OK
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-[var(--color-data-pass)] opacity-80" /> Strong
        </span>
      </div>
    </div>
  );
};

export default PANCEReadinessTreemap;
