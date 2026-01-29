/**
 * Database Analytics Dashboard
 *
 * Displays comprehensive user statistics from the database.
 * Shows overall performance, system breakdowns, trends, and study recommendations.
 */

import React, { useState } from 'react';
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
  Clock,
  Flame,
  BookOpen,
  AlertCircle,
  Award,
  RefreshCw,
  Calendar,
  Stethoscope,
  BarChart2,
} from 'lucide-react';
import { useDatabaseStats, DatabaseStats } from '../../hooks/useDatabaseStats';
import { ABBREVIATION_TO_TOPIC_MAP } from '@/src/constants';
import ConditionPerformancePanel from './ConditionPerformancePanel';
import PerformanceTrendChart from './PerformanceTrendChart';
import { PrimaryButton } from '@/components/ui/PrimaryButton';

// Helper to format time in seconds
function formatTime(ms: number | null): string {
  if (!ms) return '--';
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

// Helper to get trend icon
function TrendIcon({
  trend,
}: {
  trend: 'improving' | 'declining' | 'neutral' | 'stable' | 'insufficient_data';
}) {
  switch (trend) {
    case 'improving':
      return <TrendingUp className="w-4 h-4 text-data-pass" />;
    case 'declining':
      return <TrendingDown className="w-4 h-4 text-data-fail" />;
    default:
      return <Minus className="w-4 h-4 text-[var(--color-text-muted)]" />;
  }
}

// Helper to get trend color
function getTrendColor(
  trend: 'improving' | 'declining' | 'neutral' | 'stable' | 'insufficient_data'
): string {
  switch (trend) {
    case 'improving':
      return 'text-data-pass';
    case 'declining':
      return 'text-data-fail';
    default:
      return 'text-[var(--color-text-muted)]';
  }
}

// Loading skeleton
function StatsSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="p-4 rounded-xl bg-[var(--color-bg-secondary)] h-24" />
        ))}
      </div>
      <div className="p-4 rounded-xl bg-[var(--color-bg-secondary)] h-48" />
    </div>
  );
}

// Stats card component
function StatCard({
  icon: Icon,
  label,
  value,
  subValue,
  trend,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subValue?: string;
  trend?: 'improving' | 'declining' | 'neutral' | 'stable' | 'insufficient_data';
}) {
  return (
    <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)]">
      <div className="flex items-center justify-between mb-2">
        <Icon className="w-5 h-5 text-[var(--color-text-muted)]" />
        {trend && <TrendIcon trend={trend} />}
      </div>
      <div className="text-2xl font-bold text-[var(--color-text-primary)]">{value}</div>
      <div className="text-sm text-[var(--color-text-muted)]">{label}</div>
      {subValue && <div className="text-xs text-[var(--color-text-muted)] mt-1">{subValue}</div>}
    </div>
  );
}

// System row component
function SystemRow({
  system,
  stats,
}: {
  system: string;
  stats: DatabaseStats['bySystems'][string];
}) {
  const fullName =
    ABBREVIATION_TO_TOPIC_MAP[system as keyof typeof ABBREVIATION_TO_TOPIC_MAP] || system;
  const accuracyColor =
      stats.accuracy >= 80
      ? 'text-data-pass'
      : stats.accuracy >= 60
        ? 'text-muted-amber'
        : 'text-data-fail';

  return (
    <div className="flex items-center justify-between py-2 border-b border-[var(--color-border)] last:border-0">
      <div className="flex items-center gap-3">
        <span className="font-medium text-[var(--color-text-primary)] w-16">{system}</span>
        <span className="text-sm text-[var(--color-text-muted)] hidden md:block">{fullName}</span>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <span className={`font-bold ${accuracyColor}`}>{stats.accuracy}%</span>
          <span className="text-xs text-[var(--color-text-muted)] ml-1">
            ({stats.correct}/{stats.total})
          </span>
        </div>
        {stats.avgTimeMs && (
          <div className="text-sm text-[var(--color-text-muted)] w-16 text-right hidden sm:block">
            {formatTime(stats.avgTimeMs)}
          </div>
        )}
        <TrendIcon trend={stats.trend} />
      </div>
    </div>
  );
}

