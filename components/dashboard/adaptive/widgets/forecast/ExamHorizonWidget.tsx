import React from 'react';
import { CalendarDays } from 'lucide-react';
import type { VisualToken } from '../../model/visualTokens';
import { VisualTokenSurface } from '../../visuals/VisualTokenProvider';
import type { ExamHorizonData } from '../widgetData';

export function ExamHorizonWidget({ data, visual }: { data: ExamHorizonData; visual: VisualToken }) {
  const progress = Math.max(0, Math.min(1, (30 - data.daysToTarget) / 30));

  return (
    <VisualTokenSurface visual={visual} className="p-4" as="section">
      <div className="flex items-center gap-3">
        <CalendarDays className="h-5 w-5 text-[var(--color-accent)]" aria-hidden="true" />
        <div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Exam horizon</p>
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">{data.label}</h2>
        </div>
      </div>
      <div className="mt-4 h-2 rounded-full bg-[var(--color-bg-tertiary)]" role="img" aria-label={`${data.daysToTarget} days to target, ${data.statusLabel}`}>
        <div className="h-full rounded-full bg-[var(--color-accent)]" style={{ width: `${progress * 100}%` }} />
      </div>
      <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
        {data.daysToTarget} days · {data.statusLabel}. The plan narrows without turning the dashboard into a countdown.
      </p>
    </VisualTokenSurface>
  );
}
