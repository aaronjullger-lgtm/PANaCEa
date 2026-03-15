'use client';

import React from 'react';
import { motion } from 'framer-motion';
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
      } catch {
        /* ignore */
      }
    }
    onStart();
  };

  return (
    <GlassCard variant="warning" hoverable className="mb-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-4 flex-1">
          <div className="p-3 rounded-xl bg-[var(--color-category-specialty)]/20 backdrop-blur-sm">
            <Trophy className="w-6 h-6 text-[var(--color-category-specialty)]" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-xl font-bold text-[var(--color-text-primary)]">{title}</h3>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[var(--color-data-provisional)]/15 text-[var(--color-data-provisional)] border border-[var(--color-data-provisional)]/30">
                Daily Challenge • {dateStr}
              </span>
            </div>
            <p className="text-sm text-[var(--color-text-muted)]">{subtitle}</p>
          </div>
        </div>

        <PrimaryButton variant="warning" size="md" icon={Play} onClick={handleStart}>
          Start
        </PrimaryButton>
      </div>
    </GlassCard>
  );
};
