import React, { useMemo, useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type Column,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BrainCircuit,
  RotateCcw,
  SearchX,
  ShieldAlert,
} from 'lucide-react';
import type { DashboardContext } from '../../model/DashboardContext';
import { MedicalGlassCard } from '@/components/studypanacea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import {
  fallbackQuestionReviewRows,
  type QuestionReviewRow,
} from '../../page/commandCenterMockData';

type ReviewFilter = 'all' | 'missed' | 'flagged' | 'needs_review';

export interface QuestionReviewTableWidgetProps {
  context: DashboardContext;
  rows?: QuestionReviewRow[];
  loading?: boolean;
  className?: string;
  onOpenTutor?: (row: QuestionReviewRow) => void;
}

const reviewFilters: Array<{ value: ReviewFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'missed', label: 'Missed' },
  { value: 'flagged', label: 'Flagged' },
  { value: 'needs_review', label: 'Needs review' },
];

const resultClass: Record<QuestionReviewRow['result'], string> = {
  missed: 'border-atlas-pulse bg-[color-mix(in_srgb,var(--atlas-accent-pulse-pink)_10%,transparent)] text-atlas-pulse',
  flagged: 'border-atlas-warning bg-[color-mix(in_srgb,var(--atlas-warning-amber)_10%,transparent)] text-atlas-warning',
  needs_review: 'border-atlas-cyan bg-[color-mix(in_srgb,var(--atlas-accent-cyan)_10%,transparent)] text-atlas-cyan',
  correct: 'border-atlas-success bg-[color-mix(in_srgb,var(--atlas-success-green)_10%,transparent)] text-atlas-success',
};

const actionClass: Record<QuestionReviewRow['nextAction'], string> = {
  'Review explanation': 'text-atlas-cyan',
  Retry: 'text-atlas-warning',
  'Add to spaced review': 'text-atlas-violet',
  'Drill similar': 'text-atlas-success',
};

