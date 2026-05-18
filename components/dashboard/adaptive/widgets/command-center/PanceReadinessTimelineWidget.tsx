import React, { useMemo } from 'react';
import { Activity, Info, TrendingDown, TrendingUp } from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DashboardContext } from '../../model/DashboardContext';
import { MedicalGlassCard } from '@/components/studypanacea';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  fallbackReadinessTimeline,
  fallbackReadinessTimelineInterpretation,
  type ReadinessTimelineInterpretation,
  type ReadinessTimelinePoint,
} from '../../page/commandCenterMockData';

export interface PanceReadinessTimelineWidgetProps {
  context: DashboardContext;
  loading?: boolean;
  points?: ReadinessTimelinePoint[];
  interpretation?: ReadinessTimelineInterpretation;
  className?: string;
}

const tooltipName: Record<string, string> = {
  readiness: 'Readiness',
  accuracy: 'Accuracy',
  retention: 'Retention',
  target: 'Target',
};

function clampPercent(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function retentionToPercent(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return clampPercent(value <= 1 ? value * 100 : value);
}

function shortDateLabel(dateValue: string): string {
  const date = new Date(`${dateValue}T12:00:00`);
  if (Number.isNaN(date.getTime())) return dateValue;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function lastWeakSystem(context: DashboardContext): string {
  const weakSystem = [...context.matrix]
    .sort((left, right) => left.mastery - right.mastery || right.urgency - left.urgency)
    .find((item) => item.mastery < 0.72 || item.urgency > 0.6);
  return weakSystem?.label ?? context.raw.growthAreas[0] ?? 'the highest-priority weak system';
}

function buildTimelineData(context: DashboardContext): ReadinessTimelinePoint[] {
  const accuracyTrend = context.raw.dashboardAnalytics?.trend
    ?.filter((point) => point.attempts > 0)
    .slice(-8);
  const retentionTrend = context.raw.dashboardAnalytics?.studyHistory?.trends.slice(-8);

  if (context.readiness.available && context.readiness.points.length > 1) {
    const readinessPoints = context.readiness.points.slice(-8);
    return readinessPoints.map((score, index) => {
      const accuracy =
        accuracyTrend?.[Math.max(0, accuracyTrend.length - readinessPoints.length) + index];
      const retention =
        retentionTrend?.[Math.max(0, retentionTrend.length - readinessPoints.length) + index];
      return {
        id: `readiness-${index}`,
        label: index === 0 ? 'Now' : `+${index}`,
        readiness: clampPercent(score) ?? 0,
        accuracy: clampPercent(accuracy?.accuracy),
        retention: retentionToPercent(retention?.retentionRate),
        target: context.readiness.target,
        note: index === readinessPoints.length - 1 ? context.readiness.statusLabel : undefined,
        source: 'projection',
      };
    });
  }

  if (accuracyTrend?.length && accuracyTrend.length > 1) {
    return fallbackReadinessTimeline.slice(-accuracyTrend.length).map((fallback, index) => ({
      ...fallback,
      id: `accuracy-fallback-${accuracyTrend[index]?.date ?? index}`,
      label: shortDateLabel(accuracyTrend[index]?.date ?? fallback.label),
      accuracy: clampPercent(accuracyTrend[index]?.accuracy),
      retention: retentionToPercent(retentionTrend?.[index]?.retentionRate) ?? fallback.retention,
      source: 'mock',
    }));
  }

  return fallbackReadinessTimeline;
}

function buildInterpretation(
  context: DashboardContext,
  data: ReadinessTimelinePoint[]
): ReadinessTimelineInterpretation {
  if (!context.readiness.available || data.every((point) => point.source === 'mock')) {
    return fallbackReadinessTimelineInterpretation;
  }

  const first = data[0]?.readiness ?? 0;
  const last = data.at(-1)?.readiness ?? first;
  const delta = last - first;
  const weakSystem = lastWeakSystem(context);

  if (delta >= 3) {
    return {
      headline: `Readiness is improving, but ${weakSystem} still needs protection.`,
      detail:
        'Keep the next prescription focused instead of spreading review time across every system.',
      source: 'analytics',
    };
  }

  if (delta <= -3) {
    return {
      headline: `Readiness is drifting; ${weakSystem} should stay first in the queue.`,
      detail:
        'Use the study prescription to stabilize retention before adding broader exam simulation.',
      source: 'analytics',
    };
  }

  return {
    headline: 'Readiness is stabilizing; keep the prescription narrow.',
    detail: `The trend is steady, so the next useful move is a focused pass on ${weakSystem}.`,
    source: 'analytics',
  };
}

function TimelineTable({ points }: { points: ReadinessTimelinePoint[] }) {
  return (
    <table className="sr-only">
      <caption>PANCE readiness timeline values</caption>
      <thead>
        <tr>
          <th scope="col">Checkpoint</th>
          <th scope="col">Readiness</th>
          <th scope="col">Accuracy</th>
          <th scope="col">Retention</th>
          <th scope="col">Target</th>
        </tr>
      </thead>
      <tbody>
        {points.map((point) => (
          <tr key={point.id}>
            <th scope="row">{point.label}</th>
            <td>{point.readiness} percent</td>
            <td>{point.accuracy == null ? 'Not available' : `${point.accuracy} percent`}</td>
            <td>{point.retention == null ? 'Not available' : `${point.retention} percent`}</td>
            <td>{point.target == null ? 'Not available' : `${point.target} percent`}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TimelineLegend({
  showAccuracy,
  showRetention,
  showMock,
}: {
  showAccuracy: boolean;
  showRetention: boolean;
  showMock: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-atlas-muted">
      <span className="inline-flex items-center gap-2 rounded-full border border-atlas-border bg-atlas-glass px-2.5 py-1">
        <span className="h-1.5 w-4 rounded-full bg-atlas-cyan" aria-hidden />
        Readiness
      </span>
      {showAccuracy ? (
        <span className="inline-flex items-center gap-2 rounded-full border border-atlas-border bg-atlas-glass px-2.5 py-1">
          <span className="h-1.5 w-4 rounded-full bg-atlas-blue" aria-hidden />
          Accuracy
        </span>
      ) : null}
      {showRetention ? (
        <span className="inline-flex items-center gap-2 rounded-full border border-atlas-border bg-atlas-glass px-2.5 py-1">
          <span className="h-1.5 w-4 rounded-full bg-atlas-violet" aria-hidden />
          Retention
        </span>
      ) : null}
      <span className="inline-flex items-center gap-2 rounded-full border border-atlas-border bg-atlas-glass px-2.5 py-1">
        <span className="h-1.5 w-4 rounded-full bg-atlas-warning" aria-hidden />
        Target
      </span>
      {showMock ? (
        <span className="rounded-full border border-atlas-border px-2.5 py-1 font-semibold uppercase tracking-[0.12em] text-atlas-subtle">
          mock readiness
        </span>
      ) : null}
    </div>
  );
}

function TimelineMetricStrip({
  latest,
  delta,
  target,
  isMock,
}: {
  latest: number;
  delta: number;
  target: number | null | undefined;
  isMock: boolean;
}) {
  const items = [
    {
      label: 'Latest readiness',
      value: `${Math.round(latest)}%`,
      detail: isMock ? 'Mock calibration' : 'Current projection',
    },
    {
      label: 'Trend',
      value: `${delta >= 0 ? '+' : ''}${Math.round(delta)} pts`,
      detail: delta >= 0 ? 'Moving upward' : 'Needs stabilization',
    },
    {
      label: 'Target band',
      value: target == null ? 'Pending' : `${Math.round(target)}%`,
      detail: 'Exam-readiness reference',
    },
  ];

  return (
    <div className="mb-4 grid gap-2 md:grid-cols-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-2xl border border-atlas-border bg-atlas-glass px-3 py-2"
        >
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-atlas-subtle">
            {item.label}
          </p>
          <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-atlas-white">
            {item.value}
          </p>
          <p className="mt-1 text-xs text-atlas-muted">{item.detail}</p>
        </div>
      ))}
    </div>
  );
}

export function PanceReadinessTimelineSkeleton({ className }: { className?: string }) {
  return (
    <section
      aria-labelledby="readiness-timeline-title"
      className={cn('space-y-3', className)}
      aria-busy="true"
    >
      <div className="space-y-2">
        <Skeleton className="h-5 w-56 bg-atlas-glass" />
        <Skeleton className="h-4 w-80 bg-atlas-glass" />
      </div>
      <MedicalGlassCard className="p-4">
        <Skeleton className="h-80 rounded-2xl bg-atlas-glass" />
      </MedicalGlassCard>
    </section>
  );
}

export function PanceReadinessTimelineWidget({
  context,
  loading = false,
  points,
  interpretation,
  className,
}: PanceReadinessTimelineWidgetProps) {
  const data = useMemo(() => points ?? buildTimelineData(context), [context, points]);
  const resolvedInterpretation = useMemo(
    () => interpretation ?? buildInterpretation(context, data),
    [context, data, interpretation]
  );
  const showAccuracy = data.some((point) => point.accuracy != null);
  const showRetention = data.some((point) => point.retention != null);
  const showTarget = data.some((point) => point.target != null);
  const isMock = data.every((point) => point.source === 'mock');
  const latestReadiness = data.at(-1)?.readiness ?? 0;
  const delta = latestReadiness - (data[0]?.readiness ?? 0);
  const TrendIcon = delta >= 0 ? TrendingUp : TrendingDown;

  if (loading) {
    return <PanceReadinessTimelineSkeleton className={className} />;
  }

  return (
    <section aria-labelledby="readiness-timeline-title" className={cn('space-y-3', className)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="readiness-timeline-title" className="text-lg font-semibold text-atlas-white">
            PANCE Readiness Timeline
          </h2>
          <p className="text-sm text-atlas-muted">
            Readiness, accuracy, and retention are shown as directional signals, not a single magic
            score.
          </p>
        </div>
        <TimelineLegend
          showAccuracy={showAccuracy}
          showRetention={showRetention}
          showMock={isMock}
        />
      </div>

      <MedicalGlassCard className="p-4 sm:p-5">
        <TimelineTable points={data} />
        <TimelineMetricStrip
          latest={latestReadiness}
          delta={delta}
          target={data.at(-1)?.target}
          isMock={isMock}
        />
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="min-h-[20rem] rounded-2xl border border-atlas-border bg-[color-mix(in_srgb,var(--atlas-bg-soft)_74%,transparent)] p-3">
            <div className="h-72 w-full" role="img" aria-label={resolvedInterpretation.headline}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ left: 0, right: 12, top: 16, bottom: 0 }}>
                  <CartesianGrid
                    stroke="var(--atlas-border)"
                    strokeOpacity={0.84}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: 'var(--atlas-text-muted)', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fill: 'var(--atlas-text-muted)', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    width={38}
                  />
                  <Tooltip
                    cursor={{ stroke: 'var(--atlas-accent-cyan)', strokeOpacity: 0.28 }}
                    formatter={(value: unknown, name: unknown): [string, string] => {
                      const numericValue = Number(value);
                      const formattedValue = Number.isFinite(numericValue)
                        ? `${Math.round(numericValue)}%`
                        : `${value}`;
                      const nameKey = String(name);
                      return [formattedValue, tooltipName[nameKey] ?? nameKey];
                    }}
                    labelFormatter={(label: unknown) => `Checkpoint ${String(label)}`}
                    contentStyle={{
                      background: 'var(--atlas-surface)',
                      border: '1px solid var(--atlas-border)',
                      borderRadius: '12px',
                      color: 'var(--atlas-clinical-white)',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="readiness"
                    stroke="var(--atlas-accent-cyan)"
                    strokeWidth={2.5}
                    dot={{ r: 3, strokeWidth: 1 }}
                    activeDot={{ r: 5 }}
                    isAnimationActive={false}
                  />
                  {showAccuracy ? (
                    <Line
                      type="monotone"
                      dataKey="accuracy"
                      stroke="var(--atlas-accent-blue)"
                      strokeWidth={1.8}
                      dot={false}
                      isAnimationActive={false}
                    />
                  ) : null}
                  {showRetention ? (
                    <Line
                      type="monotone"
                      dataKey="retention"
                      stroke="var(--atlas-accent-violet)"
                      strokeWidth={1.8}
                      dot={false}
                      isAnimationActive={false}
                    />
                  ) : null}
                  {showTarget ? (
                    <Line
                      type="monotone"
                      dataKey="target"
                      stroke="var(--atlas-warning-amber)"
                      strokeDasharray="5 5"
                      strokeWidth={1.5}
                      dot={false}
                      isAnimationActive={false}
                    />
                  ) : null}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-atlas-border bg-[color-mix(in_srgb,var(--atlas-bg-soft)_76%,transparent)] p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-atlas-cyan">
              <Activity className="h-3.5 w-3.5" aria-hidden />
              Interpretation
            </div>
            <div className="mt-4 flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-atlas-border-glow bg-[color-mix(in_srgb,var(--atlas-accent-cyan)_10%,transparent)] text-atlas-cyan">
                <TrendIcon className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <h3 className="text-base font-semibold leading-6 text-atlas-white">
                  {resolvedInterpretation.headline}
                </h3>
                <p className="mt-2 text-sm leading-6 text-atlas-muted">
                  {resolvedInterpretation.detail}
                </p>
              </div>
            </div>
            <div className="mt-5 rounded-xl border border-atlas-border bg-atlas-glass p-3 text-xs leading-5 text-atlas-muted">
              <div className="flex gap-2">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-atlas-cyan" aria-hidden />
                <span>
                  Forecasts stay bounded by available evidence. Missing analytics show mock
                  readiness data instead of implying zero performance.
                </span>
              </div>
            </div>
          </div>
        </div>
      </MedicalGlassCard>
    </section>
  );
}
