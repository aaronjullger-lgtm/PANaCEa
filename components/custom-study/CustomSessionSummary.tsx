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

  // Get grade emoji based on accuracy
  const getGradeEmoji = (accuracy: number) => {
    if (accuracy >= 90) return '🌟';
    if (accuracy >= 80) return '🎯';
    if (accuracy >= 70) return '👍';
    if (accuracy >= 60) return '📚';
    return '💪';
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg overflow-hidden"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-center text-white">
          <div className="text-6xl mb-2">{getGradeEmoji(summary.firstAttemptAccuracy)}</div>
          <h1 className="text-2xl font-bold mb-1">Session Complete!</h1>
          <p className="text-blue-100">Great work on your custom study session</p>
        </div>

        {/* Main Stats */}
        <div className="p-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <StatCard
              icon={<CheckCircle className="w-5 h-5" />}
              label="Correct (1st Try)"
              value={summary.correctFirstAttempt}
              color="green"
            />
            <StatCard
              icon={<RotateCcw className="w-5 h-5" />}
              label="Correct (Retry)"
              value={summary.correctOnRetry}
              color="amber"
            />
            <StatCard
              icon={<Target className="w-5 h-5" />}
              label="Accuracy"
              value={`${summary.firstAttemptAccuracy.toFixed(0)}%`}
              color="blue"
            />
            <StatCard
              icon={<Clock className="w-5 h-5" />}
              label="Avg Time"
              value={formatTime(summary.avgTimePerQuestion)}
              color="purple"
            />
          </div>

          {/* Performance Summary */}
          <div className="grid sm:grid-cols-2 gap-4 mb-6">
            {/* Strong Areas */}
            {summary.strongAreas.length > 0 && (
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-300 mb-2">
                  <TrendingUp className="w-4 h-4" />
                  <span className="font-medium">Strong Areas</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {summary.strongAreas.map((area) => (
                    <span
                      key={area}
                      className="px-2 py-1 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 rounded-full text-sm"
                    >
                      {area}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Weak Areas */}
            {summary.weakAreas.length > 0 && (
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 mb-2">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="font-medium">Needs Review</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {summary.weakAreas.map((area) => (
                    <span
                      key={area}
                      className="px-2 py-1 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded-full text-sm"
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
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                Performance by System
              </h3>
              <div className="space-y-2">
                {summary.systemBreakdown.map((system) => (
                  <div key={system.system} className="flex items-center gap-3">
                    <div className="w-32 text-sm text-slate-600 dark:text-slate-400 truncate">
                      {system.systemName}
                    </div>
                    <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${system.accuracy}%` }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                        className={`h-full rounded-full ${
                          system.accuracy >= 80
                            ? 'bg-green-500'
                            : system.accuracy >= 60
                              ? 'bg-amber-500'
                              : 'bg-red-500'
                        }`}
                      />
                    </div>
                    <div className="w-16 text-right text-sm font-medium">
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
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                Performance by Focus Area
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {summary.focusAreaBreakdown.map((fa) => (
                  <div
                    key={fa.focusArea}
                    className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl"
                  >
                    <div className="text-2xl mb-1">
                      {FOCUS_AREA_META[fa.focusArea]?.icon || '📋'}
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400 truncate">
                      {FOCUS_AREA_META[fa.focusArea]?.label || fa.focusArea}
                    </div>
                    <div
                      className={`text-lg font-bold ${
                        fa.accuracy >= 80
                          ? 'text-green-600 dark:text-green-400'
                          : fa.accuracy >= 60
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {fa.accuracy.toFixed(0)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Info Banner */}
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-blue-700 dark:text-blue-300 text-sm mb-6">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-4 h-4" />
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
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              <Home className="w-5 h-5" />
              Back to Menu
            </button>
            <button
              onClick={onStartNew}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
            >
              <RotateCcw className="w-5 h-5" />
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
    green: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20',
    amber: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20',
    blue: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20',
    purple: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20',
    red: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20',
  };

  return (
    <div className={`p-3 rounded-xl ${colorClasses[color]}`}>
      <div className="flex items-center gap-1 mb-1">{icon}</div>
      <div className="text-xl font-bold">{value}</div>
      <div className="text-xs opacity-75">{label}</div>
    </div>
  );
}
