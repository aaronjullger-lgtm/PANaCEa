import React from 'react';
import { History } from 'lucide-react';
import type { VisualToken } from '../../model/visualTokens';
import { VisualTokenSurface } from '../../visuals/VisualTokenProvider';
import type { RecentSessionsData } from '../widgetData';

export function RecentSessionsWidget({ data, visual }: { data: RecentSessionsData; visual: VisualToken }) {
  return (
    <VisualTokenSurface visual={visual} className="p-4" as="section">
      <div className="flex items-center gap-2">
        <History className="h-4 w-4 text-[var(--color-text-muted)]" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Recent sessions</h2>
      </div>
      <ul className="mt-3 space-y-2">
        {data.sessions.map((s) => {
          const acc = s.accuracy;
          const accColor =
            acc == null
              ? 'var(--color-text-muted)'
              : acc >= 80
                ? 'var(--color-success)'
                : acc >= 60
                  ? 'var(--color-accent)'
                  : 'var(--color-risk)';
          return (
            <li key={s.id} className="flex items-center justify-between gap-2 text-xs">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="shrink-0 text-[var(--color-text-muted)]">{s.dateLabel}</span>
                <span className="truncate font-medium text-[var(--color-text-secondary)]">{s.modeLabel}</span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {acc != null && (
                  <span className="font-semibold tabular-nums" style={{ color: accColor }}>
                    {Math.round(acc)}%
                  </span>
                )}
                <span className="tabular-nums text-[var(--color-text-muted)]">{s.durationMinutes}m</span>
              </div>
            </li>
          );
        })}
      </ul>
    </VisualTokenSurface>
  );
}
