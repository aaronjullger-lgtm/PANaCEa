import React from 'react';
import { ShieldCheck } from 'lucide-react';
import type { VisualToken } from '../../model/visualTokens';
import { VisualTokenSurface } from '../../visuals/VisualTokenProvider';
import type { ReviewCoverageData } from '../widgetData';

export function ReviewCoverageWidget({ data, visual }: { data: ReviewCoverageData; visual: VisualToken }) {
  const max = Math.max(1, ...data.days.map((day) => day.stable + day.danger + day.overdue));
  const protectedCount = data.coveredDanger + data.coveredOverdue;
  const hasPlannedCoverage = data.coverageSource === 'plan_tasks' && protectedCount > 0;

  return (
    <VisualTokenSurface visual={visual} className="p-4" as="section">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Review coverage</p>
          <h2 className="mt-1 text-base font-semibold text-[var(--color-text-primary)]">
            {hasPlannedCoverage ? 'Riskiest reviews protected first' : 'Review load needs a queue pass'}
          </h2>
        </div>
        <ShieldCheck className="h-5 w-5 text-[var(--color-success)]" aria-hidden="true" />
      </div>
      <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">{data.summary}</p>
      <div className="mt-4 flex h-28 items-end gap-2" role="img" aria-label={`Review coverage: ${protectedCount} covered, ${data.overdue} overdue, ${data.danger} due today.`}>
        {data.days.map((day) => {
          const height = ((day.stable + day.danger + day.overdue) / max) * 100;
          return (
            <div key={day.label} className="flex flex-1 flex-col items-center gap-1">
              <div className="relative flex w-full flex-col justify-end overflow-hidden rounded-md bg-[var(--color-bg-tertiary)]" style={{ height: `${Math.max(12, height)}%` }}>
                {day.overdue > 0 && <span className="block bg-[var(--color-risk)] bg-[repeating-linear-gradient(45deg,currentColor_0_2px,transparent_2px_5px)] opacity-80" style={{ height: `${(day.overdue / Math.max(1, day.stable + day.danger + day.overdue)) * 100}%` }} />}
                {day.danger > 0 && <span className="block bg-[var(--color-risk)]" style={{ height: `${(day.danger / Math.max(1, day.stable + day.danger + day.overdue)) * 100}%` }} />}
                {day.stable > 0 && <span className="block bg-[var(--color-success)]/35" style={{ height: `${(day.stable / Math.max(1, day.stable + day.danger + day.overdue)) * 100}%` }} />}
                {day.scheduled > 0 && <span className="absolute inset-x-1 top-1 rounded-full border border-[var(--color-text-inverse)]/80 bg-[var(--color-success)] text-center text-[0.55rem] leading-3 text-[var(--color-text-inverse)]">✓</span>}
              </div>
              <span className="text-[0.65rem] text-[var(--color-text-muted)]">{day.label}</span>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={data.onOpenReview}
        className="mt-3 text-sm font-medium text-[var(--color-accent)] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
      >
        Open review queue
      </button>
    </VisualTokenSurface>
  );
}
