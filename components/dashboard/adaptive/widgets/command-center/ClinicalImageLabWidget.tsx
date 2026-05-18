import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BrainCircuit,
  CircleDot,
  Image as ImageIcon,
  Microscope,
  PanelRightOpen,
  ScanLine,
} from 'lucide-react';
import { MedicalGlassCard, OrganSystemBadge, ScannerFrame } from '@/components/studypanacea';
import { Skeleton } from '@/components/ui/skeleton';
import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/utils';
import { fallbackClinicalLabCases, type ClinicalLabCase } from '../../page/commandCenterMockData';

type ClinicalImageFilter = 'all' | 'needs_review' | 'strong' | 'new';

export interface ClinicalImageLabWidgetProps {
  cases?: ClinicalLabCase[];
  loading?: boolean;
  className?: string;
  onOpenTutor?: (caseItem: ClinicalLabCase) => void;
}

const filters: Array<{ value: ClinicalImageFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'needs_review', label: 'Needs Review' },
  { value: 'strong', label: 'Strong' },
  { value: 'new', label: 'New' },
];

const statusClass: Record<ClinicalLabCase['status'], string> = {
  needs_review:
    'border-atlas-warning bg-[color-mix(in_srgb,var(--atlas-warning-amber)_10%,transparent)] text-atlas-warning',
  weak: 'border-atlas-pulse bg-[color-mix(in_srgb,var(--atlas-accent-pulse-pink)_10%,transparent)] text-atlas-pulse',
  strong:
    'border-atlas-success bg-[color-mix(in_srgb,var(--atlas-success-green)_10%,transparent)] text-atlas-success',
  new: 'border-atlas-violet bg-[color-mix(in_srgb,var(--atlas-accent-violet)_10%,transparent)] text-atlas-violet',
};

function statusLabel(status: ClinicalLabCase['status']): string {
  switch (status) {
    case 'needs_review':
      return 'Needs review';
    case 'strong':
      return 'Strong';
    case 'weak':
      return 'Weak';
    default:
      return 'New';
  }
}

function filterMatches(caseItem: ClinicalLabCase, filter: ClinicalImageFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'needs_review')
    return caseItem.status === 'needs_review' || caseItem.status === 'weak';
  return caseItem.status === filter;
}

function filterCount(cases: ClinicalLabCase[], filter: ClinicalImageFilter): number {
  return cases.filter((caseItem) => filterMatches(caseItem, filter)).length;
}

function accuracyLabel(caseItem: ClinicalLabCase): string {
  return caseItem.accuracy == null ? 'Baseline' : `${caseItem.accuracy}%`;
}

function badgeState(status: ClinicalLabCase['status']): 'active' | 'weak' | 'strong' | 'watch' {
  if (status === 'strong') return 'strong';
  if (status === 'weak') return 'weak';
  if (status === 'needs_review') return 'watch';
  return 'active';
}

function nextImageAction(caseItem: ClinicalLabCase): string {
  if (caseItem.status === 'strong') return 'Maintain with one timed read this week.';
  if (caseItem.status === 'new') return 'Start with a structured checklist before answering.';
  return 'Review the annotation, then retry a similar synthetic case.';
}

