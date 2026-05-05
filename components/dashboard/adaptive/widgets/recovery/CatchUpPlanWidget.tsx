import React from 'react';
import { Route } from 'lucide-react';
import type { VisualToken } from '../../model/visualTokens';
import { VisualTokenSurface } from '../../visuals/VisualTokenProvider';
import type { CatchUpPlanData } from '../widgetData';

export function CatchUpPlanWidget({ data, visual }: { data: CatchUpPlanData; visual: VisualToken }) {
  return (
    <VisualTokenSurface visual={visual} className="p-4" as="section">
      <div className="flex items-start gap-3">
        <Route className="mt-0.5 h-5 w-5 text-[var(--color-accent)]" aria-hidden="true" />
        <div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Catch-up path</p>
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">{data.title}</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">{data.detail}</p>
          <p className="mt-3 font-mono text-sm font-semibold text-[var(--color-text-primary)]">
            {data.minutesPerDay} min/day · {data.days} days
          </p>
        </div>
      </div>
    </VisualTokenSurface>
  );
}
