'use client';

import React from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Trophy, Play } from 'lucide-react';

export const GrandRoundsBanner: React.FC<{
  onStart: () => void;
  /** When true, show "Targeted Daily Question" and pass targeted flag so mode fetches by enabled systems */
  isDidactic?: boolean;
}> = ({ onStart, isDidactic }) => {
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  const title = isDidactic ? 'Targeted Daily Question' : 'Grand Rounds';
  const subtitle = isDidactic
    ? 'One question from your current curriculum.'
    : 'Same questions for everyone — daily standardized assessment.';

  const handleStart = () => {
    if (isDidactic) {
      try {
        sessionStorage.setItem('panceai_grand_rounds_targeted', '1');
      } catch (err) {
        console.debug('[GrandRoundsBanner] sessionStorage write failed', err);
      }
    }
    onStart();
  };

  return (
    <GlassCard variant="warning" hoverable className="mb-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-4 flex-1">
          <div className="p-2.5 rounded-xl bg-[var(--color-category-specialty)]/15 shrink-0">
            <Trophy className="w-5 h-5 text-[var(--color-category-specialty)]" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <h3 className="text-base font-semibold text-[var(--color-text-primary)]">{title}</h3>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-data-provisional)]/8 text-[var(--color-data-provisional)] border border-[var(--color-data-provisional)]/15">
                Daily Challenge &middot; {dateStr}
              </span>
            </div>
            <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{subtitle}</p>
          </div>
        </div>

        <PrimaryButton
          variant="warning"
          size="md"
          icon={<Play className="h-4 w-4" aria-hidden="true" />}
          onClick={handleStart}
        >
          Start
        </PrimaryButton>
      </div>
    </GlassCard>
  );
};