function VisualPattern({
  caseItem,
  compact = false,
  decorative = false,
}: {
  caseItem: ClinicalLabCase;
  compact?: boolean;
  decorative?: boolean;
}) {
  const type = caseItem.type.toLowerCase();
  const heightClass = compact ? 'h-28' : 'min-h-72';
  const isEcg = type.includes('ecg');
  const isDerm = type.includes('derm');
  const isFundoscopy = type.includes('fundoscopy');
  const isRadiology = type.includes('radiology');

  return (
    <div
      className={cn(
        'relative overflow-hidden bg-[radial-gradient(circle_at_50%_45%,color-mix(in_srgb,var(--atlas-accent-cyan)_16%,transparent),transparent_40%),linear-gradient(135deg,color-mix(in_srgb,var(--atlas-accent-blue)_8%,transparent),color-mix(in_srgb,var(--atlas-accent-violet)_10%,transparent))]',
        heightClass
      )}
    >
      <div className="absolute inset-0 opacity-40 atlas-medical-grid" aria-hidden />
      <svg
        className={cn(
          'absolute inset-4 h-[calc(100%-2rem)] w-[calc(100%-2rem)]',
          compact && 'inset-3 h-[calc(100%-1.5rem)] w-[calc(100%-1.5rem)]'
        )}
        viewBox="0 0 420 250"
        {...(decorative
          ? { 'aria-hidden': true }
          : {
              role: 'img',
              'aria-label': `${caseItem.type} synthetic training visual`,
            })}
      >
        <defs>
          <linearGradient id={`lab-gradient-${caseItem.id}`} x1="0" x2="1">
            <stop offset="0%" stopColor="var(--atlas-accent-cyan)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--atlas-accent-violet)" stopOpacity="0.52" />
          </linearGradient>
        </defs>
        {isEcg ? (
          <>
            {Array.from({ length: 6 }).map((_, index) => (
              <path
                key={index}
                d={`M0 ${40 + index * 34} H420`}
                stroke="var(--atlas-border)"
                strokeOpacity="0.9"
                strokeWidth="1"
              />
            ))}
            <path
              d="M10 126 H76 L90 126 L108 70 L132 178 L151 126 H226 L248 102 L268 146 L287 126 H410"
              fill="none"
              stroke={`url(#lab-gradient-${caseItem.id})`}
              strokeWidth={compact ? 4 : 5}
              strokeLinecap="round"
            />
          </>
        ) : isDerm ? (
          <>
            <path
              d="M108 126 C112 72 172 49 222 76 C271 104 303 133 283 177 C263 220 190 217 143 190 C116 175 104 153 108 126Z"
              fill="var(--atlas-accent-pulse-pink)"
              fillOpacity="0.1"
              stroke="var(--atlas-accent-pulse-pink)"
              strokeOpacity="0.42"
              strokeWidth="3"
            />
            <circle cx="183" cy="132" r="16" fill="var(--atlas-accent-cyan)" fillOpacity="0.13" />
            <circle cx="232" cy="154" r="11" fill="var(--atlas-accent-violet)" fillOpacity="0.17" />
          </>
        ) : isFundoscopy ? (
          <>
            <circle
              cx="210"
              cy="126"
              r="82"
              fill="var(--atlas-accent-cyan)"
              fillOpacity="0.08"
              stroke="var(--atlas-accent-cyan)"
              strokeOpacity="0.38"
              strokeWidth="3"
            />
            <circle
              cx="235"
              cy="112"
              r="24"
              fill="var(--atlas-clinical-white)"
              fillOpacity="0.1"
              stroke="var(--atlas-clinical-white)"
              strokeOpacity="0.32"
            />
            <path
              d="M232 112 C190 118 168 150 148 184"
              stroke="var(--atlas-accent-violet)"
              strokeOpacity="0.42"
              strokeWidth="3"
              fill="none"
            />
            <path
              d="M237 110 C198 93 174 78 143 58"
              stroke="var(--atlas-accent-cyan)"
              strokeOpacity="0.36"
              strokeWidth="2"
              fill="none"
            />
          </>
        ) : isRadiology ? (
          <>
            <ellipse
              cx="178"
              cy="126"
              rx="68"
              ry="94"
              fill="var(--atlas-accent-cyan)"
              fillOpacity="0.07"
              stroke="var(--atlas-accent-cyan)"
              strokeOpacity="0.36"
            />
            <ellipse
              cx="256"
              cy="126"
              rx="62"
              ry="88"
              fill="var(--atlas-accent-violet)"
              fillOpacity="0.08"
              stroke="var(--atlas-accent-violet)"
              strokeOpacity="0.34"
            />
            <path
              d="M208 48 C197 88 197 164 208 208"
              stroke="var(--atlas-clinical-white)"
              strokeOpacity="0.28"
              strokeWidth="4"
              fill="none"
            />
            <rect
              x="230"
              y="118"
              width="52"
              height="32"
              rx="12"
              fill="var(--atlas-warning-amber)"
              fillOpacity="0.12"
              stroke="var(--atlas-warning-amber)"
              strokeOpacity="0.38"
            />
          </>
        ) : (
          <>
            <ellipse
              cx="170"
              cy="132"
              rx="74"
              ry="98"
              fill="var(--atlas-accent-cyan)"
              fillOpacity="0.08"
              stroke="var(--atlas-accent-cyan)"
              strokeOpacity="0.4"
            />
            <ellipse
              cx="260"
              cy="132"
              rx="74"
              ry="98"
              fill="var(--atlas-accent-violet)"
              fillOpacity="0.08"
              stroke="var(--atlas-accent-violet)"
              strokeOpacity="0.35"
            />
            <path
              d="M210 44 C198 88 198 164 210 216"
              stroke="var(--atlas-clinical-white)"
              strokeOpacity="0.32"
              strokeWidth="4"
              fill="none"
            />
          </>
        )}
        <circle cx="270" cy="96" r={compact ? 7 : 9} fill="var(--atlas-accent-pulse-pink)" />
        <circle
          cx="270"
          cy="96"
          r={compact ? 17 : 22}
          fill="none"
          stroke="var(--atlas-accent-pulse-pink)"
          strokeOpacity="0.42"
          strokeDasharray="4 6"
        />
      </svg>
      <div
        className="pointer-events-none absolute left-0 right-0 top-1/2 h-px bg-atlas-cyan/55 shadow-[0_0_20px_var(--atlas-accent-cyan)] motion-reduce:hidden"
        aria-hidden
      />
      {!compact ? (
        <div className="absolute right-4 top-4 rounded-full border border-atlas-border-glow bg-[color-mix(in_srgb,var(--atlas-bg)_80%,transparent)] px-3 py-1 text-xs font-semibold text-atlas-cyan">
          {caseItem.markerLabel}
        </div>
      ) : null}
    </div>
  );
}

