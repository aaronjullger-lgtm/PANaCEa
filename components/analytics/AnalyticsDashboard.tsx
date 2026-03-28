import React, { useState, useEffect, useMemo } from 'react';
import useSWR from 'swr';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Cell,
} from 'recharts';
import { Bar } from 'recharts/es6/cartesian/Bar';
import {
  Sparkles,
  Gauge,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  AlertCircle,
  BarChart3,
  Brain,
  Play,
  Info,
  Download,
  CheckCircle,
  AlertTriangle,
  HelpCircle,
  XCircle,
} from 'lucide-react';
import { exportUserAnalytics } from '@/lib/analyticsExport';
import { useAuth } from '@clerk/clerk-react';
import { SkeletonLoader, SkeletonCard } from '@/components/loading';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { CalibrationProgress } from '@/components/analytics/CalibrationProgress';
import { EmptyLineChart } from '@/components/analytics/EmptyChartState';
import {
  PANCEReadinessTreemap,
  type SystemNode,
} from '@/components/analytics/PANCEReadinessTreemap';
import { LearningCurveChart } from '@/components/analytics/LearningCurveChart';
import { ChartContainer } from '@/components/shared/ChartContainer';
import chartTheme from '@/lib/chartTheme';
import { getApiEndpoint, API_ENDPOINTS } from '@/lib/utils/apiConfig';
import { getQuadrantLabel } from '@/lib/calibrationQuadrants';
import { formatPercentForDisplay } from '@/lib/utils/textFormatting';
import {
  getSpeedBenchmarkLabel,
  getSpeedBenchmarkStatus,
  RECALL_TARGET_SEC,
  CLINICAL_REASONING_TARGET_SEC,
  OVERALL_TARGET_SEC,
} from '@/lib/speedBenchmarks';
import { logger } from '@/src/lib/logger';

// Minimum reviews needed for confident predictions (FSRS calibration threshold)
const CALIBRATION_THRESHOLD = 60;
const MIN_SYSTEM_REVIEWS = 5; // Minimum reviews per system for confident display

interface AnalyticsDashboardProps {
  isLoading?: boolean;
  performanceData?: import('@/types').PerformanceRecord[];
}

