/**
 * Question Quality Dashboard
 *
 * Admin component for monitoring question quality metrics:
 * - Quality score distribution
 * - Validation status breakdown
 * - System coverage gaps
 * - Flag rate tracking
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@clerk/clerk-react';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Flag,
  TrendingUp,
  BarChart2,
  Filter,
  RefreshCw,
} from 'lucide-react';

interface QualityStats {
  overview: {
    totalQuestions: number;
    avgQualityScore: number;
    avgFlagRate: number;
    totalServed: number;
    overallAccuracy: number;
  };
  statusBreakdown: Array<{ status: string; count: number }>;
  qualityDistribution: {
    excellent: number;
    good: number;
    fair: number;
    poor: number;
  };
  systemCoverage: Array<{
    system: string;
    count: number;
    avgQualityScore: number | null;
    avgFlagRate: number | null;
  }>;
  topFlagged: Array<{
    id: string;
    system: string;
    questionType: string;
    flagCount: number;
    flagRate: number;
    qualityScore: number;
    validationStatus: string;
  }>;
  recentlyValidated: Array<{
    id: string;
    system: string;
    validationStatus: string;
    validatedAt: string;
    validatedBy: string;
    qualityScore: number;
  }>;
}

const STATUS_COLORS = {
  approved: 'bg-[var(--color-data-pass)]',
  pending: 'bg-[var(--color-data-provisional)]',
  needs_revision: 'bg-[var(--color-data-provisional)]',
  rejected: 'bg-[var(--color-data-fail)]',
};

const STATUS_ICONS = {
  approved: CheckCircle,
  pending: Clock,
  needs_revision: AlertTriangle,
  rejected: XCircle,
};

export function QuestionQualityDashboard() {
  const [stats, setStats] = useState<QualityStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [systemFilter, setSystemFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const { getToken } = useAuth();

  const fetchStats = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (systemFilter) params.set('system', systemFilter);
      if (statusFilter) params.set('validationStatus', statusFilter);

      const token = await getToken();
      const response = await fetch(`/api/analytics/question-quality?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (!response.ok) {
        throw new Error('Failed to fetch quality stats');
      }

      const data = (await response.json()) as {
        success?: boolean;
        data?: unknown;
        error?: string;
      };
      if (data.success) {
        setStats(data.data as QualityStats);
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stats');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [systemFilter, statusFilter]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-[var(--color-bg-secondary)] rounded w-1/3" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-[var(--color-bg-secondary)] rounded-xl" />
            ))}
          </div>
          <div className="h-64 bg-[var(--color-bg-secondary)] rounded-xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-[var(--color-data-fail)]/10 border border-[var(--color-data-fail)]/20 rounded-xl p-4">
          <p className="text-[var(--color-data-fail)]">{error}</p>
          <button
            onClick={fetchStats}
            className="mt-2 text-sm text-[var(--color-data-fail)] hover:text-[var(--color-data-fail)]/80 flex items-center gap-1"
          >
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const qualityTotal = Object.values(stats.qualityDistribution).reduce((a, b) => a + b, 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
          Question Quality Dashboard
        </h1>
        <button
          onClick={fetchStats}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-[var(--color-accent)] text-white rounded-lg hover:bg-[var(--color-accent)]/90 transition-colors"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <Filter className="w-5 h-5 text-[var(--color-text-muted)]" />
        <select
          value={systemFilter}
          onChange={(e) => setSystemFilter(e.target.value)}
          className="px-3 py-2 border rounded-lg dark:bg-[var(--color-bg-secondary)] dark:border-[var(--color-border)]"
        >
          <option value="">All Systems</option>
          {stats.systemCoverage.map((s) => (
            <option key={s.system} value={s.system}>
              {s.system}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border rounded-lg dark:bg-[var(--color-bg-secondary)] dark:border-[var(--color-border)]"
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="needs_revision">Needs Revision</option>
        </select>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Questions"
          value={stats.overview.totalQuestions.toLocaleString()}
          icon={BarChart2}
          color="blue"
        />
        <StatCard
          title="Avg Quality Score"
          value={`${stats.overview.avgQualityScore}%`}
          icon={TrendingUp}
          color={
            stats.overview.avgQualityScore >= 70
              ? 'green'
              : stats.overview.avgQualityScore >= 50
                ? 'yellow'
                : 'red'
          }
        />
        <StatCard
          title="Avg Flag Rate"
          value={`${(stats.overview.avgFlagRate * 100).toFixed(1)}%`}
          icon={Flag}
          color={
            stats.overview.avgFlagRate <= 0.05
              ? 'green'
              : stats.overview.avgFlagRate <= 0.1
                ? 'yellow'
                : 'red'
          }
        />
        <StatCard
          title="Overall Accuracy"
          value={`${stats.overview.overallAccuracy}%`}
          icon={CheckCircle}
          color={
            stats.overview.overallAccuracy >= 60
              ? 'green'
              : stats.overview.overallAccuracy >= 40
                ? 'yellow'
                : 'red'
          }
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Validation Status Breakdown */}
        <div className="bg-[var(--color-bg-primary)] rounded-xl p-6 shadow-[0_0_0_1px_var(--color-border),0_1px_2px_0_rgba(0,0,0,0.03)]">
          <h2 className="text-lg font-semibold mb-4">Validation Status</h2>
          <div className="space-y-3">
            {stats.statusBreakdown.map((item) => {
              const Icon = STATUS_ICONS[item.status as keyof typeof STATUS_ICONS] || Clock;
              const percentage =
                stats.overview.totalQuestions > 0
                  ? (item.count / stats.overview.totalQuestions) * 100
                  : 0;

              return (
                <div key={item.status} className="flex items-center gap-3">
                  <Icon
                    className={`w-5 h-5 ${
                      item.status === 'approved'
                        ? 'text-[var(--color-data-pass)]'
                        : item.status === 'rejected'
                          ? 'text-[var(--color-data-fail)]'
                          : item.status === 'needs_revision'
                            ? 'text-[var(--color-data-provisional)]'
                            : 'text-[var(--color-data-provisional)]'
                    }`}
                  />
                  <span className="flex-1 capitalize">{item.status.replace('_', ' ')}</span>
                  <span className="font-mono text-sm">{item.count}</span>
                  <div className="w-24 bg-[var(--color-bg-secondary)] rounded-full h-2 overflow-hidden">
                    <motion.div
                      className={STATUS_COLORS[item.status as keyof typeof STATUS_COLORS]}
                      initial={{ width: 0 }}
                      animate={{ width: `${percentage}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quality Distribution */}
        <div className="bg-[var(--color-bg-primary)] rounded-xl p-6 shadow-[0_0_0_1px_var(--color-border),0_1px_2px_0_rgba(0,0,0,0.03)]">
          <h2 className="text-lg font-semibold mb-4">Quality Distribution</h2>
          <div className="space-y-3">
            {Object.entries(stats.qualityDistribution).map(([tier, count]) => {
              const percentage = qualityTotal > 0 ? (count / qualityTotal) * 100 : 0;
              const colors = {
                excellent: 'bg-[var(--color-data-pass)]',
                good: 'bg-[var(--color-accent)]',
                fair: 'bg-[var(--color-data-provisional)]',
                poor: 'bg-[var(--color-data-fail)]',
              };

              return (
                <div key={tier} className="flex items-center gap-3">
                  <span className="w-20 capitalize text-sm">{tier}</span>
                  <div className="flex-1 bg-[var(--color-bg-secondary)] rounded-full h-4 overflow-hidden">
                    <motion.div
                      className={colors[tier as keyof typeof colors]}
                      initial={{ width: 0 }}
                      animate={{ width: `${percentage}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                  <span className="font-mono text-sm w-16 text-right">
                    {count} ({percentage.toFixed(0)}%)
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-4 text-xs text-[var(--color-text-muted)]">
            Excellent: 80-100 | Good: 60-79 | Fair: 40-59 | Poor: 0-39
          </div>
        </div>

        {/* System Coverage */}
        <div className="bg-[var(--color-bg-primary)] rounded-xl p-6 shadow-[0_0_0_1px_var(--color-border),0_1px_2px_0_rgba(0,0,0,0.03)]">
          <h2 className="text-lg font-semibold mb-4">System Coverage</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="text-left py-2">System</th>
                  <th className="text-right py-2">Count</th>
                  <th className="text-right py-2">Avg Quality</th>
                  <th className="text-right py-2">Flag Rate</th>
                </tr>
              </thead>
              <tbody>
                {stats.systemCoverage.map((system) => (
                  <tr key={system.system} className="border-b border-[var(--color-border)]">
                    <td className="py-2">{system.system}</td>
                    <td className="text-right font-mono">{system.count}</td>
                    <td className="text-right font-mono">
                      {system.avgQualityScore ? `${system.avgQualityScore}%` : '-'}
                    </td>
                    <td className="text-right font-mono">
                      {system.avgFlagRate !== null
                        ? `${(system.avgFlagRate * 100).toFixed(1)}%`
                        : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Flagged Questions */}
        <div className="bg-[var(--color-bg-primary)] rounded-xl p-6 shadow-[0_0_0_1px_var(--color-border),0_1px_2px_0_rgba(0,0,0,0.03)]">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Flag className="w-5 h-5 text-[var(--color-data-fail)]" />
            Top Flagged Questions
          </h2>
          {stats.topFlagged.length === 0 ? (
            <p className="text-[var(--color-text-muted)] text-sm">No flagged questions</p>
          ) : (
            <div className="space-y-2">
              {stats.topFlagged.map((q) => (
                <div
                  key={q.id}
                  className="flex items-center gap-3 p-2 bg-[var(--color-bg-secondary)] rounded-lg"
                >
                  <span className="text-xs font-mono truncate flex-1">{q.id.slice(0, 8)}...</span>
                  <span className="text-xs text-[var(--color-text-muted)]">{q.system}</span>
                  <span className="text-xs bg-[var(--color-data-fail)]/10 text-[var(--color-data-fail)] px-2 py-0.5 rounded">
                    {q.flagCount} flags
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  color,
}: {
  title: string;
  value: string;
  icon: any;
  color: 'blue' | 'green' | 'yellow' | 'red';
}) {
  const colorClasses = {
    blue: 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]',
    green: 'bg-[var(--color-data-pass)]/10 text-[var(--color-data-pass)]',
    yellow: 'bg-[var(--color-data-provisional)]/10 text-[var(--color-data-provisional)]',
    red: 'bg-[var(--color-data-fail)]/10 text-[var(--color-data-fail)]',
  };

  return (
    <motion.div
      initial={{ y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[var(--color-bg-primary)] rounded-xl p-4 shadow-[0_0_0_1px_var(--color-border),0_1px_2px_0_rgba(0,0,0,0.03)]"
    >
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-sm text-[var(--color-text-secondary)]">{title}</p>
          <p className="text-xl font-bold text-[var(--color-text-primary)]">{value}</p>
        </div>
      </div>
    </motion.div>
  );
}

export default QuestionQualityDashboard;