function CaseCard({
  caseItem,
  active,
  onSelect,
}: {
  caseItem: ClinicalLabCase;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      aria-controls="clinical-image-lab-preview"
      aria-label={`${caseItem.type}, ${caseItem.system}, ${statusLabel(caseItem.status)}, ${caseItem.difficulty}, ${accuracyLabel(caseItem)} accuracy. ${caseItem.learningObjective}`}
      className={cn(
        'atlas-focus-ring group overflow-hidden rounded-2xl border text-left transition-[border-color,background-color,box-shadow] motion-reduce:transition-none',
        active
          ? 'border-atlas-border-glow bg-[color-mix(in_srgb,var(--atlas-accent-cyan)_10%,transparent)] shadow-[0_0_24px_color-mix(in_srgb,var(--atlas-accent-cyan)_14%,transparent)]'
          : 'border-atlas-border bg-[color-mix(in_srgb,var(--atlas-bg-soft)_72%,transparent)] hover:border-atlas-border-glow'
      )}
    >
      <VisualPattern caseItem={caseItem} compact decorative />
      <div className="p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-atlas-white">{caseItem.type}</p>
            <p className="mt-1 truncate text-xs text-atlas-muted">{caseItem.system}</p>
          </div>
          <span
            className={cn(
              'rounded-full border px-2 py-1 text-[0.64rem] font-semibold uppercase tracking-[0.1em]',
              statusClass[caseItem.status]
            )}
          >
            {statusLabel(caseItem.status)}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-xl border border-atlas-border bg-atlas-glass px-2 py-1.5">
            <span className="block text-atlas-subtle">Difficulty</span>
            <span className="font-mono text-atlas-white">{caseItem.difficulty}</span>
          </div>
          <div className="rounded-xl border border-atlas-border bg-atlas-glass px-2 py-1.5">
            <span className="block text-atlas-subtle">Accuracy</span>
            <span className="font-mono text-atlas-white">{accuracyLabel(caseItem)}</span>
          </div>
        </div>
        <p className="mt-3 line-clamp-2 text-xs leading-5 text-atlas-muted">
          {caseItem.learningObjective}
        </p>
      </div>
    </button>
  );
}

function ClinicalImageEmptyState({
  filter,
  onReset,
}: {
  filter: ClinicalImageFilter;
  onReset: () => void;
}) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-atlas-border bg-atlas-glass p-6 text-center">
      <ImageIcon className="h-8 w-8 text-atlas-cyan" aria-hidden />
      <h3 className="mt-3 text-base font-semibold text-atlas-white">No cases in this status</h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-atlas-muted">
        The {filters.find((item) => item.value === filter)?.label.toLowerCase()} queue is empty.
        Switch filters to inspect other mock image-training cases.
      </p>
      <button
        type="button"
        onClick={onReset}
        className="atlas-focus-ring mt-4 rounded-xl border border-atlas-border bg-atlas-glass px-3 py-2 text-sm font-semibold text-atlas-cyan"
      >
        Show all cases
      </button>
    </div>
  );
}

