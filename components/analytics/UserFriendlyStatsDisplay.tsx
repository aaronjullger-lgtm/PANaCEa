/**
 * UserFriendlyStatsDisplay
 *
 * A clean, intuitive display of analytics that regular users can understand.
 * Shows actionable insights without overwhelming with data.
 *
 * PHASE 1 FIX: Refactored to use /api/user/stats as single source of truth
 * instead of IndexedDB functions (generateUserFriendlyStats, assessTestReadiness).
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@clerk/clerk-react';
import { formatPercentForDisplay } from '@/lib/utils/textFormatting';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import {
  TrendingUp,
  TrendingDown,
  ArrowRight,
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
  Minus,
  Info,
} from 'lucide-react';
import { getApiEndpoint, API_ENDPOINTS } from '@/lib/utils/apiConfig';
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

interface UserFriendlyStatsDisplayProps {
  /** Optional callback to launch a system-specific drill from insight cards */
  onPracticeSystem?: (system: string) => void;
}

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
  const prefersReducedMotion = useReducedMotion();
  const colorClasses = {
    blue: 'bg-[var(--color-bg-tertiary)] text-[var(--color-accent)] border-[var(--color-accent)]/20',
    green: 'bg-[var(--color-data-pass)]/15 text-[var(--color-data-pass)] border-[var(--color-data-pass)]/20',
    amber: 'bg-[var(--color-data-provisional)]/15 text-[var(--color-data-provisional)] border-[var(--color-data-provisional)]/20',
    red: 'bg-[var(--color-data-fail)]/15 text-[var(--color-data-fail)] border-[var(--color-data-fail)]/20',
    purple: 'bg-[var(--color-bg-tertiary)] text-[var(--color-accent)] border-[var(--color-accent)]/20',
  };

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-start justify-between">
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>{icon}</div>
        {trend && (
          <div
            className={`flex items-center gap-1 text-xs font-medium ${
              trend === 'up'
                ? 'text-[var(--color-data-pass)]'
                : trend === 'down'
                  ? 'text-[var(--color-data-fail)]'
                  : 'text-[var(--color-text-muted)]'
            }`}
          >
            {trend === 'up' ? (
              <TrendingUp className="w-3 h-3" />
            ) : trend === 'down' ? (
              <TrendingDown className="w-3 h-3" />
            ) : (
              <>
                <ArrowRight className="w-3 h-3" aria-hidden />
                <span>No change</span>
              </>
            )}
            {trend === 'up' || trend === 'down' ? trendValue : null}
          </div>
        )}
      </div>
      <div className="mt-3">
        <p className="text-xl sm:text-2xl font-bold text-[var(--color-accent)]">{value}</p>
        <p className="text-sm text-[var(--color-text-muted)]">{label}</p>
        {subtext && <p className="text-xs text-[var(--color-text-secondary)] mt-1">{subtext}</p>}
      </div>
    </motion.div>
  );
};

/**
 * Extract the actionable system name (if any) and a CTA label from an insight string.
 *
 * Handled patterns (from /api/user/stats recommendations):
 *   "Focus on Gastrointestinal - currently at 17% accuracy"  → { system: "Gastrointestinal", label: "Practice Gastrointestinal" }
 *   "Try more questions in: Cardiovascular, Pulmonary, Gastrointestinal" → { system: "Cardiovascular", label: "Start drill" }
 *
 * Returns null when there is no specific system to act on.
 */
function extractInsightCTA(insight: string): { system: string; label: string } | null {
  // Pattern 1: "Focus on <System> - ..."
  const focusMatch = insight.match(/^Focus on ([^-–]+?)(?:\s*[-–]|$)/);
  if (focusMatch) {
    const system = focusMatch[1]?.trim();
    if (system) {
      return { system, label: `Practice ${system}` };
    }
  }

  // Pattern 2: "Try more questions in: <System1>, <System2>, ..."
  const tryMoreMatch = insight.match(/^Try more questions in:\s*(.+)$/);
  if (tryMoreMatch) {
    // Use the first listed system as the drill target
    const firstSystem = tryMoreMatch[1]?.split(',')[0]?.trim();
    if (firstSystem) {
      return { system: firstSystem, label: 'Start drill' };
    }
  }

  return null;
}

