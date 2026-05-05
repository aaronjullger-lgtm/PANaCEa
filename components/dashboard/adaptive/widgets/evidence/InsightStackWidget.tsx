import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { VisualToken } from '../../model/visualTokens';
import { VisualTokenSurface } from '../../visuals/VisualTokenProvider';
import type { InsightStackData } from '../widgetData';
import { InsightCard } from './InsightCard';

export function InsightStackWidget({ data, visual }: { data: InsightStackData; visual: VisualToken }) {
  return (
    <VisualTokenSurface visual={visual} className="p-4" as="section">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Adaptive insight stack</p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--color-text-primary)]">Only signals that matter today</h2>
        </div>
        <span className="rounded-full border border-[var(--color-border)] px-2 py-1 font-mono text-xs text-[var(--color-text-secondary)]">
          {data.cards.length}/3
        </span>
      </div>
      <div className="mt-4 space-y-3">
        {data.cards.length > 0 ? (
          data.cards.map((card) => <InsightCard key={card.id} card={card} />)
        ) : (
          <div className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-3 text-sm text-[var(--color-text-secondary)]">
            <CheckCircle2 className="h-4 w-4 text-[var(--color-success)]" aria-hidden="true" />
            {data.emptyMessage}
          </div>
        )}
      </div>
    </VisualTokenSurface>
  );
}
