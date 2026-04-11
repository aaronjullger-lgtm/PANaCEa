/**
 * AnswerSwitchInsight - Metacognitive Mirror Widget
 *
 * Shows how often the user switches answers and whether their first instinct
 * is more reliable, grouped by organ system.
 *
 * Data source: ReviewLog telemetry.hover.answerSwitches + wasCorrect + system
 */

import React from 'react';
import { GlassCard, GlassCardHeader } from '@/components/ui/GlassCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { ArrowLeftRight, ShieldCheck, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AnswerSwitchBySystem {
  system: string;
  totalQuestions: number;
  switchedCount: number;
  firstInstinctCorrect: number;
  switchHurtRate: number;
}

export interface AnswerSwitchInsightProps {
  data: AnswerSwitchBySystem[];
  loading?: boolean;
  className?: string;
}

function Skeleton() {
  return (
    <GlassCard variant="info" className="animate-pulse">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-[var(--color-bg-tertiary)]" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-40 rounded bg-[var(--color-bg-tertiary)]" />
          <div className="h-3 w-56 rounded bg-[var(--color-bg-tertiary)]" />
        </div>
      </div>
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-lg bg-[var(--color-bg-tertiary)]" />
        ))}
      </div>
    </GlassCard>
  );
}

function InsightBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-[var(--color-text-secondary)]">{label}</span>
        <span className="font-medium text-[var(--color-text-primary)]">{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-[var(--color-bg-tertiary)] overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', color)}
          style={{ width: pct + '%' }}
        />
      </div>
    </div>
  );
}

export const AnswerSwitchInsight: React.FC<AnswerSwitchInsightProps> = ({
  data,
  loading = false,
  className,
}) => {
  if (loading) return <Skeleton />;

  if (!data || data.length === 0) {
    return (
      <GlassCard variant="info" className={className}>
        <GlassCardHeader
          icon={ArrowLeftRight}
          title="Answer Switch Patterns"
          subtitle="How switching answers affects your accuracy"
        />
        <EmptyState
          variant="quiz"
          compact
          title="No switch data yet"
          description="Complete more sessions to see your answer-switching patterns."
        />
      </GlassCard>
    );
  }

  const topHurtSystem = [...data]
    .filter((d) => d.switchedCount > 0)
    .sort((a, b) => b.switchHurtRate - a.switchHurtRate)[0];

  const topInstinctSystem = [...data]
    .sort((a, b) => b.firstInstinctCorrect - a.firstInstinctCorrect)[0];

  return (
    <GlassCard variant="info" className={className}>
      <GlassCardHeader
        icon={ArrowLeftRight}
        title="Answer Switch Patterns"
        subtitle="How switching answers affects your accuracy"
        badge={{ text: data.length + ' systems', color: 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]' }}
      />

      <div className="space-y-2 mb-4">
        {topHurtSystem && topHurtSystem.switchedCount > 0 && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-[var(--color-data-fail)]/5 border border-[var(--color-data-fail)]/10">
            <AlertTriangle className="w-4 h-4 mt-0.5 text-[var(--color-data-fail)] shrink-0" />
            <p className="text-sm text-[var(--color-text-secondary)]">
              You switch answers most on <span className="font-medium text-[var(--color-text-primary)]">{topHurtSystem.system}</span> questions
              {' '}&mdash; and it hurts you <span className="font-medium text-[var(--color-data-fail)]">{Math.round(topHurtSystem.switchHurtRate * 100)}%</span> of the time.
            </p>
          </div>
        )}
        {topInstinctSystem && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-[var(--color-data-pass)]/5 border border-[var(--color-data-pass)]/10">
            <ShieldCheck className="w-4 h-4 mt-0.5 text-[var(--color-data-pass)] shrink-0" />
            <p className="text-sm text-[var(--color-text-secondary)]">
              Your first instinct is correct <span className="font-medium text-[var(--color-data-pass)]">{Math.round(topInstinctSystem.firstInstinctCorrect * 100)}%</span> of the time on <span className="font-medium text-[var(--color-text-primary)]">{topInstinctSystem.system}</span>.
            </p>
          </div>
        )}
      </div>

      <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
        {data
          .filter((d) => d.totalQuestions > 0)
          .sort((a, b) => b.switchedCount - a.switchedCount)
          .slice(0, 6)
          .map((system) => (
            <div key={system.system} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-[var(--color-text-primary)]">{system.system}</span>
                <span className="text-xs text-[var(--color-text-muted)]">
                  {system.switchedCount}/{system.totalQuestions} switched
                </span>
              </div>
              <InsightBar
                label="First instinct correct"
                value={system.firstInstinctCorrect}
                max={1}
                color="bg-[var(--color-data-pass)]"
              />
            </div>
          ))}
      </div>
    </GlassCard>
  );
};

export default AnswerSwitchInsight;
