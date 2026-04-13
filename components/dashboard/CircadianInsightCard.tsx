/**
 * CircadianInsightCard - Compact dashboard card showing peak study hours
 * Uses getCircadianInsights; renders only when enough data (20+ questions).
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Clock, Sunrise } from 'lucide-react';
import type { PerformanceRecord } from '@/types';
import { getCircadianInsights } from '@/services/analytics';
import { useReducedMotion } from '@/hooks/useReducedMotion';

interface CircadianInsightCardProps {
  performanceRecords: PerformanceRecord[];
  className?: string;
}

export const CircadianInsightCard: React.FC<CircadianInsightCardProps> = ({
  performanceRecords,
  className = '',
}) => {
  const insights = useMemo(() => getCircadianInsights(performanceRecords), [performanceRecords]);
  const prefersReducedMotion = useReducedMotion();

  if (!insights) {
    return (
      <div className="relative overflow-hidden rounded-xl bg-[var(--color-bg-secondary)] p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[var(--color-bg-tertiary)] rounded-lg shrink-0">
            <Clock className="w-5 h-5 text-[var(--color-text-muted)]" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-[var(--color-text-muted)]">Your best study hours</p>
            <p className="text-sm text-[var(--color-text-secondary)]">Answer 20+ questions to unlock circadian insights</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { y: 10 }}
      animate={{ y: 0 }}
      transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.3 }}
      className={`
        relative overflow-hidden rounded-xl
        bg-[var(--color-bg-secondary)]
        p-4 shadow-sm
        ${className}
      `}
    >
      <div className="flex items-center gap-3">
        <div className="p-2 bg-[var(--color-accent)]/15 rounded-lg shrink-0">
          <Clock className="w-5 h-5 text-[var(--color-accent)]" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-[var(--color-text-muted)]">Your best study hours</p>
          <p className="font-semibold text-[var(--color-text-primary)] flex items-center gap-1.5">
            <Sunrise className="w-4 h-4 text-[var(--color-accent)] shrink-0" />
            {insights.bestTimeRange}
          </p>
        </div>
      </div>
    </motion.div>
  );
};

export default CircadianInsightCard;
