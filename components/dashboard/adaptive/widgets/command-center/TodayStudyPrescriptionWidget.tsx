import React, { useMemo } from 'react';
import { BrainCircuit, Clock3, ListChecks, Microscope, RotateCcw, Target } from 'lucide-react';
import type { DashboardContext } from '../../model/DashboardContext';
import { MedicalGlassCard, OrganSystemBadge, PremiumCTAButton } from '@/components/studypanacea';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  fallbackStudyPrescriptionTasks,
  type StudyPrescriptionPriority,
  type StudyPrescriptionTask,
} from '../../page/commandCenterMockData';

export interface TodayStudyPrescriptionWidgetProps {
  context: DashboardContext;
  loading?: boolean;
  tasks?: StudyPrescriptionTask[];
  onOpenTutor?: () => void;
  onOpenWhy?: () => void;
  className?: string;
}

const priorityClass: Record<StudyPrescriptionPriority, string> = {
  critical: 'border-atlas-pulse bg-[color-mix(in_srgb,var(--atlas-accent-pulse-pink)_10%,transparent)] text-atlas-pulse',
  high: 'border-atlas-warning bg-[color-mix(in_srgb,var(--atlas-warning-amber)_10%,transparent)] text-atlas-warning',
  medium: 'border-atlas-cyan bg-[color-mix(in_srgb,var(--atlas-accent-cyan)_10%,transparent)] text-atlas-cyan',
  low: 'border-atlas-border bg-atlas-glass text-atlas-muted',
};

function formatLabel(raw: string | null | undefined): string {
  if (!raw) return 'Mixed system';
  return raw
    .replace(/__/g, ' / ')
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizePriority(raw: string | null | undefined): StudyPrescriptionPriority {
  const value = raw?.toLowerCase();
  if (value === 'critical' || value === 'urgent') return 'critical';
  if (value === 'high') return 'high';
  if (value === 'low') return 'low';
  return 'medium';
}

function actionFromTask(task: NonNullable<DashboardContext['raw']['todayPlan']>['tasks'][number]): StudyPrescriptionTask['action'] {
  const text = `${task.kind} ${task.mode} ${task.title} ${task.reason}`.toLowerCase();
  if (text.includes('review') || text.includes('due') || text.includes('retention')) return 'review';
  if (text.includes('image') || text.includes('clinical')) return 'practice';
  return 'start';
}

function actionLabel(action: StudyPrescriptionTask['action']): string {
  switch (action) {
    case 'review':
      return 'Review due cards';
    case 'practice':
      return 'Open practice';
    case 'plan':
      return 'Open plan';
    default:
      return 'Start task';
  }
}

function buildPrescriptionTasks(context: DashboardContext): StudyPrescriptionTask[] {
  const planTasks = context.raw.todayPlan?.tasks
    ?.filter((task) => !['completed', 'skipped', 'rescheduled'].includes(task.status))
    .slice(0, 4)
    .map((task, index): StudyPrescriptionTask => {
      const action = actionFromTask(task);
      const system =
        task.systemFilter?.[0] ??
        task.systems?.[0] ??
        task.conditionIds?.[0] ??
        context.raw.todayPlan?.mainSystems?.[0] ??
        context.raw.todayPlan?.targetedConditions?.[0] ??
        context.raw.growthAreas[0] ??
        context.goal.label;

      return {
        id: task.id,
        title: task.title,
        system: formatLabel(system),
        estimatedMinutes: Math.max(1, Math.round(task.estimatedMinutes)),
        priority: normalizePriority(task.priority),
        reason: task.reason || context.raw.todayPlan?.reasonSummary || context.today.subtitle,
        actionLabel: index === 0 ? context.today.primaryCtaLabel : actionLabel(action),
        action,
        source: 'today-plan',
      };
    });

  if (planTasks?.length) {
    return planTasks;
  }

  if (context.today.title) {
    return [
      {
        id: 'context-primary-prescription',
        title: context.today.title,
        system: formatLabel(context.raw.todayPlan?.mainSystems?.[0] ?? context.raw.growthAreas[0] ?? context.goal.label),
        estimatedMinutes: context.today.durationMinutes,
        priority: context.goal.status === 'behind' ? 'critical' : context.goal.status === 'catch_up' ? 'high' : 'medium',
        reason: context.today.subtitle,
        actionLabel: context.today.primaryCtaLabel,
        action: 'start',
        source: context.raw.todayPlan ? 'today-plan' : 'mock',
      },
      ...fallbackStudyPrescriptionTasks.slice(1),
    ];
  }

  return fallbackStudyPrescriptionTasks;
}

function runTaskAction(task: StudyPrescriptionTask, context: DashboardContext) {
  if (task.action === 'review') {
    context.actions.onOpenReview?.();
    return;
  }
  if (task.action === 'practice') {
    context.actions.onOpenPractice?.();
    return;
  }
  if (task.action === 'plan') {
    context.actions.onOpenFullPlan?.();
    return;
  }
  context.actions.onStartToday?.();
}

function TaskIcon({ task }: { task: StudyPrescriptionTask }) {
  const Icon = task.action === 'review' ? RotateCcw : task.action === 'practice' ? Microscope : Target;
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-atlas-border bg-atlas-glass text-atlas-cyan">
      <Icon className="h-4 w-4" aria-hidden />
    </span>
  );
}

