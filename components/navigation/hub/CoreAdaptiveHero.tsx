'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { GlassCard } from '@/components/ui/GlassCard';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Brain, Target, CheckCircle, ChevronRight, Play } from 'lucide-react';

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
  // Core PANCE Simulation: no weak-area copy — strict NCCIPA blueprint only
  const subtitle = isPracticing
    ? growthAreas.length > 0
      ? `Focusing on your weak areas: ${growthAreas.slice(0, 3).join(', ')}.`
      : 'Maintain your certification knowledge with adaptive questions.'
    : 'Strict NCCPA blueprint weighting. Exam-representative mix — no adaptive bias.';
  return (
    <GlassCard variant="primary" hoverable className="mb-6">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
        <div className="flex-1 flex flex-col justify-between">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-[var(--color-accent)]/20 backdrop-blur-sm">
              <Brain className="w-7 h-7 text-[var(--color-accent)]" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-xl font-bold text-[var(--color-text-primary)]">{mainTitle}</h3>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-accent)]/20">
                  {badgeLabel}
                </span>
              </div>
              <p className="text-base text-[var(--color-text-secondary)]">{subtitle}</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-4 text-[var(--color-text-muted)]">
            <span className="inline-flex items-center gap-1.5 text-sm">
              <Target className="w-4 h-4 text-[var(--color-accent)]" aria-hidden />
              {accuracy !== null ? `${accuracy}%` : 'Waiting for first session'}{' '}
              {accuracyLabel ?? 'accuracy'}
            </span>
            <span className="inline-flex items-center gap-1.5 text-sm">
              <CheckCircle className="w-4 h-4 text-[var(--color-accent)]" aria-hidden />
              {questionsToday} today
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
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
