import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Play,
  RefreshCw,
  Target,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { StudyPlanDay, StudyPlanTask } from '@/lib/api/types/studyPlan';

type TodayPlanTask = NonNullable<TodayPlanData['tasks']>[number];

interface TodayPlanCardProps {
  data: StudyPlanDay | null;
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
  onStartMain: (systems?: string[], task?: TodayPlanTask) => void;
  onStartTargeted: (conditions?: string[], task?: TodayPlanTask) => void;
}

function selectTask(tasks: StudyPlanTask[], kind: StudyPlanTask['kind']) {
  return tasks.find((task) => task.kind === kind && task.status !== 'completed');
}

function formatStatus(status: StudyPlanDay['status']): string {
  switch (status) {
    case 'completed':
      return 'Completed';
    case 'in_progress':
      return 'In progress';
    case 'skipped':
      return 'Skipped';
    default:
      return 'Pending';
  }
}

export const TodayPlanCard: React.FC<TodayPlanCardProps> = ({
  data,
  isLoading,
  error,
  onRefresh,
  onStartMain,
  onStartTargeted,
}) => {
  if (isLoading) {
    return (
      <div className="card-cinematic p-5">
        <div className="animate-pulse space-y-3">
          <div className="h-5 w-36 rounded bg-[var(--color-bg-tertiary)]" />
          <div className="h-16 rounded-xl bg-[var(--color-bg-tertiary)]" />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="h-20 rounded-xl bg-[var(--color-bg-tertiary)]" />
            <div className="h-20 rounded-xl bg-[var(--color-bg-tertiary)]" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card-cinematic p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-1 h-4 w-4 text-[var(--color-data-provisional)]" />
          <div className="flex-1 space-y-2">
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">
              Today's plan could not be loaded
            </p>
            <p className="text-sm text-[var(--color-text-secondary)]">{error}</p>
            <Button type="button" size="sm" variant="outline" onClick={onRefresh}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="card-cinematic p-5">
        <div className="space-y-3">
          <p className="text-body font-semibold text-[var(--color-text-primary)]">Today's plan</p>
          <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
            No study plan has been generated for today yet. You can still start a review or main session manually.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button type="button" size="sm" onClick={() => onStartMain()}>
              Start review
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={onRefresh}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const mainTask = selectTask(data.tasks, 'main') ?? selectTask(data.tasks, 'review');
  const targetedTask = selectTask(data.tasks, 'targeted');
  const completedPercent = Math.max(0, Math.min(100, data.progress.percentComplete));

  return (
    <div className="card-cinematic p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-body font-semibold text-[var(--color-text-primary)]">Today's plan</p>
          <p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">
            {data.summary}
          </p>
        </div>
        <span className="rounded-full bg-[var(--color-bg-tertiary)] px-2.5 py-1 text-xs font-semibold text-[var(--color-text-muted)]">
          {formatStatus(data.status)}
        </span>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          onClick={() => {
            const mainTask = data.tasks?.find((task) => task.kind === 'main' && task.status !== 'completed');
            if (mainTask?.systemFilter) onStartMain(mainTask.systemFilter, mainTask);
            else onStartMain(data.mainSystems);
          }}
          className={`flex items-center justify-center gap-2 py-3 px-4 font-semibold rounded-lg text-sm transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 ${
            splitMeta.emphasis === 'main' || splitMeta.emphasis === 'both'
              ? 'bg-[var(--color-accent)] text-[var(--color-text-inverse)] hover:opacity-90'
              : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]/70'
          }`}
        >
          <BookOpen className="w-4 h-4" aria-hidden="true" />
          Start MAIN ({data.recommendedMainCount}q)
          <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
        <button
          onClick={() => {
            const targetedTask = data.tasks?.find((task) => task.kind === 'targeted' && task.status !== 'completed');
            if (targetedTask?.conditionIds) onStartTargeted(targetedTask.conditionIds, targetedTask);
            else onStartTargeted(data.targetedConditions);
          }}
          className={`flex items-center justify-center gap-2 py-3 px-4 font-semibold rounded-lg text-sm transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 ${
            splitMeta.emphasis === 'targeted'
              ? 'bg-[var(--color-data-provisional)] text-[var(--color-text-inverse)] hover:opacity-90'
              : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]/70'
          }`}
        >
          <Target className="w-4 h-4" aria-hidden="true" />
          Start TARGETED ({data.recommendedTargetedCount}q)
          <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>

      <div className="mb-4 h-2 overflow-hidden rounded-full bg-[var(--color-bg-tertiary)]">
        <div
          className="h-full rounded-full bg-[var(--color-accent)] transition-all duration-300"
          style={{ width: `${completedPercent}%` }}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-4">
          <div className="mb-2 flex items-center gap-2">
            <Play className="h-4 w-4 text-[var(--color-accent)]" />
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">Main work</p>
          </div>
          <p className="text-sm text-[var(--color-text-secondary)]">
            {mainTask?.description ?? 'Continue with your general review queue.'}
          </p>
          <Button
            type="button"
            size="sm"
            className="mt-4"
            onClick={() => onStartMain(mainTask?.systems)}
          >
            Start main
          </Button>
        </div>

        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-4">
          <div className="mb-2 flex items-center gap-2">
            <Zap className="h-4 w-4 text-[var(--color-data-provisional)]" />
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">Targeted work</p>
          </div>
          <p className="text-sm text-[var(--color-text-secondary)]">
            {targetedTask?.description ?? 'No targeted task is scheduled right now.'}
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-4"
            onClick={() => onStartTargeted(targetedTask?.conditionIds)}
          >
            Start targeted
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TodayPlanCard;