export const DatabaseAnalyticsDashboard: React.FC = () => {
  const { stats, isLoading, error, refetch, lastFetched } = useDatabaseStats();
  const [activeTab, setActiveTab] = useState<'overview' | 'systems' | 'conditions'>('overview');

  if (isLoading && !stats) {
    return <StatsSkeleton />;
  }

  if (error && !stats) {
    return (
      <div className="p-6 rounded-xl bg-data-fail/10 border border-data-fail/30">
        <div className="flex items-center gap-2 text-data-fail">
          <AlertCircle className="w-5 h-5" />
          <span className="font-medium">Unable to load analytics</span>
        </div>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">{error}</p>
        <div className="mt-3">
          <PrimaryButton size="sm" variant="warning" onClick={() => refetch()}>
            Try Again
          </PrimaryButton>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="p-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)]">
        <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
          <BookOpen className="w-5 h-5" />
          <span>Sign in to see your analytics</span>
        </div>
      </div>
    );
  }

  const systemsWithData = Object.entries(stats.bySystems)
    .filter(([, s]) => s.total > 0)
    .sort((a, b) => b[1].total - a[1].total);

  return (
    <div className="space-y-6">
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
          📊 Performance Analytics
        </h2>
        <button
          onClick={() => refetch()}
          disabled={isLoading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          {lastFetched && (
            <span className="hidden sm:inline">
              Updated {new Date(lastFetched).toLocaleTimeString()}
            </span>
          )}
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 p-1 bg-[var(--color-bg-secondary)] rounded-lg">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'overview'
              ? 'bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] shadow-sm'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
          }`}
        >
          <BarChart2 className="w-4 h-4" />
          Overview
        </button>
        <button
          onClick={() => setActiveTab('systems')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'systems'
              ? 'bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] shadow-sm'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
          }`}
        >
          <Activity className="w-4 h-4" />
          Systems
        </button>
        <button
          onClick={() => setActiveTab('conditions')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'conditions'
              ? 'bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] shadow-sm'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
          }`}
        >
          <Stethoscope className="w-4 h-4" />
          Conditions
        </button>
      </div>

      {/* Overview Tab Content */}
      {activeTab === 'overview' && (
        <>
          {/* Overview Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              icon={Target}
              label="Overall Accuracy"
              value={`${stats.overall.accuracy}%`}
              subValue={`${stats.overall.correctAttempts}/${stats.overall.totalAttempts} correct`}
              trend={stats.recentPerformance.trend}
            />
            <StatCard
              icon={BookOpen}
              label="Questions Seen"
              value={stats.overall.questionsSeenCount}
              subValue={`${stats.overall.totalAttempts} total attempts`}
            />
            <StatCard
              icon={Flame}
              label="Current Streak"
              value={`${stats.overall.currentStreak} days`}
              subValue={`${stats.overall.totalStudyDays} total study days`}
            />
            <StatCard
              icon={Clock}
              label="Avg Time/Question"
              value={formatTime(stats.overall.avgTimeMs)}
              subValue={
                stats.overall.avgAnswerChanges
                  ? `${stats.overall.avgAnswerChanges} avg answer changes`
                  : undefined
              }
            />
          </div>

          {/* Recent Performance Comparison */}
          <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)]">
            <div className="flex items-center gap-2 text-[var(--color-text-muted)] text-sm mb-4">
              <Calendar className="w-4 h-4" />
              Recent Performance
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="text-sm text-[var(--color-text-muted)] mb-1">Last 7 Days</div>
                <div className="text-2xl font-bold text-[var(--color-text-primary)]">
                  {stats.recentPerformance.last7Days.accuracy !== null
                    ? `${stats.recentPerformance.last7Days.accuracy}%`
                    : '--'}
                </div>
                <div className="text-sm text-[var(--color-text-muted)]">
                  {stats.recentPerformance.last7Days.attempts} questions
                </div>
              </div>
              <div>
                <div className="text-sm text-[var(--color-text-muted)] mb-1">Previous 7 Days</div>
                <div className="text-2xl font-bold text-[var(--color-text-primary)]">
                  {stats.recentPerformance.previous7Days.accuracy !== null
                    ? `${stats.recentPerformance.previous7Days.accuracy}%`
                    : '--'}
                </div>
                <div className="text-sm text-[var(--color-text-muted)]">
                  {stats.recentPerformance.previous7Days.attempts} questions
                </div>
              </div>
            </div>
            <div
              className={`mt-4 flex items-center gap-2 ${getTrendColor(stats.recentPerformance.trend)}`}
            >
              <TrendIcon trend={stats.recentPerformance.trend} />
              <span className="text-sm font-medium capitalize">
                {stats.recentPerformance.trend.replace('_', ' ')}
              </span>
            </div>
          </div>

          {/* Recommendations */}
          {stats.recommendations.length > 0 && (
            <div className="p-4 rounded-xl bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/30">
              <div className="flex items-center gap-2 text-[var(--color-accent)] text-sm mb-3">
                <Target className="w-4 h-4" />
                Study Recommendations
              </div>
              <ul className="space-y-2">
                {stats.recommendations.map((rec, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-2 text-sm text-[var(--color-text-primary)]"
                  >
                    <span className="text-[var(--color-accent)]">•</span>
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {/* Systems Tab Content */}
      {activeTab === 'systems' && (
        <>
          {/* System Breakdown */}
          {systemsWithData.length > 0 && (
            <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)]">
              <div className="flex items-center gap-2 text-[var(--color-text-muted)] text-sm mb-4">
                <Activity className="w-4 h-4" />
                Performance by System
              </div>
              <div className="space-y-1">
                {systemsWithData.map(([system, systemStats]) => (
                  <SystemRow key={system} system={system} stats={systemStats} />
                ))}
              </div>
            </div>
          )}

          {/* Weak Areas */}
          {stats.weakAreas.length > 0 && (
            <div className="p-4 rounded-xl border border-muted-amber/30 bg-data-provisional/10 dark:bg-data-provisional/5 dark:border-muted-amber/20">
              <div className="flex items-center gap-2 text-muted-amber text-sm mb-3">
                <AlertCircle className="w-4 h-4" />
                Focus Areas (Need Improvement)
              </div>
              <div className="space-y-2">
                {stats.weakAreas.map((area) => (
                  <div key={area.system} className="flex items-center justify-between">
                    <span className="font-medium text-[var(--color-text-primary)]">
                      {ABBREVIATION_TO_TOPIC_MAP[
                        area.system as keyof typeof ABBREVIATION_TO_TOPIC_MAP
                      ] || area.system}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-data-fail font-bold">{area.accuracy}%</span>
                      <span className="text-xs text-[var(--color-text-muted)]">
                        ({area.attempts} attempts)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Strong Areas */}
          {stats.strongAreas.length > 0 && (
            <div className="p-4 rounded-xl bg-data-pass/10 border border-data-pass/30">
              <div className="flex items-center gap-2 text-data-pass text-sm mb-3">
                <Award className="w-4 h-4" />
                Strong Areas
              </div>
              <div className="space-y-2">
                {stats.strongAreas.slice(0, 5).map((area) => (
                  <div key={area.system} className="flex items-center justify-between">
                    <span className="font-medium text-[var(--color-text-primary)]">
                      {ABBREVIATION_TO_TOPIC_MAP[
                        area.system as keyof typeof ABBREVIATION_TO_TOPIC_MAP
                      ] || area.system}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-data-pass font-bold">{area.accuracy}%</span>
                      <span className="text-xs text-[var(--color-text-muted)]">
                        ({area.attempts} attempts)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Conditions Tab Content */}
      {activeTab === 'conditions' && (
        <ConditionPerformancePanel
          conditionStats={stats.byConditions || []}
          weakConditions={stats.weakConditions || []}
        />
      )}
    </div>
  );
};

export default DatabaseAnalyticsDashboard;
