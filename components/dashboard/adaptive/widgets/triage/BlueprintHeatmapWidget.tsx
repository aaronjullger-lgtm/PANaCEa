import React from 'react';
import type { VisualToken } from '../../model/visualTokens';
import { VisualTokenSurface } from '../../visuals/VisualTokenProvider';
import type { BlueprintHeatmapData } from '../widgetData';

export function BlueprintHeatmapWidget({ data, visual }: { data: BlueprintHeatmapData; visual: VisualToken }) {
  return (
    <VisualTokenSurface visual={visual} className="p-5" as="section">
      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">System overview</p>
      <h2 className="mt-1 text-lg font-semibold text-[var(--color-text-primary)]">Compact blueprint heatmap</h2>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {data.cells.map((cell) => (
          <button
            key={cell.id}
            type="button"
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            aria-label={`${cell.system} ${cell.subsection}, mastery ${cell.mastery == null ? 'not enough data' : Math.round(cell.mastery * 100)}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-[var(--color-text-primary)]">{cell.system}</span>
              {cell.isTodayTarget && <span className="rounded-full bg-[var(--color-accent)]/10 px-2 py-0.5 text-[0.65rem] font-semibold text-[var(--color-accent)]">Today</span>}
            </div>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">{cell.subsection}</p>
            <div className="mt-3 h-2 rounded-full bg-[var(--color-bg-tertiary)]">
              <div className="h-full rounded-full bg-[var(--color-accent)]" style={{ width: `${Math.round((cell.mastery ?? 0.18) * 100)}%` }} />
            </div>
          </button>
        ))}
      </div>
    </VisualTokenSurface>
  );
}