function PrescriptionTaskCard({
  task,
  context,
  primary,
}: {
  task: StudyPrescriptionTask;
  context: DashboardContext;
  primary: boolean;
}) {
  return (
    <article className={cn(
      'rounded-2xl border bg-[color-mix(in_srgb,var(--atlas-bg-soft)_72%,transparent)] p-4',
      primary
        ? 'border-atlas-border-glow shadow-[0_0_30px_-22px_var(--atlas-accent-cyan)] xl:col-span-3 2xl:col-span-1'
        : 'border-atlas-border',
    )}>
      <div className="flex items-start gap-3">
        <TaskIcon task={task} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn('rounded-full border px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em]', priorityClass[task.priority])}>
              {task.priority}
            </span>
            {task.source === 'mock' ? (
              <span className="rounded-full border border-atlas-border px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-atlas-subtle">
                mock
              </span>
            ) : null}
          </div>
          <h3 className="mt-3 text-base font-semibold text-atlas-white">{task.title}</h3>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-atlas-muted">
            <OrganSystemBadge label={task.system} state={task.priority === 'critical' ? 'weak' : task.priority === 'high' ? 'watch' : 'active'} />
            <span className="inline-flex items-center gap-1 rounded-full border border-atlas-border bg-atlas-glass px-2 py-1 font-mono">
              <Clock3 className="h-3.5 w-3.5" aria-hidden />
              {task.estimatedMinutes} min
            </span>
          </div>
          <p className="mt-3 text-sm leading-6 text-atlas-muted">{task.reason}</p>
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        {primary ? (
          <PremiumCTAButton
            type="button"
            onClick={() => runTaskAction(task, context)}
            scannerAccent
            data-testid="primary-study-action"
            aria-label={task.actionLabel}
          >
            {task.actionLabel}
          </PremiumCTAButton>
        ) : (
          <button
            type="button"
            onClick={() => runTaskAction(task, context)}
            className="atlas-focus-ring inline-flex items-center justify-center rounded-xl border border-atlas-border bg-atlas-glass px-3 py-2 text-sm font-semibold text-atlas-cyan hover:border-atlas-border-glow"
            aria-label={`${task.actionLabel}: ${task.title}`}
          >
            {task.actionLabel}
          </button>
        )}
      </div>
    </article>
  );
}

