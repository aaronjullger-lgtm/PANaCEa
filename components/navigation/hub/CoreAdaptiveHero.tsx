'use client';

import React from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Brain, Target, CheckCircle, Play, ChevronRight } from 'lucide-react';

export const CoreAdaptiveHero: React.FC<{
  onStart: () => void;
  accuracy: number | null;
  questionsToday: number;
  examLabel: string;
  /** When true, show "Knowledge Maintenance" / "PANRE-LA Check-in" instead of Core PANCE */
  isPracticing?: boolean;
  /** Sub-label for Start Session (e.g. "Testing: CV, PULM, GI Only") - shown for Didactic users */
  enabledSystemsLabel?: string | null;
  /** Optional label for accuracy (e.g. "Module Accuracy") */
  accuracyLabel?: string;
  /** Weak areas from analytics; when present, show "Focusing on your weak areas: X, Y" */
  growthAreas?: string[];
}> = ({
  onStart,
  accuracy,
  questionsToday,
  examLabel,
  isPracticing,
  enabledSystemsLabel,
  accuracyLabel,
  growthAreas = [],
}) => {
  const mainTitle = isPracticing ? 'Knowledge Maintenance' : 'Core PANCE Simulation';
  const badgeLabel = isPracticing ? 'PANRE-LA Check-in' : `${examLabel} Prep`;
  // Core PANCE Simulation: no weak-area copy — strict NCCPA blueprint only
  const subtitle = isPracticing
 ? growthAreas.length > 0 ? `Focusing on your growth areas: ${growthAreas.slice(0, 3).join(', ')}.`
     : 'Maintain your certification knowledge with adaptive questions.'
     : 'Strict NCCPA blueprint weighting. Exam-representative mix — no adaptive bias.';

  return (
    <GlassCard variant="primary" hoverable className="mb-8">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
        <div className="flex-1 flex flex-col justify-between">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-[var(--color-accent)]/15 shrink-0">
              <Brain className="w-5 h-5 text-[var(--color-accent)]" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-lg font-bold text-[var(--color-text-primary)]">{mainTitle}</h3>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-[var(--color-accent)]/8 text-[var(--color-accent)] border border-[var(--color-accent)]/15">
                  {badgeLabel}
                </span>
              </div>
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{subtitle}</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-5 text-[var(--color-text-muted)]">
            <span className="inline-flex items-center gap-1.5 text-xs">
              <Target className="w-3.5 h-3.5 text-[var(--color-accent)]" aria-hidden />
              <span className="font-medium tabular-nums">{accuracy !== null ? `${accuracy}%` : '—'}</span>
              <span className="text-[var(--color-text-secondary)]">{accuracyLabel ?? 'accuracy'}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs">
              <CheckCircle className="w-3.5 h-3.5 text-[var(--color-accent)]" aria-hidden />
              <span className="font-medium tabular-nums">{questionsToday}</span>
              <span className="text-[var(--color-text-secondary)]">today</span>
            </span>
          </div>
        </div>

        <div className="flex flex-col items-stretch sm:items-end gap-1.5">
          <PrimaryButton
            variant="secondary"
            size="lg"
            icon={Play}
            iconRight={ChevronRight}
            onClick={onStart}
          >
            Start Session
          </PrimaryButton>
          {enabledSystemsLabel && (
            <span className="text-xs text-[var(--color-text-muted)]">{enabledSystemsLabel}</span>
          )}
        </div>
      </div>
    </GlassCard>
  );
};
