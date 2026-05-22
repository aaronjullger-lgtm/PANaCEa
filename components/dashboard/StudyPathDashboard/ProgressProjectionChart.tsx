import React, { useCallback } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useAuth, useUser } from '@clerk/clerk-react';
import useSWR from 'swr';
import { TrendingUp, BarChart3 } from 'lucide-react';
import { getApiEndpoint, API_ENDPOINTS } from '@/lib/utils/apiConfig';
import { getApiEnvelopeError, unwrapApiEnvelope } from '@/lib/utils/apiEnvelope';
import { InlineSpinner } from '@/components/loading';
import { WorkspaceEmptyState } from '@/components/workspace';
import type { ProgressResponse } from '@/types';

// ============================================================================
// Authenticated Fetcher for Progress Data
// ============================================================================

function createProgressFetcher(getToken: () => Promise<string | null>) {
  return async (url: string): Promise<ProgressResponse> => {
    const token = await getToken();
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(getApiEnvelopeError(data, 'Unable to load progress projection. Please try again.'));
    }
    return unwrapApiEnvelope<ProgressResponse>(data);
  };
}

// ============================================================================
// Progress Projection Chart Component
// ============================================================================

interface ProgressProjectionChartProps {
  /** Optional plan ID; if not provided, fetches latest plan progress */
  planId?: string;
  /** Optional constraints to pass to the progress endpoint */
  constraints?: {
    dailyMinutesLimit?: number;
    examDate?: Date;
    targetRetention?: number;
  };
}

const ProgressProjectionChart: React.FC<ProgressProjectionChartProps> = ({
  planId,
  constraints,
}) => {
  const { user } = useUser();
  const { getToken } = useAuth();
  const fetcher = useCallback(createProgressFetcher(getToken), [getToken]);

  // Build query string
  const queryParams = new URLSearchParams();
  if (planId) queryParams.set('planId', planId);
  if (constraints?.dailyMinutesLimit)
    queryParams.set('dailyMinutesLimit', constraints.dailyMinutesLimit.toString());
  if (constraints?.examDate)
    queryParams.set('examDate', constraints.examDate.toISOString());
  if (constraints?.targetRetention)
    queryParams.set('targetRetention', constraints.targetRetention.toString());

  const queryString = queryParams.toString();
  const endpoint = `${getApiEndpoint(API_ENDPOINTS.STUDY_PATH_PROGRESS)}${
    queryString ? `?${queryString}` : ''
  }`;

  const { data, error, isLoading } = useSWR<ProgressResponse>(
    user ? endpoint : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );

  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center h-64"
        role="status"
        aria-live="polite"
      >
        <div className="text-center">
          <InlineSpinner size="lg" className="text-[var(--color-accent)]" />
          <p className="mt-4 text-[var(--color-text-secondary)]">Loading progress projection...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <WorkspaceEmptyState
        icon={BarChart3}
        title="Progress projection unavailable"
        description="Unable to load progress data. The study optimizer may still be running — try again in a moment."
      />
    );
  }

  const projections = data?.projections || [];
  const metrics = data?.metrics;

  if (projections.length === 0) {
    return (
      <WorkspaceEmptyState
        icon={TrendingUp}
        title="No projection data available"
        description="Complete a study session to see how the optimizer projects your retention, accuracy, and blueprint coverage will improve over time."
      />
    );
  }

  // Format data for chart
  const chartData = projections.map((proj) => ({
    date: new Date(proj.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    retention: proj.projectedRetention * 100,
    accuracy: proj.projectedAccuracy * 100,
    coverage: proj.projectedCoverage * 100,
    cumulativeMinutes: proj.cumulativeStudyMinutes,
  }));

  // Determine if we have multiple metrics to show
  const hasAccuracy = chartData.some((d) => d.accuracy !== undefined);
  const hasCoverage = chartData.some((d) => d.coverage !== undefined);

  return (
    <div className="w-full" role="figure" aria-label="Progress projection chart">
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis
            dataKey="date"
            stroke="var(--color-text-muted)"
            fontSize={12}
            tickLine={false}
            axisLine={{ stroke: 'var(--color-border)' }}
          />
          <YAxis
            yAxisId="left"
            stroke="var(--color-text-muted)"
            fontSize={12}
            tickLine={false}
            axisLine={{ stroke: 'var(--color-border)' }}
            label={{
              value: 'Retention / Accuracy (%)',
              angle: -90,
              position: 'insideLeft',
              offset: 10,
              style: { fill: 'var(--color-text-muted)', fontSize: 12 },
            }}
            tickFormatter={(value) => `${Math.round(value)}%`}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            stroke="var(--color-text-muted)"
            fontSize={12}
            tickLine={false}
            axisLine={{ stroke: 'var(--color-border)' }}
            label={{
              value: 'Coverage (%)',
              angle: 90,
              position: 'insideRight',
              offset: 10,
              style: { fill: 'var(--color-text-muted)', fontSize: 12 },
            }}
            tickFormatter={(value) => `${Math.round(value)}%`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--color-bg-card)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              color: 'var(--color-text-primary)',
            }}
            formatter={(value, name) => {
              const numericValue = Array.isArray(value) ? Number(value[0]) : Number(value);
              const label = typeof name === 'string'
                ? name.charAt(0).toUpperCase() + name.slice(1)
                : String(name);
              return [`${numericValue.toFixed(1)}%`, label] as [string, string];
            }}
            labelFormatter={(label) => `Date: ${label}`}
          />
          <Legend
            verticalAlign="top"
            height={36}
            iconType="circle"
            wrapperStyle={{ paddingBottom: 10 }}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="retention"
            name="Retention"
            stroke="var(--color-success)"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
          {hasAccuracy && (
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="accuracy"
              name="Accuracy"
              stroke="var(--color-accent)"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          )}
          {hasCoverage && (
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="coverage"
              name="Coverage"
              stroke="var(--color-info)"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="text-center p-4 rounded-lg bg-[var(--color-bg-secondary)]">
            <div className="text-2xl font-bold text-[var(--color-text-primary)]">
              {metrics.totalStudyDays}
            </div>
            <div className="text-sm text-[var(--color-text-secondary)]">Total Study Days</div>
          </div>
          <div className="text-center p-4 rounded-lg bg-[var(--color-bg-secondary)]">
            <div className="text-2xl font-bold text-[var(--color-text-primary)]">
              {Math.round(metrics.averageDailyMinutes)}
            </div>
            <div className="text-sm text-[var(--color-text-secondary)]">Avg Minutes per Day</div>
          </div>
          <div className="text-center p-4 rounded-lg bg-[var(--color-bg-secondary)]">
            <div className="text-2xl font-bold text-[var(--color-text-primary)]">
              +{(metrics.estimatedRetentionIncrease * 100).toFixed(1)}%
            </div>
            <div className="text-sm text-[var(--color-text-secondary)]">Estimated Retention Increase</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProgressProjectionChart;
