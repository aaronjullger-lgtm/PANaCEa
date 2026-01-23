/**
 * DrillStatsDashboard - Comprehensive drill performance dashboard
 *
 * Displays:
 * - Overall drill performance summary
 * - Individual drill cards with stats
 * - Category breakdowns for System/Subcategory drills
 * - Difficulty progression indicators
 * - Spaced repetition due dates
 * - Progress milestones
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart3,
  TrendingUp,
  Target,
  Clock,
  Award,
  Flame,
  Calendar,
  ChevronDown,
  ChevronRight,
  Activity,
  Brain,
  Heart,
  Beaker,
  Wind,
  Bone,
  Layers,
  FolderTree,
  HeartPulse,
  Droplets,
  Bug,
} from 'lucide-react';
import {
  getAllDrillStats,
  getDrillPerformanceSummary,
  getDrillProgress,
  getCategoryBreakdown,
  getDrillsDueForReview,
  getSimulationStats,
  type DrillType,
  type DrillStatistics,
} from '@/services/analytics';

interface DrillStatsDashboardProps {
  onClose?: () => void;
  onStartDrill?: (drillType: DrillType) => void;
}

const DRILL_INFO: Record<DrillType, { label: string; icon: React.ElementType; color: string }> = {
  ecg_drill: { label: 'ECG Interpretation', icon: Activity, color: 'rose' },
  derm_drill: { label: 'Derm Recognition', icon: Brain, color: 'pink' },
  imaging_drill: { label: 'Radiology Review', icon: Brain, color: 'slate' },
  system_drill: { label: 'System Drill', icon: Layers, color: 'indigo' },
  subcategory_drill: { label: 'Subcategory Drill', icon: FolderTree, color: 'violet' },
  condition_drill: { label: 'Condition Deep Dive', icon: Target, color: 'teal' },
  pharmacology: { label: 'Pharmacology Quiz', icon: Beaker, color: 'purple' },
  physiology_drill: { label: 'Physiology Review', icon: Heart, color: 'red' },
  anatomy_review: { label: 'Anatomy Review', icon: Bone, color: 'stone' },
  ventilator_hero: { label: 'Ventilator Management', icon: Wind, color: 'blue' },
  mini_lab: { label: 'Lab Interpretation', icon: Beaker, color: 'emerald' },
  fluid_electrolyte: { label: 'Fluids & Electrolytes', icon: Beaker, color: 'cyan' },
  first_line_treatment: { label: 'First-Line Treatment', icon: Target, color: 'orange' },
  guideline_drill: { label: 'Guidelines & Scoring', icon: Target, color: 'green' },
  rapid_recall: { label: 'Rapid Recall', icon: Flame, color: 'red' },
  code_blue_speed: { label: 'Code Blue Speed', icon: Activity, color: 'red' },
  ddx_compare: { label: 'DDx Compare', icon: Target, color: 'purple' },
  ddx_drill: { label: 'Differential Dx', icon: Activity, color: 'blue' },
  procedure_drill: { label: 'Procedures', icon: Target, color: 'green' },
  history_drill: { label: 'History Taking', icon: Heart, color: 'purple' },
  antibiotic_mode: { label: 'Bug-Drug Match', icon: Beaker, color: 'teal' },
  polypharmacy_puzzle: { label: 'Polypharmacy Puzzle', icon: Droplets, color: 'amber' },
};

const DrillStatsDashboard: React.FC<DrillStatsDashboardProps> = ({ onClose, onStartDrill }) => {
  const [expandedDrill, setExpandedDrill] = useState<DrillType | null>(null);
  const [view, setView] = useState<'overview' | 'details'>('overview');

  const allStats = getAllDrillStats();
  const summary = getDrillPerformanceSummary();
  const dueForReview = getDrillsDueForReview();
  const simulationStats = getSimulationStats();

  // Filter drills with activity
  const activeDrills = useMemo(() => {
    return Object.entries(allStats).filter(([_, stats]) => stats.totalSessions > 0);
  }, [allStats]);

  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const getDifficultyBadge = (difficulty: 'easy' | 'medium' | 'hard') => {
    const colors = {
      easy: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
      medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      hard: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    };
    return (
      <span className={`text-xs px-2 py-1 rounded-full font-medium ${colors[difficulty]}`}>
        {difficulty}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-6xl max-h-[90vh] bg-[var(--color-bg-primary)] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <h2 className="text-xl font-bold text-[var(--color-text-primary)]">
              Drill Performance Dashboard
            </h2>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            Close
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Overall Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)] p-5">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <span className="text-sm text-[var(--color-text-muted)]">Active Drills</span>
              </div>
              <div className="text-3xl font-bold text-[var(--color-text-primary)]">
                {summary.totalDrills}
              </div>
            </div>

            <div className="bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)] p-5">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-sm text-[var(--color-text-muted)]">Total Sessions</span>
              </div>
              <div className="text-3xl font-bold text-[var(--color-text-primary)]">
                {summary.totalSessions}
              </div>
            </div>

            <div className="bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)] p-5">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                <span className="text-sm text-[var(--color-text-muted)]">Avg Accuracy</span>
              </div>
              <div className="text-3xl font-bold text-[var(--color-text-primary)]">
                {summary.averageAccuracy}%
              </div>
            </div>

            <div className="bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)] p-5">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                <span className="text-sm text-[var(--color-text-muted)]">Time Invested</span>
              </div>
              <div className="text-3xl font-bold text-[var(--color-text-primary)]">
                {formatTime(summary.totalTime)}
              </div>
            </div>
          </div>

          {/* Due for Review */}
          {dueForReview.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-5 mb-8">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                <h3 className="font-semibold text-amber-900 dark:text-amber-200">
                  Due for Review ({dueForReview.length})
                </h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {dueForReview.map((drillType) => {
                  const info = DRILL_INFO[drillType];
                  return (
                    <button
                      key={drillType}
                      onClick={() => onStartDrill?.(drillType)}
                      className="px-3 py-1.5 bg-white dark:bg-slate-800 rounded-lg text-sm font-medium text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
                    >
                      {info?.label || drillType}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Clinical Simulations Section */}
          {(simulationStats.codeBlue.hasActivity ||
            simulationStats.fluids.hasActivity ||
            simulationStats.antibiotics.hasActivity) && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Clinical Simulations
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Code Blue Speed Mode */}
                {simulationStats.codeBlue.hasActivity && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0 }}
                    className="bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)] p-5 hover:shadow-lg hover:border-red-300 dark:hover:border-red-700 transition-all duration-300 cursor-pointer"
                    onClick={() => onStartDrill?.('code_blue_speed')}
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2.5 rounded-lg bg-red-100 dark:bg-red-900/20">
                        <HeartPulse className="w-5 h-5 text-red-600 dark:text-red-400" />
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] font-medium">
                          Resuscitation
                        </div>
                        <div className="text-sm font-semibold text-[var(--color-text-primary)]">
                          Code Blue
                        </div>
                      </div>
                    </div>
                    <div className="mb-2">
                      <div className="text-3xl font-bold text-red-600 dark:text-red-400">
                        {simulationStats.codeBlue.survivalRate}%
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)] mt-1">
                        Survival Rate
                      </div>
                    </div>
                    {simulationStats.codeBlue.bestTime && (
                      <div className="text-xs text-[var(--color-text-secondary)] mt-3 pt-3 border-t border-[var(--color-border)]">
                        Best Time: {Math.round(simulationStats.codeBlue.bestTime)}s
                      </div>
                    )}
                    {!simulationStats.codeBlue.bestTime && (
                      <div className="text-xs text-[var(--color-text-muted)] mt-3 pt-3 border-t border-[var(--color-border)]">
                        {simulationStats.codeBlue.totalAttempts}{' '}
                        {simulationStats.codeBlue.totalAttempts === 1 ? 'case' : 'cases'} attempted
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Fluids & Electrolytes Mode */}
                {simulationStats.fluids.hasActivity && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)] p-5 hover:shadow-lg hover:border-cyan-300 dark:hover:border-cyan-700 transition-all duration-300 cursor-pointer"
                    onClick={() => onStartDrill?.('fluid_electrolyte')}
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2.5 rounded-lg bg-cyan-100 dark:bg-cyan-900/20">
                        <Droplets className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] font-medium">
                          Nephrology
                        </div>
                        <div className="text-sm font-semibold text-[var(--color-text-primary)]">
                          Fluids & Lytes
                        </div>
                      </div>
                    </div>
                    <div className="mb-2">
                      <div className="text-3xl font-bold text-cyan-600 dark:text-cyan-400">
                        {simulationStats.fluids.casesSolved}
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)] mt-1">
                        Cases Managed
                      </div>
                    </div>
                    <div className="text-xs text-[var(--color-text-secondary)] mt-3 pt-3 border-t border-[var(--color-border)]">
                      {simulationStats.fluids.averageAccuracy}% accuracy
                    </div>
                  </motion.div>
                )}

                {/* Antibiotic Coverage Mode */}
                {simulationStats.antibiotics.hasActivity && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)] p-5 hover:shadow-lg hover:border-teal-300 dark:hover:border-teal-700 transition-all duration-300 cursor-pointer"
                    onClick={() => onStartDrill?.('antibiotic_mode')}
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2.5 rounded-lg bg-teal-100 dark:bg-teal-900/20">
                        <Bug className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] font-medium">
                          Infectious Disease
                        </div>
                        <div className="text-sm font-semibold text-[var(--color-text-primary)]">
                          Antibiotics
                        </div>
                      </div>
                    </div>
                    <div className="mb-2">
                      <div className="text-3xl font-bold text-teal-600 dark:text-teal-400">
                        {simulationStats.antibiotics.coverageMastery}%
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)] mt-1">
                        Coverage Mastery
                      </div>
                    </div>
                    <div className="text-xs text-[var(--color-text-secondary)] mt-3 pt-3 border-t border-[var(--color-border)]">
                      {simulationStats.antibiotics.totalChallenges}{' '}
                      {simulationStats.antibiotics.totalChallenges === 1
                        ? 'challenge'
                        : 'challenges'}{' '}
                      completed
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          )}

          {/* Individual Drill Cards */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-3">
              Drill Performance
            </h3>

            {activeDrills.length === 0 ? (
              <div className="text-center py-12 text-[var(--color-text-muted)]">
                <BarChart3 className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>No drill activity yet. Start practicing to see your stats!</p>
              </div>
            ) : (
              activeDrills.map(([drillType, stats]) => {
                const info = DRILL_INFO[drillType as DrillType];
                const Icon = info?.icon || Target;
                const progress = getDrillProgress(drillType as DrillType);
                const isExpanded = expandedDrill === drillType;

                return (
                  <motion.div
                    key={drillType}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)] overflow-hidden"
                  >
                    <button
                      onClick={() => setExpandedDrill(isExpanded ? null : (drillType as DrillType))}
                      className="w-full p-5 flex items-center gap-4 hover:bg-[var(--color-bg-tertiary)] transition-colors"
                    >
                      <div
                        className={`p-3 rounded-lg bg-${info?.color}-100 dark:bg-${info?.color}-900/20`}
                      >
                        <Icon
                          className={`w-6 h-6 text-${info?.color}-600 dark:text-${info?.color}-400`}
                        />
                      </div>

                      <div className="flex-1 text-left">
                        <div className="flex items-center gap-3 mb-1">
                          <h4 className="font-semibold text-[var(--color-text-primary)]">
                            {info?.label || drillType}
                          </h4>
                          {getDifficultyBadge(stats.currentDifficulty)}
                        </div>
                        <div className="flex items-center gap-6 text-sm text-[var(--color-text-muted)]">
                          <span>{stats.totalSessions} sessions</span>
                          <span>{stats.totalAttempts} questions</span>
                          <span className="font-semibold">
                            {stats.averageAccuracy.toFixed(0)}% avg
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-2xl font-bold text-[var(--color-text-primary)]">
                            {progress.masteryLevel}
                          </div>
                          <div className="text-xs text-[var(--color-text-muted)]">mastery</div>
                        </div>
                        {isExpanded ? (
                          <ChevronDown className="w-5 h-5 text-[var(--color-text-muted)]" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-[var(--color-text-muted)]" />
                        )}
                      </div>
                    </button>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="border-t border-[var(--color-border)] overflow-hidden"
                        >
                          <div className="p-5 space-y-4">
                            {/* Detailed Stats */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              <div>
                                <div className="text-xs text-[var(--color-text-muted)] mb-1">
                                  Best Accuracy
                                </div>
                                <div className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">
                                  {stats.bestAccuracy.toFixed(0)}%
                                </div>
                              </div>
                              <div>
                                <div className="text-xs text-[var(--color-text-muted)] mb-1">
                                  Best Streak
                                </div>
                                <div className="text-lg font-semibold text-orange-600 dark:text-orange-400 flex items-center gap-1">
                                  <Flame className="w-4 h-4" />
                                  {stats.bestStreak}
                                </div>
                              </div>
                              <div>
                                <div className="text-xs text-[var(--color-text-muted)] mb-1">
                                  Time Spent
                                </div>
                                <div className="text-lg font-semibold text-[var(--color-text-primary)]">
                                  {formatTime(stats.totalTimeSpent)}
                                </div>
                              </div>
                              <div>
                                <div className="text-xs text-[var(--color-text-muted)] mb-1">
                                  Last Practiced
                                </div>
                                <div className="text-lg font-semibold text-[var(--color-text-primary)]">
                                  {formatDate(stats.lastAttempted)}
                                </div>
                              </div>
                            </div>

                            {/* Milestones */}
                            <div>
                              <div className="text-sm font-semibold text-[var(--color-text-primary)] mb-2 flex items-center gap-2">
                                <Award className="w-4 h-4" />
                                Milestones
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {Object.entries(progress.milestones).map(([key, achieved]) => {
                                  if (!achieved) return null;
                                  const labels: Record<string, string> = {
                                    sessions10: '10 Sessions',
                                    sessions25: '25 Sessions',
                                    sessions50: '50 Sessions',
                                    sessions100: '100 Sessions',
                                    accuracy80: '80% Accuracy',
                                    accuracy90: '90% Accuracy',
                                    accuracy95: '95% Accuracy',
                                    streak10: '10 Streak',
                                    streak25: '25 Streak',
                                    streak50: '50 Streak',
                                  };
                                  return (
                                    <span
                                      key={key}
                                      className="text-xs px-2 py-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-full font-medium"
                                    >
                                      ✓ {labels[key]}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Category Breakdown for System/Subcategory drills */}
                            {(drillType === 'system_drill' ||
                              drillType === 'subcategory_drill') && (
                              <div>
                                <div className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">
                                  Category Breakdown
                                </div>
                                <div className="space-y-2">
                                  {getCategoryBreakdown(
                                    drillType as 'system_drill' | 'subcategory_drill'
                                  )
                                    .slice(0, 5)
                                    .map((cat) => (
                                      <div
                                        key={cat.category}
                                        className="flex items-center justify-between text-sm"
                                      >
                                        <span className="text-[var(--color-text-secondary)]">
                                          {cat.category}
                                        </span>
                                        <div className="flex items-center gap-3">
                                          <span className="text-xs text-[var(--color-text-muted)]">
                                            {cat.attempts} attempts
                                          </span>
                                          <span className="font-semibold text-[var(--color-text-primary)]">
                                            {cat.accuracy}%
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                </div>
                              </div>
                            )}

                            {/* Action Button */}
                            <button
                              onClick={() => {
                                onStartDrill?.(drillType as DrillType);
                                onClose?.();
                              }}
                              className={`w-full px-4 py-2.5 bg-${info?.color}-600 hover:bg-${info?.color}-500 text-white rounded-lg font-medium transition-colors`}
                            >
                              Practice Now
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default DrillStatsDashboard;
