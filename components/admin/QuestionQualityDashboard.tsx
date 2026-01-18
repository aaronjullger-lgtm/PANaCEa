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
  approved: 'bg-green-500',
  pending: 'bg-yellow-500',
  needs_revision: 'bg-orange-500',
  rejected: 'bg-red-500',
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

      const data = await response.json();
      if (data.success) {
        setStats(data.data);
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
          <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-slate-200 dark:bg-slate-700 rounded-xl" />
            ))}
          </div>
          <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <p className="text-red-700 dark:text-red-300">{error}</p>
          <button
            onClick={fetchStats}
            className="mt-2 text-sm text-red-600 hover:text-red-800 flex items-center gap-1"
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
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Question Quality Dashboard
        </h1>
        <button
          onClick={fetchStats}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <Filter className="w-5 h-5 text-slate-500" />
        <select
          value={systemFilter}
          onChange={(e) => setSystemFilter(e.target.value)}
          className="px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-600"
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
          className="px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-600"
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
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm">
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
                        ? 'text-green-500'
                        : item.status === 'rejected'
                          ? 'text-red-500'
                          : item.status === 'needs_revision'
                            ? 'text-orange-500'
                            : 'text-yellow-500'
                    }`}
                  />
                  <span className="flex-1 capitalize">{item.status.replace('_', ' ')}</span>
                  <span className="font-mono text-sm">{item.count}</span>
                  <div className="w-24 bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
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
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Quality Distribution</h2>
          <div className="space-y-3">
            {Object.entries(stats.qualityDistribution).map(([tier, count]) => {
              const percentage = qualityTotal > 0 ? (count / qualityTotal) * 100 : 0;
              const colors = {
                excellent: 'bg-green-500',
                good: 'bg-blue-500',
                fair: 'bg-yellow-500',
                poor: 'bg-red-500',
              };

              return (
                <div key={tier} className="flex items-center gap-3">
                  <span className="w-20 capitalize text-sm">{tier}</span>
                  <div className="flex-1 bg-slate-200 dark:bg-slate-700 rounded-full h-4 overflow-hidden">
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
          <div className="mt-4 text-xs text-slate-500">
            Excellent: 80-100 | Good: 60-79 | Fair: 40-59 | Poor: 0-39
          </div>
        </div>

        {/* System Coverage */}
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">System Coverage</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b dark:border-slate-700">
                  <th className="text-left py-2">System</th>
                  <th className="text-right py-2">Count</th>
                  <th className="text-right py-2">Avg Quality</th>
                  <th className="text-right py-2">Flag Rate</th>
                </tr>
              </thead>
              <tbody>
                {stats.systemCoverage.map((system) => (
                  <tr key={system.system} className="border-b dark:border-slate-700/50">
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
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Flag className="w-5 h-5 text-red-500" />
            Top Flagged Questions
          </h2>
          {stats.topFlagged.length === 0 ? (
            <p className="text-slate-500 text-sm">No flagged questions</p>
          ) : (
            <div className="space-y-2">
              {stats.topFlagged.map((q) => (
                <div
                  key={q.id}
                  className="flex items-center gap-3 p-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg"
                >
                  <span className="text-xs font-mono truncate flex-1">{q.id.slice(0, 8)}...</span>
                  <span className="text-xs text-slate-500">{q.system}</span>
                  <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-2 py-0.5 rounded">
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
    blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    green: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
    yellow: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400',
    red: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm"
    >
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">{title}</p>
          <p className="text-xl font-bold text-slate-900 dark:text-white">{value}</p>
        </div>
      </div>
    </motion.div>
  );
}

export default QuestionQualityDashboard;
