import React from 'react';
import { Activity, Info, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { VisualToken } from '../../model/visualTokens';
import { VisualTokenSurface } from '../../visuals/VisualTokenProvider';
import { ConfidenceBand } from '../../visuals/ConfidenceBand';
import type { ReadinessPulseData } from '../widgetData';

export function ReadinessPulseWidget({ data, visual }: { data: ReadinessPulseData; visual: VisualToken }) {
  return (
    <VisualTokenSurface visual={visual} className="p-4" as="section">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Readiness pulse</p>
          <h2 className="mt-1 text-base font-semibold text-[var(--color-text-primary)]">{data.statusLabel}</h2>
        </div>
        <Activity className="h-5 w-5 text-[var(--color-accent)]" aria-hidden="true" />
      </div>
      {data.available ? (
        <div className="mt-3 text-[var(--color-accent)]">
          <ConfidenceBand
            points={data.points}
            low={data.confidenceLow}
            high={data.confidenceHigh}
            target={data.target}
            label={`Readiness pulse with ${data.confidence} confidence. ${data.summary}`}
          />
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-bg-primary)] p-4 text-sm text-[var(--color-text-secondary)]">
          Forecast hidden until the baseline is strong enough.
        </div>
      )}
      <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">{data.summary}</p>
      <details className="mt-2">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-[var(--color-text-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]">
          <Info className="h-3.5 w-3.5" aria-hidden="true" />
          Assumptions
        </summary>
        <p className="mt-2 text-xs leading-5 text-[var(--color-text-secondary)]">
          This band uses recent completed sessions and review load. It is intentionally shown as a range, not a precise score prediction.
        </p>
      </details>
      {data.available && (
        <Link
          to="/progress"
          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[var(--color-accent-button)] hover:text-[var(--color-accent)]"
        >
          View progress details
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </Link>
      )}
    </VisualTokenSurface>
  );
}
