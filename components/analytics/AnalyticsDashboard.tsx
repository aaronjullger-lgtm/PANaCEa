import React, { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
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
  Activity,
  AlertCircle,
  BarChart3,
  Brain,
  Play,
  Info,
  Download,
} from 'lucide-react';
import { exportUserAnalytics } from '@/lib/analyticsExport';
import { useAuth } from '@clerk/clerk-react';
import { SkeletonLoader, SkeletonCard } from '@/components/ui/SkeletonLoader';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { CalibrationProgress } from '@/components/analytics/CalibrationProgress';
import { EmptyRadarChart, EmptyLineChart } from '@/components/analytics/EmptyChartState';
import chartTheme from '@/lib/chartTheme';
import { getApiEndpoint } from '@/lib/utils/apiConfig';

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

        const response = await fetch(getApiEndpoint('/api/user/stats'), {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          const contentType = response.headers.get('content-type');
          if (!contentType?.includes('application/json')) {
            throw new Error(`Expected JSON but got ${contentType}`);
          }
          throw new Error('Failed to fetch user stats');
        }

        const result = await response.json();
        setUserStats(result);
      } catch (error) {
        console.error('[AnalyticsDashboard] Failed to fetch user stats:', error);
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

        const response = await fetch('/api/user/stability-trend?days=30', {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch stability trend');
        }

        const result = await response.json();

        if (result.data && Array.isArray(result.data)) {
          // Format dates for display
          const formattedData = result.data.map((point: any) => ({
            date: new Date(point.date).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            }),
            avgStability: point.avgStability,
            totalReviews: point.totalReviews,
          }));
          setStabilityTrendData(formattedData);
        }
      } catch (error) {
        console.error('[AnalyticsDashboard] Failed to fetch stability trend:', error);
        setStabilityError(error instanceof Error ? error.message : 'Unknown error');
      } finally {
        setStabilityLoading(false);
      }
    };

    fetchStabilityTrend();
  }, [getToken]);

  // Transform server data for radar chart (system performance)
  const radarData: SystemRadarDatum[] = useMemo(() => {
    if (!userStats?.stats.bySystems) return [];

    return Object.entries(userStats.stats.bySystems)
      .map(([system, stats]) => ({
        system,
        accuracy: stats.accuracy,
        attempts: stats.total,
      }))
      .filter((d) => d.attempts > 0)
      .sort((a, b) => b.attempts - a.attempts)
      .slice(0, 10); // Top 10 systems by attempts
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
    window.location.assign('/study/main-session');
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
      {/* Backup your data - reassure users they own their data */}
      <div className="flex justify-end">
        <button
          onClick={() => exportUserAnalytics(performanceData ?? [], 'csv')}
          disabled={!performanceData?.length}
          className="text-sm text-[var(--color-accent)] hover:underline flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="w-4 h-4" />
          Backup your data (CSV)
        </button>
      </div>

      {/* Context Banner for Students */}
      {hasData && (
        <div className="p-4 rounded-xl bg-surface-card border border-[var(--color-border)]">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-action-primary mt-0.5" />
            <div>
              <h4 className="font-semibold text-action-primary mb-1">PANCE Readiness Overview</h4>
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
        <div className="flex flex-col items-center justify-center py-12 px-6 bg-surface-card rounded-xl border border-[var(--color-border)]">
          <div className="mb-4 p-4 rounded-full bg-action-muted">
            <BarChart3 className="w-12 h-12 text-action-muted" />
          </div>
          <h3 className="text-xl font-semibold text-action-primary mb-2">
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
            <div className="p-6 rounded-xl border-2 border-[var(--color-border)] bg-surface-primary hover:border-action-primary/50 transition-colors">
              <div className="flex items-center gap-2 text-action-muted text-sm mb-2">
                <Gauge className="w-4 h-4" />
                <span className="font-medium">Exam Readiness</span>
              </div>
              <div className="flex items-baseline gap-2 mb-1">
                <div className="text-4xl font-bold text-action-primary">{readinessScore}%</div>
                <TrendingUp className="w-5 h-5 text-action-primary" />
              </div>
              <p className="text-xs text-action-muted">
                Based on accuracy ({userStats.stats.overall.accuracy}%) + coverage
              </p>
            </div>

            <div className="p-6 rounded-xl border-2 border-[var(--color-border)] bg-surface-primary hover:border-action-primary/50 transition-colors">
              <div className="flex items-center gap-2 text-action-muted text-sm mb-2">
                <TrendingUp className="w-4 h-4" />
                <span className="font-medium">Recent Performance</span>
              </div>
              <div className="flex items-baseline gap-2 mb-1">
                <div className="text-4xl font-bold text-action-primary">
                  {userStats.stats.recentPerformance.last7Days.accuracy ?? 0}%
                </div>
                <Activity className="w-5 h-5 text-action-primary" />
              </div>
              <p className="text-xs text-action-muted">
                Last 7 days ({userStats.stats.recentPerformance.last7Days.attempts} questions)
              </p>
            </div>

            <div className="p-6 rounded-xl border-2 border-[var(--color-border)] bg-surface-primary hover:border-action-primary/50 transition-colors">
              <div className="flex items-center gap-2 text-action-muted text-sm mb-2">
                <Clock className="w-4 h-4" />
                <span className="font-medium">Decision Speed</span>
              </div>
              <div className="flex items-baseline gap-2 mb-1">
                <div className="text-4xl font-bold text-action-primary">
                  {userStats.stats.overall.avgTimeMs
                    ? `${Math.round(userStats.stats.overall.avgTimeMs / 1000)}s`
                    : '—'}
                </div>
              </div>
              <p className="text-xs text-action-muted">Average per question</p>
            </div>
          </div>

          {/* FSRS Calibration Progress - Epistemic Uncertainty UI */}
          <CalibrationProgress
            current={totalAttempts}
            target={CALIBRATION_THRESHOLD}
            showDetails={true}
          />

          {/* Weakest Subject Areas - Student Priority */}
          {userStats.stats.weakAreas.length > 0 && (
            <div className="p-6 rounded-xl bg-data-provisional/10 border-2 border-data-provisional/30">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 rounded-lg bg-data-provisional/10">
                  <AlertCircle className="w-5 h-5 text-data-provisional" />
                </div>
                <h3 className="font-bold text-data-provisional">Focus Areas - Highest Impact</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {userStats.stats.weakAreas.slice(0, 3).map((area) => (
                  <div
                    key={area.system}
                    className="p-3 rounded-lg bg-surface-primary border border-data-provisional/30"
                  >
                    <div className="text-sm font-semibold text-action-primary mb-1">
                      {area.system}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-bold text-data-provisional">
                        {area.accuracy}%
                      </span>
                      <span className="text-xs text-action-muted">{area.attempts} Q's</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Visual vs Text Performance Split */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="p-6 rounded-xl border border-[var(--color-border)] bg-surface-primary">
              <div className="flex items-center gap-2 text-action-muted text-sm mb-3">
                <Activity className="w-4 h-4" /> System Performance Radar
              </div>
              {radarData.length === 0 ? (
                <EmptyRadarChart message="Complete questions across organ systems" height={320} />
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <RadarChart data={radarData} outerRadius={120}>
                    <PolarGrid stroke="var(--color-border)" />
                    <PolarAngleAxis
                      dataKey="system"
                      tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }}
                    />
                    <PolarRadiusAxis
                      angle={30}
                      domain={[0, 100]}
                      tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }}
                    />
                    <Radar
                      name="Accuracy"
                      dataKey="accuracy"
                      stroke="var(--color-accent)"
                      fill="var(--color-accent)"
                      fillOpacity={0.35}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="p-6 rounded-xl border border-[var(--color-border)] bg-surface-primary">
              <div className="flex items-center gap-2 text-action-muted text-sm mb-3">
                <TrendingUp className="w-4 h-4" /> Performance Trend
              </div>
              {userStats.stats.recentPerformance.trend === 'insufficient_data' ? (
                <div className="flex flex-col items-center justify-center h-[320px]">
                  <p className="text-sm text-action-muted">
                    Complete more questions to see performance trends.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-[320px]">
                  <div className="text-6xl font-bold text-action-primary mb-4">
                    {userStats.stats.recentPerformance.trend === 'improving' && '📈'}
                    {userStats.stats.recentPerformance.trend === 'declining' && '📉'}
                    {userStats.stats.recentPerformance.trend === 'stable' && '➡️'}
                  </div>
                  <p className="text-lg font-semibold text-action-primary mb-2">
                    {userStats.stats.recentPerformance.trend === 'improving' && 'Trending Upward'}
                    {userStats.stats.recentPerformance.trend === 'declining' && 'Needs Focus'}
                    {userStats.stats.recentPerformance.trend === 'stable' &&
                      (() => {
                        const last7 = userStats.stats.recentPerformance.last7Days.accuracy ?? 0;
                        const prev7 = userStats.stats.recentPerformance.previous7Days.accuracy ?? 0;
                        const delta = last7 - prev7;
                        const deltaStr =
                          delta > 0 ? `+${delta.toFixed(1)}%` : `${delta.toFixed(1)}%`;
                        return deltaStr;
                      })()}
                  </p>
                  <p className="text-sm text-action-muted text-center max-w-xs">
                    Last 7 days: {userStats.stats.recentPerformance.last7Days.accuracy}% (
                    {userStats.stats.recentPerformance.last7Days.attempts} questions)
                    <br />
                    Previous 7 days: {userStats.stats.recentPerformance.previous7Days.accuracy}% (
                    {userStats.stats.recentPerformance.previous7Days.attempts} questions)
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* FSRS Stability Growth Trend */}
          <div className="p-6 rounded-xl border border-[var(--color-border)] bg-surface-primary">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-action-muted text-sm">
                <Brain className="w-4 h-4" /> Memory Stability Growth (Last 30 Days)
              </div>
              {stabilityLoading && (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 border-2 border-action-primary border-t-transparent rounded-full animate-spin"></div>
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
                message="Complete questions to track memory stability growth"
                height={320}
              />
            ) : (
              <>
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={stabilityTrendData}>
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
                        if (value === undefined) return ['—', name ?? ''];
                        if (name === 'avgStability')
                          return [
                            typeof value === 'number' ? value.toFixed(2) : value,
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
                <div className="mt-3 p-3 bg-surface-card rounded-lg border border-[var(--color-border)]">
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

          {/* Decision Time by System */}
          <div className="p-6 rounded-xl border border-[var(--color-border)] bg-surface-primary">
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
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={timeData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgb(226 232 240)"
                    className="dark:[stroke:var(--color-border)]"
                  />
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
                      if (value === undefined) return ['—', 'Avg time'];
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
                    {timeData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill="var(--color-accent)"
                        fillOpacity={entry.count >= MIN_SYSTEM_REVIEWS ? 1 : 0.3}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default AnalyticsDashboard;
