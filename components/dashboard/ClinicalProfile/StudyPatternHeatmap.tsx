import React from 'react';
import type { ClinicalProfileData } from './hooks/useClinicalProfile';

interface Props {
  peakHours: number[];
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export const StudyPatternHeatmap: React.FC<Props> = ({ peakHours }) => {
  const isPeak = (h: number) => peakHours.includes(h);
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">Peak Study Hours</p>
        <span className="text-xs text-[var(--color-text-muted)]">Top 3</span>
      </div>
      <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 text-xs text-[var(--color-text-muted)]">
        {HOURS.map((h) => (
          <div
            key={h}
            className={`flex items-center justify-center rounded-md py-2 border ${
              isPeak(h)
                ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)] border-[var(--color-accent)]/50'
                : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] border-[var(--color-border)]'
            }`}
          >
            {h}:00
          </div>
        ))}
      </div>
    </div>
  );
};
