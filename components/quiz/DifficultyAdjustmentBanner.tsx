/**
 * Difficulty Adjustment Banner
 * 2026 PA Student Optimization - Priority 8
 * 
 * Shows user-friendly feedback when difficulty is adjusted to maintain flow state
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, TrendingDown, Target } from 'lucide-react';
import type { DifficultyLevel } from '@/services/adaptiveDifficultyService';

interface DifficultyAdjustmentBannerProps {
  level: DifficultyLevel;
  accuracy: number;
  onDismiss: () => void;
}

export const DifficultyAdjustmentBanner: React.FC<DifficultyAdjustmentBannerProps> = ({
  level,
  accuracy,
  onDismiss,
}) => {
  const config = {
    harder: {
      icon: TrendingUp,
      bg: 'bg-green-50 dark:bg-green-900/20',
      border: 'border-green-200 dark:border-green-800',
      text: 'text-green-700 dark:text-green-300',
      iconColor: 'text-green-500',
      title: 'Challenge Increased',
      message: `Great job! You're crushing it at ${Math.round(accuracy * 100)}% accuracy. Questions will be more challenging to keep you engaged.`,
    },
    easier: {
      icon: TrendingDown,
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      border: 'border-blue-200 dark:border-blue-800',
      text: 'text-blue-700 dark:text-blue-300',
      iconColor: 'text-blue-500',
      title: 'Building Confidence',
      message: `Adjusting difficulty to help you build momentum. You've got this! 💪`,
    },
    maintain: {
      icon: Target,
      bg: 'bg-[var(--color-bg-secondary)]',
      border: 'border-[var(--color-border)]',
      text: 'text-[var(--color-text-secondary)]',
      iconColor: 'text-[var(--color-accent)]',
      title: 'Flow State',
      message: `Perfect! You're in the optimal learning zone at ${Math.round(accuracy * 100)}% accuracy.`,
    },
  };

  const current = config[level];
  const Icon = current.icon;

  // Auto-dismiss after 5 seconds
  React.useEffect(() => {
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className={`mb-4 rounded-lg border ${current.bg} ${current.border} p-4`}
      >
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-full ${current.bg}`}>
            <Icon className={`w-5 h-5 ${current.iconColor}`} />
          </div>
          <div className="flex-1">
            <h4 className={`font-semibold ${current.text} mb-1`}>
              {current.title}
            </h4>
            <p className={`text-sm ${current.text}`}>
              {current.message}
            </p>
          </div>
          <button
            onClick={onDismiss}
            className={`text-sm ${current.text} hover:opacity-70 transition-opacity`}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default DifficultyAdjustmentBanner;
