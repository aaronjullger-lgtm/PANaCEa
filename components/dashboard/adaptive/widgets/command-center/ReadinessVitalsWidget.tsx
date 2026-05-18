import React, { useMemo } from 'react';
import { Activity, AlertTriangle, CheckCircle2, CircleDashed, ShieldCheck } from 'lucide-react';
import type { DashboardContext } from '../../model/DashboardContext';
import { MedicalGlassCard } from '@/components/studypanacea';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  fallbackReadinessVitals,
  type ReadinessVitalMetric,
  type ReadinessVitalMetricId,
  type ReadinessVitalStatus,
} from '../../page/commandCenterMockData';

export interface ReadinessVitalsWidgetProps {
  context: DashboardContext;
  loading?: boolean;
  metrics?: ReadinessVitalMetric[];
  className?: string;
}

const statusClass: Record<ReadinessVitalStatus, string> = {
  strong: 'border-atlas-success text-atlas-success',
  stable: 'border-atlas-cyan text-atlas-cyan',
  watch: 'border-atlas-warning text-atlas-warning',
  risk: 'border-atlas-pulse text-atlas-pulse',
  calibrating: 'border-atlas-violet text-atlas-violet',
};

const statusIcon = {
  strong: CheckCircle2,
  stable: Activity,
  watch: AlertTriangle,
  risk: AlertTriangle,
  calibrating: CircleDashed,
} satisfies Record<ReadinessVitalStatus, typeof Activity>;