export function ClinicalImageLabSkeleton({ className }: { className?: string }) {
  return (
    <section
      aria-labelledby="clinical-image-lab-title"
      className={cn('space-y-3', className)}
      aria-busy="true"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-5 w-44 bg-atlas-glass" />
          <Skeleton className="h-4 w-80 bg-atlas-glass" />
        </div>
        <Skeleton className="h-8 w-28 rounded-full bg-atlas-glass" />
      </div>
      <MedicalGlassCard className="p-4">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_21rem]">
          <Skeleton className="h-96 rounded-2xl bg-atlas-glass" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-36 rounded-2xl bg-atlas-glass" />
            ))}
          </div>
        </div>
      </MedicalGlassCard>
    </section>
  );
}

export function ClinicalImageLabWidget({
  cases = fallbackClinicalLabCases,
  loading = false,
  className,
  onOpenTutor,
}: ClinicalImageLabWidgetProps) {
  const [filter, setFilter] = useState<ClinicalImageFilter>('all');
  const filteredCases = useMemo(
    () => cases.filter((caseItem) => filterMatches(caseItem, filter)),
    [cases, filter]
  );
  const [activeCaseId, setActiveCaseId] = useState(cases[0]?.id ?? '');

  useEffect(() => {
    if (!filteredCases.length) return;
    if (!filteredCases.some((caseItem) => caseItem.id === activeCaseId)) {
      setActiveCaseId(filteredCases[0]?.id ?? '');
    }
  }, [activeCaseId, filteredCases]);

  const activeCase =
    filteredCases.find((caseItem) => caseItem.id === activeCaseId) ?? filteredCases[0] ?? null;
  const needsReviewCount = filterCount(cases, 'needs_review');

  if (loading) {
    return <ClinicalImageLabSkeleton className={className} />;
  }

  return (
    <section aria-labelledby="clinical-image-lab-title" className={cn('space-y-3', className)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="clinical-image-lab-title" className="text-lg font-semibold text-atlas-white">
            Clinical Image Lab
          </h2>
          <p className="text-sm text-atlas-muted">
            Synthetic image-training cases for structured visual reasoning. No real patient images
            are used here.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-atlas-border bg-atlas-glass px-3 py-1.5 text-xs text-atlas-muted">
            <Microscope className="h-3.5 w-3.5 text-atlas-cyan" aria-hidden />
            {needsReviewCount} review signals
          </span>
          <Link
            to={ROUTES.CLINICAL_EYE}
            className="atlas-focus-ring inline-flex items-center gap-2 rounded-full border border-atlas-border bg-atlas-glass px-3 py-1.5 text-xs font-semibold text-atlas-cyan"
          >
            Open lab
            <PanelRightOpen className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      </div>

      <MedicalGlassCard scannerAccent className="p-4 sm:p-5">
        <div
          className="mb-4 flex h-auto w-full flex-wrap justify-start gap-2 rounded-2xl border border-atlas-border bg-atlas-glass p-1 sm:w-fit"
          role="group"
          aria-label="Clinical image status filters"
        >
          {filters.map((item) => {
            const count = filterCount(cases, item.value);

            return (
              <button
                key={item.value}
                type="button"
                aria-pressed={filter === item.value}
                aria-label={`${item.label} clinical image cases, ${count} available`}
                onClick={() => setFilter(item.value)}
                className={cn(
                  'atlas-focus-ring rounded-xl px-3 py-2 text-xs font-semibold text-atlas-muted transition-colors motion-reduce:transition-none',
                  filter === item.value
                    ? 'bg-[color-mix(in_srgb,var(--atlas-accent-cyan)_12%,transparent)] text-atlas-cyan'
                    : 'hover:bg-atlas-glass hover:text-atlas-white'
                )}
              >
                {item.label}
                <span className="ml-2 rounded-full border border-atlas-border px-1.5 py-0.5 font-mono text-[0.62rem]">
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {!cases.length || !activeCase ? (
          <ClinicalImageEmptyState filter={filter} onReset={() => setFilter('all')} />
        ) : (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <div id="clinical-image-lab-preview" className="min-w-0">
              <ScannerFrame
                label={`${activeCase.type} diagnostic viewer`}
                footer={activeCase.annotationNote}
                aria-label={`Synthetic diagnostic viewer for ${activeCase.type}. ${activeCase.annotationNote}`}
              >
                <VisualPattern caseItem={activeCase} />
              </ScannerFrame>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-atlas-border bg-atlas-glass p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-atlas-subtle">
                    Accuracy
                  </p>
                  <p className="mt-2 font-mono text-2xl font-semibold text-atlas-white">
                    {accuracyLabel(activeCase)}
                  </p>
                  <p className="mt-1 text-xs text-atlas-muted">{activeCase.accuracyTrend}</p>
                </div>
                <div className="rounded-2xl border border-atlas-border bg-atlas-glass p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-atlas-subtle">
                    Difficulty
                  </p>
                  <p className="mt-2 font-mono text-2xl font-semibold text-atlas-white">
                    {activeCase.difficulty}
                  </p>
                  <p className="mt-1 text-xs text-atlas-muted">Mock case calibration</p>
                </div>
                <div className="rounded-2xl border border-atlas-border bg-atlas-glass p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-atlas-subtle">
                    Status
                  </p>
                  <p className="mt-2 font-mono text-2xl font-semibold text-atlas-white">
                    {statusLabel(activeCase.status)}
                  </p>
                  <p className="mt-1 text-xs text-atlas-muted">Training queue state</p>
                </div>
              </div>
            </div>

            <div className="min-w-0 space-y-3">
              <div className="rounded-2xl border border-atlas-border bg-[color-mix(in_srgb,var(--atlas-bg-soft)_76%,transparent)] p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <OrganSystemBadge
                    label={activeCase.system}
                    score={activeCase.difficulty}
                    state={badgeState(activeCase.status)}
                    aria-label={`${activeCase.system} ${activeCase.difficulty} case`}
                  />
                  <span
                    className={cn(
                      'rounded-full border px-2 py-1 text-xs font-semibold',
                      statusClass[activeCase.status]
                    )}
                  >
                    {statusLabel(activeCase.status)}
                  </span>
                  <span className="rounded-full border border-atlas-border px-2 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-atlas-subtle">
                    mock
                  </span>
                </div>
                <h3 className="mt-4 text-xl font-semibold text-atlas-white">
                  {activeCase.type} reasoning drill
                </h3>
                <p className="mt-2 text-sm leading-6 text-atlas-muted">
                  {activeCase.learningObjective}
                </p>
                <div className="mt-4 rounded-xl border border-atlas-border bg-atlas-glass p-3 text-sm leading-6 text-atlas-muted">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-atlas-cyan">
                    Next image action
                  </p>
                  <p className="mt-1">{nextImageAction(activeCase)}</p>
                </div>
                <div className="mt-4 rounded-xl border border-atlas-border bg-atlas-glass p-3 text-sm leading-6 text-atlas-muted">
                  <div className="flex gap-2">
                    <CircleDot className="mt-1 h-4 w-4 shrink-0 text-atlas-pulse" aria-hidden />
                    <span>{activeCase.annotationNote}</span>
                  </div>
                </div>
                {onOpenTutor ? (
                  <button
                    type="button"
                    onClick={() => onOpenTutor(activeCase)}
                    className="atlas-focus-ring mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-atlas-border-glow bg-[color-mix(in_srgb,var(--atlas-accent-cyan)_10%,transparent)] px-3 py-2 text-sm font-semibold text-atlas-cyan transition-colors hover:bg-[color-mix(in_srgb,var(--atlas-accent-cyan)_16%,transparent)]"
                    aria-label={`Ask AI Tutor about ${activeCase.type} image pattern`}
                  >
                    <BrainCircuit className="h-4 w-4" aria-hidden />
                    Ask tutor about this pattern
                  </button>
                ) : null}
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                {filteredCases.map((caseItem) => (
                  <CaseCard
                    key={caseItem.id}
                    caseItem={caseItem}
                    active={caseItem.id === activeCase.id}
                    onSelect={() => setActiveCaseId(caseItem.id)}
                  />
                ))}
              </div>

              <div className="rounded-2xl border border-atlas-border bg-atlas-glass p-3 text-xs leading-5 text-atlas-muted">
                <div className="flex gap-2">
                  <ScanLine className="mt-0.5 h-3.5 w-3.5 shrink-0 text-atlas-cyan" aria-hidden />
                  <span>
                    Replace these synthetic panels with licensed clinical images through the
                    image-training asset pipeline when available.
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </MedicalGlassCard>
    </section>
  );
}
