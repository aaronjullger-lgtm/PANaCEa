import React from 'react';
import { Gauge } from 'lucide-react';
import type { VisualToken } from '../../model/visualTokens';
import { VisualTokenSurface } from '../../visuals/VisualTokenProvider';
import type { FsrsHealthData } from '../widgetData';

export function FsrsHealthWidget({ data, visual }: { data: FsrsHealthData; visual: VisualToken }) {
  const retentionColor =
    data.retentionPercent >= 85
      ? 'var(--color-success)'
      : data.retentionPercent >= 75
        ? 'var(--color-accent)'
        : 'var(--color-risk)';

  return (
    <VisualTokenSurface visual={visual} className="p-4" as="section">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">FSRS health</p>
          <h2 className="mt-1 text-base font-semibold text-[var(--color-text-primary)]">{data.interpretation}</h2>
        </div>
        <Gauge className="h-5 w-5 text-[var(--color-accent)]" aria-hidden="true" />
      </div>

      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-2xl font-bold tabular-nums" style={{ color: retentionColor }}>
          {Math.round(data.retentionPercent)}%
        </span>
        <span className="text-xs text-[var(--color-text-muted)]">retention</span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-[var(--color-border)] pt-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--color-text-muted)]">Stability</span>
          <span className="text-xs font-semibold tabular-nums text-[var(--color-text-secondary)]">
            {data.averageStability != null ? data.averageStability.toFixed(1) : '—'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--color-text-muted)]">Difficulty</span>
          <span className="text-xs font-semibold tabular-nums text-[var(--color-text-secondary)]">
            {data.averageDifficulty != null ? data.averageDifficulty.toFixed(1) : '—'}
          </span>
        </div>
      </div>

      {data.optimizerEligible === false && data.optimizerProgress != null && (
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[0.65rem] text-[var(--color-text-muted)]">Optimizer unlock</span>
            <span className="text-[0.65rem] font-semibold tabular-nums text-[var(--color-text-secondary)]">
              {Math.round(data.optimizerProgress)}%
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-[var(--color-bg-tertiary)]">
            <div
              className="h-full rounded-full bg-[var(--color-accent)] transition-all"
              style={{ width: `${Math.min(100, data.optimizerProgress)}%` }}
            />
          </div>
        </div>
      )}
    </VisualTokenSurface>
  );
}