type SystemRadarDatum = { system: string; accuracy: number; attempts: number };
type TimeDatum = { system: string; seconds: number; accuracy: number; count: number };
type StabilityTrendDatum = { date: string; avgStability: number; totalReviews: number };
type CalibrationQuadrantData = {
  mastered: number;
  dangerousMisconception: number;
  luckyGuess: number;
  unconfidentWrong: number;
  total: number;
};

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
    speedByType?: {
      recall: { avgTimeMs: number | null; count: number };
      clinicalReasoning: { avgTimeMs: number | null; count: number };
    };
    recommendations: string[];
  };
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  isLoading = false,
  performanceData = [],
}) => {
  const { getToken } = useAuth();
  const [userStats, setUserStats] = useState<UserStatsResponse | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [stabilityTrendData, setStabilityTrendData] = useState<StabilityTrendDatum[]>([]);
  const [stabilityLoading, setStabilityLoading] = useState(true);
  const [stabilityError, setStabilityError] = useState<string | null>(null);

  // Fetch user stats on mount
  useEffect(() => {
    const fetchUserStats = async () => {
      try {
        const token = await getToken();
        if (!token) {
          setStatsLoading(false);
          return;
        }

        const response = await fetch(getApiEndpoint(API_ENDPOINTS.USER_STATS), {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch user stats');
        }

        const contentType = response.headers.get('content-type');
        if (!contentType?.includes('application/json')) {
          throw new Error(`Expected JSON but got ${contentType || 'text/html'}`);
        }

        const result = (await response.json()) as UserStatsResponse;
        setUserStats(result);
      } catch (error) {
        logger.error('AnalyticsDashboard', 'Failed to fetch user stats', error);
        setStatsError(error instanceof Error ? error.message : 'Unknown error');
      } finally {
        setStatsLoading(false);
      }
    };

    fetchUserStats();
  }, [getToken]);

  // Fetch stability trend on mount
  useEffect(() => {
    const fetchStabilityTrend = async () => {
      try {
        const token = await getToken();
        if (!token) {
          setStabilityLoading(false);
          return;
        }

        const response = await fetch(
          `${getApiEndpoint(API_ENDPOINTS.USER_STABILITY_TREND)}?days=30`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (!response.ok) {
          throw new Error('Failed to fetch stability trend');
        }

        const contentType = response.headers.get('content-type');
        if (!contentType?.includes('application/json')) {
          throw new Error(`Expected JSON but got ${contentType || 'text/html'}`);
        }

        const result = (await response.json()) as {
          data?: Array<{ date: string; avgStability?: number; totalReviews?: number }>;
        };

        if (result.data && Array.isArray(result.data)) {
          // Format dates for display
          const formattedData = result.data.map((point: (typeof result.data)[number]) => ({
            date: new Date(point.date).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            }),
            avgStability: point.avgStability ?? 0,
            totalReviews: point.totalReviews ?? 0,
          })) as StabilityTrendDatum[];
          setStabilityTrendData(formattedData);
        }
      } catch (error) {
        logger.error('AnalyticsDashboard', 'Failed to fetch stability trend', error);
        setStabilityError(error instanceof Error ? error.message : 'Unknown error');
      } finally {
        setStabilityLoading(false);
      }
    };

    fetchStabilityTrend();
  }, [getToken]);

  // Calibration (Confidence vs. Accuracy) for Recent Performance
  const calibrationFetcher = async (url: string) => {
    const token = await getToken();
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('Failed to fetch calibration');
    const json = await res.json();
    // API middleware sends result.data as body, so response is { calibration, days }
    return json as { calibration: CalibrationQuadrantData; days: number };
  };
  const calibrationUrl =
    userStats && userStats.stats?.overall?.totalAttempts > 0
      ? `${getApiEndpoint(API_ENDPOINTS.ANALYTICS_CALIBRATION)}?days=90`
      : null;
  const { data: calibrationData } = useSWR<{ calibration: CalibrationQuadrantData; days: number }>(
    calibrationUrl,
    calibrationFetcher,
    { revalidateOnFocus: false }
  );

  // System performance: horizontal bar chart (best to worst), bottom 3 = red zone
  const systemPerformanceBarData: SystemRadarDatum[] = useMemo(() => {
    if (!userStats?.stats.bySystems) return [];

    return Object.entries(userStats.stats.bySystems)
      .map(([system, stats]) => ({
        system,
        accuracy: stats.accuracy,
        attempts: stats.total,
      }))
      .filter((d) => d.attempts > 0)
      .sort((a, b) => b.accuracy - a.accuracy); // Best first, worst last (bottom 3 = study today)
  }, [userStats]);

  // PANCE readiness treemap: include ALL systems so 0-data shows as "Not Yet Studied" (neutral), not red
  const treemapData: SystemNode[] = useMemo(() => {
    if (!userStats?.stats.bySystems) return [];

    return Object.entries(userStats.stats.bySystems)
      .map(([system, stats]) => ({
        name: system,
        systemCode: system,
        volume: stats.total ?? 0,
        masteryPercent: stats.accuracy ?? 0,
      }))
      .sort((a, b) => b.volume - a.volume); // Most studied first for visual hierarchy
  }, [userStats]);

  // Transform server data for time chart (decision time by system)
  const timeData: TimeDatum[] = useMemo(() => {
    if (!userStats?.stats.bySystems) return [];

    return Object.entries(userStats.stats.bySystems)
      .map(([system, stats]) => ({
        system,
        seconds: stats.avgTimeMs ? Math.round(stats.avgTimeMs / 1000) : 0,
        accuracy: stats.accuracy,
        count: stats.total,
      }))
      .filter((d) => d.count > 0 && d.seconds > 0)
      .sort((a, b) => b.accuracy - a.accuracy)
      .slice(0, 8); // Top 8 systems by accuracy
  }, [userStats]);

  // Calculate readiness score (weighted blend of accuracy and coverage)
  const readinessScore = useMemo(() => {
    if (!userStats?.stats.overall || !userStats.stats.bySystems) return 0;

    const accuracy = userStats.stats.overall.accuracy / 100;
    const systemsWithData = Object.values(userStats.stats.bySystems).filter(
      (s) => s.total > 0
    ).length;
    const totalSystems = Object.keys(userStats.stats.bySystems).length;
    const coverage = totalSystems > 0 ? systemsWithData / totalSystems : 0;

    // Weighted blend: 70% accuracy, 30% coverage
    return Math.round((accuracy * 0.7 + coverage * 0.3) * 100);
  }, [userStats]);

  // Determine if we have sufficient data
  const hasData = userStats && userStats.stats.overall.totalAttempts > 0;
  const totalAttempts = userStats?.stats.overall.totalAttempts ?? 0;

  const handleStartSession = () => {
    window.location.assign('/study');
  };

  // Loading state skeleton
  if (isLoading || statsLoading) {
    return (
      <div className="space-y-6">
        <SkeletonLoader height="5rem" className="rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SkeletonLoader height="20rem" className="rounded-xl" />
          <SkeletonLoader height="20rem" className="rounded-xl" />
        </div>
        <SkeletonLoader height="20rem" className="rounded-xl" />
      </div>
    );
  }

  // Error state
  if (statsError) {
    return (
      <div className="p-6 rounded-xl bg-data-provisional/10 border-2 border-data-provisional/30">
        <div className="flex items-center gap-2 mb-2">
          <AlertCircle className="w-5 h-5 text-data-provisional" />
          <h3 className="font-bold text-data-provisional">Error Loading Analytics</h3>
        </div>
        <p className="text-sm text-[var(--color-text-muted)]">
          {statsError}. Please try refreshing the page.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Backup your data - reassure users they own their progress */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className="text-xs text-[var(--color-text-muted)]">You own your progress.</span>
        <button
          onClick={() => exportUserAnalytics(performanceData ?? [], 'csv')}
          disabled={!performanceData?.length}
          className="text-sm text-[var(--color-accent)] hover:underline flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Backup your data as CSV"
        >
          <Download className="w-4 h-4" />
          Backup your data (CSV)
        </button>
      </div>

      {/* Context Banner for Students */}
      {hasData && (
        <div className="p-4 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-[var(--color-accent)] mt-0.5" />
            <div>
              <h4 className="font-semibold text-[var(--color-accent)] mb-1">PANCE Readiness Overview</h4>
              <p className="text-sm text-action-muted">
                Track your progress across all organ systems. Focus on your weakest areas for
                maximum improvement.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Empty State - With CTA to prevent dead ends */}
      {!hasData && (
        <div className="flex flex-col items-center justify-center py-12 px-6 bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border)]">
          <div className="mb-4 p-4 rounded-full bg-[var(--color-accent)]/15">
            <BarChart3 className="w-12 h-12 text-action-muted" />
          </div>
          <h3 className="text-xl font-semibold text-[var(--color-accent)] mb-2">
            Start Building Your Profile
          </h3>
          <p className="text-sm text-action-muted text-center max-w-md mb-6">
            Complete your first 20-question session to unlock personalized analytics, track your
            progress across organ systems, and identify your focus areas.
          </p>
          <PrimaryButton size="md" icon={Play} onClick={handleStartSession}>
            Start Calibration Session
          </PrimaryButton>
          <p className="text-xs text-action-muted mt-3">
            ~15 minutes • Interleaved across 3+ organ systems
          </p>
        </div>
      )}

      {/* Stats Grid - Student Context */}
      {hasData && userStats && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-6 rounded-xl bg-[var(--color-bg-secondary)] shadow-sm transition-colors">
              <div className="flex items-center gap-2 text-action-muted text-sm mb-2">
                <Gauge className="w-4 h-4" />
                <span className="font-medium">Exam Readiness</span>
              </div>
              <div className="flex items-baseline gap-2 mb-1">
                <div className="text-4xl font-bold text-[var(--color-accent)]">
                  {formatPercentForDisplay(readinessScore)}
                </div>
                <TrendingUp className="w-5 h-5 text-[var(--color-accent)]" />
              </div>
              <p className="text-xs text-action-muted">
                Based on accuracy ({formatPercentForDisplay(userStats.stats.overall.accuracy)}) +
                coverage
              </p>
            </div>

            <div className="p-6 rounded-xl bg-[var(--color-bg-secondary)] shadow-sm transition-colors">
              <div className="flex items-center gap-2 text-action-muted text-sm mb-2">
                <TrendingUp className="w-4 h-4" />
                <span className="font-medium">Recent Performance</span>
              </div>
              <div className="flex items-baseline gap-2 mb-1">
                <div className="text-4xl font-bold text-[var(--color-accent)]">
                  {formatPercentForDisplay(userStats.stats.recentPerformance.last7Days.accuracy)}
                </div>
                <Activity className="w-5 h-5 text-[var(--color-accent)]" />
              </div>
              <p className="text-xs text-action-muted">
                Last 7 days ({userStats.stats.recentPerformance.last7Days.attempts} questions)
              </p>
            </div>

            <div className="p-6 rounded-xl bg-[var(--color-bg-secondary)] shadow-sm transition-colors">
              <div className="flex items-center gap-2 text-action-muted text-sm mb-2">
                <Clock className="w-4 h-4" />
                <span className="font-medium">Decision Speed</span>
              </div>
              {(() => {
                const { primary, benchmark, status } = getSpeedBenchmarkLabel(
                  userStats.stats.overall.avgTimeMs,
                  { targetSec: OVERALL_TARGET_SEC }
                );
                return (
                  <>
                    <div className="flex items-baseline gap-2 mb-1">
                      <div
                        className={`text-4xl font-bold ${
                          status === 'above_target'
                            ? 'text-data-provisional'
                            : status === 'below_target'
                              ? 'text-data-pass'
                              : 'text-[var(--color-accent)]'
                        }`}
                      >
                        {primary}
                      </div>
                    </div>
                    <p className="text-xs text-action-muted">
                      {benchmark ? `${benchmark} · Avg per question` : 'Average per question'}
                    </p>
                  </>
                );
              })()}
            </div>
          </div>

          {/* Confidence vs. Accuracy (Calibration) - Illusion of Competence */}
          {calibrationData?.calibration && calibrationData.calibration.total > 0 && (
            <div className="p-6 rounded-xl bg-[var(--color-bg-secondary)] shadow-sm">
              <div className="flex items-center gap-2 text-action-muted text-sm mb-3">
                <Brain className="w-4 h-4" />
                <span className="font-medium">Confidence vs. Accuracy</span>
              </div>
              <p className="text-xs text-action-muted mb-4">
                How well your confidence (from behavior) matches correctness. Lucky guesses and
                dangerous misconceptions need different follow-up.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    key: 'mastered' as const,
                    icon: CheckCircle,
                    label: getQuadrantLabel('mastered').short,
                    count: calibrationData.calibration.mastered,
                    className: 'bg-data-pass/10 text-data-pass',
                  },
                  {
                    key: 'dangerous_misconception' as const,
                    icon: AlertTriangle,
                    label: getQuadrantLabel('dangerous_misconception').short,
                    count: calibrationData.calibration.dangerousMisconception,
                    className: 'bg-data-fail/10 text-data-fail',
                  },
                  {
                    key: 'lucky_guess' as const,
                    icon: HelpCircle,
                    label: getQuadrantLabel('lucky_guess').short,
                    count: calibrationData.calibration.luckyGuess,
                    className:
                      'bg-data-provisional/10 text-data-provisional',
                  },
                  {
                    key: 'unconfident_wrong' as const,
                    icon: XCircle,
                    label: getQuadrantLabel('unconfident_wrong').short,
                    count: calibrationData.calibration.unconfidentWrong,
                    className: 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)]',
                  },
                ].map(({ key, icon: Icon, label, count, className }) => (
                  <div
                    key={key}
                    className={`rounded-lg p-3 flex items-center justify-between ${className}`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="text-sm font-medium">{label}</span>
                    </div>
                    <span className="text-xl font-bold">{count}</span>
                  </div>
                ))}
              </div>
              {calibrationData.calibration.dangerousMisconception > 0 && (
                <p className="mt-3 text-xs text-data-fail">
                  High confidence + wrong = dangerous misconception — prioritize reviewing those
                  topics.
                </p>
              )}
            </div>
          )}

          {/* Speed by question type: Recall vs Clinical Reasoning */}
          {userStats.stats.speedByType &&
            (userStats.stats.speedByType.recall.count > 0 ||
              userStats.stats.speedByType.clinicalReasoning.count > 0) && (
              <div className="p-6 rounded-xl bg-[var(--color-bg-secondary)] shadow-sm">
                <div className="flex items-center gap-2 text-action-muted text-sm mb-3">
                  <Clock className="w-4 h-4" />
                  <span className="font-medium">Speed by question type</span>
                </div>
                <p className="text-xs text-action-muted mb-4">
                  Recall (first-order) vs clinical reasoning (vignettes). Targets: recall &lt;60s,
                  clinical &lt;90s.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {userStats.stats.speedByType.recall.count > 0 && (
                    <div className="rounded-xl p-4 bg-[var(--color-bg-tertiary)]">
                      <div className="text-sm font-medium text-[var(--color-accent)] mb-1">
                        Recall speed
                      </div>
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-2xl font-bold text-[var(--color-accent)]">
                          {Math.round((userStats.stats.speedByType.recall.avgTimeMs ?? 0) / 1000)}s
                        </span>
                        <span className="text-xs text-action-muted">
                          (Target: &lt;{RECALL_TARGET_SEC}s)
                          {getSpeedBenchmarkStatus(
                            userStats.stats.speedByType.recall.avgTimeMs,
                            RECALL_TARGET_SEC
                          ) === 'below_target' && ' · On target'}
                          {getSpeedBenchmarkStatus(
                            userStats.stats.speedByType.recall.avgTimeMs,
                            RECALL_TARGET_SEC
                          ) === 'above_target' && ' · Slow for recall'}
                        </span>
                      </div>
                      <p className="text-xs text-action-muted mt-1">
                        {userStats.stats.speedByType.recall.count} rapid-recall question
                        {userStats.stats.speedByType.recall.count !== 1 ? 's' : ''}
                      </p>
                    </div>
                  )}
                  {userStats.stats.speedByType.clinicalReasoning.count > 0 && (
                    <div className="rounded-xl p-4 bg-[var(--color-bg-tertiary)]">
                      <div className="text-sm font-medium text-[var(--color-accent)] mb-1">
                        Clinical reasoning speed
                      </div>
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-2xl font-bold text-[var(--color-accent)]">
                          {Math.round(
                            (userStats.stats.speedByType.clinicalReasoning.avgTimeMs ?? 0) / 1000
                          )}
                          s
                        </span>
                        <span className="text-xs text-action-muted">
                          (Target: &lt;{CLINICAL_REASONING_TARGET_SEC}s)
                          {getSpeedBenchmarkStatus(
                            userStats.stats.speedByType.clinicalReasoning.avgTimeMs,
                            CLINICAL_REASONING_TARGET_SEC
                          ) === 'below_target' && ' · On target'}
                          {getSpeedBenchmarkStatus(
                            userStats.stats.speedByType.clinicalReasoning.avgTimeMs,
                            CLINICAL_REASONING_TARGET_SEC
                          ) === 'above_target' && ' · Consider pacing'}
                        </span>
                      </div>
                      <p className="text-xs text-action-muted mt-1">
                        {userStats.stats.speedByType.clinicalReasoning.count} vignette/clinical
                        question
                        {userStats.stats.speedByType.clinicalReasoning.count !== 1 ? 's' : ''}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

          {/* FSRS Calibration Progress - Epistemic Uncertainty UI */}
          <CalibrationProgress
            current={totalAttempts}
            target={CALIBRATION_THRESHOLD}
            showDetails={true}
          />

          {/* Weakest Subject Areas - Student Priority (hide when no data: filter out 0 attempts) */}
          {(() => {
            const focusAreasWithData = (userStats.stats.weakAreas ?? []).filter(
              (area) => (area.attempts ?? 0) > 0
            );
            if (focusAreasWithData.length === 0) return null;

            return (
              <div className="p-6 rounded-xl border-2 border-data-provisional/30 bg-[var(--color-bg-secondary)]">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 rounded-lg bg-data-provisional/10">
                    <AlertCircle className="w-5 h-5 text-data-provisional" />
                  </div>
                  <h3 className="font-bold text-data-provisional">Focus Areas - Highest Impact</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {focusAreasWithData.slice(0, 3).map((area) => (
                    <div
                      key={area.system}
                      className="p-4 rounded-lg bg-[var(--color-bg-primary)] border border-data-provisional/30"
                    >
                      <div className="text-sm font-semibold text-[var(--color-accent)] mb-1">
                        {area.system}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-2xl font-bold text-data-provisional">
                          {formatPercentForDisplay(area.accuracy)}
                        </span>
                        <span className="text-xs text-action-muted">{area.attempts} Q's</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* PANCE Readiness Treemap (all systems: 0 data = neutral "Not Yet Studied") */}
          {treemapData.length > 0 && (
            <div className="mb-6">
              <ChartContainer minHeight={320} className="w-full">
                <PANCEReadinessTreemap data={treemapData} />
              </ChartContainer>
            </div>
          )}

          {/* System Performance: horizontal bar (best to worst), bottom 3 = red zone */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="p-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)]">
              <div className="flex items-center gap-2 text-action-muted text-sm mb-2">
                <BarChart3 className="w-4 h-4" /> System Performance (Best → Worst)
              </div>
              <p className="text-xs text-action-muted mb-3">
                Bottom 3 bars = focus areas. What should I study today?
              </p>
              {systemPerformanceBarData.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[320px] text-center px-4">
                  <Activity className="w-10 h-10 text-action-muted/50 mb-2" />
                  <p className="text-sm text-action-muted mb-4">Not yet assessed</p>
                  <button
                    type="button"
                    onClick={handleStartSession}
                    className="px-4 py-2.5 rounded-xl bg-[var(--color-accent)] text-[var(--color-text-inverse)] text-sm font-medium hover:opacity-90 transition-opacity"
                  >
                    Take a 10-question diagnostic quiz to unlock this graph
                  </button>
                </div>
              ) : (
                <ChartContainer minHeight={320} className="min-h-[320px] w-full" aria-hidden>
                  <ResponsiveContainer
                    width="100%"
                    height={Math.max(320, systemPerformanceBarData.length * 36)}
                    minHeight={200}
                    minWidth={0}
                  >
                    <BarChart
                      layout="vertical"
                      data={systemPerformanceBarData}
                      margin={{ top: 4, right: 24, left: 0, bottom: 24 }}
                    >
                      <CartesianGrid {...chartTheme.gridBar} stroke="var(--chart-grid-stroke)" />
                      <XAxis
                        type="number"
                        domain={[0, 100]}
                        tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
                      />
                      <YAxis
                        type="category"
                        dataKey="system"
                        width={100}
                        tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
                      />
                      <Tooltip
                        formatter={(value?: number) => [
                          formatPercentForDisplay(value ?? 0),
                          'Accuracy',
                        ]}
                        contentStyle={chartTheme.tooltip.contentStyle}
                        labelStyle={chartTheme.tooltip.labelStyle}
                      />
                      <Bar dataKey="accuracy" name="Accuracy" radius={[0, 4, 4, 0]} maxBarSize={28}>
                        {systemPerformanceBarData.map((_, index) => {
                          const isRedZone = index >= systemPerformanceBarData.length - 3;
                          return (
                            <Cell
                              key={index}
                              fill={isRedZone ? 'var(--color-data-fail)' : 'var(--color-accent)'}
                              fillOpacity={isRedZone ? 0.9 : 0.7}
                            />
                          );
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              )}
            </div>

            <div className="p-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)]">
              <div className="flex items-center gap-2 text-action-muted text-sm mb-3">
                <TrendingUp className="w-4 h-4" /> Performance Trend
              </div>
              {userStats.stats.recentPerformance.trend === 'insufficient_data' ? (
                <div className="flex flex-col items-center justify-center h-[320px] gap-4">
                  <p className="text-sm text-action-muted">Not yet assessed</p>
                  <button
                    type="button"
                    onClick={handleStartSession}
                    className="px-4 py-2.5 rounded-xl bg-[var(--color-accent)] text-[var(--color-text-inverse)] text-sm font-medium hover:opacity-90 transition-opacity"
                  >
                    Take a 10-question diagnostic quiz to unlock this graph
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-[320px]">
                  <div className="mb-4">
                    {userStats.stats.recentPerformance.trend === 'improving' && (
                      <TrendingUp className="w-16 h-16 text-[var(--color-accent)]" />
                    )}
                    {userStats.stats.recentPerformance.trend === 'declining' && (
                      <TrendingDown className="w-16 h-16 text-[var(--color-accent)]" />
                    )}
                    {userStats.stats.recentPerformance.trend === 'stable' && (
                      <Minus className="w-16 h-16 text-[var(--color-accent)]" />
                    )}
                  </div>
                  <p className="text-lg font-semibold text-[var(--color-accent)] mb-2">
                    {userStats.stats.recentPerformance.trend === 'improving' && 'Trending Upward'}
                    {userStats.stats.recentPerformance.trend === 'declining' && 'Needs Focus'}
                    {userStats.stats.recentPerformance.trend === 'stable' &&
                      (() => {
                        const last7 = userStats.stats.recentPerformance.last7Days.accuracy ?? 0;
                        const prev7 = userStats.stats.recentPerformance.previous7Days.accuracy ?? 0;
                        const delta = last7 - prev7;
                        const deltaStr =
                          delta > 0
                            ? `+${formatPercentForDisplay(delta)}`
                            : formatPercentForDisplay(delta);
                        return deltaStr;
                      })()}
                  </p>
                  <p className="text-sm text-action-muted text-center max-w-xs">
                    Last 7 days:{' '}
                    {formatPercentForDisplay(userStats.stats.recentPerformance.last7Days.accuracy)}{' '}
                    ({userStats.stats.recentPerformance.last7Days.attempts} questions)
                    <br />
                    Previous 7 days:{' '}
                    {formatPercentForDisplay(
                      userStats.stats.recentPerformance.previous7Days.accuracy
                    )}{' '}
                    ({userStats.stats.recentPerformance.previous7Days.attempts} questions)
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* FSRS Stability Growth Trend */}
          <div className="p-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-action-muted text-sm">
                <Brain className="w-4 h-4" /> Memory Stability Growth (Last 30 Days)
              </div>
              {stabilityLoading && (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-xs text-action-muted">Fetching data...</span>
                </div>
              )}
            </div>
            {stabilityError ? (
              <p className="text-sm text-data-provisional">
                Error loading stability data: {stabilityError}
              </p>
            ) : stabilityLoading ? (
              <SkeletonLoader width="100%" height="320" />
            ) : stabilityTrendData.length === 0 ? (
              <EmptyLineChart
                message="Not yet assessed"
                height={320}
                diagnosticCta={{ onClick: handleStartSession }}
              />
            ) : (
              <>
                <ChartContainer minHeight={320} className="min-h-[320px] w-full" aria-hidden>
                  <ResponsiveContainer width="100%" height={320} minHeight={200} minWidth={0}>
                    <LineChart
                      data={stabilityTrendData.filter(d => !isNaN(d.avgStability) && isFinite(d.avgStability))}
                      margin={{ top: 4, right: 24, left: 0, bottom: 28 }}
                    >
                      <CartesianGrid {...chartTheme.grid} />
                      <XAxis dataKey="date" tick={chartTheme.axis.tick} angle={-20} height={60} />
                      <YAxis
                        tick={chartTheme.axis.tick}
                        label={{
                          value: 'Stability',
                          angle: -90,
                          position: 'insideLeft',
                          style: { fill: 'var(--color-text-muted)' },
                        }}
                      />
                      <Tooltip
                        contentStyle={chartTheme.tooltip.contentStyle}
                        labelStyle={chartTheme.tooltip.labelStyle}
                        formatter={(value: number | string | undefined, name?: string) => {
                          if (value === undefined || (typeof value === 'number' && (isNaN(value) || !isFinite(value)))) return ['—', name ?? ''];
                          if (name === 'avgStability')
                            return [
                              typeof value === 'number' ? value.toFixed(1) : value,
                              'Stability',
                            ];
                          return [value, name ?? ''];
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="avgStability"
                        stroke="var(--color-accent)"
                        strokeWidth={3}
                        dot={{ fill: 'var(--color-accent)', r: 4 }}
                        name="avgStability"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartContainer>
                <div className="mt-3 p-3 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)]">
                  <p className="text-xs text-action-muted">
                    <strong>What is Stability?</strong> Stability measures how long you'll remember
                    information. Higher stability means longer retention and fewer reviews needed.
                    {stabilityTrendData.length > 1 && (
                      <span className="block mt-1">
                        Your stability has{' '}
                        <strong>
                          {(() => {
                            const lastItem = stabilityTrendData[stabilityTrendData.length - 1];
                            const firstItem = stabilityTrendData[0];
                            return lastItem &&
                              firstItem &&
                              lastItem.avgStability > firstItem.avgStability
                              ? 'increased'
                              : 'remained stable';
                          })()}
                        </strong>{' '}
                        over the past 30 days.
                      </span>
                    )}
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Learning Curve */}
          <div className="p-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-action-muted text-sm">
                <TrendingUp className="w-4 h-4" /> Learning Curve
              </div>
            </div>
            <LearningCurveChart />
          </div>

          {/* Decision Time by System */}
          <div className="p-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-action-muted text-sm">
                <Clock className="w-4 h-4" /> Decision Time by System
              </div>
              {timeData.some((d) => d.count < MIN_SYSTEM_REVIEWS) && (
                <div className="flex items-center gap-1 text-xs text-action-muted">
                  <Info className="w-3 h-3" />
                  <span>Faded bars = &lt;{MIN_SYSTEM_REVIEWS} reviews</span>
                </div>
              )}
            </div>
            {timeData.length === 0 ? (
              <p className="text-sm text-action-muted">
                Time tracking will appear once you complete timed sessions.
              </p>
            ) : (
              <ChartContainer minHeight={320} className="min-h-[320px] w-full" aria-hidden>
                <ResponsiveContainer width="100%" height={320} minHeight={200} minWidth={0}>
                  <BarChart data={timeData.filter(d => !isNaN(d.seconds) && isFinite(d.seconds))} margin={{ bottom: 28 }}>
                    <CartesianGrid {...chartTheme.gridBar} stroke="var(--chart-grid-stroke)" />
                    <XAxis
                      dataKey="system"
                      tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
                      interval={0}
                      angle={-20}
                      height={60}
                    />
                    <YAxis tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} />
                    <Tooltip
                      formatter={(
                        value: number | string | undefined,
                        name?: string,
                        props?: { payload?: TimeDatum }
                      ) => {
                        if (value === undefined || (typeof value === 'number' && (isNaN(value) || !isFinite(value)))) return ['—', 'Avg time'];
                        const entry = props?.payload;
                        return [
                          `${value}s (${entry?.count ?? 0} review${entry?.count !== 1 ? 's' : ''})`,
                          'Avg time',
                        ];
                      }}
                    />
                    <Bar
                      dataKey="seconds"
                      fill="var(--color-accent)"
                      radius={[6, 6, 0, 0]}
                      name="Avg seconds"
                    >
                      {timeData.filter(d => !isNaN(d.seconds) && isFinite(d.seconds)).map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill="var(--color-accent)"
                          fillOpacity={entry.count >= MIN_SYSTEM_REVIEWS ? 1 : 0.3}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default AnalyticsDashboard;
