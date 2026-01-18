/**
 * DrillLandingPage - Standardized landing page for drill modes
 *
 * Provides a consistent entry point for all drill modes with:
 * - Title and description
 * - Learning objectives
 * - Start button
 * - History/Stats summary
 * - Instructions
 * - Estimated time
 *
 * Uses muted semantic color palette for professional appearance.
 */

import React from 'react';
import { motion } from 'framer-motion';
import {
  LucideIcon,
  Play,
  BarChart3,
  Clock,
  Target,
  BookOpen,
  Lightbulb,
  ArrowLeft,
} from 'lucide-react';

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
  /** Extended description with more context */
  longDescription?: string;
  /** Icon for the drill mode */
  icon: LucideIcon;
  /** Color theme for the drill (e.g., 'sage', 'slate-teal', 'dusty-rose', 'steel-blue', 'muted-amber', 'deep-plum') */
  accentColor?: string;
  /** Stats to display */
  stats?: DrillStats;
  /** Instructions or tips for the drill */
  instructions?: string[];
  /** Learning objectives */
  objectives?: string[];
  /** Estimated time in minutes */
  estimatedMinutes?: number;
  /** PANCE blueprint categories covered */
  categories?: string[];
  /** Callback when user clicks Start */
  onStart: () => void;
  /** Callback when user wants to view history */
  onViewHistory?: () => void;
  /** Callback to exit/go back */
  onExit?: () => void;
  /** Optional children for custom content */
  children?: React.ReactNode;
  /** Whether drill is loading */
  isLoading?: boolean;
}

