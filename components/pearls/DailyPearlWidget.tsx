/**
 * Daily Pearl Widget - Sprint 8: Pearl UI
 *
 * Compact widget showing the "Pearl of the Day" on the dashboard
 * Can be expanded to show full My Pearls panel
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Gem, ChevronRight, Sparkles } from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';

interface DailyPearl {
  id: string;
  pearlText: string;
  system: string;
  category?: string;
}

interface DailyPearlWidgetProps {
  onExpandClick?: () => void;
  className?: string;
}

export const DailyPearlWidget: React.FC<DailyPearlWidgetProps> = ({
  onExpandClick,
  className = '',
}) => {
  const { getToken } = useAuth();
  const [pearl, setPearl] = useState<DailyPearl | null>(null);
  const [loading, setLoading] = useState(true);

  // Error state tracked but not displayed (used for fallback logic)
  const handleError = () => {
    setPearl(FALLBACK_PEARL);
  };

  useEffect(() => {
    const fetchDailyPearl = async () => {
      setLoading(true);

      try {
        const token = await getToken();
        const response = await fetch('/api/user/pearls/daily', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (response.ok) {
          const data = await response.json();
          setPearl(data.pearl);
        } else {
          // Use fallback pearl for demo/development
          handleError();
        }
      } catch (err) {
        console.warn('[DailyPearlWidget] Fetch error, using fallback:', err);
        handleError();
      } finally {
        setLoading(false);
      }
    };

    fetchDailyPearl();
  }, [getToken]);

  if (loading) {
    return (
      <div className={`rounded-xl bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 p-4 ${className}`}>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 dark:bg-purple-800/50 rounded-lg animate-pulse">
            <Gem className="w-5 h-5 text-purple-400" />
          </div>
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-purple-100 dark:bg-purple-800/30 rounded animate-pulse w-24" />
            <div className="h-3 bg-purple-100 dark:bg-purple-800/30 rounded animate-pulse w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!pearl) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border border-purple-100 dark:border-purple-800/50 overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-purple-500/10 to-indigo-500/10 dark:from-purple-500/20 dark:to-indigo-500/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gem className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          <span className="text-sm font-semibold text-purple-700 dark:text-purple-300">
            Daily Pearl
          </span>
          <Sparkles className="w-3 h-3 text-amber-500" />
        </div>
        <span className="text-xs text-purple-500 dark:text-purple-400 bg-purple-100 dark:bg-purple-800/50 px-2 py-0.5 rounded-full">
          {pearl.system}
        </span>
      </div>

      {/* Pearl content */}
      <div className="p-4">
        <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed line-clamp-3">
          {pearl.pearlText}
        </p>
      </div>

      {/* Footer with expand action */}
      {onExpandClick && (
        <button
          onClick={onExpandClick}
          className="w-full px-4 py-2.5 bg-purple-500/10 dark:bg-purple-500/20 hover:bg-purple-500/20 dark:hover:bg-purple-500/30 transition-colors flex items-center justify-center gap-2 group"
        >
          <span className="text-xs font-medium text-purple-600 dark:text-purple-400">
            View All Pearls
          </span>
          <ChevronRight className="w-4 h-4 text-purple-500 group-hover:translate-x-1 transition-transform" />
        </button>
      )}
    </motion.div>
  );
};

// Fallback pearl for development/offline mode
const FALLBACK_PEARL: DailyPearl = {
  id: 'fallback-1',
  pearlText:
    'In suspected PE, a negative D-dimer with low pretest probability (Wells ≤4) effectively rules out PE. Skip the CT-PA!',
  system: 'Pulmonary',
  category: 'diagnosis',
};

export default DailyPearlWidget;
