/**
 * Custom Session Summary
 *
 * Displays detailed statistics at the end of a custom study session.
 * Shows performance breakdown by system and focus area.
 */

import React from 'react';
import { motion } from 'framer-motion';
import {
  Trophy,
  Target,
  Clock,
  TrendingUp,
  TrendingDown,
  RotateCcw,
  Home,
  CheckCircle,
  AlertTriangle,
  Zap,
  Star,
  BookOpen,
  ThumbsUp,
} from 'lucide-react';
import type { CustomSessionSummary as SummaryType } from '../../types/custom-session';
import { FOCUS_AREA_META } from '../../types/custom-session';

interface Props {
  summary: SummaryType;
  onStartNew: () => void;
  onGoHome: () => void;
}

export default function CustomSessionSummary({ summary, onStartNew, onGoHome }: Props) {
  // Format time
  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return minutes > 0 ? `${minutes}m ${remainingSeconds}s` : `${remainingSeconds}s`;
  };

  // Get grade icon based on accuracy
  const getGradeIcon = (accuracy: number) => {
    const Icon = accuracy >= 90 ? Star : accuracy >= 80 ? Target : accuracy >= 70 ? ThumbsUp : accuracy >= 60 ? BookOpen : Zap;
    return <Icon className="w-16 h-16 mx-auto text-[var(--color-text-inverse)]" aria-hidden="true" />;
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      <motion.div
        initial={{ y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[var(--color-bg-secondary)] rounded-2xl shadow-lg overflow-hidden"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent)]/80 p-6 text-center text-[var(--color-text-inverse)]">
          <div className="mb-2">{getGradeIcon(summary.firstAttemptAccuracy)}</div>
          <h1 className="text-2xl font-bold mb-1">Session Complete!</h1>
          <p className="text-[var(--color-category-practice)]">Great work on your custom study session</p>
        </div>

        {/* Main Stats */}
        <div className="p-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <StatCard
              icon={<CheckCircle className="w-5 h-5" aria-hidden="true" />}
              label="Correct (1st Try)"
              value={summary.correctFirstAttempt}
              color="green"
            />
            <StatCard
              icon={<RotateCcw className="w-5 h-5" aria-hidden="true" />}
              label="Correct (Retry)"
              value={summary.correctOnRetry}
              color="amber"
            />
            <StatCard
              icon={<Target className="w-5 h-5" aria-hidden="true" />}
              label="Accuracy"
              value={`${summary.firstAttemptAccuracy.toFixed(0)}%`}
              color="blue"
            />
            <StatCard
              icon={<Clock className="w-5 h-5" aria-hidden="true" />}
              label="Avg Time"
              value={formatTime(summary.avgTimePerQuestion)}
              color="purple"
            />
          </div>

          {/* Performance Summary */}
          <div className="grid sm:grid-cols-2 gap-4 mb-6">
            {/* Strong Areas */}
            {summary.strongAreas.length > 0 && (
              <div className="p-4 bg-data-pass dark:bg-data-pass/20 rounded-xl">
                <div className="flex items-center gap-2 text-data-pass dark:text-data-pass mb-2">
                  <TrendingUp className="w-4 h-4" aria-hidden="true" />
                  <span className="font-medium">Strong Areas</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {summary.strongAreas.map((area) => (
                    <span
                      key={area}
                      className="px-2 py-1 bg-data-pass dark:bg-data-pass/40 text-data-pass dark:text-data-pass rounded-full text-sm"
                    >
                      {area}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Focus Areas */}
            {summary.weakAreas.length > 0 && (
              <div className="p-4 bg-data-provisional dark:bg-data-provisional/20 rounded-xl">
                <div className="flex items-center gap-2 text-data-provisional dark:text-data-provisional mb-2">
                  <AlertTriangle className="w-4 h-4" aria-hidden="true" />
                  <span className="font-medium">Needs Review</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {summary.weakAreas.map((area) => (
                    <span
                      key={area}
                      className="px-2 py-1 bg-data-provisional dark:bg-data-provisional/40 text-data-provisional dark:text-data-provisional rounded-full text-sm"
                    >
                      {area}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* System Breakdown */}
          {summary.systemBreakdown.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-data-neutral dark:text-data-neutral mb-3">
                Performance by System
              </h3>
              <div className="space-y-2">
                {summary.systemBreakdown.map((system) => (
                  <div key={system.system} className="flex items-center gap-3">
                    <div className="w-32 text-sm text-data-neutral dark:text-data-neutral truncate">
                      {system.systemName}
                    </div>
                    <div className="flex-1 h-2 bg-data-neutral dark:bg-data-neutral rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${system.accuracy}%` }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                        className={`h-full rounded-full ${
                          system.accuracy >= 80
                            ? 'bg-data-pass'
                            : system.accuracy >= 60
                              ? 'bg-data-provisional'
                              : 'bg-data-fail'
                        }`}
                      />
                    </div>
                    <div className="w-16 text-right text-sm font-medium tabular-nums">
                      {system.correct}/{system.total}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Focus Area Breakdown */}
          {summary.focusAreaBreakdown.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-data-neutral dark:text-data-neutral mb-3">
                Performance by Focus Area
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {summary.focusAreaBreakdown.map((fa) => (
                  <div
                    key={fa.focusArea}
                    className="p-3 bg-data-neutral dark:bg-data-neutral/50 rounded-xl"
                  >
                    <div className="text-2xl mb-1">
                      {FOCUS_AREA_META[fa.focusArea]?.icon || '📋'}
                    </div>
                    <div className="text-xs text-data-neutral dark:text-data-neutral truncate">
                      {FOCUS_AREA_META[fa.focusArea]?.label || fa.focusArea}
                    </div>
                    <div
                      className={`text-lg font-bold ${
                        fa.accuracy >= 80
                          ? 'text-data-pass dark:text-data-pass'
                          : fa.accuracy >= 60
                            ? 'text-data-provisional dark:text-data-provisional'
                            : 'text-data-fail dark:text-data-fail'
                      }`}
                    >
                      <span className="tabular-nums">{fa.accuracy.toFixed(0)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Info Banner */}
          <div className="p-4 bg-[color-mix(in_srgb,var(--color-category-practice)_20%,transparent)] rounded-xl text-[var(--color-category-practice)] text-sm mb-6">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-4 h-4" aria-hidden="true" />
              <span className="font-medium">Practice Session</span>
            </div>
            <p>
              This was a custom practice session. Results are not saved to your spaced repetition
              schedule. Want to solidify this knowledge? Try the regular Question Mode!
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onGoHome}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border border-data-neutral dark:border-data-neutral rounded-xl text-data-neutral dark:text-data-neutral hover:bg-data-neutral dark:hover:bg-data-neutral transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2"
            >
              <Home className="w-5 h-5" aria-hidden="true" />
              Back to Menu
            </button>
            <button
              onClick={onStartNew}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-[var(--color-category-practice)] text-[var(--color-text-inverse)] rounded-xl hover:bg-[var(--color-category-practice)] transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2"
            >
              <RotateCcw className="w-5 h-5" aria-hidden="true" />
              New Session
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ============================================================================
// STAT CARD COMPONENT
// ============================================================================

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: 'green' | 'amber' | 'blue' | 'purple' | 'red';
}

function StatCard({ icon, label, value, color }: StatCardProps) {
  const colorClasses = {
    green: 'text-data-pass dark:text-data-pass bg-data-pass dark:bg-data-pass/20',
    amber: 'text-data-provisional dark:text-data-provisional bg-data-provisional dark:bg-data-provisional/20',
    blue: 'text-[var(--color-category-practice)] bg-[color-mix(in_srgb,var(--color-category-practice)_20%,transparent)]',
    purple: 'text-[var(--color-accent)] bg-[var(--color-accent)]/5 dark:bg-[var(--color-accent)]/20',
    red: 'text-data-fail dark:text-data-fail bg-data-fail dark:bg-data-fail/20',
  };

  return (
    <div className={`p-3 rounded-xl ${colorClasses[color]}`}>
      <div className="flex items-center gap-1 mb-1">{icon}</div>
      <div className="text-xl font-bold">{value}</div>
      <div className="text-xs opacity-75">{label}</div>
    </div>
  );
}
