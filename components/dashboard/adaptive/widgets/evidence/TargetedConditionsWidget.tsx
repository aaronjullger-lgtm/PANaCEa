import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import type { TargetedConditionsData } from '../widgetData';
import type { VisualToken } from '../../model/visualTokens';

export function TargetedConditionsWidget({ data }: { data: TargetedConditionsData; visual: VisualToken }) {
  if (data.conditions.length === 0) return null;

  return (
    <article className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)]/75 p-3">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--color-bg-tertiary)] text-[var(--color-accent)]">
          <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Today's conditions</h3>
      </div>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {data.conditions.map((c) => (
          <li key={c.href}>
            <Link
              to={c.href}
              className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-2.5 py-1 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
            >
              {c.name}
            </Link>
          </li>
        ))}
      </ul>
    </article>
  );
}
