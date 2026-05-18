import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDownRight, ArrowRight, ArrowUpRight, ScanLine, Target } from 'lucide-react';
import type { DashboardContext, MatrixItem } from '../../model/DashboardContext';
import {
  MedicalGlassCard,
  OrganSystemBadge,
  type OrganSystemBadgeState,
} from '@/components/studypanacea';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  fallbackOrganSystemHeatmap,
  type OrganSystemHeatmapItem,
  type OrganSystemHeatmapStatus,
} from '../../page/commandCenterMockData';

export interface OrganSystemHeatmapWidgetProps {
  context: DashboardContext;
  loading?: boolean;
  systems?: OrganSystemHeatmapItem[];
  className?: string;
}

const systemAliases: Record<string, string> = {
  cv: 'cardiovascular',
  cardiovascular: 'cardiovascular',
  cardiac: 'cardiovascular',
  cardiology: 'cardiovascular',
  heart: 'cardiovascular',
  pulm: 'pulmonary',
  pulmonary: 'pulmonary',
  pulmonology: 'pulmonary',
  respiratory: 'pulmonary',
  gi: 'gastrointestinal',
  gastrointestinal: 'gastrointestinal',
  gastroenterology: 'gastrointestinal',
  digestive: 'gastrointestinal',
  msk: 'musculoskeletal',
  musculoskeletal: 'musculoskeletal',
  orthopedic: 'musculoskeletal',
  orthopedics: 'musculoskeletal',
  heent: 'heent',
  ent: 'heent',
  eyesearsnosethroat: 'heent',
  reproductive: 'reproductive',
  repro: 'reproductive',
  obgyn: 'reproductive',
  neurologic: 'neurologic',
  neuro: 'neurologic',
  neurology: 'neurologic',
  psych: 'psychiatry-behavioral',
  psychiatry: 'psychiatry-behavioral',
  psychiatrybehavioral: 'psychiatry-behavioral',
  behavioral: 'psychiatry-behavioral',
  endocrine: 'endocrine',
  endo: 'endocrine',
  dermatologic: 'dermatologic',
  dermatology: 'dermatologic',
  derm: 'dermatologic',
  skin: 'dermatologic',
  genitourinary: 'genitourinary',
  gu: 'genitourinary',
  urology: 'genitourinary',
  hematologic: 'hematologic',
  heme: 'hematologic',
  blood: 'hematologic',
  infectiousdisease: 'infectious-disease',
  infectious: 'infectious-disease',
  id: 'infectious-disease',
  renal: 'renal',
  kidney: 'renal',
  emergency: 'emergency-medicine',
  emergencymedicine: 'emergency-medicine',
};

const statusPriority: Record<OrganSystemHeatmapStatus, number> = {
  active: 0,
  weak: 1,
  watch: 2,
  calibrating: 3,
  strong: 4,
};

const statusClass: Record<OrganSystemHeatmapStatus, string> = {
  active:
    'border-atlas-border-glow bg-[color-mix(in_srgb,var(--atlas-accent-cyan)_12%,transparent)] text-atlas-cyan',
  weak: 'border-[color-mix(in_srgb,var(--atlas-accent-pulse-pink)_42%,transparent)] bg-[color-mix(in_srgb,var(--atlas-accent-pulse-pink)_9%,transparent)] text-atlas-pulse',
  watch:
    'border-[color-mix(in_srgb,var(--atlas-warning-amber)_42%,transparent)] bg-[color-mix(in_srgb,var(--atlas-warning-amber)_9%,transparent)] text-atlas-warning',
  strong:
    'border-[color-mix(in_srgb,var(--atlas-success-green)_42%,transparent)] bg-[color-mix(in_srgb,var(--atlas-success-green)_9%,transparent)] text-atlas-success',
  calibrating:
    'border-[color-mix(in_srgb,var(--atlas-accent-violet)_42%,transparent)] bg-[color-mix(in_srgb,var(--atlas-accent-violet)_9%,transparent)] text-atlas-violet',
};

