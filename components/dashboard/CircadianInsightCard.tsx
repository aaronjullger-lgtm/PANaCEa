/**
 * CircadianInsightCard - Compact dashboard card showing peak study hours
 * Uses getCircadianInsights; renders only when enough data (20+ questions).
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Clock, Sunrise } from 'lucide-react';
import type { PerformanceRecord } from '@/types';
import { getCircadianInsights } from '@/services/analytics';

interface CircadianInsightCardProps {
  performanceRecords: PerformanceRecord[];
  className?: string;
}

export const CircadianInsightCard: React.FC<CircadianInsightCardProps> = ({
  performanceRecords,
  className = '',
}) => {
  const insights = useMemo(
    () => getCircadianInsights(performanceRecords),
    [performanceRecords]
  );

  if (!insights) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`
        relative overflow-hidden rounded-xl 
        border border-[var(--color-border)] 
        bg-gradient-to-br from-sky-500/10 via-[var(--color-bg-secondary)] to-indigo-500/10
        p-4
        ${className}
      `}
    >
      <div className="flex items-center gap-3">
        <div className="p-2 bg-sky-500/15 rounded-lg shrink-0">
          <Clock className="w-5 h-5 text-sky-500" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-[var(--color-text-muted)]">Your best study hours</p>
          <p className="font-semibold text-[var(--color-text-primary)] flex items-center gap-1.5">
            <Sunrise className="w-4 h-4 text-sky-500 shrink-0" />
            {insights.bestTimeRange}
          </p>
        </div>
      </div>
    </motion.div>
  );
};

export default CircadianInsightCard;
