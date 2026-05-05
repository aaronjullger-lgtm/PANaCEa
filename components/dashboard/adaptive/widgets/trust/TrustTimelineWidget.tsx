import React from 'react';
import { GitBranch } from 'lucide-react';
import type { VisualToken } from '../../model/visualTokens';
import { VisualTokenSurface } from '../../visuals/VisualTokenProvider';
import type { TrustTimelineData } from '../widgetData';

export function TrustTimelineWidget({ data, visual }: { data: TrustTimelineData; visual: VisualToken }) {
  return (
    <VisualTokenSurface visual={visual} className="p-5" as="section">
      <div className="flex items-center gap-3">
        <GitBranch className="h-5 w-5 text-[var(--color-accent)]" aria-hidden="true" />
        <div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Trust timeline</p>
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Why PANaCEa changed the plan</h2>
        </div>
      </div>
      <ol className="mt-4 space-y-4">
        {data.events.map((event) => (
          <li key={event.id} className="grid gap-2 border-l border-[var(--color-border)] pl-4 sm:grid-cols-[7rem_1fr]">
            <span className="font-mono text-xs text-[var(--color-text-muted)]">{event.when}</span>
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{event.title}</h3>
              <p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">{event.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </VisualTokenSurface>
  );
}
