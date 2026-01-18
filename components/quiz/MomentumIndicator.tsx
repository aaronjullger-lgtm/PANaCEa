/**
 * Momentum Indicator Component
 *
 * Displays current session momentum with visual feedback.
 * Shows when user is "in the zone" vs struggling.
 */

import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, TrendingUp, Minus, TrendingDown, Snowflake, Zap, Coffee } from 'lucide-react';
import {
  calculateMomentum,
  detectFatigueSignals,
  type MomentumLevel,
  type MomentumState,
} from '@/services/session';

interface MomentumIndicatorProps {
  /** Force refresh when question answered */
  refreshKey?: number;
  /** Compact mode for toolbar */
  compact?: boolean;
}

const levelConfig: Record<
  MomentumLevel,
  {
    icon: React.ElementType;
    color: string;
    bgColor: string;
    borderColor: string;
    label: string;
  }
> = {
  peaked: {
    icon: Flame,
    color: 'text-orange-500',
    bgColor: 'bg-orange-100 dark:bg-orange-900/30',
    borderColor: 'border-orange-200 dark:border-orange-800',
    label: 'On Fire',
  },
  rising: {
    icon: TrendingUp,
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
    borderColor: 'border-emerald-200 dark:border-emerald-800',
    label: 'Rising',
  },
  steady: {
    icon: Minus,
    color: 'text-slate-500',
    bgColor: 'bg-slate-100 dark:bg-slate-800',
    borderColor: 'border-slate-200 dark:border-slate-700',
    label: 'Steady',
  },
  cooling: {
    icon: TrendingDown,
    color: 'text-amber-500',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
    borderColor: 'border-amber-200 dark:border-amber-800',
    label: 'Cooling',
  },
  cold: {
    icon: Snowflake,
    color: 'text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    borderColor: 'border-blue-200 dark:border-blue-800',
    label: 'Cold',
  },
};

export const MomentumIndicator: React.FC<MomentumIndicatorProps> = ({
  refreshKey = 0,
  compact = false,
}) => {
  const momentum = useMemo(() => {
    return calculateMomentum();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const fatigue = useMemo(() => {
    return detectFatigueSignals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const config = levelConfig[momentum.level];
  const Icon = config.icon;

  if (compact) {
    return (
      <motion.div
        key={momentum.level}
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${config.bgColor} ${config.color} border ${config.borderColor}`}
      >
        <Icon className="w-3 h-3" />
        <span>{momentum.score}</span>
      </motion.div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Main indicator */}
      <motion.div
        key={momentum.level}
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300 }}
        className={`flex items-center gap-3 px-4 py-3 rounded-xl ${config.bgColor} border ${config.borderColor}`}
      >
        <div className={`p-2 rounded-lg bg-white/50 dark:bg-black/20 ${config.color}`}>
          <Icon className="w-5 h-5" />
        </div>

        <div className="flex-1">
          <div className="flex items-center justify-between">
            <span className={`text-sm font-semibold ${config.color}`}>{config.label}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">{momentum.score}%</span>
          </div>

          {/* Progress bar */}
          <div className="mt-1.5 h-1.5 bg-white/50 dark:bg-black/20 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${momentum.score}%` }}
              transition={{ duration: 0.5 }}
              className={`h-full rounded-full ${
                momentum.level === 'peaked'
                  ? 'bg-orange-500'
                  : momentum.level === 'rising'
                    ? 'bg-emerald-500'
                    : momentum.level === 'cooling'
                      ? 'bg-amber-500'
                      : momentum.level === 'cold'
                        ? 'bg-blue-400'
                        : 'bg-slate-400'
              }`}
            />
          </div>

          {/* Stats row */}
          <div className="mt-2 flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400">
            {momentum.streak > 0 && (
              <span className="flex items-center gap-1">
                <Zap className="w-3 h-3 text-amber-500" />
                {momentum.streak} streak
              </span>
            )}
            <span>{momentum.recentAccuracy}% recent</span>
            {momentum.speedTrend !== 'consistent' && (
              <span
                className={momentum.speedTrend === 'faster' ? 'text-emerald-600' : 'text-amber-600'}
              >
                {momentum.speedTrend === 'faster' ? '↗ Faster' : '↘ Slower'}
              </span>
            )}
          </div>
        </div>
      </motion.div>

      {/* Recommendation */}
      <AnimatePresence>
        {momentum.recommendation && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg"
          >
            <p className="text-xs text-blue-700 dark:text-blue-300">💡 {momentum.recommendation}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fatigue warning */}
      <AnimatePresence>
        {fatigue.isFatigued && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg"
          >
            <div className="flex items-start gap-2">
              <Coffee className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                  Time for a break?
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                  {fatigue.signals.join(' • ')}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/**
 * Compact momentum badge for toolbar/header
 */
export const MomentumBadge: React.FC<{ refreshKey?: number }> = ({ refreshKey = 0 }) => {
  return <MomentumIndicator refreshKey={refreshKey} compact />;
};

export default MomentumIndicator;