const InsightCard: React.FC<{
  insight: string;
  index: number;
  onPracticeSystem?: (system: string) => void;
}> = ({ insight, index, onPracticeSystem }) => {
  const prefersReducedMotion = useReducedMotion();
  const cta = onPracticeSystem ? extractInsightCTA(insight) : null;

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={prefersReducedMotion ? { duration: 0 } : { delay: index * 0.1 }}
      className="flex flex-col gap-2 p-3 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)]"
    >
      <div className="flex items-start gap-3">
        <Lightbulb className="w-5 h-5 text-[var(--color-accent)] flex-shrink-0 mt-0.5" aria-hidden />
        <p className="text-sm text-[var(--color-accent)] leading-relaxed">{insight}</p>
      </div>
      {cta && (
        <div className="pl-8">
          <button
            type="button"
            onClick={() => onPracticeSystem!(cta.system)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-accent)]/20 hover:bg-[var(--color-accent)]/20 transition-colors"
          >
            {cta.label}
          </button>
        </div>
      )}
    </motion.div>
  );
};

const ReadinessGauge: React.FC<{
  score: number;
  passProbability: number;
  hasData?: boolean;
}> = ({ score, passProbability, hasData = true }) => {
  const prefersReducedMotion = useReducedMotion();
  const [showInfo, setShowInfo] = useState(false);
  const safeScore = isNaN(score) || !isFinite(score) ? 0 : Math.min(100, Math.max(0, score));
  const safePassProb =
    isNaN(passProbability) || !isFinite(passProbability)
      ? 0
      : Math.min(100, Math.max(0, passProbability));

  const getColor = (s: number) => {
    if (s >= 80) return 'var(--color-data-pass)';
    if (s >= 60) return 'var(--color-action-primary)';
    return 'var(--color-data-provisional)';
  };

  const getLabel = (s: number) => {
    if (s >= 80) return 'Ready';
    if (s >= 65) return 'Almost Ready';
    if (s >= 50) return 'Progressing';
    if (s >= 30) return 'Building';
    return 'Getting Started';
  };

  return (
    <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-5">
      <h3 className="text-sm font-medium text-[var(--color-text-muted)] mb-4 flex items-center gap-2">
        <Target className="w-4 h-4" />
        <div className="relative inline-flex items-center gap-1">
          <span>Exam Readiness</span>
          <button
            type="button"
            onClick={() => setShowInfo(v => !v)}
            className="w-4 h-4 rounded-full text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            aria-label="About this score"
          >
            <Info className="w-4 h-4" />
          </button>
          {showInfo && (
            <div className="absolute bottom-full left-0 z-50 mb-2 w-64 p-3 rounded-xl bg-[var(--color-bg-primary)] border border-[var(--color-border)] shadow-lg text-xs text-[var(--color-text-secondary)]">
              <p className="font-semibold text-[var(--color-text-primary)] mb-1">How is this calculated?</p>
              <p className="mb-2">Your Exam Readiness index (0–100) combines your recent accuracy, total questions answered, and answer recency using an adaptive weighting model.</p>
              <p className="font-medium text-[var(--color-text-primary)] mb-1">Score levels:</p>
              <ul className="space-y-0.5">
                <li>0–29: Getting Started</li>
                <li>30–49: Building</li>
                <li>50–64: Progressing</li>
                <li>65–79: Almost Ready</li>
                <li>80–100: Ready</li>
              </ul>
            </div>
          )}
        </div>
      </h3>

      <div className="flex items-center gap-6">
        <div className="relative w-24 h-24">
          <svg className="w-24 h-24 -rotate-90">
            <circle
              cx="48"
              cy="48"
              r="40"
              fill="none"
              stroke="var(--color-bg-tertiary)"
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
              initial={prefersReducedMotion ? false : { strokeDashoffset: 251.2 }}
              animate={{ strokeDashoffset: 251.2 - (251.2 * safeScore) / 100 }}
              transition={prefersReducedMotion ? { duration: 0 } : { duration: 1, ease: 'easeOut' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {hasData ? (
              <>
                <span className="text-xl sm:text-2xl font-bold text-[var(--color-accent)]">
                  {safeScore}
                </span>
                <span className="text-xs text-[var(--color-text-muted)]">/ 100</span>
              </>
            ) : (
              <span className="text-xl font-bold text-[var(--color-text-muted)]">—</span>
            )}
          </div>
        </div>

        <div className="flex-1">
          <p
            className="text-lg font-semibold text-[var(--color-accent)]"
            style={{ color: hasData ? getColor(safeScore) : undefined }}
          >
            {hasData ? getLabel(safeScore) : 'Waiting for first session'}
          </p>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            {hasData
              ? `${safePassProb}% estimated pass probability`
              : 'Complete questions to see readiness'}
          </p>
          {hasData && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-[var(--color-text-muted)]">Pass Probability</span>
                <span className="font-medium text-[var(--color-accent)]">
                  {safePassProb}%
                </span>
              </div>
              <div className="h-2 bg-[var(--color-border)] rounded-full overflow-hidden border border-[var(--color-border)]">
                <motion.div
                  initial={prefersReducedMotion ? false : { width: 0 }}
                  animate={{ width: `${safePassProb}%` }}
                  transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.8, ease: 'easeOut' }}
                  className="h-full rounded-full min-w-[4px]"
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
  const prefersReducedMotion = useReducedMotion();
  const getBarColor = (m: number) => {
    if (m >= 80) return 'bg-[var(--color-data-pass)]';
    if (m >= 60) return 'bg-[var(--color-accent)]';
    if (m >= 40) return 'bg-[var(--color-data-provisional)]';
    return 'bg-[var(--color-data-fail)]';
  };

  return (
    <div className="flex items-center gap-3">
      <div className="w-20 text-xs font-medium text-[var(--color-accent)] truncate">
        {system}
      </div>
      <div className="flex-1 h-2 bg-[var(--color-border)] rounded-full overflow-hidden border border-[var(--color-border)]">
        <motion.div
          initial={prefersReducedMotion ? false : { width: 0 }}
          animate={{ width: `${mastery}%` }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.5 }}
          className={`h-full rounded-full min-w-[4px] ${getBarColor(mastery)}`}
        />
      </div>
      <div className="w-10 text-xs font-medium text-right text-[var(--color-accent)]">
        {mastery}%
      </div>
      <div
        className={`w-4 ${
          trend === 'improving'
            ? 'text-[var(--color-data-pass)]'
            : trend === 'declining'
              ? 'text-[var(--color-data-fail)]'
              : 'text-[var(--color-text-muted)]'
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
  const prefersReducedMotion = useReducedMotion();
  return (
    <motion.div
      initial={prefersReducedMotion ? false : { y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={prefersReducedMotion ? { duration: 0 } : { delay: index * 0.1 }}
      className="border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] rounded-xl p-4"
    >
      <div className="flex items-start gap-3">
        <Lightbulb
          className="w-5 h-5 text-[var(--color-accent)] flex-shrink-0 mt-0.5"
          aria-hidden
        />
        <p className="font-medium text-[var(--color-accent)] text-sm">{recommendation}</p>
      </div>
    </motion.div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const UserFriendlyStatsDisplay: React.FC<UserFriendlyStatsDisplayProps> = ({
  onPracticeSystem,
}) => {
  const { getToken } = useAuth();
  const prefersReducedMotion = useReducedMotion();
  const [userStats, setUserStats] = useState<UserStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'insights' | 'systems'>('overview');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(getApiEndpoint(API_ENDPOINTS.USER_STATS), {
        credentials: 'include',
        headers,
      });

      // 404 = user not in DB yet (new user / not synced) — show "No data yet" instead of error
      if (response.status === 404) {
        setUserStats(null);
        setError(null);
        return;
      }

      let data: UserStatsResponse & { success?: boolean; error?: string; message?: string };
      try {
        data = (await response.json()) as UserStatsResponse & {
          success?: boolean;
          error?: string;
          message?: string;
        };
      } catch (err) {
        console.warn('[UserFriendlyStatsDisplay] Failed to parse analytics response', err);
        if (!response.ok) {
          const friendly =
            response.status === 503
              ? 'Analytics temporarily unavailable. Please try again later.'
              : response.status === 500
                ? 'Server error loading analytics. Please try again later.'
                : response.statusText || 'Failed to load analytics';
          throw new Error(friendly);
        }
        throw new Error('Invalid response from server');
      }

      // 200 but success: false (e.g. backend sent no-data payload) — show empty state
      if (response.ok && data.success === false) {
        setUserStats(null);
        setError(null);
        return;
      }

      if (!response.ok) {
        const serverMessage =
          data?.message || data?.error || (response.status === 503 ? 'Service unavailable.' : '');
        const friendly =
          serverMessage ||
          (response.status === 500
            ? 'Server error loading analytics. Please try again later.'
            : `Failed to load analytics (${response.status})`);
        throw new Error(friendly);
      }

      setUserStats(data as UserStatsResponse);
    } catch (err) {
      console.error('Failed to load analytics:', err);
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
      // Reserved for future server-backed insights (not displayed until API exists)
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
        <p className="font-medium text-[var(--color-accent)]">Failed to load analytics</p>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">{error}</p>
        <button
          onClick={loadData}
          className="mt-4 px-4 py-2 rounded-lg font-medium bg-[var(--color-accent)] text-[var(--color-text-inverse)] hover:opacity-90 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!displayData || !userStats) {
    return (
      <div className="text-center py-12 px-4">
        <BookOpen className="w-12 h-12 mx-auto text-[var(--color-text-muted)] mb-3" />
        <p className="text-[var(--color-accent)] font-medium">Not yet assessed</p>
        <p className="text-sm text-[var(--color-text-muted)] mt-1 mb-4 max-w-sm mx-auto">
          Your personalized analytics will appear here after you answer questions.
        </p>
        <button
          type="button"
          onClick={() => window.location.assign('/study')}
          className="px-4 py-2.5 rounded-xl bg-[var(--color-accent)] text-[var(--color-text-inverse)] text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Take a 10-question diagnostic quiz to unlock your analytics
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Segmented control: light track + white pill for active tab */}
      <div
        className="inline-flex p-1 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)]"
        role="tablist"
        aria-label="Analytics view"
      >
        {[
          { id: 'overview', label: 'Overview', icon: BarChart2 },
          { id: 'insights', label: 'Insights', icon: Lightbulb },
          { id: 'systems', label: 'Systems', icon: Activity },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-[var(--color-bg-secondary)] text-[var(--color-accent)] shadow-[0_0_0_1px_var(--color-border),0_1px_2px_0_rgba(0,0,0,0.03)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
              }`}
            >
              <tab.icon className="w-4 h-4 shrink-0" aria-hidden />
              {tab.label}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <motion.div
            key="overview"
            role="tabpanel"
            aria-label="Overview"
            initial={prefersReducedMotion ? false : { y: 10 }}
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

            {/* Key Stats Grid - stretch so cards match height and reduce vertical gap */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-stretch">
              <StatCard
                label="Lifetime Accuracy"
                value={
                  displayData.hasData ? formatPercentForDisplay(displayData.accuracyLifetime) : '—'
                }
                icon={<Target className="w-5 h-5" />}
                trend={
                  displayData.accuracyTrend === 'improving'
                    ? 'up'
                    : displayData.accuracyTrend === 'declining'
                      ? 'down'
                      : 'stable'
                }
                trendValue={
                  displayData.accuracyChange > 0
                    ? `+${formatPercentForDisplay(displayData.accuracyChange)}`
                    : formatPercentForDisplay(displayData.accuracyChange)
                }
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

            {/* Quick Stats Row - stretch to match Key Stats row height */}
            <div className="grid grid-cols-3 gap-4 items-stretch">
              <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-4 text-center">
                <Clock className="w-5 h-5 mx-auto text-[var(--color-text-muted)] mb-2" />
                <p className="text-lg font-bold text-[var(--color-accent)]">
                  {userStats?.stats?.overall?.avgTimeMs
                    ? getSpeedBenchmarkLabel(userStats.stats.overall.avgTimeMs).primary
                    : '—'}
                </p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  {userStats?.stats?.overall?.avgTimeMs
                    ? getSpeedBenchmarkLabel(userStats.stats.overall.avgTimeMs).benchmark ||
                      'avg per question'
                    : 'avg per question'}
                </p>
              </div>

              <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-4 text-center">
                <Timer className="w-5 h-5 mx-auto text-[var(--color-text-muted)] mb-2" />
                <p className="text-lg font-bold text-[var(--color-accent)]">
                  {displayData.totalStudyHours}h
                </p>
                <p className="text-xs text-[var(--color-text-muted)]">total study time</p>
              </div>

              <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-4 text-center">
                <Zap className="w-5 h-5 mx-auto text-[var(--color-text-muted)] mb-2" />
                <p className="text-lg font-bold text-[var(--color-accent)]">
                  {displayData.questionsPerHour === 0 ? '--' : displayData.questionsPerHour}
                </p>
                <p className="text-xs text-[var(--color-text-muted)]">questions/hour</p>
              </div>
            </div>

            {/* Top Insights */}
            <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-5">
              <h3 className="text-sm font-medium text-[var(--color-text-muted)] mb-4 flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-[var(--color-accent)]" aria-hidden />
                Key Insights
              </h3>
              {(() => {
                const validInsights = displayData.topInsights.filter(
                  (s): s is string => typeof s === 'string' && s.trim().length > 0
                );
                if (validInsights.length === 0) {
                  return (
                    <p className="text-sm text-[var(--color-text-muted)] py-4 text-center">
                      Not enough data yet. Complete more questions to see personalized insights
                      here.
                    </p>
                  );
                }
                return (
                  <div className="space-y-3">
                    {validInsights.map((insight, i) => (
                      <InsightCard key={i} insight={insight} index={i} onPracticeSystem={onPracticeSystem} />
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Behavioral Patterns */}
            {displayData.hasEnoughDataForInsights ? (
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-5">
                  <h3 className="text-sm font-medium text-[var(--color-text-muted)] mb-4 flex items-center gap-2">
                    <Brain className="w-4 h-4" />
                    Study Progress
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[var(--color-text-secondary)]">Questions Completed</span>
                      <span className="font-medium text-[var(--color-accent)]">
                        {displayData.totalQuestionsLifetime}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[var(--color-text-secondary)]">Study Days</span>
                      <span className="font-medium text-[var(--color-accent)]">
                        {userStats.stats.overall.totalStudyDays}
                      </span>
                    </div>
                    <div className="p-3 rounded-lg bg-[var(--color-bg-tertiary)] text-[var(--color-accent)] text-sm flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 flex-shrink-0" />
                      <span>Great progress! Keep building your knowledge base.</span>
                    </div>
                  </div>
                </div>

                <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-5">
                  <h3 className="text-sm font-medium text-[var(--color-text-muted)] mb-4 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Performance Trend
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[var(--color-text-secondary)]">Last 7 Days</span>
                      <span className="font-medium text-[var(--color-accent)]">
                        {displayData.last7DaysQuestions} questions
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[var(--color-text-secondary)]">Recent Accuracy</span>
                      <span className="font-medium text-[var(--color-accent)]">
                        {formatPercentForDisplay(
                          userStats.stats.recentPerformance.last7Days.accuracy ??
                            displayData.accuracyLifetime
                        )}
                      </span>
                    </div>
                    {userStats.stats.recentPerformance.trend !== 'insufficient_data' && (
                      <div
                        className={`p-3 rounded-lg text-sm flex items-center gap-2 ${
                          userStats.stats.recentPerformance.trend === 'improving'
                            ? 'bg-[var(--color-data-pass)]/15 text-[var(--color-data-pass)]'
                            : userStats.stats.recentPerformance.trend === 'declining'
                              ? 'bg-[var(--color-data-provisional)]/15 text-[var(--color-data-provisional)]'
                              : 'bg-[var(--color-bg-tertiary)] text-[var(--color-accent)]'
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
              <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-6 text-center">
                <Brain className="w-8 h-8 mx-auto text-[var(--color-text-muted)] mb-3" />
                <h3 className="text-sm font-medium text-[var(--color-accent)] mb-2">
                  Building Your Profile
                </h3>
                <p className="text-sm text-[var(--color-text-muted)]">
                  Complete at least 50 questions to unlock personalized insights about your
                  test-taking patterns, optimal study times, and break recommendations.
                </p>
                <p className="text-xs text-[var(--color-text-secondary)] mt-2">
                  {displayData.totalQuestionsLifetime} / 50 questions completed
                </p>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'insights' && (
          <motion.div
            key="insights"
            role="tabpanel"
            aria-label="Insights"
            initial={prefersReducedMotion ? false : { y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-5">
              <h3 className="text-sm font-medium text-[var(--color-text-muted)] mb-2">
                Personalized Recommendations
              </h3>
              <p className="text-xs text-[var(--color-text-muted)] mb-4">
                Based on your study patterns and performance
              </p>
              {(() => {
                const validRecs = displayData.recommendations.filter(
                  (s): s is string => typeof s === 'string' && s.trim().length > 0
                );
                if (validRecs.length === 0) {
                  return (
                    <p className="text-sm text-[var(--color-text-muted)] py-4 text-center">
                      Not enough data yet. Complete more questions to see personalized
                      recommendations.
                    </p>
                  );
                }
                return (
                  <div className="space-y-3">
                    {validRecs.map((rec, i) => (
                      <RecommendationCard key={i} recommendation={rec} index={i} />
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Priority Areas */}
            {displayData.weakAreas.length > 0 && (
              <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-5">
                <h3 className="text-sm font-medium text-[var(--color-text-muted)] mb-4 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Priority Study Areas
                </h3>
                <div className="flex flex-wrap gap-2">
                  {displayData.weakAreas.map((area) => (
                    <span
                      key={area}
                      className="px-3 py-1.5 bg-[var(--color-data-provisional)]/15 text-[var(--color-data-provisional)] rounded-full text-sm font-medium"
                    >
                      {area}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Strengths */}
            {displayData.strongAreas.length > 0 && (
              <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-5">
                <h3 className="text-sm font-medium text-[var(--color-text-muted)] mb-4 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Strengths to Maintain
                </h3>
                <div className="flex flex-wrap gap-2">
                  {displayData.strongAreas.map((strength) => (
                    <span
                      key={strength}
                      className="px-3 py-1.5 bg-[var(--color-data-pass)]/15 text-[var(--color-data-pass)] rounded-full text-sm font-medium"
                    >
                      {strength}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Readiness Timeline */}
            <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-5">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-[var(--color-bg-tertiary)] rounded-xl">
                  <Calendar className="w-6 h-6 text-[var(--color-text-muted)]" />
                </div>
                <div>
                  <p className="text-xl sm:text-2xl font-bold text-[var(--color-accent)]">
                    {displayData.readinessScore >= 80
                      ? "You're Ready!"
                      : `${Math.ceil((80 - displayData.readinessScore) / 2)} days`}
                  </p>
                  <p className="text-sm text-[var(--color-text-muted)]">
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
            role="tabpanel"
            aria-label="Systems"
            initial={prefersReducedMotion ? false : { y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Strengths */}
            {displayData.systems.strengths.length > 0 && (
              <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-5">
                <h3 className="text-sm font-medium text-[var(--color-accent)] mb-4 flex items-center gap-2">
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
              <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-5">
                <h3 className="text-sm font-medium text-[var(--color-text-muted)] mb-4 flex items-center gap-2">
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
              <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-5">
                <h3 className="text-sm font-medium text-[var(--color-text-muted)] mb-4 flex items-center gap-2">
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
              <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-5">
                <h3 className="text-sm font-medium text-[var(--color-text-muted)] mb-4 flex items-center gap-2">
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
          className="flex items-center gap-2 px-4 py-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh Analytics
        </button>
      </div>
    </div>
  );
};

export default UserFriendlyStatsDisplay;
