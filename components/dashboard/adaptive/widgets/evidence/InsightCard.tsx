import React from 'react';
import { Activity, CheckCircle2, Eye, ShieldCheck, Target, TriangleAlert } from 'lucide-react';
import type { DashboardInsightCandidate, InsightActionState, InsightMicroVisual } from '../../model/widgetTypes';
import { MicroBars } from '../../visuals/MicroBars';

function stateLabel(state: InsightActionState): string {
  switch (state) {
    case 'in_plan':
      return 'In plan';
    case 'needs_action':
      return 'Needs action';
    case 'monitor':
      return 'Monitor';
    case 'protected':
      return 'Protected';
    case 'reassurance':
      return 'Protected';
    default:
      return 'Monitor';
  }
}

function stateIcon(state: InsightActionState) {
  if (state === 'needs_action') return TriangleAlert;
  if (state === 'in_plan' || state === 'protected' || state === 'reassurance') return ShieldCheck;
  return Eye;
}

function MicroVisual({ visual }: { visual: InsightMicroVisual }) {
  switch (visual.kind) {
    case 'segmented-bar':
      return (
        <MicroBars
          ariaLabel={`${visual.covered} covered, ${visual.remaining} remaining`}
          total={visual.total}
          segments={[
            { label: 'covered', value: visual.covered, className: 'bg-[var(--color-success)]' },
            { label: 'remaining', value: visual.remaining, className: 'bg-[var(--color-risk)] bg-[repeating-linear-gradient(45deg,currentColor_0_2px,transparent_2px_5px)]' },
          ]}
        />
      );
    case 'weighted-meter':
      return (
        <div role="img" aria-label={`${visual.label} is ${visual.value}, target ${visual.target}`}>
          <div className="flex h-2 overflow-hidden rounded-full bg-[var(--color-bg-tertiary)]">
            <span className="bg-[var(--color-accent)]" style={{ width: `${Math.min(100, visual.value)}%` }} />
          </div>
          <p className="mt-1 font-mono text-[0.68rem] text-[var(--color-text-muted)]">{visual.label} {visual.value} / {visual.target}</p>
        </div>
      );
    case 'split-contrast':
      return (
        <div role="img" aria-label={`${visual.left} compared with ${visual.right}`} className="flex gap-1 text-[0.72rem] font-semibold">
          <span className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-2 py-1">{visual.left}</span>
          <span className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-2 py-1">{visual.right}</span>
          {visual.handled && <CheckCircle2 className="h-4 w-4 text-[var(--color-success)]" aria-label="covered by today’s plan" />}
        </div>
      );
    case 'countdown-rail':
      return (
        <div role="img" aria-label={visual.label}>
          <div className="h-2 rounded-full bg-[var(--color-bg-tertiary)]">
            <div className="h-full rounded-full bg-[var(--color-accent)]" style={{ width: `${(visual.current / visual.total) * 100}%` }} />
          </div>
          <p className="mt-1 font-mono text-[0.68rem] text-[var(--color-text-muted)]">{visual.label}</p>
        </div>
      );
    case 'load-meter':
      return (
        <div role="img" aria-label={`Load ${visual.value} of ${visual.max}`} className="flex gap-1">
          {Array.from({ length: visual.max }, (_, index) => (
            <span key={index} className={`h-2 flex-1 rounded-full ${index < visual.value ? 'bg-[var(--color-risk)]' : 'bg-[var(--color-bg-tertiary)]'}`} />
          ))}
        </div>
      );
    case 'calibration-ring':
      return <div className="font-mono text-sm text-[var(--color-text-secondary)]">{visual.value}% {visual.label}</div>;
    case 'confidence-bars':
      return (
        <MicroBars
          ariaLabel={`Confidence ${visual.confidence}, accuracy ${visual.accuracy}`}
          total={200}
          segments={[
            { label: 'confidence', value: visual.confidence, className: 'bg-[var(--color-accent)]' },
            { label: 'accuracy', value: visual.accuracy, className: 'bg-[var(--color-success)]' },
          ]}
        />
      );
    case 'shield':
      return <div className="font-mono text-sm text-[var(--color-text-secondary)]">{visual.label} · {visual.value}</div>;
    default:
      return null;
  }
}

export function InsightCard({ card }: { card: DashboardInsightCandidate }) {
  const Icon = card.signalId.includes('retention') ? ShieldCheck : card.signalId.includes('forecast') ? Activity : Target;
  const StateIcon = stateIcon(card.actionState);

  return (
    <article className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)]/75 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-2">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-bg-tertiary)] text-[var(--color-accent)]">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{card.title}</h3>
            <p className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">{card.explanation}</p>
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--color-border)] px-2 py-1 text-[0.65rem] font-semibold text-[var(--color-text-secondary)]">
          <StateIcon className="h-3 w-3" aria-hidden="true" />
          {stateLabel(card.actionState)}
        </span>
      </div>
      <div className="mt-3">
        <MicroVisual visual={card.microVisual} />
      </div>
      <p className="mt-2 text-[0.68rem] leading-4 text-[var(--color-text-muted)]">{card.attribution}</p>
    </article>
  );
}
