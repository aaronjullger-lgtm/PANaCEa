import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import ChartContainer from '../shared/ChartContainer';
import { useAuth } from '@clerk/clerk-react';
import { getApiEndpoint } from '../../lib/utils/apiConfig';
import { toast } from 'sonner';
import FSRSInsightCard from './FSRSInsightCard';

/**
 * Shape returned by GET /api/analytics/srs-summary
 */
interface SRSAnalyticsSummary {
  totalCards: number;
  reviewsDue: number;
  avgStability: number;
  avgDifficulty: number;
  projectedRetention: number;
  stabilityDistribution: { range: string; count: number }[];
  stateDistribution: { state: string; count: number }[];
  systemBreakdown: {
    system: string;
    cardCount: number;
    avgStability: number;
    avgDifficulty: number;
    reviewsDue: number;
  }[];
  recentReviews: number;
  recentNewCards: number;
  learningVelocity: number;
  stabilityTrend: { date: string; avgStability: number }[];
}

/**
 * Fetch real SRS analytics summary from the backend.
 */
async function fetchSrsSummary(token: string): Promise<SRSAnalyticsSummary> {
  const url = getApiEndpoint('/api/analytics/srs-summary');
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`SRS summary request failed: ${res.status}`);
  }
  return res.json();
}

const SrsDashboard = () => {
  const [summary, setSummary] = useState<SRSAnalyticsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { userId, getToken } = useAuth();

  useEffect(() => {
    const loadData = async () => {
      if (!userId) return;
      setIsLoading(true);
      try {
        const token = await getToken();
        if (!token) throw new Error('No auth token');
        const data = await fetchSrsSummary(token);
        setSummary(data);
      } catch (error) {
        console.error('SRS analytics fetch error:', error);
        toast.error('Failed to load SRS analytics data.');
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [userId, getToken]);

  // Derive chart-friendly data from the API response
  const analytics = useMemo(() => {
    if (!summary) {
      return {
        retentionRate: 0,
        avgStability: 0,
        reviewsDue: 0,
        totalCards: 0,
        recentReviews: 0,
        learningVelocity: 0,
        stabilityDistribution: [],
        stateDistribution: [],
        systemBreakdown: [],
        topSystem: null as SRSAnalyticsSummary['systemBreakdown'][number] | null,
      };
    }

    return {
      retentionRate: summary.projectedRetention,
      avgStability: summary.avgStability,
      reviewsDue: summary.reviewsDue,
      totalCards: summary.totalCards,
      recentReviews: summary.recentReviews,
      learningVelocity: summary.learningVelocity,
      stabilityDistribution: summary.stabilityDistribution.map((b) => ({
        name: b.range,
        count: b.count,
      })),
      stateDistribution: summary.stateDistribution.map((s) => ({
        name: s.state.charAt(0).toUpperCase() + s.state.slice(1),
        count: s.count,
      })),
      systemBreakdown: summary.systemBreakdown,
      topSystem: summary.systemBreakdown[0] ?? null,
    };
  }, [summary]);

  if (isLoading) {
    return (
      <div className="p-6 bg-[var(--color-bg-secondary)] rounded-lg">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 bg-[var(--color-bg-tertiary)] rounded" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-[var(--color-bg-tertiary)] rounded-xl" />
            ))}
          </div>
          <div className="h-64 bg-[var(--color-bg-tertiary)] rounded-xl" />
        </div>
      </div>
    );
  }

  if (!summary || analytics.totalCards === 0) {
    return (
      <div className="p-6 bg-[var(--color-bg-secondary)] rounded-lg text-center py-12">
        <h2 className="text-2xl font-bold mb-4 text-[var(--color-text-primary)]">
          Spaced Repetition (SRS) Analytics
        </h2>
        <p className="text-[var(--color-text-muted)]">
          No review data yet. Start studying to see your SRS analytics here.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-[var(--color-bg-secondary)] rounded-lg">
      <h2 className="text-2xl font-bold mb-6 text-[var(--color-text-primary)]">
        Spaced Repetition (SRS) Analytics
      </h2>

      {/* Core Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="p-4 bg-[var(--color-bg-primary)] rounded-xl shadow">
          <h3 className="text-sm font-medium text-[var(--color-text-muted)]">
            Projected Retention
          </h3>
          <p className="text-3xl font-bold text-[var(--color-text-primary)]">
            {analytics.retentionRate.toFixed(1)}%
          </p>
        </div>
        <div className="p-4 bg-[var(--color-bg-primary)] rounded-xl shadow">
          <h3 className="text-sm font-medium text-[var(--color-text-muted)]">
            Average Stability (Days)
          </h3>
          <p className="text-3xl font-bold text-[var(--color-text-primary)]">
            {analytics.avgStability.toFixed(1)}
          </p>
        </div>
        <div className="p-4 bg-[var(--color-bg-primary)] rounded-xl shadow">
          <h3 className="text-sm font-medium text-[var(--color-text-muted)]">Reviews Due Today</h3>
          <p className="text-3xl font-bold text-[var(--color-text-primary)]">
            {analytics.reviewsDue}
          </p>
        </div>
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="p-3 bg-[var(--color-bg-primary)] rounded-lg">
          <h4 className="text-xs font-medium text-[var(--color-text-muted)]">Total Cards</h4>
          <p className="text-xl font-semibold text-[var(--color-text-primary)]">
            {analytics.totalCards}
          </p>
        </div>
        <div className="p-3 bg-[var(--color-bg-primary)] rounded-lg">
          <h4 className="text-xs font-medium text-[var(--color-text-muted)]">Reviewed (7d)</h4>
          <p className="text-xl font-semibold text-[var(--color-text-primary)]">
            {analytics.recentReviews}
          </p>
        </div>
        <div className="p-3 bg-[var(--color-bg-primary)] rounded-lg">
          <h4 className="text-xs font-medium text-[var(--color-text-muted)]">Cards/Day</h4>
          <p className="text-xl font-semibold text-[var(--color-text-primary)]">
            {analytics.learningVelocity.toFixed(1)}
          </p>
        </div>
        <div className="p-3 bg-[var(--color-bg-primary)] rounded-lg">
          <h4 className="text-xs font-medium text-[var(--color-text-muted)]">Avg Difficulty</h4>
          <p className="text-xl font-semibold text-[var(--color-text-primary)]">
            {summary?.avgDifficulty.toFixed(1) ?? '—'}
          </p>
        </div>
      </div>

      {/* Stability Distribution */}
      <div className="mb-6">
        <h2 className="text-xl md:text-2xl font-bold mb-4 text-[var(--color-text-primary)]">
          Memory Stability Distribution
        </h2>
        <ChartContainer minHeight={300} className="min-h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%" minHeight={200} minWidth={0}>
            <BarChart data={analytics.stabilityDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" fill="var(--color-accent)" name="Number of Items" />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </div>

      {/* Card State Distribution */}
      {analytics.stateDistribution.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xl md:text-2xl font-bold mb-4 text-[var(--color-text-primary)]">
            Card State Distribution
          </h2>
          <ChartContainer minHeight={250} className="min-h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%" minHeight={200} minWidth={0}>
              <BarChart data={analytics.stateDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="var(--color-data-pass, #22c55e)" name="Cards" />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>
      )}

      {/* System Breakdown Table */}
      {analytics.systemBreakdown.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xl md:text-2xl font-bold mb-4 text-[var(--color-text-primary)]">
            System Breakdown
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="text-left py-2 px-3 text-[var(--color-text-muted)]">System</th>
                  <th className="text-right py-2 px-3 text-[var(--color-text-muted)]">Cards</th>
                  <th className="text-right py-2 px-3 text-[var(--color-text-muted)]">
                    Avg Stability
                  </th>
                  <th className="text-right py-2 px-3 text-[var(--color-text-muted)]">Due</th>
                </tr>
              </thead>
              <tbody>
                {analytics.systemBreakdown.map((sys) => (
                  <tr
                    key={sys.system}
                    className="border-b border-[var(--color-border)]/50 hover:bg-[var(--color-bg-tertiary)]/50"
                  >
                    <td className="py-2 px-3 text-[var(--color-text-primary)]">{sys.system}</td>
                    <td className="text-right py-2 px-3 text-[var(--color-text-primary)]">
                      {sys.cardCount}
                    </td>
                    <td className="text-right py-2 px-3 text-[var(--color-text-primary)]">
                      {sys.avgStability.toFixed(1)}d
                    </td>
                    <td className="text-right py-2 px-3 text-[var(--color-text-primary)]">
                      {sys.reviewsDue}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* FSRS Insight Card - Top System Deep Dive */}
      {analytics.topSystem && (
        <div className="mt-6">
          <h2 className="text-xl md:text-2xl font-bold mb-4 text-[var(--color-text-primary)]">
            Top System Deep Dive
          </h2>
          <FSRSInsightCard
            data={{
              conceptName: analytics.topSystem.system,
              conditionId: `system-${analytics.topSystem.system.toLowerCase().replace(/\s+/g, '-')}`,
              system: analytics.topSystem.system,
              stability: analytics.topSystem.avgStability,
              difficulty: analytics.topSystem.avgDifficulty,
              retrievability: analytics.retentionRate / 100,
              state: 'review',
              dueDate: new Date(
                Date.now() + Math.round(analytics.topSystem.avgStability) * 86400000
              ),
              reviewCount: analytics.topSystem.cardCount,
              lastReview: new Date(),
              stabilityHistory:
                summary?.stabilityTrend.map((t) => ({
                  date: t.date,
                  stability: t.avgStability,
                })) ?? [],
            }}
            compact={false}
          />
        </div>
      )}
    </div>
  );
};

export default SrsDashboard;