const statusColor: Record<OrganSystemHeatmapStatus, string> = {
  active: 'var(--atlas-accent-cyan)',
  weak: 'var(--atlas-accent-pulse-pink)',
  watch: 'var(--atlas-warning-amber)',
  strong: 'var(--atlas-success-green)',
  calibrating: 'var(--atlas-accent-violet)',
};

const mapNodes: Array<{ id: string; x: number; y: number }> = [
  { id: 'neurologic', x: 50, y: 13 },
  { id: 'heent', x: 50, y: 25 },
  { id: 'cardiovascular', x: 43, y: 39 },
  { id: 'pulmonary', x: 58, y: 39 },
  { id: 'gastrointestinal', x: 50, y: 53 },
  { id: 'renal', x: 40, y: 61 },
  { id: 'genitourinary', x: 60, y: 64 },
  { id: 'reproductive', x: 50, y: 72 },
  { id: 'musculoskeletal', x: 34, y: 49 },
  { id: 'endocrine', x: 50, y: 33 },
  { id: 'dermatologic', x: 68, y: 48 },
  { id: 'hematologic', x: 35, y: 35 },
  { id: 'infectious-disease', x: 66, y: 59 },
  { id: 'psychiatry-behavioral', x: 39, y: 22 },
  { id: 'emergency-medicine', x: 50, y: 86 },
];

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function toSystemKey(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const compact = raw
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '');
  return systemAliases[compact] ?? null;
}

function statusForSignal(item: MatrixItem): OrganSystemHeatmapStatus {
  if (item.isTodayTarget) return 'active';
  if (item.mastery >= 0.78 && item.urgency < 0.48) return 'strong';
  if (item.mastery < 0.58 || item.urgency > 0.68) return 'weak';
  return 'watch';
}

function statusFromBlueprint(
  score: number,
  urgency: number,
  isTodayTarget?: boolean
): OrganSystemHeatmapStatus {
  if (isTodayTarget) return 'active';
  if (score >= 78 && urgency < 48) return 'strong';
  if (score < 58 || urgency > 68) return 'weak';
  return 'watch';
}

function badgeState(status: OrganSystemHeatmapStatus): OrganSystemBadgeState {
  if (status === 'calibrating') return 'watch';
  return status;
}

function trendLabel(trend: OrganSystemHeatmapItem['trend']): string {
  if (trend === 'up') return 'Improving';
  if (trend === 'down') return 'Declining';
  return 'Stable';
}

function systemNextAction(status: OrganSystemHeatmapStatus): string {
  if (status === 'weak') return 'Drill this system';
  if (status === 'watch') return 'Add focused reps';
  if (status === 'active') return 'Start today’s target';
  if (status === 'strong') return 'Maintain with review';
  return 'Calibrate with practice';
}

function TrendIcon({ trend }: { trend: OrganSystemHeatmapItem['trend'] }) {
  const Icon = trend === 'up' ? ArrowUpRight : trend === 'down' ? ArrowDownRight : ArrowRight;
  return <Icon className="h-3.5 w-3.5" aria-hidden />;
}

function mergeHeatmapItems(context: DashboardContext): OrganSystemHeatmapItem[] {
  const byId = new Map(fallbackOrganSystemHeatmap.map((item) => [item.id, item]));

  context.blueprintHeatmap.forEach((cell) => {
    const id = toSystemKey(cell.system) ?? toSystemKey(cell.id);
    if (!id) return;
    const base = byId.get(id);
    if (!base) return;
    const score = clampPercent((cell.mastery ?? base.score / 100) * 100);
    const urgency = clampPercent(cell.urgency * 100);
    byId.set(id, {
      ...base,
      score,
      urgency,
      status: statusFromBlueprint(score, urgency, cell.isTodayTarget),
      evidenceLabel: cell.subsection,
      context: `${cell.system} reflects blueprint coverage and current mastery evidence.`,
      source: 'blueprint',
    });
  });

  context.matrix.forEach((item) => {
    const id = toSystemKey(item.label) ?? toSystemKey(item.id);
    if (!id) return;
    const base = byId.get(id);
    if (!base) return;
    byId.set(id, {
      ...base,
      score: clampPercent(item.mastery * 100),
      urgency: clampPercent(item.urgency * 100),
      blueprintWeight: Math.max(base.blueprintWeight, Math.round(item.weight * 12)),
      trend: item.trend,
      status: statusForSignal(item),
      evidenceLabel: item.isTodayTarget ? 'Today target' : trendLabel(item.trend),
      context: item.attribution,
      source: 'analytics',
    });
  });

  return Array.from(byId.values()).sort((left, right) => {
    const priorityDelta = statusPriority[left.status] - statusPriority[right.status];
    if (priorityDelta !== 0) return priorityDelta;
    return (
      right.urgency * (100 - right.score) * right.blueprintWeight -
      left.urgency * (100 - left.score) * left.blueprintWeight
    );
  });
}

