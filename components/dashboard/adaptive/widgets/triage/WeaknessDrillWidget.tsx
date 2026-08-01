import React from 'react';
import { Link } from 'react-router-dom';
import { Crosshair, TrendingUp, TrendingDown, Minus, ArrowRight } from 'lucide-react';
import type { VisualToken } from '../../model/visualTokens';
import { VisualTokenSurface } from '../../visuals/VisualTokenProvider';
import type { WeaknessDrillData } from '../widgetData';

function TrendIcon({ trend }: { trend: WeaknessDrillData['trend'] }) {
  if (trend === 'improving') return <TrendingUp className="h-3.5 w-3.5 text-[var(--color-success)]" aria-label="improving" />;
  if (trend === 'declining') return <TrendingDown className="h-3.5 w-3.5 text-[var(--color-risk)]" aria-label="declining" />;
  return <Minus className="h-3.5 w-3.5 text-[var(--color-text-muted)]" aria-label="stable" />;
}

export function WeaknessDrillWidget({ data, visual }: { data: WeaknessDrillData; visual: VisualToken }) {
  const accuracyColor = data.accuracy < 50 ? 'var(--color-risk)' : data.accuracy < 70 ? 'var(--color-accent)' : 'var(--color-success)';

  return (
    <VisualTokenSurface visual={visual} className="p-4" as="section">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Weakest system</p>
          <h2 className="mt-1 text-base font-semibold text-[var(--color-text-primary)]">{data.system}</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">{data.systemLabel}</p>
        </div>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-bg-tertiary)] text-[var(--color-risk)]">
          <Crosshair className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold tabular-nums" style={{ color: accuracyColor }}>
            {Math.round(data.accuracy)}%
          </span>
          <span className="text-xs text-[var(--color-text-muted)]">accuracy</span>
        </div>
        <div className="flex items-center gap-1 border-l border-[var(--color-border)] pl-3">
          <TrendIcon trend={data.trend} />
          <span className="text-xs text-[var(--color-text-secondary)]">{data.attempts} attempts</span>
        </div>
      </div>

      {data.gapPercent != null && data.gapPercent > 0 && (
        <p className="mt-2 text-xs leading-5 text-[var(--color-text-secondary)]">
          {data.gapPercent.toFixed(0)}% below blueprint target — {data.weaknessLabel.replace(/-/g, ' ')}.
        </p>
      )}

      <Link
        to={data.drillHref}
        className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--color-accent-button)] px-3 py-2 text-sm font-medium text-[var(--color-text-inverse)] transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
      >
        Drill {data.system}
        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </Link>
    </VisualTokenSurface>
  );
}
