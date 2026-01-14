import React from 'react';
import type { ClinicalProfileData } from './hooks/useClinicalProfile';

interface Props {
  patterns: ClinicalProfileData['patterns'];
}

export const TimingPatterns: React.FC<Props> = ({ patterns }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-4">
        <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">Rushing</p>
        {patterns.rushedSystems.length ? (
          <ul className="space-y-1 text-sm text-slate-700 dark:text-slate-200">
            {patterns.rushedSystems.map((sys) => (
              <li key={sys} className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                {sys}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">No rushing detected.</p>
        )}
      </div>
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-4">
        <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">Overthinking</p>
        {patterns.overthinkingSystems.length ? (
          <ul className="space-y-1 text-sm text-slate-700 dark:text-slate-200">
            {patterns.overthinkingSystems.map((sys) => (
              <li key={sys} className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                {sys}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">No overthinking detected.</p>
        )}
      </div>
    </div>
  );
};
