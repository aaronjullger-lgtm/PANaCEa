/**
 * DrillLandingPage - Standardized landing page for drill modes
 * 
 * Provides a consistent entry point for all drill modes with:
 * - Title and description
 * - Start button
 * - History/Stats summary
 * - Instructions
 */

import React from 'react';
import { motion } from 'framer-motion';
import { LucideIcon, Play, BarChart3, Clock, Target } from 'lucide-react';

export interface DrillStats {
  totalAttempts?: number;
  averageScore?: number;
  bestScore?: number;
  lastAttempted?: Date | string;
  timeSpent?: number; // in minutes
}

export interface DrillLandingPageProps {
  /** Title of the drill mode */
  title: string;
  /** Description/subtitle */
  description: string;
  /** Icon for the drill mode */
  icon: LucideIcon;
  /** Color theme for the drill (e.g., 'blue', 'green', 'purple') */
  accentColor?: string;
  /** Stats to display */
  stats?: DrillStats;
  /** Instructions or tips for the drill */
  instructions?: string[];
  /** Callback when user clicks Start */
  onStart: () => void;
  /** Callback when user wants to view history */
  onViewHistory?: () => void;
  /** Optional children for custom content */
  children?: React.ReactNode;
  /** Whether drill is loading */
  isLoading?: boolean;
}

export function DrillLandingPage({
  title,
  description,
  icon: Icon,
  accentColor = 'blue',
  stats,
  instructions,
  onStart,
  onViewHistory,
  children,
  isLoading = false,
}: DrillLandingPageProps) {
  const colorClasses = {
    blue: {
      bg: 'bg-blue-50 dark:bg-blue-950/20',
      border: 'border-blue-200 dark:border-blue-800',
      text: 'text-blue-600 dark:text-blue-400',
      button: 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400',
    },
    green: {
      bg: 'bg-green-50 dark:bg-green-950/20',
      border: 'border-green-200 dark:border-green-800',
      text: 'text-green-600 dark:text-green-400',
      button: 'bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-400',
    },
    purple: {
      bg: 'bg-purple-50 dark:bg-purple-950/20',
      border: 'border-purple-200 dark:border-purple-800',
      text: 'text-purple-600 dark:text-purple-400',
      button: 'bg-purple-600 hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-400',
    },
    orange: {
      bg: 'bg-orange-50 dark:bg-orange-950/20',
      border: 'border-orange-200 dark:border-orange-800',
      text: 'text-orange-600 dark:text-orange-400',
      button: 'bg-orange-600 hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-400',
    },
    red: {
      bg: 'bg-red-50 dark:bg-red-950/20',
      border: 'border-red-200 dark:border-red-800',
      text: 'text-red-600 dark:text-red-400',
      button: 'bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-400',
    },
  };

  const colors = colorClasses[accentColor as keyof typeof colorClasses] || colorClasses.blue;

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] py-8 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto"
      >
        {/* Header */}
        <div className={`rounded-2xl p-8 border ${colors.border} ${colors.bg} mb-6`}>
          <div className="flex items-center gap-4 mb-4">
            <div className={`p-4 rounded-xl ${colors.text} bg-white dark:bg-slate-800`}>
              <Icon className="w-12 h-12" />
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-2">
                {title}
              </h1>
              <p className="text-lg text-[var(--color-text-secondary)]">
                {description}
              </p>
            </div>
          </div>

          {/* Start Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onStart}
            disabled={isLoading}
            className={`w-full ${colors.button} text-white font-bold py-4 px-6 rounded-xl transition-colors flex items-center justify-center gap-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <Play className="w-6 h-6" />
            {isLoading ? 'Loading...' : 'Start Drill'}
          </motion.button>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {stats.totalAttempts !== undefined && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-4 h-4 text-[var(--color-text-muted)]" />
                  <span className="text-sm text-[var(--color-text-muted)]">Attempts</span>
                </div>
                <div className="text-2xl font-bold text-[var(--color-text-primary)]">
                  {stats.totalAttempts}
                </div>
              </motion.div>
            )}

            {stats.averageScore !== undefined && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 className="w-4 h-4 text-[var(--color-text-muted)]" />
                  <span className="text-sm text-[var(--color-text-muted)]">Avg Score</span>
                </div>
                <div className="text-2xl font-bold text-[var(--color-text-primary)]">
                  {stats.averageScore.toFixed(0)}%
                </div>
              </motion.div>
            )}

            {stats.bestScore !== undefined && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-4 h-4 text-[var(--color-text-muted)]" />
                  <span className="text-sm text-[var(--color-text-muted)]">Best Score</span>
                </div>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {stats.bestScore.toFixed(0)}%
                </div>
              </motion.div>
            )}

            {stats.timeSpent !== undefined && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-[var(--color-text-muted)]" />
                  <span className="text-sm text-[var(--color-text-muted)]">Time Spent</span>
                </div>
                <div className="text-2xl font-bold text-[var(--color-text-primary)]">
                  {stats.timeSpent}m
                </div>
              </motion.div>
            )}
          </div>
        )}

        {/* Instructions */}
        {instructions && instructions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-6 mb-6"
          >
            <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-4">
              How it Works
            </h2>
            <ul className="space-y-3">
              {instructions.map((instruction, index) => (
                <li key={index} className="flex items-start gap-3">
                  <span className={`${colors.text} font-bold text-lg mt-0.5`}>
                    {index + 1}.
                  </span>
                  <span className="text-[var(--color-text-secondary)] flex-1">
                    {instruction}
                  </span>
                </li>
              ))}
            </ul>
          </motion.div>
        )}

        {/* Custom Content */}
        {children && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            {children}
          </motion.div>
        )}

        {/* View History Button */}
        {onViewHistory && stats && stats.totalAttempts && stats.totalAttempts > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="text-center"
          >
            <button
              onClick={onViewHistory}
              className="btn-secondary"
            >
              View History & Stats
            </button>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