function formatLabel(raw: string | null | undefined): string {
  if (!raw) return 'Mixed clinical pattern';
  return raw
    .replace(/__/g, ' / ')
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function resultLabel(result: QuestionReviewRow['result']): string {
  if (result === 'needs_review') return 'Needs review';
  return result.charAt(0).toUpperCase() + result.slice(1);
}

function difficultyRank(difficulty: QuestionReviewRow['difficulty']): number {
  switch (difficulty) {
    case 'Hard':
      return 4;
    case 'Moderate':
      return 3;
    case 'PANCE-level':
      return 2;
    default:
      return 1;
  }
}

function resultRank(result: QuestionReviewRow['result']): number {
  switch (result) {
    case 'missed':
      return 4;
    case 'flagged':
      return 3;
    case 'needs_review':
      return 2;
    default:
      return 1;
  }
}

function timeLabel(seconds: number | null): string {
  if (seconds == null) return 'Not captured';
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}m ${remaining}s`;
}

function isConfidenceMismatch(row: QuestionReviewRow): boolean {
  return row.flags.includes('confidence_mismatch') || (row.result === 'missed' && (row.confidenceValue ?? 0) >= 75);
}

function difficultyFromRecord(questionType: string | undefined, timeSpentSeconds: number | null): QuestionReviewRow['difficulty'] {
  if (timeSpentSeconds != null && timeSpentSeconds >= 75) return 'Hard';
  if (questionType === 'management' || questionType === 'pharm') return 'Moderate';
  return 'PANCE-level';
}

function nextActionForRow(result: QuestionReviewRow['result'], flagged: boolean): QuestionReviewRow['nextAction'] {
  if (result === 'missed') return 'Review explanation';
  if (flagged) return 'Retry';
  if (result === 'needs_review') return 'Add to spaced review';
  return 'Drill similar';
}

function runAction(row: QuestionReviewRow, context: DashboardContext) {
  if (row.nextAction === 'Add to spaced review' || row.nextAction === 'Review explanation') {
    context.actions.onOpenReview?.();
    return;
  }

  context.actions.onOpenPractice?.();
}

function buildQuestionReviewRows(context: DashboardContext): QuestionReviewRow[] {
  const recentPerformanceRows: QuestionReviewRow[] = context.raw.performanceData
    .slice()
    .sort((left, right) => right.timestamp - left.timestamp)
    .filter((record) => {
      const slow = record.timeSpentMs != null && record.timeSpentMs >= 60_000;
      return !record.isCorrect || Boolean(record.finalAnswerWasChanged) || slow;
    })
    .slice(0, 5)
    .map((record, index) => {
      const timeSpentSeconds =
        record.timeSpentMs == null ? null : Math.max(1, Math.round(record.timeSpentMs / 1000));
      const flagged = Boolean(record.finalAnswerWasChanged) || record.errorTag === 'guessing';
      const result: QuestionReviewRow['result'] = !record.isCorrect
        ? 'missed'
        : flagged
          ? 'flagged'
          : 'needs_review';
      const flags: QuestionReviewRow['flags'] = [];
      if (!record.isCorrect) flags.push('missed', 'needs_review');
      if (flagged) flags.push('flagged', 'needs_review');
      if (!flags.includes('needs_review')) flags.push('needs_review');

      return {
        id: `performance-${record.conditionId || record.topic || index}-${record.timestamp}`,
        topic: formatLabel(record.condition || record.subcategory || record.topic || record.conditionId),
        system: formatLabel(record.system ?? record.topic),
        difficulty: difficultyFromRecord(record.questionType, timeSpentSeconds),
        result,
        confidenceLabel: flagged ? 'Mixed signal' : 'Not captured',
        confidenceValue: null,
        timeSpentSeconds,
        nextAction: nextActionForRow(result, flagged),
        reason:
          record.errorTag != null
            ? `Recent attempt tagged as ${formatLabel(record.errorTag)}.`
            : !record.isCorrect
              ? 'Recent missed item; review the explanation before drilling similar questions.'
              : 'Recent answer pattern suggests this item should stay in review.',
        flags,
        source: 'analytics',
      };
    });

  const upcomingReviewRows: QuestionReviewRow[] =
    context.raw.dashboardAnalytics?.fsrs.upcomingReviews.slice(0, 5).map((review) => {
      const retrievability = review.retrievabilityPercent;
      const isOverdue = review.overdueDays > 0;
      return {
        id: `review-${review.id}`,
        topic: review.targetLabel,
        system: formatLabel(review.system ?? review.progressContext ?? 'Review queue'),
        difficulty: 'PANCE-level',
        result: isOverdue ? 'needs_review' : 'flagged',
        confidenceLabel: retrievability == null ? 'Not captured' : `${retrievability}% retrieval`,
        confidenceValue: retrievability,
        timeSpentSeconds: null,
        nextAction: 'Add to spaced review',
        reason: isOverdue
          ? `${review.overdueDays} day${review.overdueDays === 1 ? '' : 's'} overdue in the review queue.`
          : 'Due review item; retrieval strength is a memory signal, not a diagnostic claim.',
        flags: isOverdue || (retrievability != null && retrievability < 65) ? ['needs_review'] : ['flagged'],
        source: 'review-queue',
      } satisfies QuestionReviewRow;
    }) ?? [];

  const remaining = Math.max(0, 8 - recentPerformanceRows.length - upcomingReviewRows.length);
  const weakConditionRows: QuestionReviewRow[] =
    context.raw.dashboardAnalytics?.weakConditions.slice(0, remaining).map((condition) => ({
      id: `weak-condition-${condition.conditionId}`,
      topic: formatLabel(condition.conditionId),
      system: 'Weak condition',
      difficulty: condition.accuracy < 50 ? 'Hard' : 'Moderate',
      result: 'needs_review',
      confidenceLabel: 'Not captured',
      confidenceValue: null,
      timeSpentSeconds: null,
      nextAction: 'Drill similar',
      reason: `${Math.round(condition.accuracy)}% accuracy across ${condition.total} attempts.`,
      flags: condition.accuracy < 60 ? ['missed', 'needs_review'] : ['needs_review'],
      source: 'analytics',
    })) ?? [];

  const rows = [...recentPerformanceRows, ...upcomingReviewRows, ...weakConditionRows];
  return rows.length ? rows : fallbackQuestionReviewRows;
}

function SortIcon({ sorted }: { sorted: false | 'asc' | 'desc' }) {
  if (sorted === 'asc') return <ArrowUp className="h-3.5 w-3.5" aria-hidden />;
  if (sorted === 'desc') return <ArrowDown className="h-3.5 w-3.5" aria-hidden />;
  return <ArrowUpDown className="h-3.5 w-3.5 opacity-70" aria-hidden />;
}

function HeaderButton({
  label,
  column,
}: {
  label: string;
  column: Column<QuestionReviewRow, unknown>;
}) {
  const sorted = column.getIsSorted();
  const sortDescription =
    sorted === 'asc' ? 'sorted ascending' : sorted === 'desc' ? 'sorted descending' : 'not sorted';
  return (
    <button
      type="button"
      onClick={column.getToggleSortingHandler()}
      className="atlas-focus-ring inline-flex items-center gap-1 rounded-md px-1 py-1 text-left"
      aria-label={`${label}, ${sortDescription}. Activate to change sort order.`}
    >
      {label}
      <SortIcon sorted={sorted} />
    </button>
  );
}

function ResultBadge({ row }: { row: QuestionReviewRow }) {
  const mismatch = isConfidenceMismatch(row);
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold', resultClass[row.result])}>
      {mismatch ? <ShieldAlert className="h-3.5 w-3.5" aria-hidden /> : null}
      {resultLabel(row.result)}
    </span>
  );
}

function ConfidenceCell({ row }: { row: QuestionReviewRow }) {
  const mismatch = isConfidenceMismatch(row);
  return (
    <div className="space-y-1">
      <span className={cn('font-mono text-xs tabular-nums', mismatch ? 'text-atlas-pulse' : 'text-atlas-white')}>
        {row.confidenceLabel}
      </span>
      {mismatch ? (
        <span className="block text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-atlas-pulse">
          Mismatch
        </span>
      ) : null}
    </div>
  );
}

function ActionButton({
  row,
  context,
  onOpenTutor,
}: {
  row: QuestionReviewRow;
  context: DashboardContext;
  onOpenTutor?: (row: QuestionReviewRow) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => runAction(row, context)}
        className={cn(
          'atlas-focus-ring inline-flex items-center gap-2 rounded-xl border border-atlas-border bg-atlas-glass px-3 py-2 text-sm font-semibold hover:border-atlas-border-glow',
          actionClass[row.nextAction],
        )}
        aria-label={`${row.nextAction}: ${row.topic}`}
      >
        <RotateCcw className="h-3.5 w-3.5" aria-hidden />
        {row.nextAction}
      </button>
      {onOpenTutor ? (
        <button
          type="button"
          onClick={() => onOpenTutor(row)}
          className="atlas-focus-ring inline-flex items-center gap-2 rounded-xl border border-atlas-border-glow bg-[color-mix(in_srgb,var(--atlas-accent-cyan)_9%,transparent)] px-3 py-2 text-sm font-semibold text-atlas-cyan hover:bg-[color-mix(in_srgb,var(--atlas-accent-cyan)_15%,transparent)]"
          aria-label={`Ask AI Tutor about ${row.topic}`}
        >
          <BrainCircuit className="h-3.5 w-3.5" aria-hidden />
          Ask tutor
        </button>
      ) : null}
    </div>
  );
}

function MobileReviewCard({
  row,
  context,
  onOpenTutor,
}: {
  row: QuestionReviewRow;
  context: DashboardContext;
  onOpenTutor?: (row: QuestionReviewRow) => void;
}) {
  const mismatch = isConfidenceMismatch(row);
  return (
    <article
      className={cn(
        'rounded-2xl border bg-[color-mix(in_srgb,var(--atlas-bg-soft)_74%,transparent)] p-4',
        mismatch ? 'border-[color-mix(in_srgb,var(--atlas-accent-pulse-pink)_45%,transparent)]' : 'border-atlas-border',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-atlas-white">{row.topic}</h3>
          <p className="mt-1 text-sm text-atlas-muted">{row.system}</p>
        </div>
        <ResultBadge row={row} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl border border-atlas-border bg-atlas-glass p-2">
          <span className="block text-atlas-subtle">Difficulty</span>
          <span className="font-mono text-atlas-white">{row.difficulty}</span>
        </div>
        <div className="rounded-xl border border-atlas-border bg-atlas-glass p-2">
          <span className="block text-atlas-subtle">Confidence</span>
          <span className="font-mono text-atlas-white">{row.confidenceLabel}</span>
        </div>
        <div className="rounded-xl border border-atlas-border bg-atlas-glass p-2">
          <span className="block text-atlas-subtle">Time</span>
          <span className="font-mono text-atlas-white">{timeLabel(row.timeSpentSeconds)}</span>
        </div>
        <div className="rounded-xl border border-atlas-border bg-atlas-glass p-2">
          <span className="block text-atlas-subtle">Source</span>
          <span className="font-mono text-atlas-white">{row.source === 'mock' ? 'Mock' : 'Signal'}</span>
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-atlas-muted">{row.reason}</p>
      <div className="mt-4">
        <ActionButton row={row} context={context} onOpenTutor={onOpenTutor} />
      </div>
    </article>
  );
}

function EmptyState({
  filtered,
  onReset,
}: {
  filtered: boolean;
  onReset: () => void;
}) {
  return (
    <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-atlas-border bg-atlas-glass p-6 text-center">
      <SearchX className="h-8 w-8 text-atlas-cyan" aria-hidden />
      <h3 className="mt-3 text-base font-semibold text-atlas-white">
        {filtered ? 'No review rows match these filters' : 'No question review rows yet'}
      </h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-atlas-muted">
        {filtered
          ? 'Reset filters to inspect the available review signals.'
          : 'Complete practice or review sessions to populate missed, flagged, and confidence-mismatch items.'}
      </p>
      {filtered ? (
        <button
          type="button"
          onClick={onReset}
          className="atlas-focus-ring mt-4 rounded-xl border border-atlas-border bg-atlas-glass px-3 py-2 text-sm font-semibold text-atlas-cyan"
        >
          Reset filters
        </button>
      ) : null}
    </div>
  );
}

export function QuestionReviewTableSkeleton({ className }: { className?: string }) {
  return (
    <section aria-labelledby="question-review-title" className={cn('space-y-3', className)} aria-busy="true">
      <div className="space-y-2">
        <Skeleton className="h-5 w-48 bg-atlas-glass" />
        <Skeleton className="h-4 w-80 bg-atlas-glass" />
      </div>
      <MedicalGlassCard className="p-4">
        <Skeleton className="h-80 rounded-2xl bg-atlas-glass" />
      </MedicalGlassCard>
    </section>
  );
}

export function QuestionReviewTableWidget({
  context,
  rows,
  loading = false,
  className,
  onOpenTutor,
}: QuestionReviewTableWidgetProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'result', desc: true }]);
  const [systemFilter, setSystemFilter] = useState('all');
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('all');
  const resolvedRows = useMemo(() => rows ?? buildQuestionReviewRows(context), [context, rows]);
  const systems = useMemo(
    () => Array.from(new Set(resolvedRows.map((row) => row.system))).sort((left, right) => left.localeCompare(right)),
    [resolvedRows],
  );
  const filteredRows = useMemo(
    () =>
      resolvedRows.filter((row) => {
        const systemMatches = systemFilter === 'all' || row.system === systemFilter;
        const reviewMatches =
          reviewFilter === 'all' ||
          row.flags.includes(reviewFilter) ||
          (reviewFilter === 'missed' && row.result === 'missed') ||
          (reviewFilter === 'flagged' && row.result === 'flagged') ||
          (reviewFilter === 'needs_review' && row.result === 'needs_review');
        return systemMatches && reviewMatches;
      }),
    [resolvedRows, reviewFilter, systemFilter],
  );
  const mismatchCount = filteredRows.filter(isConfidenceMismatch).length;

  const columns = useMemo<ColumnDef<QuestionReviewRow>[]>(
    () => [
      {
        accessorKey: 'topic',
        header: 'Question/topic',
        enableSorting: false,
        cell: ({ row }) => (
          <div className="max-w-[18rem]">
            <p className="font-medium text-atlas-white">{row.original.topic}</p>
            <p className="mt-1 line-clamp-1 text-xs text-atlas-subtle">{row.original.reason}</p>
          </div>
        ),
      },
      {
        accessorKey: 'system',
        header: ({ column }) => <HeaderButton label="Organ system" column={column} />,
        cell: ({ row }) => <span className="text-atlas-muted">{row.original.system}</span>,
      },
      {
        id: 'difficulty',
        accessorFn: (row) => difficultyRank(row.difficulty),
        header: ({ column }) => <HeaderButton label="Difficulty" column={column} />,
        cell: ({ row }) => <span className="font-mono text-xs text-atlas-white">{row.original.difficulty}</span>,
      },
      {
        id: 'result',
        accessorFn: (row) => resultRank(row.result),
        header: ({ column }) => <HeaderButton label="Result" column={column} />,
        cell: ({ row }) => <ResultBadge row={row.original} />,
      },
      {
        id: 'confidence',
        accessorFn: (row) => row.confidenceValue ?? -1,
        header: ({ column }) => <HeaderButton label="Confidence" column={column} />,
        cell: ({ row }) => <ConfidenceCell row={row.original} />,
      },
      {
        id: 'timeSpentSeconds',
        accessorFn: (row) => row.timeSpentSeconds ?? -1,
        header: ({ column }) => <HeaderButton label="Time spent" column={column} />,
        cell: ({ row }) => <span className="font-mono text-xs text-atlas-muted">{timeLabel(row.original.timeSpentSeconds)}</span>,
      },
      {
        id: 'nextAction',
        header: 'Next action',
        enableSorting: false,
        cell: ({ row }) => <ActionButton row={row.original} context={context} onOpenTutor={onOpenTutor} />,
      },
    ],
    [context, onOpenTutor],
  );

  const table = useReactTable({
    data: filteredRows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (loading) {
    return <QuestionReviewTableSkeleton className={className} />;
  }

  const isFallback = resolvedRows.every((row) => row.source === 'mock');
  const filtersActive = systemFilter !== 'all' || reviewFilter !== 'all';
  const displayedRowCount = table.getRowModel().rows.length;

  return (
    <section aria-labelledby="question-review-title" className={cn('space-y-3', className)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="question-review-title" className="text-lg font-semibold text-atlas-white">
            Question Review Table
          </h2>
          <p className="text-sm text-atlas-muted">
            Missed, flagged, and review-ready items ranked by learning value, not vanity activity.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-atlas-border bg-atlas-glass px-3 py-1.5 text-xs text-atlas-muted">
          <ShieldAlert className="h-3.5 w-3.5 text-atlas-pulse" aria-hidden />
          {displayedRowCount} rows • {mismatchCount} confidence mismatch{mismatchCount === 1 ? '' : 'es'}
        </span>
      </div>

      <MedicalGlassCard scannerAccent className="p-4 sm:p-5">
        <div className="sr-only" aria-live="polite">
          Showing {displayedRowCount} question review rows.
        </div>
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Review row filters">
            {reviewFilters.map((filter) => (
              <button
                key={filter.value}
                type="button"
                aria-pressed={reviewFilter === filter.value}
                onClick={() => setReviewFilter(filter.value)}
                className={cn(
                  'atlas-focus-ring rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors motion-reduce:transition-none',
                  reviewFilter === filter.value
                    ? 'border-atlas-border-glow bg-[color-mix(in_srgb,var(--atlas-accent-cyan)_10%,transparent)] text-atlas-cyan'
                    : 'border-atlas-border bg-atlas-glass text-atlas-muted hover:text-atlas-white',
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-atlas-subtle sm:min-w-56">
            Organ system
            <select
              value={systemFilter}
              onChange={(event) => setSystemFilter(event.target.value)}
              className="atlas-focus-ring h-10 rounded-xl border border-atlas-border bg-[color-mix(in_srgb,var(--atlas-bg-soft)_90%,transparent)] px-3 text-sm normal-case tracking-normal text-atlas-white"
            >
              <option value="all">All systems</option>
              {systems.map((system) => (
                <option key={system} value={system}>
                  {system}
                </option>
              ))}
            </select>
          </label>
        </div>

        {!resolvedRows.length || !filteredRows.length ? (
          <EmptyState
            filtered={filtersActive}
            onReset={() => {
              setSystemFilter('all');
              setReviewFilter('all');
            }}
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto rounded-2xl border border-atlas-border bg-[color-mix(in_srgb,var(--atlas-bg-soft)_76%,transparent)] lg:block">
              <Table className="min-w-[980px]">
                <TableCaption className="sr-only">
                  Question review rows with sortable organ system, difficulty, result, confidence, and time spent columns.
                </TableCaption>
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id} className="border-atlas-border hover:bg-transparent">
                      {headerGroup.headers.map((header) => {
                        const sorted = header.column.getIsSorted();
                        return (
                          <TableHead
                            key={header.id}
                            scope="col"
                            className="text-atlas-muted"
                            aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : 'none'}
                          >
                            {header.isPlaceholder
                              ? null
                              : flexRender(header.column.columnDef.header, header.getContext())}
                          </TableHead>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      className={cn(
                        'border-atlas-border hover:bg-[color-mix(in_srgb,var(--atlas-surface-glass)_60%,transparent)]',
                        isConfidenceMismatch(row.original) && 'bg-[color-mix(in_srgb,var(--atlas-accent-pulse-pink)_6%,transparent)]',
                      )}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="grid gap-3 lg:hidden">
              {table.getRowModel().rows.map((row) => (
                <MobileReviewCard
                  key={row.id}
                  row={row.original}
                  context={context}
                  onOpenTutor={onOpenTutor}
                />
              ))}
            </div>

            {isFallback ? (
              <p className="mt-3 border-t border-atlas-border pt-3 text-xs text-atlas-subtle">
                Mock review rows are shown until missed-question, confidence, and review telemetry is available.
              </p>
            ) : null}
          </>
        )}
      </MedicalGlassCard>
    </section>
  );
}