function clampPercent(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function percentStatus(value: number | null, strongAt = 78, watchAt = 65): ReadinessVitalStatus {
  if (value == null) return 'calibrating';
  if (value >= strongAt) return 'strong';
  if (value >= watchAt) return 'watch';
  return 'risk';
}

function fallbackMetric(id: ReadinessVitalMetricId): ReadinessVitalMetric {
  return fallbackReadinessVitals.find((metric) => metric.id === id) ?? fallbackReadinessVitals[0];
}

function metricWithFallback(
  id: ReadinessVitalMetricId,
  overrides: Partial<ReadinessVitalMetric>,
): ReadinessVitalMetric {
  return { ...fallbackMetric(id), ...overrides };
}

function buildReadinessVitals(context: DashboardContext): ReadinessVitalMetric[] {
  const overview = context.raw.dashboardAnalytics?.overview;
  const fsrs = context.raw.dashboardAnalytics?.fsrs;
  const readiness = clampPercent(context.readiness.available ? context.readiness.points.at(-1) : null);
  const accuracy = clampPercent(overview?.accuracyLast7Days);
  const retention = clampPercent(fsrs?.retentionPercent);
  const planProgress = clampPercent(context.raw.todayPlan?.progress?.percentComplete);

  return [
    metricWithFallback('pance-readiness', {
      value: readiness != null ? `${readiness}%` : fallbackMetric('pance-readiness').value,
      status: readiness != null ? percentStatus(readiness, 76, 62) : context.userState.lowData ? 'calibrating' : fallbackMetric('pance-readiness').status,
      context: readiness != null ? context.readiness.summary : fallbackMetric('pance-readiness').context,
      accessibleDescription:
        readiness != null
          ? `PANCE readiness estimate is ${readiness} percent. ${context.readiness.summary}`
          : fallbackMetric('pance-readiness').accessibleDescription,
      progress: readiness ?? fallbackMetric('pance-readiness').progress,
      sparkline: context.readiness.points.length > 1 ? context.readiness.points.slice(-7) : fallbackMetric('pance-readiness').sparkline,
      source: readiness != null ? 'analytics' : 'mock',
    }),
    metricWithFallback('accuracy', {
      value: accuracy != null ? `${accuracy}%` : fallbackMetric('accuracy').value,
      status: percentStatus(accuracy, 74, 62),
      context:
        accuracy != null
          ? `${overview?.attemptsLast7Days ?? 0} questions in the last 7 days; ${overview?.accuracyDelta == null ? 'trend pending' : `${overview.accuracyDelta > 0 ? '+' : ''}${Math.round(overview.accuracyDelta)} pts vs prior week`}.`
          : fallbackMetric('accuracy').context,
      accessibleDescription:
        accuracy != null
          ? `Seven day accuracy is ${accuracy} percent across ${overview?.attemptsLast7Days ?? 0} questions.`
          : fallbackMetric('accuracy').accessibleDescription,
      progress: accuracy ?? fallbackMetric('accuracy').progress,
      source: accuracy != null ? 'analytics' : 'mock',
    }),
    metricWithFallback('retention', {
      value: retention != null ? `${retention}%` : fallbackMetric('retention').value,
      status: percentStatus(retention, 86, 76),
      context:
        retention != null
          ? `${fsrs?.reviewCount ?? 0} FSRS reviews; ${fsrs?.dueTodayCount ?? 0} due today, ${fsrs?.overdueCount ?? 0} overdue.`
          : fallbackMetric('retention').context,
      accessibleDescription:
        retention != null
          ? `Spaced review retention is ${retention} percent across ${fsrs?.reviewCount ?? 0} reviews.`
          : fallbackMetric('retention').accessibleDescription,
      progress: retention ?? fallbackMetric('retention').progress,
      source: retention != null ? 'analytics' : 'mock',
    }),
    metricWithFallback('pace', {
      value: context.goal.statusLabel,
      status: context.goal.status === 'behind' ? 'risk' : context.goal.status === 'catch_up' ? 'watch' : context.goal.status === 'calibrating' ? 'calibrating' : 'stable',
      context:
        planProgress != null
          ? `${planProgress}% of today’s plan completed; ${context.today.durationMinutes} min prescribed.`
          : `${context.today.durationMinutes} min prescribed today; ${context.goal.targetLabel.toLowerCase()} target horizon.`,
      accessibleDescription:
        planProgress != null
          ? `Study pace is ${context.goal.statusLabel}; ${planProgress} percent of today's plan is complete.`
          : `Study pace is ${context.goal.statusLabel}; today's prescription is ${context.today.durationMinutes} minutes.`,
      progress: planProgress ?? fallbackMetric('pace').progress,
      source: planProgress != null || context.raw.todayPlan ? 'plan' : 'derived',
    }),
    fallbackMetric('clinical-image-accuracy'),
    fallbackMetric('confidence-mismatch'),
  ];
}

function MiniSparkline({ values, status }: { values?: number[]; status: ReadinessVitalStatus }) {
  if (!values?.length) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const points = values
    .map((value, index) => {
      const x = values.length === 1 ? 96 : (index / (values.length - 1)) * 96;
      const y = 28 - ((value - min) / span) * 22;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg className={cn('h-8 w-24', statusClass[status])} viewBox="0 0 96 32" aria-hidden="true">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function metricNextAction(metric: ReadinessVitalMetric): string {
  if (metric.source === 'mock') {
    return 'Next: complete a short mixed block to replace mock calibration.';
  }

  switch (metric.id) {
    case 'pance-readiness':
      return metric.status === 'risk'
        ? 'Next: start the highest-priority prescription before broad review.'
        : 'Next: keep the daily prescription narrow and measurable.';
    case 'accuracy':
      return metric.status === 'strong'
        ? 'Next: protect accuracy with timed mixed reps.'
        : 'Next: review misses before adding more new questions.';
    case 'retention':
      return metric.status === 'risk' || metric.status === 'watch'
        ? 'Next: clear due reviews before starting a new block.'
        : 'Next: maintain the review cadence.';
    case 'pace':
      return metric.status === 'risk'
        ? 'Next: switch to a shorter recovery block.'
        : 'Next: finish today’s prescribed dose.';
    case 'clinical-image-accuracy':
      return 'Next: run a structured image-reading pass.';
    case 'confidence-mismatch':
      return 'Next: inspect high-confidence misses in the review table.';
    default:
      return 'Next: use this signal to choose a focused study action.';
  }
}

function ReadinessVitalCard({ metric }: { metric: ReadinessVitalMetric }) {
  const Icon = statusIcon[metric.status];
  const progress = clampPercent(metric.progress) ?? 0;

  return (
    <div
      role="group"
      aria-label={metric.accessibleDescription}
      className={cn(
        'relative overflow-hidden rounded-2xl border bg-[color-mix(in_srgb,var(--atlas-bg-soft)_70%,transparent)] p-4',
        'min-h-[10.5rem] transition-colors',
        statusClass[metric.status],
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-atlas-muted">
            {metric.label}
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-semibold tabular-nums text-atlas-white">
              {metric.value}
            </span>
            {metric.source === 'mock' ? (
              <span className="rounded-full border border-atlas-border px-1.5 py-0.5 text-[0.6rem] uppercase tracking-[0.12em] text-atlas-subtle">
                mock
              </span>
            ) : null}
          </div>
        </div>
        <span className="rounded-full border border-current bg-[color-mix(in_srgb,currentColor_10%,transparent)] p-2">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
      </div>

      <p className="mt-3 line-clamp-2 text-xs leading-5 text-atlas-muted">{metric.context}</p>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-atlas-glass" aria-hidden="true">
          <div className="h-full rounded-full bg-current" style={{ width: `${Math.max(6, progress)}%` }} />
        </div>
        <MiniSparkline values={metric.sparkline} status={metric.status} />
      </div>
      <p className="mt-3 border-t border-atlas-border pt-3 text-xs leading-5 text-atlas-muted">
        {metricNextAction(metric)}
      </p>
    </div>
  );
}

export function ReadinessVitalsSkeleton({ className }: { className?: string }) {
  return (
    <section aria-labelledby="readiness-vitals-title" className={cn('space-y-3', className)} aria-busy="true">
      <div className="flex items-end justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-5 w-40 bg-atlas-glass" />
          <Skeleton className="h-4 w-64 bg-atlas-glass" />
        </div>
        <Skeleton className="hidden h-7 w-24 rounded-full bg-atlas-glass sm:block" />
      </div>
      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-40 rounded-2xl bg-atlas-glass" />
        ))}
      </div>
    </section>
  );
}

export function ReadinessVitalsWidget({
  context,
  loading = false,
  metrics,
  className,
}: ReadinessVitalsWidgetProps) {
  const resolvedMetrics = useMemo(
    () => metrics ?? buildReadinessVitals(context),
    [context, metrics],
  );
  const mockCount = resolvedMetrics.filter((metric) => metric.source === 'mock').length;
  const analyticsCount = resolvedMetrics.length - mockCount;

  if (loading) {
    return <ReadinessVitalsSkeleton className={className} />;
  }

  return (
    <section aria-labelledby="readiness-vitals-title" className={cn('space-y-3', className)}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 id="readiness-vitals-title" className="text-lg font-semibold text-atlas-white">
            Readiness Vitals
          </h2>
          <p className="text-sm text-atlas-muted">
            Board-readiness signals with enough context to decide the next action.
          </p>
        </div>
        <span className="hidden items-center gap-2 rounded-full border border-atlas-border bg-atlas-glass px-3 py-1 text-xs text-atlas-muted sm:inline-flex">
          <ShieldCheck className="h-3.5 w-3.5 text-atlas-cyan" aria-hidden />
          {analyticsCount} live / {mockCount} calibrating
        </span>
      </div>
      <MedicalGlassCard className="p-3 sm:p-4">
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {resolvedMetrics.map((metric) => (
            <ReadinessVitalCard key={metric.id} metric={metric} />
          ))}
        </div>
      </MedicalGlassCard>
    </section>
  );
}
