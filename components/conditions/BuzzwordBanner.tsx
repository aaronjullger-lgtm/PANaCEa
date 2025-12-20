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
    });
  }, [conditionName]);

  if (!info) return null;

  return (
    <div className="mb-8 relative overflow-hidden rounded-xl border border-blue-200 dark:border-blue-800 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 p-6 shadow-sm">
      <div className="absolute top-0 right-0 -mt-4 -mr-4 h-24 w-24 rounded-full bg-blue-100 dark:bg-blue-900/30 blur-2xl" />
      
      <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/50">
          <Lightbulb className="w-6 h-6 text-amber-500" />
        </div>
        
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              High-Yield Associations
            </span>
            <span className="inline-flex items-center rounded-full bg-white/50 dark:bg-black/20 px-2 py-0.5 text-xs font-medium text-slate-500">
              {info.category}
            </span>
          </div>
          
          <p className="text-lg font-bold text-slate-900 dark:text-white">
            "{info.buzzword}"
          </p>
        </div>
      </div>
    </div>
  );
};
