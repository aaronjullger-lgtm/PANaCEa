/**
 * TodayPlanCard — Daily study allocation recommendation
 *
 * Consumes the Daily Study Allocator (GET /api/study-plan/today) to show:
 *   - MAIN vs TARGETED split (visual bar + recommended counts)
 *   - Priority systems for MAIN sessions
 *   - Top conditions for TARGETED review
 *   - Human-readable reason summary
 *
 * Replaces the static "What To Study" section in DashboardPage with
 * allocator-driven recommendations.
 *
 * Sprint: Dual-Study Allocator UI — April 2026
 */

import React from 'react';
import { motion } from 'framer-motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import {
  BookOpen,
  Target,
  ArrowRight,
  Sparkles,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { ClinicalSkeleton } from '@/components/loading';
import type { TodayPlanData, StudySplit } from '@/hooks/useTodayPlan';

// ─── Types ────────────────────────────────────────────────────────────────────

type TodayPlanTask = NonNullable<TodayPlanData['tasks']>[number];

interface TodayPlanCardProps {
  data: TodayPlanData | null;
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
  onStartMain: (systems?: string[], task?: TodayPlanTask) => void;
  onStartTargeted: (conditions?: string[], task?: TodayPlanTask) => void;
}

// ─── Split Label ──────────────────────────────────────────────────────────────

const SPLIT_META: Record<StudySplit, { label: string; color: string; emphasis: 'main' | 'targeted' | 'both' }> = {
  main_heavy:     { label: 'Readiness Focus', color: 'var(--color-accent)',           emphasis: 'main' },
  balanced:       { label: 'Balanced',        color: 'var(--color-text-secondary)',   emphasis: 'both' },
  targeted_heavy: { label: 'Retention Focus', color: 'var(--color-data-provisional)', emphasis: 'targeted' },
};

// ─── Sub-Components ───────────────────────────────────────────────────────────

function SplitBar({ mainCount, targetedCount, split }: { mainCount: number; targetedCount: number; split: StudySplit }) {
  const total = mainCount + targetedCount;
  const mainPct = total > 0 ? Math.round((mainCount / total) * 100) : 50;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
        <span className="flex items-center gap-1.5">
          <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
          MAIN · {mainCount}q
        </span>
        <span
          className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
          style={{
            backgroundColor: `color-mix(in srgb, ${SPLIT_META[split].color} 15%, transparent)`,
            color: SPLIT_META[split].color,
          }}
        >
          {SPLIT_META[split].label}
        </span>
        <span className="flex items-center gap-1.5">
          TARGETED · {targetedCount}q
          <Target className="w-3.5 h-3.5" aria-hidden="true" />
        </span>
      </div>
      <div
        className="h-2 rounded-full overflow-hidden flex"
        role="img"
        aria-label={`Study split: ${mainPct}% MAIN, ${100 - mainPct}% TARGETED`}
      >
        <div
          className="h-full rounded-l-full transition-all duration-500"
          style={{
            width: `${mainPct}%`,
            backgroundColor: 'var(--color-accent)',
          }}
        />
        <div
          className="h-full rounded-r-full transition-all duration-500"
          style={{
            width: `${100 - mainPct}%`,
            backgroundColor: 'var(--color-data-provisional)',
          }}
        />
      </div>
    </div>
  );
}

function PriorityPills({ label, items, icon }: { label: string; items: string[]; icon: React.ReactNode }) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-muted)] flex items-center gap-1.5">
        {icon}
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span
            key={item}
            className="px-2.5 py-1 text-xs rounded-md bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] border border-[var(--color-border)]"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function PlanSkeleton() {
  return (
    <div
      className="bg-[var(--color-bg-secondary)] rounded-xl p-6"
      style={{ boxShadow: '0 0 0 1px var(--color-glass-border), 0 2px 8px -2px var(--color-glass-shadow), 0 1px 3px -1px rgba(0,0,0,0.04)' }}
    >
      <ClinicalSkeleton lines={5} className="min-h-[200px]" />
    </div>
  );
}

function PlanError({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div
      className="bg-[var(--color-bg-secondary)] rounded-xl p-6"
      style={{ boxShadow: '0 0 0 1px var(--color-glass-border), 0 2px 8px -2px var(--color-glass-shadow), 0 1px 3px -1px rgba(0,0,0,0.04)' }}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-[var(--color-data-fail)] shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-[var(--color-text-primary)]">Couldn't load today's plan</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">{error}</p>
          <button
            onClick={onRetry}
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-accent)] hover:opacity-80 transition-opacity"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function TodayPlanCard({
  data,
  isLoading,
  error,
  onRefresh,
  onStartMain,
  onStartTargeted,
}: TodayPlanCardProps) {
  const prefersReducedMotion = useReducedMotion();

  if (isLoading) return <PlanSkeleton />;
  if (error || !data) return <PlanError error={error ?? 'No plan available'} onRetry={onRefresh} />;

  const splitMeta = SPLIT_META[data.recommendedSplit];

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { y: 8, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.35, ease: 'easeOut' }}
      className="bg-[var(--color-bg-secondary)] rounded-xl p-6 space-y-5"
      style={{ boxShadow: '0 0 0 1px var(--color-glass-border), 0 2px 8px -2px var(--color-glass-shadow), 0 1px 3px -1px rgba(0,0,0,0.04)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-[var(--color-bg-tertiary)]">
            <Sparkles className="w-4.5 h-4.5 text-[var(--color-accent)]" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-[var(--color-text-primary)] tracking-tight">
              Today's Plan
            </h2>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              {data.reasonSummary}
            </p>
          </div>
        </div>
        <button
          onClick={onRefresh}
          className="p-1.5 rounded hover:bg-[var(--color-bg-tertiary)] transition-colors"
          aria-label="Refresh study plan"
        >
          <RefreshCw className="w-4 h-4 text-[var(--color-text-muted)]" />
        </button>
      </div>

      {/* Split Bar */}
      <SplitBar
        mainCount={data.recommendedMainCount}
        targetedCount={data.recommendedTargetedCount}
        split={data.recommendedSplit}
      />

      {/* Priority Systems + Conditions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <PriorityPills
          label="Main Focus Systems"
          items={data.mainSystems}
          icon={<BookOpen className="w-3 h-3" aria-hidden="true" />}
        />
        <PriorityPills
          label="Targeted Conditions"
          items={data.targetedConditions.slice(0, 5)}
          icon={<Target className="w-3 h-3" aria-hidden="true" />}
        />
      </div>

      {/* Priority Scores (subtle) */}
      <div className="flex items-center gap-4 text-xs text-[var(--color-text-muted)]">
        <span className="tabular-nums">
          Readiness: <strong className="text-[var(--color-text-secondary)]">{data.readinessPriority}</strong>/100
        </span>
        <span className="tabular-nums">
          Retention: <strong className="text-[var(--color-text-secondary)]">{data.retentionPriority}</strong>/100
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
    </motion.div>
  );
}

export default TodayPlanCard;
