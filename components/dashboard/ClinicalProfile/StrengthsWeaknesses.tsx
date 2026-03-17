import React from 'react';
import type { ClinicalProfileData } from './hooks/useClinicalProfile';

interface Props {
  strengths: string[];
  weaknesses: string[];
}

export const StrengthsWeaknesses: React.FC<Props> = ({ strengths, weaknesses }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4">
        <p className="text-xs uppercase tracking-wide text-data-neutral mb-2">Strengths</p>
        {strengths.length ? (
          <ul className="space-y-1 text-sm text-data-neutral dark:text-data-neutral">
            {strengths.map((item) => (
              <li key={item} className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-data-pass" />
                {item}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-data-neutral">Need more data.</p>
        )}
      </div>
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4">
        <p className="text-xs uppercase tracking-wide text-data-neutral mb-2">Needs Work</p>
        {weaknesses.length ? (
          <ul className="space-y-1 text-sm text-data-neutral dark:text-data-neutral">
            {weaknesses.map((item) => (
              <li key={item} className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                {item}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-data-neutral">No weak systems detected.</p>
        )}
      </div>
    </div>
  );
};
