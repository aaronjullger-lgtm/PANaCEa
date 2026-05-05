import React from 'react';
import { ArrowRight, Clock3, FileText, HelpCircle, ListChecks } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { VisualToken } from '../../model/visualTokens';
import { ClinicalSessionTicket } from '../../visuals/ClinicalSessionTicket';
import type { TodayCommandData } from '../widgetData';

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)]/70 px-3 py-2">
      <div className="flex items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
        {icon}
        {label}
      </div>
      <p className="mt-1 font-mono text-sm font-semibold text-[var(--color-text-primary)]">{value}</p>
    </div>
  );
}

export function TodayCommandWidget({ data, visual }: { data: TodayCommandData; visual: VisualToken }) {
  const secondaryHandlers = {
    short: data.onStartShort,
    full_plan: data.onOpenFullPlan,
    why: data.onOpenWhy,
  };

  return (
    <ClinicalSessionTicket visual={visual} className="p-5 sm:p-6" aria-labelledby="today-session-heading">
      <div className="flex flex-col gap-5">
        <div>
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-[var(--color-accent)]">
            Today&apos;s session
          </p>
          <h2 id="today-session-heading" className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-[var(--color-text-primary)] sm:text-3xl">
            {data.title}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-text-secondary)]">{data.subtitle}</p>
        </div>

        <div className="grid gap-2 sm:grid-cols-4">
          <Metric icon={<Clock3 className="h-3.5 w-3.5" aria-hidden="true" />} label="Duration" value={`${data.durationMinutes} min`} />
          <Metric icon={<FileText className="h-3.5 w-3.5" aria-hidden="true" />} label="Questions" value={String(data.questionCount)} />
          <Metric icon={<ListChecks className="h-3.5 w-3.5" aria-hidden="true" />} label="Reviews" value={`${data.reviewCount} included`} />
          <Metric icon={<HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />} label="Lift" value={data.expectedLiftLabel.replace('Expected lift: ', '')} />
        </div>

        <div className="flex flex-wrap gap-2">
          {data.reasonChips.map((chip) => (
            <span
              key={chip}
              className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-3 py-1 text-xs font-medium text-[var(--color-text-secondary)]"
            >
              {chip}
            </span>
          ))}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button type="button" size="lg" variant="primary" onClick={data.onStart} data-testid="primary-study-action" className="w-full sm:w-auto">
            {data.primaryCtaLabel}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {data.secondaryLinks.map((link) => (
              <button
                key={link.action}
                type="button"
                onClick={secondaryHandlers[link.action]}
                className="min-h-[36px] text-sm font-medium text-[var(--color-text-secondary)] underline-offset-4 hover:text-[var(--color-text-primary)] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
              >
                {link.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </ClinicalSessionTicket>
  );
}

export const BaselineCommandWidget = TodayCommandWidget;
export const MaintenanceCommandWidget = TodayCommandWidget;
