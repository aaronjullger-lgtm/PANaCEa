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
import { useReducedMotion } from '@/hooks/useReducedMotion';
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
  const prefersReducedMotion = useReducedMotion();

  // Semantic design tokens (consistent across all drill modes)
  const colors = {
    bg: 'bg-[var(--color-bg-tertiary)]',
    border: 'border-[var(--color-border)]',
    text: 'text-[var(--color-accent)]',
    button: 'bg-[var(--color-accent)] hover:opacity-90',
    tag: 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]',
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] py-8 px-4">
      <motion.div
        initial={{ y: 20 }}
        animate={{ y: 0 }}
        className="max-w-4xl mx-auto"
      >
        {/* Back Button */}
        {onExit && (
          <motion.button
            initial={{ x: -20 }}
            animate={{ x: 0 }}
            onClick={onExit}
            aria-label="Go back to training hub"
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
              <h1 className="text-3xl font-semibold text-gold-gradient mb-2">{title}</h1>
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
            whileHover={prefersReducedMotion ? undefined : { scale: 1.02 }}
            whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
            onClick={onStart}
            disabled={isLoading}
            aria-label={isLoading ? 'Starting drill...' : `Start ${title} drill`}
            className={`w-full ${colors.button} text-[var(--color-text-inverse)] font-semibold py-4 px-6 rounded-xl transition-colors flex items-center justify-center gap-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2`}
          >
            {isLoading ? (
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" role="status" aria-label="Loading" />
            ) : (
              <Play className="w-6 h-6" aria-hidden="true" />
            )}
            {isLoading ? 'Starting...' : 'Start Drill'}
          </motion.button>
        </div>

        {/* Learning Objectives */}
        {objectives && objectives.length > 0 && (
          <motion.div
            initial={prefersReducedMotion ? false : { y: 20 }}
            animate={{ y: 0 }}
            transition={prefersReducedMotion ? { duration: 0 } : { delay: 0.1 }}
            className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-6 mb-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <Lightbulb className={`w-5 h-5 ${colors.text}`} />
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                Learning Objectives
              </h2>
            </div>
            <ul className="space-y-2" role="list" aria-label="Learning objectives">
              {objectives.map((objective, index) => (
                <li key={index} className="flex items-start gap-3">
                  <div
                    className={`w-5 h-5 rounded-full ${colors.bg} ${colors.border} border flex items-center justify-center flex-shrink-0 mt-0.5`}
                  >
                    <span className={`text-xs font-semibold ${colors.text}`}>{index + 1}</span>
                  </div>
                  <span className="text-[var(--color-text-secondary)]">{objective}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        )}

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6" aria-live="polite" aria-label="Drill statistics">
            {stats.totalAttempts !== undefined && (
              <motion.div
                initial={{ y: 20 }}
                animate={{ y: 0 }}
                transition={{ delay: 0.15 }}
                className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-4 h-4 text-[var(--color-text-muted)]" />
                  <span className="text-sm text-[var(--color-text-muted)]">Attempts</span>
                </div>
                <div className="text-2xl font-semibold text-[var(--color-text-primary)]">
                  {stats.totalAttempts}
                </div>
              </motion.div>
            )}

            {stats.averageScore !== undefined && (
              <motion.div
                initial={{ y: 20 }}
                animate={{ y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 className="w-4 h-4 text-[var(--color-text-muted)]" />
                  <span className="text-sm text-[var(--color-text-muted)]">Avg Score</span>
                </div>
                <div className="text-2xl font-semibold text-[var(--color-text-primary)]">
                  {stats.averageScore.toFixed(0)}%
                </div>
              </motion.div>
            )}

            {stats.bestScore !== undefined && (
              <motion.div
                initial={{ y: 20 }}
                animate={{ y: 0 }}
                transition={{ delay: 0.25 }}
                className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-4 h-4 text-[var(--color-text-muted)]" />
                  <span className="text-sm text-[var(--color-text-muted)]">Best Score</span>
                </div>
                <div className={`text-2xl font-semibold ${colors.text}`}>
                  {stats.bestScore.toFixed(0)}%
                </div>
              </motion.div>
            )}

            {stats.timeSpent !== undefined && (
              <motion.div
                initial={{ y: 20 }}
                animate={{ y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-[var(--color-text-muted)]" />
                  <span className="text-sm text-[var(--color-text-muted)]">Time Spent</span>
                </div>
                <div className="text-2xl font-semibold text-[var(--color-text-primary)]">
                  {stats.timeSpent}m
                </div>
              </motion.div>
            )}
          </div>
        )}

        {/* Instructions */}
        {instructions && instructions.length > 0 && (
          <motion.div
            initial={{ y: 20 }}
            animate={{ y: 0 }}
            transition={{ delay: 0.35 }}
            className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-6 mb-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <BookOpen className={`w-5 h-5 ${colors.text}`} />
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">How it Works</h2>
            </div>
            <ul className="space-y-3" role="list" aria-label="Instructions">
              {instructions.map((instruction, index) => (
                <li key={index} className="flex items-start gap-3">
                  <span className={`${colors.text} font-semibold text-lg mt-0.5`}>{index + 1}.</span>
                  <span className="text-[var(--color-text-secondary)] flex-1">{instruction}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        )}

        {/* Custom Content */}
        {children && (
          <motion.div
            initial={{ y: 20 }}
            animate={{ y: 0 }}
            transition={{ delay: 0.4 }}
          >
            {children}
          </motion.div>
        )}

        {/* View History Button */}
        {onViewHistory && stats && stats.totalAttempts && stats.totalAttempts > 0 && (
          <motion.div
            initial={{ y: 20 }}
            animate={{ y: 0 }}
            transition={{ delay: 0.45 }}
            className="text-center"
          >
            <button onClick={onViewHistory} aria-label={`View ${title} history and statistics`} className="btn-ghost">
              View History and Stats
            </button>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
