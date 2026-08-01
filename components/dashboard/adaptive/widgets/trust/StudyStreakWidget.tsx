import React from 'react';
import { Flame, Calendar, Clock } from 'lucide-react';
import type { VisualToken } from '../../model/visualTokens';
import { VisualTokenSurface } from '../../visuals/VisualTokenProvider';
import type { StudyStreakData } from '../widgetData';

export function StudyStreakWidget({ data, visual }: { data: StudyStreakData; visual: VisualToken }) {
  return (
    <VisualTokenSurface visual={visual} className="p-4" as="section">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Study streak</p>
          <h2 className="mt-1 text-base font-semibold text-[var(--color-text-primary)]">{data.message}</h2>
        </div>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-bg-tertiary)] text-[var(--color-accent)]">
          <Flame className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>

      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-3xl font-bold tabular-nums text-[var(--color-text-primary)]">{data.currentStreak}</span>
        <span className="text-xs text-[var(--color-text-muted)]">day{data.currentStreak === 1 ? '' : 's'}</span>
      </div>

      <div className="mt-3 flex items-center gap-4 border-t border-[var(--color-border)] pt-3">
        <div className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-[var(--color-text-muted)]" aria-hidden="true" />
          <span className="text-xs text-[var(--color-text-secondary)]">
            <span className="font-semibold tabular-nums">{data.activeDays}</span> active day{data.activeDays === 1 ? '' : 's'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-[var(--color-text-muted)]" aria-hidden="true" />
          <span className="text-xs text-[var(--color-text-secondary)]">
            <span className="font-semibold tabular-nums">{data.studyMinutes7d}</span> min this week
          </span>
        </div>
      </div>
    </VisualTokenSurface>
  );
}
