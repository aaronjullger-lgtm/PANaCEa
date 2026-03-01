import React from 'react';
import type { ClinicalProfileData } from './hooks/useClinicalProfile';

interface Props {
  patterns: ClinicalProfileData['patterns'];
}

export const TimingPatterns: React.FC<Props> = ({ patterns }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="rounded-xl border border-data-neutral dark:border-data-neutral bg-white dark:bg-data-neutral/80 p-4">
        <p className="text-xs uppercase tracking-wide text-data-neutral mb-2">Rushing</p>
        {patterns.rushedSystems.length ? (
          <ul className="space-y-1 text-sm text-data-neutral dark:text-data-neutral">
            {patterns.rushedSystems.map((sys) => (
              <li key={sys} className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-data-pass" />
                {sys}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-data-neutral">No rushing detected.</p>
        )}
      </div>
      <div className="rounded-xl border border-data-neutral dark:border-data-neutral bg-white dark:bg-data-neutral/80 p-4">
        <p className="text-xs uppercase tracking-wide text-data-neutral mb-2">Overthinking</p>
        {patterns.overthinkingSystems.length ? (
          <ul className="space-y-1 text-sm text-data-neutral dark:text-data-neutral">
            {patterns.overthinkingSystems.map((sys) => (
              <li key={sys} className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-data-provisional" />
                {sys}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-data-neutral">No overthinking detected.</p>
        )}
      </div>
    </div>
  );
};
