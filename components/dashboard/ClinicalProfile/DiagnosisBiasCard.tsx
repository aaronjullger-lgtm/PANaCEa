import React from 'react';
import type { ClinicalProfileData } from './hooks/useClinicalProfile';

interface Props {
  biases: ClinicalProfileData['diagnosisBias'];
}

export const DiagnosisBiasCard: React.FC<Props> = ({ biases }) => {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs uppercase tracking-wide text-data-neutral">Diagnosis Bias</p>
        <span className="text-xs text-data-neutral">Most over-selected</span>
      </div>
      {biases.length === 0 ? (
        <p className="text-sm text-data-neutral">No bias detected yet.</p>
      ) : (
        <ul className="space-y-2">
          {biases.slice(0, 5).map((item) => (
            <li
              key={item.condition}
              className="flex items-center justify-between text-sm text-data-neutral dark:text-data-neutral"
            >
              <span>{item.condition}</span>
              <span className="text-data-neutral">{item.count}×</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
