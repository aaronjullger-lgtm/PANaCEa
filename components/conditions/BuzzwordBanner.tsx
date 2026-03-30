import React, { useEffect, useState } from 'react';
import { Lightbulb } from 'lucide-react';
import { getBuzzword, loadBuzzwords, BuzzwordEntry } from '../../lib/buzzwordRegistry';

interface BuzzwordBannerProps {
  conditionName: string;
}

export const BuzzwordBanner: React.FC<BuzzwordBannerProps> = ({ conditionName }) => {
  const [info, setInfo] = useState<BuzzwordEntry | null>(getBuzzword(conditionName));

  useEffect(() => {
    // Try to get it synchronously first
    const cached = getBuzzword(conditionName);
    if (cached) {
      setInfo(cached);
      return;
    }

    // If not found, ensure data is loaded
    loadBuzzwords().then(() => {
      const loaded = getBuzzword(conditionName);
      setInfo(loaded);
    }).catch(() => {
      // Buzzword data unavailable — component renders nothing via null check below
    });
  }, [conditionName]);

  if (!info) return null;

  return (
    <div className="mb-8 relative overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6 shadow-sm">
      <div className="absolute top-0 right-0 -mt-4 -mr-4 h-24 w-24 rounded-full bg-[var(--color-accent)]/10 blur-2xl" />

      <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)]/15 border border-[var(--color-border)]">
          <Lightbulb className="w-6 h-6 text-[var(--color-accent)]" />
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-accent)]">
              High-Yield Associations
            </span>
            <span className="inline-flex items-center rounded-full bg-[var(--color-bg-tertiary)]/80 px-2 py-0.5 text-xs font-medium text-[var(--color-text-muted)]">
              {info.category}
            </span>
          </div>

          <p className="text-lg font-bold text-[var(--color-text-primary)]">
            &quot;{info.buzzword}&quot;
          </p>
        </div>
      </div>
    </div>
  );
};
