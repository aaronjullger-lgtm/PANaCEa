import React from 'react';
import { Clock3, Target, Activity } from 'lucide-react';
import type { ClinicalProfileData } from './hooks/useClinicalProfile';

interface Props {
  overall: ClinicalProfileData['overall'];
  avgSessionLength?: number | null;
}

export const OverviewCard: React.FC<Props> = ({ overall, avgSessionLength }) => {
  const accuracyPct = Math.round((overall.accuracy || 0) * 100);
  const avgTimeSec = overall.avgTimeMs ? Math.round(overall.avgTimeMs / 1000) : null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4 shadow-sm">
        <div className="flex items-center gap-3 text-[var(--color-text-secondary)]">
          <Target className="w-5 h-5 text-[var(--color-accent)]" />
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
              Accuracy
            </p>
            <p className="text-2xl font-semibold text-[var(--color-text-primary)]">
              {accuracyPct}%
            </p>
          </div>
        </div>
      </div>
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4 shadow-sm">
        <div className="flex items-center gap-3 text-[var(--color-text-secondary)]">
          <Clock3 className="w-5 h-5 text-[var(--color-data-pass)]" />
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
              Avg Time / Q
            </p>
            <p className="text-2xl font-semibold text-[var(--color-text-primary)]">
              {avgTimeSec ? `${avgTimeSec}s` : '—'}
            </p>
          </div>
        </div>
      </div>
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4 shadow-sm">
        <div className="flex items-center gap-3 text-[var(--color-text-secondary)]">
          <Activity className="w-5 h-5 text-[var(--color-accent)]" />
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
              Avg Session
            </p>
            <p className="text-2xl font-semibold text-[var(--color-text-primary)]">
              {avgSessionLength ? `${Math.round(avgSessionLength)} min` : '—'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
