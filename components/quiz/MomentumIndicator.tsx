/**
 * Momentum Indicator Component
 *
 * Displays current session momentum with visual feedback.
 * Shows when user is "in the zone" vs struggling.
 */

import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, TrendingUp, Equal, TrendingDown, Snowflake, Zap, Coffee, Lightbulb } from 'lucide-react';
import {
  calculateMomentum,
  detectFatigueSignals,
  type MomentumLevel,
  type MomentumState,
} from '@/services/session';
import { useLowPowerMode } from '@/hooks/useLowPowerMode';

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
    color: 'text-[var(--color-data-provisional)]',
    bgColor: 'bg-[var(--color-data-provisional)]/10 dark:bg-[var(--color-data-provisional)]/30',
    borderColor:
      'border-[var(--color-data-provisional)]/30 dark:border-[var(--color-data-provisional)]/80',
    label: 'On Fire',
  },
  rising: {
    icon: TrendingUp,
    color: 'text-[var(--color-data-pass)]',
    bgColor: 'bg-[var(--color-data-pass)]/10 dark:bg-[var(--color-data-pass)]/30',
    borderColor: 'border-[var(--color-data-pass)]/30 dark:border-[var(--color-data-pass)]/80',
    label: 'Rising',
  },
  steady: {
    icon: Equal,
    color: 'text-data-neutral',
    bgColor: 'bg-data-neutral dark:bg-data-neutral',
    borderColor: 'border-data-neutral dark:border-data-neutral',
    label: 'Steady',
  },
  cooling: {
    icon: TrendingDown,
    color: 'text-[var(--color-data-provisional)]',
    bgColor: 'bg-[var(--color-data-provisional)]/10 dark:bg-[var(--color-data-provisional)]/30',
    borderColor:
      'border-[var(--color-data-provisional)]/30 dark:border-[var(--color-data-provisional)]/80',
    label: 'Cooling',
  },
  cold: {
    icon: Snowflake,
    color: 'text-[var(--color-accent)]',
    bgColor: 'bg-[var(--color-accent)]/10 dark:bg-[var(--color-accent)]/30',
    borderColor: 'border-[var(--color-accent)]/30 dark:border-[var(--color-accent)]/80',
    label: 'Cold',
  },
};

export const MomentumIndicator: React.FC<MomentumIndicatorProps> = ({
  refreshKey = 0,
  compact = false,
}) => {
  const lowPower = useLowPowerMode();
  const momentum = useMemo(() => {
    return calculateMomentum();
  }, [refreshKey]);

  const fatigue = useMemo(() => {
    return detectFatigueSignals();
  }, [refreshKey]);

  const config = levelConfig[momentum.level];
  const Icon = config.icon;

  const noMotion = lowPower;

  if (compact) {
    return (
      <motion.div
        key={momentum.level}
        initial={noMotion ? false : { scale: 0.9 }}
        animate={{ scale: 1 }}
        transition={noMotion ? { duration: 0 } : undefined}
        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${config.bgColor} ${config.color} border ${config.borderColor}`}
        style={{ transform: 'translateZ(0)' }}
        aria-label={`Momentum: ${config.label} — ${momentum.score}%`}
      >
        <Icon className="w-3 h-3" aria-hidden="true" />
        <span className="tabular-nums">{momentum.score}</span>
      </motion.div>
    );
  }

  return (
    <div className="space-y-2" style={{ transform: 'translateZ(0)' }}>
      {/* Main indicator — GPU layer; no spring when low power */}
      <motion.div
        key={momentum.level}
        initial={noMotion ? false : { scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={noMotion ? { duration: 0 } : { type: 'spring', stiffness: 300 }}
        className={`flex items-center gap-3 px-4 py-3 rounded-xl ${config.bgColor} border ${config.borderColor}`}
      >
        <div className={`p-2 rounded-lg bg-[var(--color-bg-tertiary)]/80 ${config.color}`}>
          <Icon className="w-5 h-5" />
        </div>

        <div className="flex-1">
          <div className="flex items-center justify-between">
            <span className={`text-sm font-semibold ${config.color}`}>{config.label}</span>
            <span className="text-xs text-data-neutral dark:text-data-neutral">{momentum.score}%</span>
          </div>

          {/* Progress bar */}
          <div className="mt-1.5 h-1.5 bg-[var(--color-bg-tertiary)]/80 rounded-full overflow-hidden">
            <motion.div
              initial={noMotion ? false : { width: 0 }}
              animate={{ width: `${momentum.score}%` }}
              transition={noMotion ? { duration: 0 } : { duration: 0.5 }}
              className={`h-full rounded-full ${
                momentum.level === 'peaked'
                  ? 'bg-[var(--color-data-provisional)]'
                  : momentum.level === 'rising'
                    ? 'bg-[var(--color-data-pass)]'
                    : momentum.level === 'cooling'
                      ? 'bg-[var(--color-data-provisional)]'
                      : momentum.level === 'cold'
                        ? 'bg-[var(--color-accent)]'
                        : 'bg-data-neutral'
              }`}
            />
          </div>

          {/* Stats row */}
          <div className="mt-2 flex items-center gap-3 text-xs text-data-neutral dark:text-data-neutral">
            {momentum.streak > 0 && (
              <span className="flex items-center gap-1">
                <Zap className="w-3 h-3 text-[var(--color-data-provisional)]" />
                {momentum.streak} streak
              </span>
            )}
            <span>{momentum.recentAccuracy}% recent</span>
            {momentum.speedTrend !== 'consistent' && (
              <span
                className={
                  momentum.speedTrend === 'faster'
                    ? 'text-[var(--color-data-pass)]'
                    : 'text-[var(--color-data-provisional)]'
                }
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
            initial={noMotion ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={noMotion ? undefined : { opacity: 0, height: 0 }}
            transition={noMotion ? { duration: 0 } : undefined}
            className="px-3 py-2 bg-[var(--color-accent)]/10 dark:bg-[var(--color-accent)]/20 border border-[var(--color-accent)]/30 dark:border-[var(--color-accent)]/80 rounded-lg"
          >
            <p className="text-xs text-[var(--color-accent)] dark:text-[var(--color-accent)]/90 flex items-start gap-2">
              <Lightbulb className="w-4 h-4 shrink-0 mt-0.5" />
              {momentum.recommendation}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fatigue warning */}
      <AnimatePresence>
        {fatigue.isFatigued && (
          <motion.div
            initial={noMotion ? false : { opacity: 0, y: -10 }}
            animate={{ y: 0 }}
            exit={noMotion ? undefined : { opacity: 0, y: -10 }}
            transition={noMotion ? { duration: 0 } : undefined}
            className="px-3 py-2 bg-[var(--color-data-provisional)]/10 dark:bg-[var(--color-data-provisional)]/20 border border-[var(--color-data-provisional)]/30 dark:border-[var(--color-data-provisional)]/80 rounded-lg"
          >
            <div className="flex items-start gap-2">
              <Coffee className="w-4 h-4 text-[var(--color-data-provisional)] dark:text-[var(--color-data-provisional)]/90 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-medium text-[var(--color-data-provisional)] dark:text-[var(--color-data-provisional)]/90">
                  Time for a break?
                </p>
                <p className="text-xs text-[var(--color-data-provisional)]/80 dark:text-[var(--color-data-provisional)]/80 mt-0.5">
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
