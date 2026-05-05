import React, { useId, useState } from 'react';
import type { VisualToken } from '../../model/visualTokens';
import { VisualTokenSurface } from '../../visuals/VisualTokenProvider';
import { MatrixBubble } from '../../visuals/MatrixBubble';
import type { MatrixItem } from '../../model/DashboardContext';
import type { MasteryUrgencyMatrixData } from '../widgetData';

export function MasteryUrgencyMatrixWidget({ data, visual }: { data: MasteryUrgencyMatrixData; visual: VisualToken }) {
  const [selected, setSelected] = useState<MatrixItem | null>(data.items.find((item) => item.isTodayTarget) ?? null);
  const detailId = useId();

  return (
    <VisualTokenSurface visual={visual} className="p-5" as="section">
      <div>
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Mastery × urgency</p>
        <h2 className="mt-1 text-lg font-semibold text-[var(--color-text-primary)]">What to work on after today’s plan</h2>
      </div>
      <div className="relative mt-4 h-80 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)]/70">
        <div className="absolute left-3 top-3 text-xs font-semibold text-[var(--color-text-muted)]">Maintain</div>
        <div className="absolute right-3 top-3 text-xs font-semibold text-[var(--color-text-muted)]">Safe</div>
        <div className="absolute bottom-3 left-3 text-xs font-semibold text-[var(--color-text-muted)]">Act first</div>
        <div className="absolute bottom-3 right-3 text-xs font-semibold text-[var(--color-text-muted)]">Monitor</div>
        <div className="absolute inset-x-6 top-1/2 border-t border-dashed border-[var(--color-border)]" />
        <div className="absolute inset-y-6 left-1/2 border-l border-dashed border-[var(--color-border)]" />
        {data.items.slice(0, 7).map((item) => (
          <MatrixBubble
            key={item.id}
            item={item}
            selected={selected?.id === item.id}
            onSelect={setSelected}
          />
        ))}
      </div>
      {selected ? (
        <div
          id={detailId}
          className="mt-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)]/75 p-3"
          role="region"
          aria-label={`${selected.label} detail`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{selected.label}</h3>
            <span className="font-mono text-xs text-[var(--color-text-muted)]">
              Urgency {Math.round(selected.urgency * 100)} · Mastery {Math.round(selected.mastery * 100)}
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">{selected.attribution}</p>
        </div>
      ) : null}
      <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
        Bubble position combines urgency and mastery; size reflects exam or rotation weight, and arrows show trend.
      </p>
    </VisualTokenSurface>
  );
}
