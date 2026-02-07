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
          const data = (await response.json()) as { pearl?: DailyPearl | null };
          setPearl(data.pearl ?? null);
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
      <div className={`rounded-xl bg-[var(--color-bg-secondary)] p-4 ${className}`}>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[var(--color-bg-tertiary)] rounded-lg animate-pulse">
            <Gem className="w-5 h-5 text-[var(--color-accent)]" />
          </div>
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-[var(--color-bg-tertiary)] rounded animate-pulse w-24" />
            <div className="h-3 bg-[var(--color-bg-tertiary)] rounded animate-pulse w-full" />
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
      className={`rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="px-4 py-3 bg-[var(--color-accent)]/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gem className="w-4 h-4 text-[var(--color-accent)]" />
          <span className="text-sm font-semibold text-[var(--color-accent)]">Daily Pearl</span>
          <Sparkles className="w-3 h-3 text-data-provisional" />
        </div>
        <span className="text-xs text-[var(--color-accent)] bg-[var(--color-accent)]/15 px-2 py-0.5 rounded-full">
          {pearl.system}
        </span>
      </div>

      {/* Pearl content */}
      <div className="p-4">
        <p className="text-sm text-[var(--color-text-primary)] leading-relaxed line-clamp-3">
          {pearl.pearlText}
        </p>
      </div>

      {/* Footer with expand action */}
      {onExpandClick && (
        <button
          onClick={onExpandClick}
          className="w-full px-4 py-2.5 bg-[var(--color-accent)]/10 hover:bg-[var(--color-accent)]/20 transition-colors flex items-center justify-center gap-2 group"
        >
          <span className="text-xs font-medium text-[var(--color-accent)]">View All Pearls</span>
          <ChevronRight className="w-4 h-4 text-[var(--color-accent)] group-hover:translate-x-1 transition-transform" />
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
