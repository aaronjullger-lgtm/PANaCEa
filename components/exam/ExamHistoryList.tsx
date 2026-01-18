/**
 * Exam History List Component
 * Sprint 6: Display past exam attempts with scores and trends
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Calendar,
  Clock,
  Award,
  TrendingUp,
  TrendingDown,
  Target,
  CheckCircle,
  XCircle,
  ChevronRight,
  BarChart3,
  RefreshCcw,
} from 'lucide-react';
import { ExamService } from '@/services/domain';

// =============================================================================
// TYPES
// =============================================================================

export interface ExamAttemptSummary {
  id: string;
  configName: string; // "PANCE" or "PANRE-LA"
  startedAt: Date | string;
  completedAt?: Date | string;
  status: 'completed' | 'in_progress' | 'abandoned' | 'timed_out';
  score?: number;
  percentCorrect?: number;
  passStatus?: 'passed' | 'failed' | 'pending';
  totalQuestions: number;
  questionsAnswered: number;
  timeUsedMinutes: number;
  systemScores?: Record<string, number>;
}

export interface ExamHistoryListProps {
  attempts: ExamAttemptSummary[];
  onSelectAttempt?: (attemptId: string) => void;
  onResumeAttempt?: (attemptId: string) => void;
  showTrends?: boolean;
  maxItems?: number;
  isLoading?: boolean;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function getScoreColor(score: number): string {
  if (score >= 450) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 400) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function getScoreBgColor(score: number): string {
  if (score >= 450) return 'bg-emerald-100 dark:bg-emerald-900/30';
  if (score >= 400) return 'bg-amber-100 dark:bg-amber-900/30';
  return 'bg-red-100 dark:bg-red-900/30';
}

// =============================================================================
// COMPONENT
// =============================================================================

export function ExamHistoryList({
  attempts,
  onSelectAttempt,
  onResumeAttempt,
  showTrends = true,
  maxItems,
  isLoading = false,
}: ExamHistoryListProps) {
  // Calculate trend
  const trend = useMemo(() => {
    const completed = attempts.filter((a) => a.status === 'completed' && a.score).slice(0, 5);

    if (completed.length < 2) return null;

    const recent = completed.slice(0, 2).map((a) => a.score!);
    const avgRecent = recent.reduce((a, b) => a + b, 0) / recent.length;

    const older = completed.slice(2).map((a) => a.score!);
    if (older.length === 0) return null;

    const avgOlder = older.reduce((a, b) => a + b, 0) / older.length;

    return {
      direction: avgRecent > avgOlder ? 'up' : avgRecent < avgOlder ? 'down' : 'flat',
      change: Math.round(avgRecent - avgOlder),
    };
  }, [attempts]);

  // Stats summary
  const stats = useMemo(() => {
    const completed = attempts.filter((a) => a.status === 'completed');
    const passed = completed.filter((a) => a.passStatus === 'passed');

    return {
      total: attempts.length,
      completed: completed.length,
      passRate: completed.length > 0 ? Math.round((passed.length / completed.length) * 100) : 0,
      avgScore:
        completed.length > 0
          ? Math.round(completed.reduce((a, b) => a + (b.score || 0), 0) / completed.length)
          : 0,
    };
  }, [attempts]);

  const displayAttempts = maxItems ? attempts.slice(0, maxItems) : attempts;

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-4 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
                <div className="h-3 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
              </div>
              <div className="h-12 w-16 bg-slate-200 dark:bg-slate-700 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (attempts.length === 0) {
    return (
      <div className="text-center py-12">
        <Target className="h-12 w-12 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
        <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-2">
          No Exam History
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Start your first practice exam to track your progress.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      {showTrends && (
        <div className="grid grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Total Exams</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.total}</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Completed</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.completed}</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Pass Rate</p>
            <p
              className={`text-2xl font-bold ${stats.passRate >= 70 ? 'text-emerald-600' : 'text-amber-600'}`}
            >
              {stats.passRate}%
            </p>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 relative">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Avg Score</p>
            <p className={`text-2xl font-bold ${getScoreColor(stats.avgScore)}`}>
              {stats.avgScore}
            </p>
            {trend && (
              <div
                className={`absolute top-2 right-2 flex items-center gap-0.5 text-xs ${
                  trend.direction === 'up' ? 'text-emerald-500' : 'text-red-500'
                }`}
              >
                {trend.direction === 'up' ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                <span>{Math.abs(trend.change)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Attempt List */}
      <div className="space-y-3">
        {displayAttempts.map((attempt, index) => (
          <motion.div
            key={attempt.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            onClick={() => onSelectAttempt?.(attempt.id)}
            className={`
              p-4 rounded-xl border-2 transition-all
              ${
                attempt.status === 'completed'
                  ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                  : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
              }
              ${onSelectAttempt ? 'cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-600' : ''}
            `}
          >
            <div className="flex items-start justify-between">
              {/* Left side - Info */}
              <div className="flex-grow">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {attempt.configName}
                  </span>
                  {attempt.status === 'completed' &&
                    (attempt.passStatus === 'passed' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300">
                        <CheckCircle className="h-3 w-3" />
                        Passed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300">
                        <XCircle className="h-3 w-3" />
                        Failed
                      </span>
                    ))}
                  {attempt.status === 'in_progress' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300">
                      In Progress
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    <span>{formatDate(attempt.startedAt)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>{attempt.timeUsedMinutes} min</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <BarChart3 className="h-4 w-4" />
                    <span>
                      {attempt.questionsAnswered}/{attempt.totalQuestions}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right side - Score or Resume */}
              {attempt.status === 'completed' && attempt.score ? (
                <div
                  className={`
                  flex flex-col items-center justify-center px-4 py-2 rounded-lg
                  ${getScoreBgColor(attempt.score)}
                `}
                >
                  <span className={`text-2xl font-bold ${getScoreColor(attempt.score)}`}>
                    {attempt.score}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {attempt.percentCorrect}%
                  </span>
                </div>
              ) : attempt.status === 'in_progress' && onResumeAttempt ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onResumeAttempt(attempt.id);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  <RefreshCcw className="h-4 w-4" />
                  Resume
                </button>
              ) : (
                <ChevronRight className="h-5 w-5 text-slate-400" />
              )}
            </div>

            {/* System breakdown preview (for completed exams) */}
            {attempt.status === 'completed' &&
              attempt.systemScores &&
              Object.keys(attempt.systemScores).length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {Object.entries(attempt.systemScores)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 5)
                      .map(([system, score]) => (
                        <div
                          key={system}
                          className={`
                          flex-shrink-0 px-2 py-1 rounded text-xs font-medium
                          ${
                            score >= 75
                              ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                              : score >= 60
                                ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                                : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                          }
                        `}
                        >
                          {system.replace(/_/g, ' ')}: {Math.round(score)}%
                        </div>
                      ))}
                  </div>
                </div>
              )}
          </motion.div>
        ))}
      </div>

      {/* Show more link */}
      {maxItems && attempts.length > maxItems && (
        <div className="text-center">
          <button
            onClick={() => onSelectAttempt?.('view-all')}
            className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            View all {attempts.length} attempts →
          </button>
        </div>
      )}
    </div>
  );
}

export default ExamHistoryList;