function AbstractSystemMap({
  items,
  active,
  onSelect,
}: {
  items: OrganSystemHeatmapItem[];
  active: OrganSystemHeatmapItem;
  onSelect: (id: string) => void;
}) {
  const itemById = new Map(items.map((item) => [item.id, item]));

  return (
    <div className="relative overflow-hidden rounded-2xl border border-atlas-border bg-[radial-gradient(circle_at_50%_38%,color-mix(in_srgb,var(--atlas-accent-cyan)_14%,transparent),transparent_42%),color-mix(in_srgb,var(--atlas-bg-soft)_82%,transparent)] p-4">
      <div className="absolute inset-0 opacity-35 atlas-medical-grid" aria-hidden />
      <svg
        viewBox="0 0 100 100"
        className="relative h-[19rem] w-full"
        role="img"
        aria-label="Abstract organ-system signal map"
      >
        <path
          d="M50 6 C60 6 67 13 67 23 C67 29 64 34 60 37 C68 42 74 53 72 68 C70 83 62 94 50 94 C38 94 30 83 28 68 C26 53 32 42 40 37 C36 34 33 29 33 23 C33 13 40 6 50 6Z"
          fill="var(--atlas-accent-cyan)"
          fillOpacity="0.055"
          stroke="var(--atlas-border-strong)"
          strokeOpacity="0.76"
          strokeWidth="0.8"
        />
        <path
          d="M50 33 C48 45 48 62 50 84"
          fill="none"
          stroke="var(--atlas-clinical-white)"
          strokeOpacity="0.2"
          strokeWidth="0.7"
          strokeDasharray="2 3"
        />
        {mapNodes.map((node) => {
          const item = itemById.get(node.id);
          if (!item) return null;
          const isActive = item.id === active.id;
          return (
            <g key={node.id}>
              <circle
                cx={node.x}
                cy={node.y}
                r={isActive ? 6.5 : 4.4}
                fill={statusColor[item.status]}
                opacity={isActive ? 0.24 : 0.12}
              />
              <circle
                cx={node.x}
                cy={node.y}
                r={isActive ? 3.7 : 2.5}
                fill={statusColor[item.status]}
                stroke="var(--atlas-clinical-white)"
                strokeOpacity="0.45"
                strokeWidth={isActive ? 0.8 : 0.4}
              />
            </g>
          );
        })}
      </svg>
      <div className="relative -mt-3 grid grid-cols-2 gap-2">
        {items.slice(0, 4).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            className={cn(
              'atlas-focus-ring rounded-xl border px-3 py-2 text-left text-xs transition-colors motion-reduce:transition-none',
              item.id === active.id
                ? statusClass[item.status]
                : 'border-atlas-border bg-atlas-glass text-atlas-muted hover:text-atlas-white'
            )}
            aria-pressed={item.id === active.id}
          >
            <span className="block truncate font-semibold">{item.label}</span>
            <span className="mt-1 block font-mono tabular-nums">
              {item.score}% / U{item.urgency}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function OrganSystemTable({ systems }: { systems: OrganSystemHeatmapItem[] }) {
  return (
    <table className="sr-only">
      <caption>Organ system heatmap scores and status</caption>
      <thead>
        <tr>
          <th scope="col">System</th>
          <th scope="col">Score</th>
          <th scope="col">Status</th>
          <th scope="col">Urgency</th>
          <th scope="col">Evidence</th>
        </tr>
      </thead>
      <tbody>
        {systems.map((system) => (
          <tr key={system.id}>
            <th scope="row">{system.label}</th>
            <td>{system.score} percent</td>
            <td>{system.status}</td>
            <td>{system.urgency} percent</td>
            <td>{system.evidenceLabel}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function OrganSystemHeatmapSkeleton({ className }: { className?: string }) {
  return (
    <section
      aria-labelledby="organ-heatmap-title"
      className={cn('space-y-3', className)}
      aria-busy="true"
    >
      <div className="space-y-2">
        <Skeleton className="h-5 w-48 bg-atlas-glass" />
        <Skeleton className="h-4 w-72 bg-atlas-glass" />
      </div>
      <MedicalGlassCard className="p-4">
        <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <Skeleton className="h-80 rounded-2xl bg-atlas-glass" />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 9 }).map((_, index) => (
              <Skeleton key={index} className="h-32 rounded-2xl bg-atlas-glass" />
            ))}
          </div>
        </div>
      </MedicalGlassCard>
    </section>
  );
}

export function OrganSystemHeatmapWidget({
  context,
  loading = false,
  systems,
  className,
}: OrganSystemHeatmapWidgetProps) {
  const resolvedSystems = useMemo(() => systems ?? mergeHeatmapItems(context), [context, systems]);
  const initialActiveId =
    resolvedSystems.find((item) => item.status === 'active')?.id ?? resolvedSystems[0]?.id;
  const [activeId, setActiveId] = useState(initialActiveId);

  useEffect(() => {
    if (!resolvedSystems.length) return;
    if (!resolvedSystems.some((item) => item.id === activeId)) {
      setActiveId(initialActiveId);
    }
  }, [activeId, initialActiveId, resolvedSystems]);

  const activeSystem =
    resolvedSystems.find((item) => item.id === activeId) ??
    resolvedSystems.find((item) => item.status === 'active') ??
    resolvedSystems[0];

  if (loading) {
    return <OrganSystemHeatmapSkeleton className={className} />;
  }

  if (!activeSystem) {
    return (
      <section aria-labelledby="organ-heatmap-title" className={cn('space-y-3', className)}>
        <div>
          <h2 id="organ-heatmap-title" className="text-lg font-semibold text-atlas-white">
            Organ System Heatmap
          </h2>
          <p className="text-sm text-atlas-muted">
            Major PANCE systems ranked by mastery, urgency, and blueprint weight.
          </p>
        </div>
        <MedicalGlassCard className="flex min-h-56 flex-col items-center justify-center border-dashed p-6 text-center">
          <Target className="h-8 w-8 text-atlas-cyan" aria-hidden />
          <h3 className="mt-3 text-base font-semibold text-atlas-white">
            No organ-system signals yet
          </h3>
          <p className="mt-2 max-w-md text-sm leading-6 text-atlas-muted">
            Complete a mixed practice block to create the first weak-area map.
          </p>
        </MedicalGlassCard>
      </section>
    );
  }

  const weakCount = resolvedSystems.filter((item) => item.status === 'weak').length;
  const activeSystemAction =
    activeSystem.status === 'strong'
      ? (context.actions.onOpenReview ?? context.actions.onOpenPractice)
      : (context.actions.onOpenPractice ?? context.actions.onStartToday);

  return (
    <section aria-labelledby="organ-heatmap-title" className={cn('space-y-3', className)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="organ-heatmap-title" className="text-lg font-semibold text-atlas-white">
            Organ System Heatmap
          </h2>
          <p className="text-sm text-atlas-muted">
            Major PANCE systems ranked by mastery, urgency, and blueprint weight.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-atlas-border bg-atlas-glass px-3 py-1 text-xs text-atlas-muted">
          <Target className="h-3.5 w-3.5 text-atlas-cyan" aria-hidden />
          {weakCount} weak-area signals
        </span>
      </div>

      <MedicalGlassCard scannerAccent className="p-4 sm:p-5">
        <OrganSystemTable systems={resolvedSystems} />
        <div className="grid gap-4 xl:grid-cols-[20rem_minmax(0,1fr)]">
          <div className="space-y-3">
            <AbstractSystemMap
              items={resolvedSystems}
              active={activeSystem}
              onSelect={setActiveId}
            />
            <div className="rounded-2xl border border-atlas-border bg-[color-mix(in_srgb,var(--atlas-bg-soft)_76%,transparent)] p-4 transition-colors motion-reduce:transition-none">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-atlas-cyan">
                    Active system
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-atlas-white">
                    {activeSystem.label}
                  </h3>
                </div>
                <OrganSystemBadge
                  label={activeSystem.status}
                  score={`${activeSystem.score}%`}
                  state={badgeState(activeSystem.status)}
                  aria-label={`${activeSystem.label} ${activeSystem.status} status with score ${activeSystem.score} percent`}
                />
              </div>
              <p className="mt-3 text-sm leading-6 text-atlas-muted">{activeSystem.context}</p>
              <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-xl border border-atlas-border bg-atlas-glass p-2">
                  <span className="block text-atlas-subtle">Urgency</span>
                  <span className="mt-1 block font-mono text-atlas-white">
                    {activeSystem.urgency}
                  </span>
                </div>
                <div className="rounded-xl border border-atlas-border bg-atlas-glass p-2">
                  <span className="block text-atlas-subtle">Weight</span>
                  <span className="mt-1 block font-mono text-atlas-white">
                    {activeSystem.blueprintWeight}%
                  </span>
                </div>
                <div className="rounded-xl border border-atlas-border bg-atlas-glass p-2">
                  <span className="block text-atlas-subtle">Trend</span>
                  <span className="mt-1 flex items-center gap-1 font-mono text-atlas-white">
                    <TrendIcon trend={activeSystem.trend} />
                    {trendLabel(activeSystem.trend)}
                  </span>
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-2 rounded-xl border border-atlas-border bg-atlas-glass p-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs leading-5 text-atlas-muted">
                  Next action: keep practice scoped to {activeSystem.label} until the signal
                  stabilizes.
                </p>
                <button
                  type="button"
                  onClick={activeSystemAction}
                  disabled={!activeSystemAction}
                  className="atlas-focus-ring inline-flex shrink-0 items-center justify-center rounded-xl border border-atlas-border-glow bg-[color-mix(in_srgb,var(--atlas-accent-cyan)_10%,transparent)] px-3 py-2 text-sm font-semibold text-atlas-cyan hover:bg-[color-mix(in_srgb,var(--atlas-accent-cyan)_16%,transparent)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {systemNextAction(activeSystem.status)}
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            {resolvedSystems.map((system) => (
              <button
                key={system.id}
                type="button"
                onClick={() => setActiveId(system.id)}
                className={cn(
                  'atlas-focus-ring group rounded-2xl border p-3 text-left transition-colors motion-reduce:transition-none',
                  system.id === activeSystem.id
                    ? statusClass[system.status]
                    : 'border-atlas-border bg-[color-mix(in_srgb,var(--atlas-bg-soft)_72%,transparent)] text-atlas-muted hover:border-atlas-border-glow hover:text-atlas-white'
                )}
                aria-pressed={system.id === activeSystem.id}
                aria-label={`${system.label}: ${system.score} percent score, ${system.status} status, urgency ${system.urgency}. ${system.context}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-atlas-white">
                      {system.label}
                    </p>
                    <p className="mt-1 text-xs text-atlas-subtle">{system.evidenceLabel}</p>
                  </div>
                  <span className="rounded-full border border-current bg-[color-mix(in_srgb,currentColor_10%,transparent)] px-2 py-1 font-mono text-xs tabular-nums">
                    {system.score}
                  </span>
                </div>
                <div
                  className="mt-4 h-1.5 overflow-hidden rounded-full bg-atlas-glass"
                  aria-hidden="true"
                >
                  <div
                    className="h-full rounded-full bg-current"
                    style={{ width: `${Math.max(8, system.score)}%` }}
                  />
                </div>
                <div className="mt-3 flex items-center justify-between gap-2 text-xs">
                  <span className="inline-flex items-center gap-1">
                    <ScanLine className="h-3.5 w-3.5" aria-hidden />U{system.urgency}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <TrendIcon trend={system.trend} />
                    {trendLabel(system.trend)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </MedicalGlassCard>
    </section>
  );
}
