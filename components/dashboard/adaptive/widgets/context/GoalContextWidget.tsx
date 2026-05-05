import React from 'react';
import { CheckCircle2, Clock3, Info } from 'lucide-react';
import type { VisualToken } from '../../model/visualTokens';
import { VisualTokenSurface } from '../../visuals/VisualTokenProvider';
import type { GoalContextData } from '../widgetData';

export function GoalContextWidget({ data, visual }: { data: GoalContextData; visual: VisualToken }) {
  const statusIcon = data.goal.status === 'calibrating' ? Info : data.goal.status === 'behind' ? Clock3 : CheckCircle2;
  const StatusIcon = statusIcon;

  return (
    <VisualTokenSurface visual={visual} className="px-4 py-3" as="section">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-current/20 bg-current/8">
            <StatusIcon className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold text-[var(--color-text-primary)]">{data.goal.label}</h1>
            <p className="text-sm text-[var(--color-text-secondary)]">
              {data.goal.targetLabel} · {data.goal.statusLabel} · {data.recommendedMinutes} min recommended today
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-[var(--color-text-secondary)]">
          <span className="h-2 w-2 rounded-full bg-current" aria-hidden="true" />
          {data.partialFailure ? 'Partial signal' : data.goal.syncedLabel}
        </div>
      </div>
    </VisualTokenSurface>
  );
}
