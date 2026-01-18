import React from 'react';
import type { ClinicalProfileData } from './hooks/useClinicalProfile';

interface Props {
  biases: ClinicalProfileData['diagnosisBias'];
}

export const DiagnosisBiasCard: React.FC<Props> = ({ biases }) => {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs uppercase tracking-wide text-slate-400">Diagnosis Bias</p>
        <span className="text-xs text-slate-500">Most over-selected</span>
      </div>
      {biases.length === 0 ? (
        <p className="text-sm text-slate-500">No bias detected yet.</p>
      ) : (
        <ul className="space-y-2">
          {biases.slice(0, 5).map((item) => (
            <li
              key={item.condition}
              className="flex items-center justify-between text-sm text-slate-700 dark:text-slate-200"
            >
              <span>{item.condition}</span>
              <span className="text-slate-500">{item.count}×</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