export function DrillLandingPage({
  title,
  description,
  longDescription,
  icon: Icon,
  accentColor = 'steel-blue',
  stats,
  instructions,
  objectives,
  estimatedMinutes,
  categories,
  onStart,
  onViewHistory,
  onExit,
  children,
  isLoading = false,
}: DrillLandingPageProps) {
  // Muted semantic color palette
  const colorClasses = {
    // Legacy colors (still supported)
    blue: {
      bg: 'bg-steel-blue-50 dark:bg-steel-blue-900/20',
      border: 'border-steel-blue-200 dark:border-steel-blue-800',
      text: 'text-steel-blue-600 dark:text-steel-blue-400',
      button:
        'bg-steel-blue-600 hover:bg-steel-blue-700 dark:bg-steel-blue-500 dark:hover:bg-steel-blue-400',
      tag: 'bg-steel-blue-100 text-steel-blue-700 dark:bg-steel-blue-900/30 dark:text-steel-blue-300',
    },
    green: {
      bg: 'bg-sage-50 dark:bg-sage-900/20',
      border: 'border-sage-200 dark:border-sage-800',
      text: 'text-sage-600 dark:text-sage-400',
      button: 'bg-sage-600 hover:bg-sage-700 dark:bg-sage-500 dark:hover:bg-sage-400',
      tag: 'bg-sage-100 text-sage-700 dark:bg-sage-900/30 dark:text-sage-300',
    },
    purple: {
      bg: 'bg-deep-plum-50 dark:bg-deep-plum-900/20',
      border: 'border-deep-plum-200 dark:border-deep-plum-800',
      text: 'text-deep-plum-600 dark:text-deep-plum-400',
      button:
        'bg-deep-plum-600 hover:bg-deep-plum-700 dark:bg-deep-plum-500 dark:hover:bg-deep-plum-400',
      tag: 'bg-deep-plum-100 text-deep-plum-700 dark:bg-deep-plum-900/30 dark:text-deep-plum-300',
    },
    orange: {
      bg: 'bg-muted-amber-50 dark:bg-muted-amber-900/20',
      border: 'border-muted-amber-200 dark:border-muted-amber-800',
      text: 'text-muted-amber-600 dark:text-muted-amber-400',
      button:
        'bg-muted-amber-600 hover:bg-muted-amber-700 dark:bg-muted-amber-500 dark:hover:bg-muted-amber-400',
      tag: 'bg-muted-amber-100 text-muted-amber-700 dark:bg-muted-amber-900/30 dark:text-muted-amber-300',
    },
    red: {
      bg: 'bg-dusty-rose-50 dark:bg-dusty-rose-900/20',
      border: 'border-dusty-rose-200 dark:border-dusty-rose-800',
      text: 'text-dusty-rose-600 dark:text-dusty-rose-400',
      button:
        'bg-dusty-rose-600 hover:bg-dusty-rose-700 dark:bg-dusty-rose-500 dark:hover:bg-dusty-rose-400',
      tag: 'bg-dusty-rose-100 text-dusty-rose-700 dark:bg-dusty-rose-900/30 dark:text-dusty-rose-300',
    },
    // New muted semantic colors
    sage: {
      bg: 'bg-sage-50 dark:bg-sage-900/20',
      border: 'border-sage-200 dark:border-sage-800',
      text: 'text-sage-600 dark:text-sage-400',
      button: 'bg-sage-600 hover:bg-sage-700 dark:bg-sage-500 dark:hover:bg-sage-400',
      tag: 'bg-sage-100 text-sage-700 dark:bg-sage-900/30 dark:text-sage-300',
    },
    'slate-teal': {
      bg: 'bg-slate-teal-50 dark:bg-slate-teal-900/20',
      border: 'border-slate-teal-200 dark:border-slate-teal-800',
      text: 'text-slate-teal-600 dark:text-slate-teal-400',
      button:
        'bg-slate-teal-600 hover:bg-slate-teal-700 dark:bg-slate-teal-500 dark:hover:bg-slate-teal-400',
      tag: 'bg-slate-teal-100 text-slate-teal-700 dark:bg-slate-teal-900/30 dark:text-slate-teal-300',
    },
    'dusty-rose': {
      bg: 'bg-dusty-rose-50 dark:bg-dusty-rose-900/20',
      border: 'border-dusty-rose-200 dark:border-dusty-rose-800',
      text: 'text-dusty-rose-600 dark:text-dusty-rose-400',
      button:
        'bg-dusty-rose-600 hover:bg-dusty-rose-700 dark:bg-dusty-rose-500 dark:hover:bg-dusty-rose-400',
      tag: 'bg-dusty-rose-100 text-dusty-rose-700 dark:bg-dusty-rose-900/30 dark:text-dusty-rose-300',
    },
    'steel-blue': {
      bg: 'bg-steel-blue-50 dark:bg-steel-blue-900/20',
      border: 'border-steel-blue-200 dark:border-steel-blue-800',
      text: 'text-steel-blue-600 dark:text-steel-blue-400',
      button:
        'bg-steel-blue-600 hover:bg-steel-blue-700 dark:bg-steel-blue-500 dark:hover:bg-steel-blue-400',
      tag: 'bg-steel-blue-100 text-steel-blue-700 dark:bg-steel-blue-900/30 dark:text-steel-blue-300',
    },
    'muted-amber': {
      bg: 'bg-muted-amber-50 dark:bg-muted-amber-900/20',
      border: 'border-muted-amber-200 dark:border-muted-amber-800',
      text: 'text-muted-amber-600 dark:text-muted-amber-400',
      button:
        'bg-muted-amber-600 hover:bg-muted-amber-700 dark:bg-muted-amber-500 dark:hover:bg-muted-amber-400',
      tag: 'bg-muted-amber-100 text-muted-amber-700 dark:bg-muted-amber-900/30 dark:text-muted-amber-300',
    },
    'deep-plum': {
      bg: 'bg-deep-plum-50 dark:bg-deep-plum-900/20',
      border: 'border-deep-plum-200 dark:border-deep-plum-800',
      text: 'text-deep-plum-600 dark:text-deep-plum-400',
      button:
        'bg-deep-plum-600 hover:bg-deep-plum-700 dark:bg-deep-plum-500 dark:hover:bg-deep-plum-400',
      tag: 'bg-deep-plum-100 text-deep-plum-700 dark:bg-deep-plum-900/30 dark:text-deep-plum-300',
    },
  };

  const colors =
    colorClasses[accentColor as keyof typeof colorClasses] || colorClasses['steel-blue'];

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] py-8 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto"
      >
        {/* Back Button */}
        {onExit && (
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={onExit}
            className="flex items-center gap-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Training</span>
          </motion.button>
        )}

        {/* Header */}
        <div className={`rounded-2xl p-8 border ${colors.border} ${colors.bg} mb-6`}>
          <div className="flex items-center gap-4 mb-4">
            <div className={`p-4 rounded-xl ${colors.text} bg-[var(--color-bg-tertiary)]`}>
              <Icon className="w-12 h-12" />
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-2">{title}</h1>
              <p className="text-lg text-[var(--color-text-secondary)]">{description}</p>
            </div>
          </div>

          {/* Meta info row */}
          <div className="flex flex-wrap items-center gap-4 mb-6">
            {estimatedMinutes && (
              <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
                <Clock className="w-4 h-4" />
                <span>~{estimatedMinutes} minutes</span>
              </div>
            )}
            {categories && categories.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {categories.map((cat, idx) => (
                  <span key={idx} className={`text-xs px-2 py-1 rounded-full ${colors.tag}`}>
                    {cat}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Long Description */}
          {longDescription && (
            <p className="text-[var(--color-text-secondary)] mb-6 leading-relaxed">
              {longDescription}
            </p>
          )}

          {/* Start Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onStart}
            disabled={isLoading}
            className={`w-full ${colors.button} text-white font-bold py-4 px-6 rounded-xl transition-colors flex items-center justify-center gap-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isLoading ? (
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Play className="w-6 h-6" />
            )}
            {isLoading ? 'Starting...' : 'Start Drill'}
          </motion.button>
        </div>

        {/* Learning Objectives */}
        {objectives && objectives.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-6 mb-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <Lightbulb className={`w-5 h-5 ${colors.text}`} />
              <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
                Learning Objectives
              </h2>
            </div>
            <ul className="space-y-2">
              {objectives.map((objective, index) => (
                <li key={index} className="flex items-start gap-3">
                  <div
                    className={`w-5 h-5 rounded-full ${colors.bg} ${colors.border} border flex items-center justify-center flex-shrink-0 mt-0.5`}
                  >
                    <span className={`text-xs font-bold ${colors.text}`}>{index + 1}</span>
                  </div>
                  <span className="text-[var(--color-text-secondary)]">{objective}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        )}

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {stats.totalAttempts !== undefined && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
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
                transition={{ delay: 0.25 }}
                className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-4 h-4 text-[var(--color-text-muted)]" />
                  <span className="text-sm text-[var(--color-text-muted)]">Best Score</span>
                </div>
                <div className={`text-2xl font-bold ${colors.text}`}>
                  {stats.bestScore.toFixed(0)}%
                </div>
              </motion.div>
            )}

            {stats.timeSpent !== undefined && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
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
            transition={{ delay: 0.35 }}
            className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-6 mb-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <BookOpen className={`w-5 h-5 ${colors.text}`} />
              <h2 className="text-lg font-bold text-[var(--color-text-primary)]">How it Works</h2>
            </div>
            <ul className="space-y-3">
              {instructions.map((instruction, index) => (
                <li key={index} className="flex items-start gap-3">
                  <span className={`${colors.text} font-bold text-lg mt-0.5`}>{index + 1}.</span>
                  <span className="text-[var(--color-text-secondary)] flex-1">{instruction}</span>
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
            transition={{ delay: 0.4 }}
          >
            {children}
          </motion.div>
        )}

        {/* View History Button */}
        {onViewHistory && stats && stats.totalAttempts && stats.totalAttempts > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="text-center"
          >
            <button onClick={onViewHistory} className="btn-ghost">
              View History and Stats
            </button>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
