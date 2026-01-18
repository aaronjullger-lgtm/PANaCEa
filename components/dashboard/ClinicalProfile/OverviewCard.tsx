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
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-4 shadow-sm">
        <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300">
          <Target className="w-5 h-5 text-blue-500" />
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Accuracy</p>
            <p className="text-2xl font-semibold text-slate-900 dark:text-white">{accuracyPct}%</p>
          </div>
        </div>
      </div>
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-4 shadow-sm">
        <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300">
          <Clock3 className="w-5 h-5 text-emerald-500" />
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Avg Time / Q</p>
            <p className="text-2xl font-semibold text-slate-900 dark:text-white">
              {avgTimeSec ? `${avgTimeSec}s` : '—'}
            </p>
          </div>
        </div>
      </div>
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-4 shadow-sm">
        <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300">
          <Activity className="w-5 h-5 text-indigo-500" />
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Avg Session</p>
            <p className="text-2xl font-semibold text-slate-900 dark:text-white">
              {avgSessionLength ? `${Math.round(avgSessionLength)} min` : '—'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
