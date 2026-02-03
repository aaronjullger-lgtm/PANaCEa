/**
 * UserFriendlyStatsDisplay
 *
 * A clean, intuitive display of analytics that regular users can understand.
 * Shows actionable insights without overwhelming with data.
 *
 * PHASE 1 FIX: Refactored to use /api/user/stats as single source of truth
 * instead of IndexedDB functions (generateUserFriendlyStats, assessTestReadiness).
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
  Clock,
  Brain,
  Zap,
  Calendar,
  Award,
  AlertCircle,
  CheckCircle,
  ChevronRight,
  Lightbulb,
  BookOpen,
  Timer,
  Flame,
  BarChart2,
  Activity,
  RefreshCw,
  Coffee,
} from 'lucide-react';
import { getApiEndpoint } from '@/lib/utils/apiConfig';
import { UserStatsOverviewSkeleton } from '@/components/loading';
import { getSpeedBenchmarkLabel } from '@/lib/speedBenchmarks';

// ============================================================================
// Types - Server Response
// ============================================================================

interface UserStatsResponse {
  success: boolean;
  stats: {
    overall: {
      totalAttempts: number;
      correctAttempts: number;
      accuracy: number;
      questionsSeenCount: number;
      currentStreak: number;
      totalStudyDays: number;
      avgTimeMs: number | null;
      avgAnswerChanges: number | null;
    };
    bySystems: Record<
      string,
      {
        total: number;
        correct: number;
        accuracy: number;
        trend: 'improving' | 'declining' | 'neutral';
        avgTimeMs: number | null;
        lastAttempt: string | null;
      }
    >;
    byConditions: Array<{
      conditionId: string;
      total: number;
      correct: number;
      accuracy: number;
    }>;
    weakAreas: Array<{
      system: string;
      accuracy: number;
      attempts: number;
      trend: 'improving' | 'declining' | 'neutral';
    }>;
    strongAreas: Array<{
      system: string;
      accuracy: number;
      attempts: number;
    }>;
    weakConditions: Array<{
      conditionId: string;
      total: number;
      correct: number;
      accuracy: number;
    }>;
    recentPerformance: {
      last7Days: {
        attempts: number;
        accuracy: number | null;
      };
      previous7Days: {
        attempts: number;
        accuracy: number | null;
      };
      trend: 'improving' | 'declining' | 'stable' | 'insufficient_data';
    };
    recommendations: string[];
  };
}

// ============================================================================
// Types - Component Props
// ============================================================================

interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: string;
  color?: 'blue' | 'green' | 'amber' | 'red' | 'purple';
}

// ============================================================================
// Sub-Components
// ============================================================================

const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subtext,
  icon,
  trend,
  trendValue,
  color = 'blue',
}) => {
  const colorClasses = {
    blue: 'bg-action-muted text-action-primary border-action-primary/20',
    green: 'bg-success-muted text-success-primary border-success-primary/20',
    amber: 'bg-warning-muted text-warning-primary border-warning-primary/20',
    red: 'bg-error-muted text-error-primary border-error-primary/20',
    purple: 'bg-action-muted text-action-primary border-action-primary/20',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-surface-card border border-border-subtle rounded-xl p-4"
    >
      <div className="flex items-start justify-between">
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>{icon}</div>
        {trend && (
          <div
            className={`flex items-center gap-1 text-xs font-medium ${
              trend === 'up'
                ? 'text-success-primary'
                : trend === 'down'
                  ? 'text-error-primary'
                  : 'text-text-muted'
            }`}
          >
            {trend === 'up' ? (
              <TrendingUp className="w-3 h-3" />
            ) : trend === 'down' ? (
              <TrendingDown className="w-3 h-3" />
            ) : (
              <Minus className="w-3 h-3" />
            )}
            {trendValue}
          </div>
        )}
      </div>
      <div className="mt-3">
        <p className="text-2xl font-bold text-text-primary">{value}</p>
        <p className="text-sm text-text-muted">{label}</p>
        {subtext && <p className="text-xs text-text-secondary mt-1">{subtext}</p>}
      </div>
    </motion.div>
  );
};

const InsightCard: React.FC<{ insight: string; index: number }> = ({ insight, index }) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      className="flex items-start gap-3 p-3 bg-surface-primary rounded-lg"
    >
      <Lightbulb className="w-5 h-5 text-action-primary flex-shrink-0 mt-0.5" />
      <p className="text-sm text-text-primary leading-relaxed">{insight}</p>
    </motion.div>
  );
};

const ReadinessGauge: React.FC<{
  score: number;
  passProbability: number;
  hasData?: boolean;
}> = ({ score, passProbability, hasData = true }) => {
  const safeScore = isNaN(score) || !isFinite(score) ? 0 : Math.min(100, Math.max(0, score));
  const safePassProb =
    isNaN(passProbability) || !isFinite(passProbability)
      ? 0
      : Math.min(100, Math.max(0, passProbability));

  const getColor = (s: number) => {
    if (s >= 80) return 'var(--color-success)';
    if (s >= 60) return 'var(--color-accent)';
    return 'var(--color-warning)';
  };

  const getLabel = (s: number) => {
    if (s >= 80) return 'Ready';
    if (s >= 65) return 'Almost Ready';
    if (s >= 50) return 'Progressing';
    if (s >= 30) return 'Building';
    return 'Getting Started';
  };

  return (
    <div className="bg-surface-card border border-border-subtle rounded-xl p-5">
      <h3 className="text-sm font-medium text-text-muted mb-4 flex items-center gap-2">
        <Target className="w-4 h-4" />
        Exam Readiness
      </h3>

      <div className="flex items-center gap-6">
        <div className="relative w-24 h-24">
          <svg className="w-24 h-24 -rotate-90">
            <circle
              cx="48"
              cy="48"
              r="40"
              fill="none"
              stroke="var(--color-surface)"
              strokeWidth="8"
            />
            <motion.circle
              cx="48"
              cy="48"
              r="40"
              fill="none"
              stroke={getColor(safeScore)}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={251.2}
              initial={{ strokeDashoffset: 251.2 }}
              animate={{ strokeDashoffset: 251.2 - (251.2 * safeScore) / 100 }}
              transition={{ duration: 1, ease: 'easeOut' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {hasData ? (
              <>
                <span className="text-2xl font-bold text-text-primary">{safeScore}</span>
                <span className="text-xs text-text-muted">/ 100</span>
              </>
            ) : (
              <span className="text-xl font-bold text-text-muted">—</span>
            )}
          </div>
        </div>

        <div className="flex-1">
          <p
            className="text-lg font-semibold text-text-primary"
            style={{ color: hasData ? getColor(safeScore) : undefined }}
          >
            {hasData ? getLabel(safeScore) : 'Waiting for first session'}
          </p>
          <p className="text-sm text-text-muted mt-1">
            {hasData
              ? `${safePassProb}% estimated pass probability`
              : 'Complete questions to see readiness'}
          </p>
          {hasData && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-text-muted">Pass Probability</span>
                <span className="font-medium text-text-primary">{safePassProb}%</span>
              </div>
              <div className="h-2 bg-surface-primary rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${safePassProb}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: getColor(safePassProb) }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const SystemStrengthBar: React.FC<{
  system: string;
  mastery: number;
  trend: 'improving' | 'declining' | 'neutral';
  isStrength: boolean;
}> = ({ system, mastery, trend, isStrength }) => {
  const getBarColor = (m: number) => {
    if (m >= 80) return 'bg-success-primary';
    if (m >= 60) return 'bg-action-primary';
    if (m >= 40) return 'bg-warning-primary';
    return 'bg-error-primary';
  };

  return (
    <div className="flex items-center gap-3">
      <div className="w-20 text-xs font-medium text-text-primary truncate">{system}</div>
      <div className="flex-1 h-2 bg-surface-primary rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${mastery}%` }}
          transition={{ duration: 0.5 }}
          className={`h-full rounded-full ${getBarColor(mastery)}`}
        />
      </div>
      <div className="w-10 text-xs font-medium text-right text-text-primary">{mastery}%</div>
      <div
        className={`w-4 ${
          trend === 'improving'
            ? 'text-success-primary'
            : trend === 'declining'
              ? 'text-error-primary'
              : 'text-text-muted'
        }`}
      >
        {trend === 'improving' ? (
          <TrendingUp className="w-4 h-4" />
        ) : trend === 'declining' ? (
          <TrendingDown className="w-4 h-4" />
        ) : (
          <Minus className="w-4 h-4" />
        )}
      </div>
    </div>
  );
};

const RecommendationCard: React.FC<{ recommendation: string; index: number }> = ({
  recommendation,
  index,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="border border-action-primary/30 bg-action-muted/50 rounded-xl p-4"
    >
      <div className="flex items-start gap-3">
        <Lightbulb className="w-5 h-5 text-action-primary flex-shrink-0 mt-0.5" />
        <p className="font-medium text-text-primary text-sm">{recommendation}</p>
      </div>
    </motion.div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const UserFriendlyStatsDisplay: React.FC = () => {
  const [userStats, setUserStats] = useState<UserStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'insights' | 'systems'>('overview');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(getApiEndpoint('/api/user/stats'), {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch stats: ${response.statusText}`);
      }

      const data = await response.json();
      setUserStats(data);
    } catch (err) {
      console.error('Failed to load analytics:', err);
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  // Transform server data for display
  const displayData = useMemo(() => {
    if (!userStats?.stats) return null;

    const { overall, bySystems, weakAreas, strongAreas, recentPerformance, recommendations } =
      userStats.stats;

    // Calculate readiness score based on overall performance
    const readinessScore = Math.min(
      100,
      Math.max(0, Math.round(overall.accuracy * 0.7 + (overall.currentStreak / 30) * 30))
    );
    const passProbability = Math.min(100, Math.max(0, Math.round((overall.accuracy - 40) * 1.67)));

    // Calculate predicted PANCE score (200-800 scale)
    const predictedScore = Math.min(800, Math.max(200, 200 + overall.accuracy * 6));

    // Calculate trends
    const last7Acc = recentPerformance.last7Days.accuracy ?? overall.accuracy;
    const prev7Acc = recentPerformance.previous7Days.accuracy ?? overall.accuracy;
    const accuracyChange = last7Acc - prev7Acc;
    const accuracyTrend =
      accuracyChange > 5 ? 'improving' : accuracyChange < -5 ? 'declining' : 'stable';

    // Calculate avg time in seconds
    const avgTimeSeconds = overall.avgTimeMs ? Math.round(overall.avgTimeMs / 1000) : 0;

    // Calculate total study hours
    const totalStudyHours =
      overall.avgTimeMs && overall.totalAttempts > 0
        ? Math.round((overall.avgTimeMs * overall.totalAttempts) / (1000 * 60 * 60))
        : 0;

    // Calculate questions per hour
    const questionsPerHour =
      overall.avgTimeMs && overall.avgTimeMs > 0 ? Math.round(3600000 / overall.avgTimeMs) : 0;

    // Transform systems for display
    const systemsArray = Object.entries(bySystems).map(([system, stats]) => ({
      system,
      mastery: stats.accuracy,
      trend:
        stats.trend === 'improving'
          ? 'improving'
          : stats.trend === 'declining'
            ? 'declining'
            : ('neutral' as const),
      total: stats.total,
    }));

    const strengths = systemsArray
      .filter((s) => s.mastery >= 70 && s.total >= 10)
      .sort((a, b) => b.mastery - a.mastery);

    const weaknesses = systemsArray
      .filter((s) => s.mastery < 70 && s.total >= 5)
      .sort((a, b) => a.mastery - b.mastery);

    const improving = systemsArray
      .filter((s) => s.trend === 'improving' && s.total >= 10)
      .sort((a, b) => b.mastery - a.mastery);

    const declining = systemsArray
      .filter((s) => s.trend === 'declining' && s.total >= 10)
      .sort((a, b) => a.mastery - b.mastery);

    const hasData = overall.totalAttempts > 0;

    return {
      hasData,
      readinessScore,
      passProbability,
      predictedScore,
      scoreRange: {
        low: Math.max(200, predictedScore - 50),
        high: Math.min(800, predictedScore + 50),
      },
      accuracyLifetime: overall.accuracy,
      accuracyChange: Math.round(accuracyChange),
      accuracyTrend,
      studyDaysStreak: overall.currentStreak,
      totalQuestionsLifetime: overall.totalAttempts,
      last7DaysQuestions: recentPerformance.last7Days.attempts,
      avgTimePerQuestion: avgTimeSeconds,
      totalStudyHours,
      questionsPerHour,
      hasEnoughDataForInsights: overall.totalAttempts >= 50,
      topInsights: recommendations.slice(0, 3),
      weakAreas: weakAreas.map((w) => w.system),
      strongAreas: strongAreas.map((s) => s.system),
      recommendations: recommendations,
      systems: {
        strengths,
        weaknesses,
        improving,
        declining,
      },
      // Placeholder values for features not yet in server
      firstInstinctAccuracy: null,
      answerChangeHelpfulness: null,
      shouldTrustFirstInstinct: null,
      bestStudyTime: null,
      fatiguePoint: null,
      optimalBreakFrequency: null,
    };
  }, [userStats]);

  if (loading) {
    return (
      <div className="space-y-6">
        <UserStatsOverviewSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6 text-center">
        <AlertCircle className="w-12 h-12 mx-auto text-[var(--color-data-fail)] mb-3" aria-hidden />
        <p className="font-medium text-[var(--color-text-primary)]">Failed to load analytics</p>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">{error}</p>
        <button
          onClick={loadData}
          className="mt-4 px-4 py-2 rounded-lg font-medium bg-[var(--color-accent)] text-[var(--color-text-inverse)] hover:opacity-90 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!displayData || !userStats) {
    return (
      <div className="text-center py-12 px-4">
        <BookOpen className="w-12 h-12 mx-auto text-text-muted mb-3" />
        <p className="text-text-primary font-medium">Not yet assessed</p>
        <p className="text-sm text-text-muted mt-1 mb-4 max-w-sm mx-auto">
          Your personalized analytics will appear here after you answer questions.
        </p>
        <button
          type="button"
          onClick={() => window.location.assign('/study/main-session')}
          className="px-4 py-2.5 rounded-xl bg-action-primary text-white text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Take a 10-question diagnostic quiz to unlock your analytics
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex gap-2 bg-surface-primary p-1 rounded-xl">
        {[
          { id: 'overview', label: 'Overview', icon: BarChart2 },
          { id: 'insights', label: 'Insights', icon: Lightbulb },
          { id: 'systems', label: 'Systems', icon: Activity },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-surface-card text-text-primary shadow-sm'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Readiness Gauge */}
            <ReadinessGauge
              score={displayData.readinessScore}
              passProbability={displayData.passProbability}
              hasData={displayData.hasData}
            />

            {/* Key Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                label="Lifetime Accuracy"
                value={displayData.hasData ? `${displayData.accuracyLifetime}%` : '—'}
                icon={<Target className="w-5 h-5" />}
                trend={
                  displayData.accuracyTrend === 'improving'
                    ? 'up'
                    : displayData.accuracyTrend === 'declining'
                      ? 'down'
                      : 'stable'
                }
                trendValue={`${displayData.accuracyChange > 0 ? '+' : ''}${displayData.accuracyChange}%`}
                color={
                  displayData.accuracyLifetime >= 80
                    ? 'green'
                    : displayData.accuracyLifetime >= 60
                      ? 'blue'
                      : 'amber'
                }
              />

              <StatCard
                label="Study Streak"
                value={displayData.studyDaysStreak}
                subtext="consecutive days"
                icon={<Flame className="w-5 h-5" />}
                color={
                  displayData.studyDaysStreak >= 7
                    ? 'green'
                    : displayData.studyDaysStreak >= 3
                      ? 'amber'
                      : 'blue'
                }
              />

              <StatCard
                label="Total Questions"
                value={displayData.totalQuestionsLifetime.toLocaleString()}
                subtext={`${displayData.last7DaysQuestions} this week`}
                icon={<BookOpen className="w-5 h-5" />}
                color="purple"
              />

              <StatCard
                label="Predicted Score"
                value={displayData.predictedScore}
                subtext={`${displayData.scoreRange.low}-${displayData.scoreRange.high} range`}
                icon={<Award className="w-5 h-5" />}
                color={
                  displayData.predictedScore >= 500
                    ? 'green'
                    : displayData.predictedScore >= 450
                      ? 'blue'
                      : 'amber'
                }
              />
            </div>

            {/* Quick Stats Row */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-surface-card border border-border-subtle rounded-xl p-4 text-center">
                <Clock className="w-5 h-5 mx-auto text-text-muted mb-2" />
                <p className="text-lg font-bold text-text-primary">
                  {userStats?.stats?.overall?.avgTimeMs
                    ? getSpeedBenchmarkLabel(userStats.stats.overall.avgTimeMs).primary
                    : '—'}
                </p>
                <p className="text-xs text-text-muted">
                  {userStats?.stats?.overall?.avgTimeMs
                    ? getSpeedBenchmarkLabel(userStats.stats.overall.avgTimeMs).benchmark ||
                      'avg per question'
                    : 'avg per question'}
                </p>
              </div>

              <div className="bg-surface-card border border-border-subtle rounded-xl p-4 text-center">
                <Timer className="w-5 h-5 mx-auto text-text-muted mb-2" />
                <p className="text-lg font-bold text-text-primary">
                  {displayData.totalStudyHours}h
                </p>
                <p className="text-xs text-text-muted">total study time</p>
              </div>

              <div className="bg-surface-card border border-border-subtle rounded-xl p-4 text-center">
                <Zap className="w-5 h-5 mx-auto text-text-muted mb-2" />
                <p className="text-lg font-bold text-text-primary">
                  {displayData.questionsPerHour === 0 ? '--' : displayData.questionsPerHour}
                </p>
                <p className="text-xs text-text-muted">questions/hour</p>
              </div>
            </div>

            {/* Top Insights */}
            {displayData.topInsights.length > 0 && (
              <div className="bg-surface-card border border-border-subtle rounded-xl p-5">
                <h3 className="text-sm font-medium text-text-muted mb-4 flex items-center gap-2">
                  <Lightbulb className="w-4 h-4" />
                  Key Insights
                </h3>
                <div className="space-y-3">
                  {displayData.topInsights.map((insight, i) => (
                    <InsightCard key={i} insight={insight} index={i} />
                  ))}
                </div>
              </div>
            )}

            {/* Behavioral Patterns */}
            {displayData.hasEnoughDataForInsights ? (
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-surface-card border border-border-subtle rounded-xl p-5">
                  <h3 className="text-sm font-medium text-text-muted mb-4 flex items-center gap-2">
                    <Brain className="w-4 h-4" />
                    Study Progress
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-text-secondary">Questions Completed</span>
                      <span className="font-medium text-text-primary">
                        {displayData.totalQuestionsLifetime}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-text-secondary">Study Days</span>
                      <span className="font-medium text-text-primary">
                        {userStats.stats.overall.totalStudyDays}
                      </span>
                    </div>
                    <div className="p-3 rounded-lg bg-action-muted text-action-primary text-sm flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 flex-shrink-0" />
                      <span>Great progress! Keep building your knowledge base.</span>
                    </div>
                  </div>
                </div>

                <div className="bg-surface-card border border-border-subtle rounded-xl p-5">
                  <h3 className="text-sm font-medium text-text-muted mb-4 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Performance Trend
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-text-secondary">Last 7 Days</span>
                      <span className="font-medium text-text-primary">
                        {displayData.last7DaysQuestions} questions
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-text-secondary">Recent Accuracy</span>
                      <span className="font-medium text-text-primary">
                        {userStats.stats.recentPerformance.last7Days.accuracy ??
                          displayData.accuracyLifetime}
                        %
                      </span>
                    </div>
                    {userStats.stats.recentPerformance.trend !== 'insufficient_data' && (
                      <div
                        className={`p-3 rounded-lg text-sm flex items-center gap-2 ${
                          userStats.stats.recentPerformance.trend === 'improving'
                            ? 'bg-success-muted text-success-primary'
                            : userStats.stats.recentPerformance.trend === 'declining'
                              ? 'bg-warning-muted text-warning-primary'
                              : 'bg-action-muted text-action-primary'
                        }`}
                      >
                        <Activity className="w-4 h-4 flex-shrink-0" />
                        <span>
                          {userStats.stats.recentPerformance.trend === 'improving'
                            ? "You're on an upward trajectory!"
                            : userStats.stats.recentPerformance.trend === 'declining'
                              ? 'Consider reviewing fundamentals'
                              : 'Steady performance'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-surface-card border border-border-subtle rounded-xl p-6 text-center">
                <Brain className="w-8 h-8 mx-auto text-text-muted mb-3" />
                <h3 className="text-sm font-medium text-text-primary mb-2">
                  Building Your Profile
                </h3>
                <p className="text-sm text-text-muted">
                  Complete at least 50 questions to unlock personalized insights about your
                  test-taking patterns, optimal study times, and break recommendations.
                </p>
                <p className="text-xs text-text-secondary mt-2">
                  {displayData.totalQuestionsLifetime} / 50 questions completed
                </p>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'insights' && (
          <motion.div
            key="insights"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div className="bg-surface-card border border-border-subtle rounded-xl p-5">
              <h3 className="text-sm font-medium text-text-muted mb-2">
                Personalized Recommendations
              </h3>
              <p className="text-xs text-text-secondary mb-4">
                Based on your study patterns and performance
              </p>
              <div className="space-y-3">
                {displayData.recommendations.map((rec, i) => (
                  <RecommendationCard key={i} recommendation={rec} index={i} />
                ))}
              </div>
            </div>

            {/* Priority Areas */}
            {displayData.weakAreas.length > 0 && (
              <div className="bg-surface-card border border-border-subtle rounded-xl p-5">
                <h3 className="text-sm font-medium text-text-muted mb-4 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Priority Study Areas
                </h3>
                <div className="flex flex-wrap gap-2">
                  {displayData.weakAreas.map((area) => (
                    <span
                      key={area}
                      className="px-3 py-1.5 bg-warning-muted text-warning-primary rounded-full text-sm font-medium"
                    >
                      {area}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Strengths */}
            {displayData.strongAreas.length > 0 && (
              <div className="bg-surface-card border border-border-subtle rounded-xl p-5">
                <h3 className="text-sm font-medium text-text-muted mb-4 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Strengths to Maintain
                </h3>
                <div className="flex flex-wrap gap-2">
                  {displayData.strongAreas.map((strength) => (
                    <span
                      key={strength}
                      className="px-3 py-1.5 bg-success-muted text-success-primary rounded-full text-sm font-medium"
                    >
                      {strength}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Readiness Timeline */}
            <div className="bg-surface-secondary border border-border-subtle rounded-xl p-5">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-surface-tertiary rounded-xl">
                  <Calendar className="w-6 h-6 text-text-muted" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-text-primary">
                    {displayData.readinessScore >= 80
                      ? "You're Ready!"
                      : `${Math.ceil((80 - displayData.readinessScore) / 2)} days`}
                  </p>
                  <p className="text-sm text-text-muted">
                    {displayData.readinessScore >= 80
                      ? "You've reached your target readiness level"
                      : 'estimated to reach readiness'}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'systems' && (
          <motion.div
            key="systems"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Strengths */}
            {displayData.systems.strengths.length > 0 && (
              <div className="bg-surface-card border border-border-subtle rounded-xl p-5">
                <h3 className="text-sm font-medium text-text-primary mb-4 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Your Strengths ({displayData.systems.strengths.length})
                </h3>
                <div className="space-y-3">
                  {displayData.systems.strengths.slice(0, 5).map((sys) => (
                    <SystemStrengthBar
                      key={sys.system}
                      system={sys.system}
                      mastery={sys.mastery}
                      trend={sys.trend as 'improving' | 'declining' | 'neutral'}
                      isStrength
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Weaknesses */}
            {displayData.systems.weaknesses.length > 0 && (
              <div className="bg-surface-card border border-border-subtle rounded-xl p-5">
                <h3 className="text-sm font-medium text-text-muted mb-4 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Areas to Improve ({displayData.systems.weaknesses.length})
                </h3>
                <div className="space-y-3">
                  {displayData.systems.weaknesses.slice(0, 5).map((sys) => (
                    <SystemStrengthBar
                      key={sys.system}
                      system={sys.system}
                      mastery={sys.mastery}
                      trend={sys.trend as 'improving' | 'declining' | 'neutral'}
                      isStrength={false}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Improving */}
            {displayData.systems.improving.length > 0 && (
              <div className="bg-surface-card border border-border-subtle rounded-xl p-5">
                <h3 className="text-sm font-medium text-text-muted mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Rapidly Improving ({displayData.systems.improving.length})
                </h3>
                <div className="space-y-3">
                  {displayData.systems.improving.slice(0, 3).map((sys) => (
                    <SystemStrengthBar
                      key={sys.system}
                      system={sys.system}
                      mastery={sys.mastery}
                      trend={sys.trend as 'improving' | 'declining' | 'neutral'}
                      isStrength
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Declining */}
            {displayData.systems.declining.length > 0 && (
              <div className="bg-surface-card border border-border-subtle rounded-xl p-5">
                <h3 className="text-sm font-medium text-text-muted mb-4 flex items-center gap-2">
                  <TrendingDown className="w-4 h-4" />
                  Needs Review ({displayData.systems.declining.length})
                </h3>
                <div className="space-y-3">
                  {displayData.systems.declining.slice(0, 3).map((sys) => (
                    <SystemStrengthBar
                      key={sys.system}
                      system={sys.system}
                      mastery={sys.mastery}
                      trend={sys.trend as 'improving' | 'declining' | 'neutral'}
                      isStrength={false}
                    />
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Refresh Button */}
      <div className="flex justify-center">
        <button
          onClick={loadData}
          className="flex items-center gap-2 px-4 py-2 text-sm text-text-muted hover:text-text-primary transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh Analytics
        </button>
      </div>
    </div>
  );
};

export default UserFriendlyStatsDisplay;
