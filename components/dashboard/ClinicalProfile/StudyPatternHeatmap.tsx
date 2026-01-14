import React from 'react';
import type { ClinicalProfileData } from './hooks/useClinicalProfile';

interface Props {
  peakHours: number[];
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export const StudyPatternHeatmap: React.FC<Props> = ({ peakHours }) => {
  const isPeak = (h: number) => peakHours.includes(h);
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs uppercase tracking-wide text-slate-400">Peak Study Hours</p>
        <span className="text-xs text-slate-500">Top 3</span>
      </div>
      <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 text-xs text-slate-500">
        {HOURS.map((h) => (
          <div
            key={h}
            className={`flex items-center justify-center rounded-md py-2 border border-slate-100 dark:border-slate-800 ${
              isPeak(h)
                ? 'bg-blue-500/20 text-blue-700 dark:text-blue-200 border-blue-400/50'
                : 'bg-slate-50 dark:bg-slate-900 text-slate-500'
            }`}
          >
            {h}:00
          </div>
        ))}
      </div>
    </div>
  );
};