function PrescriptionSummary({ context }: { context: DashboardContext }) {
  const items = [
    { label: 'Dose', value: `${context.today.durationMinutes} min` },
    { label: 'Questions', value: `${context.today.questionCount}` },
    { label: 'Reviews', value: `${context.today.reviewCount}` },
    { label: 'Expected lift', value: context.today.expectedLiftLabel },
  ];

  return (
    <div className="mb-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-2">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-2xl border border-atlas-border bg-atlas-glass px-3 py-2"
        >
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-atlas-subtle">
            {item.label}
          </p>
          <p className="mt-1 font-mono text-sm font-semibold tabular-nums text-atlas-white">
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}

export function TodayStudyPrescriptionSkeleton({ className }: { className?: string }) {
  return (
    <section aria-labelledby="today-prescription-title" className={cn('space-y-3', className)} aria-busy="true">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-5 w-52 bg-atlas-glass" />
          <Skeleton className="h-4 w-72 bg-atlas-glass" />
        </div>
        <Skeleton className="h-8 w-24 rounded-full bg-atlas-glass" />
      </div>
      <MedicalGlassCard className="space-y-3 p-3 sm:p-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-44 rounded-2xl bg-atlas-glass" />
        ))}
      </MedicalGlassCard>
    </section>
  );
}

export function TodayStudyPrescriptionWidget({
  context,
  loading = false,
  tasks,
  onOpenTutor,
  onOpenWhy,
  className,
}: TodayStudyPrescriptionWidgetProps) {
  const resolvedTasks = useMemo(() => tasks ?? buildPrescriptionTasks(context), [context, tasks]);

  if (loading) {
    return <TodayStudyPrescriptionSkeleton className={className} />;
  }

  return (
    <section aria-labelledby="today-prescription-title" className={cn('space-y-3', className)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="today-prescription-title" className="text-lg font-semibold text-atlas-white">
            Today's PANCE Study Prescription
            <span className="sr-only"> Today's session</span>
          </h2>
          <p className="text-sm text-atlas-muted">
            The next block, review pass, or image drill ranked by urgency and weak-area value.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {onOpenWhy ? (
            <button
              type="button"
              onClick={onOpenWhy}
              aria-label="Why this?"
              className="atlas-focus-ring inline-flex items-center gap-2 rounded-full border border-atlas-border bg-atlas-glass px-3 py-1.5 text-xs font-semibold text-atlas-cyan"
            >
              <ListChecks className="h-3.5 w-3.5" aria-hidden />
              Why this plan
            </button>
          ) : null}
          {onOpenTutor ? (
            <button
              type="button"
              onClick={onOpenTutor}
              className="atlas-focus-ring inline-flex items-center gap-2 rounded-full border border-atlas-border bg-atlas-glass px-3 py-1.5 text-xs font-semibold text-atlas-cyan"
            >
              <BrainCircuit className="h-3.5 w-3.5" aria-hidden />
              Ask tutor
            </button>
          ) : null}
        </div>
      </div>

      <MedicalGlassCard scannerAccent className="p-3 sm:p-4">
        <PrescriptionSummary context={context} />
        {resolvedTasks.length ? (
          <div className="grid gap-3 xl:grid-cols-3 2xl:grid-cols-1">
            {resolvedTasks.map((task, index) => (
              <PrescriptionTaskCard key={task.id} task={task} context={context} primary={index === 0} />
            ))}
          </div>
        ) : (
          <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-atlas-border bg-atlas-glass p-6 text-center">
            <ListChecks className="h-8 w-8 text-atlas-cyan" aria-hidden />
            <h3 className="mt-3 text-base font-semibold text-atlas-white">No prescription tasks ready</h3>
            <p className="mt-2 max-w-md text-sm leading-6 text-atlas-muted">
              Complete a short practice block or open the study plan to generate a safer next action.
            </p>
            <button
              type="button"
              onClick={context.actions.onOpenFullPlan ?? context.actions.onOpenPractice}
              className="atlas-focus-ring mt-4 inline-flex items-center justify-center rounded-xl border border-atlas-border bg-atlas-glass px-3 py-2 text-sm font-semibold text-atlas-cyan"
            >
              Open study plan
            </button>
          </div>
        )}
      </MedicalGlassCard>
    </section>
  );
}
