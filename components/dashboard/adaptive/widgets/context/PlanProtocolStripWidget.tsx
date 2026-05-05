import React from 'react';
import type { VisualToken } from '../../model/visualTokens';
import { VisualTokenSurface } from '../../visuals/VisualTokenProvider';
import type { PlanProtocolStripData } from '../widgetData';

function widthForMinutes(minutes: number): number {
  return Math.max(140, Math.min(260, minutes * 12));
}

export function PlanProtocolStripWidget({ data, visual }: { data: PlanProtocolStripData; visual: VisualToken }) {
  return (
    <VisualTokenSurface visual={visual} className="p-5" as="section">
      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Study protocol</p>
      <h2 className="mt-1 text-lg font-semibold text-[var(--color-text-primary)]">Today’s plan path</h2>
      <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
        {data.steps.map((step, index) => (
          <div
            key={step.id}
            className="shrink-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-3"
            style={{ width: widthForMinutes(step.minutes) }}
          >
            <span className="font-mono text-[0.7rem] text-[var(--color-text-muted)]">0{index + 1}</span>
            <h3 className="mt-1 text-sm font-semibold text-[var(--color-text-primary)]">{step.label}</h3>
            <p className="mt-1 font-mono text-xs text-[var(--color-text-secondary)]">{step.minutes} min</p>
            <p className="mt-2 text-xs leading-5 text-[var(--color-text-muted)]">{step.attribution}</p>
          </div>
        ))}
      </div>
    </VisualTokenSurface>
  );
}
