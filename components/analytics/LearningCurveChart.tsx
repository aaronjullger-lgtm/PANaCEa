/**
 * Learning Curve Chart Component
 * Displays accuracy, stability, and response time trends over time using Recharts.
 */

import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Brush,
} from 'recharts';
import { ChartContainer } from '@/components/shared/ChartContainer';
import { useLearningCurveData } from '@/hooks/useLearningCurveData';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { EmptyChartState } from '@/components/analytics/EmptyChartState';
import { Calendar, TrendingUp, Brain, Clock } from 'lucide-react';

interface TimeRangeOption {
  label: string;
  days: number;
}

const TIME_RANGES: TimeRangeOption[] = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: 'All time', days: 90 }, // max supported by API
];

export const LearningCurveChart: React.FC = () => {
  const [selectedRange, setSelectedRange] = useState<TimeRangeOption>(TIME_RANGES[1]); // default 30 days
  const { data, isLoading, error, isEmpty } = useLearningCurveData({
    days: selectedRange.days,
  });

  const chartData = useMemo(() => {
    if (!data?.points) return [];
    return data.points.map((point) => ({
      date: point.date,
      // Format date for display (e.g., "Mar 1")
      formattedDate: new Date(point.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
      accuracy: point.accuracy,
      stability: point.avgStability,
      duration: point.avgDurationMs ? point.avgDurationMs / 1000 : undefined, // convert to seconds
      attempts: point.attempts,
    }));
  }, [data]);

  const handleRangeChange = (range: TimeRangeOption) => {
    setSelectedRange(range);
  };

  if (error) {
    return (
      <div className="bg-[var(--color-bg-primary)] rounded-xl border border-[var(--color-border)] p-6 text-center">
        <p className="text-error">Failed to load learning curve data.</p>
        <p className="text-sm text-text-[var(--color-text-muted)] mt-1">{error.message}</p>
      </div>
    );
  }

  if (isLoading) {
    return <SkeletonLoader height="400px" className="rounded-xl" />;
  }

  if (isEmpty) {
    return (
      <EmptyChartState
        icon={<Calendar className="w-12 h-12 text-text-[var(--color-text-muted)]" />}
        title="No data yet"
        message="Complete some questions to see your learning curve."
      />
    );
  }

  // Determine which series have data
  const hasAccuracy = chartData.some((d) => d.accuracy != null);
  const hasStability = chartData.some((d) => d.stability != null);
  const hasDuration = chartData.some((d) => d.duration != null);

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg p-3 shadow-lg">
          <p className="font-medium text-text-primary">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value} {entry.unit || ''}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-4">
      {/* Header with title and range selector */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-accent" />
            Learning Curve
          </h3>
          <p className="text-sm text-text-[var(--color-text-muted)]">
            Track your performance, memory stability, and response times over time.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {TIME_RANGES.map((range) => (
            <button
              key={range.days}
              type="button"
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                selectedRange.days === range.days
                  ? 'bg-action-primary text-white border-action-primary'
                  : 'bg-surface-secondary border-border hover:bg-[var(--color-bg-tertiary)]'
              }`}
              onClick={() => handleRangeChange(range)}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div
        className="bg-[var(--color-bg-primary)] rounded-xl border border-[var(--color-border)] p-4"
        role="img"
        aria-label="Learning curve chart showing accuracy, stability, and response time trends over selected period"
      >
        <ChartContainer minHeight={400}>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis
                dataKey="formattedDate"
                stroke="var(--color-text-[var(--color-text-muted)])"
                fontSize={12}
                tickLine={false}
                axisLine={{ stroke: 'var(--color-border)' }}
              />
              <YAxis
                yAxisId="left"
                stroke="var(--color-text-[var(--color-text-muted)])"
                fontSize={12}
                tickLine={false}
                axisLine={{ stroke: 'var(--color-border)' }}
                label={{
                  value: 'Accuracy (%)',
                  angle: -90,
                  position: 'insideLeft',
                  offset: 10,
                  style: { fill: 'var(--color-text-[var(--color-text-muted)])', fontSize: 12 },
                }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="var(--color-text-[var(--color-text-muted)])"
                fontSize={12}
                tickLine={false}
                axisLine={{ stroke: 'var(--color-border)' }}
                label={{
                  value: 'Stability / Duration (s)',
                  angle: 90,
                  position: 'insideRight',
                  offset: 10,
                  style: { fill: 'var(--color-text-[var(--color-text-muted)])', fontSize: 12 },
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="top"
                height={36}
                iconType="circle"
                wrapperStyle={{ paddingBottom: 10 }}
              />
              {hasAccuracy && (
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="accuracy"
                  name="Accuracy"
                  stroke="var(--color-success)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                  unit="%"
                />
              )}
              {hasStability && (
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="stability"
                  name="Stability"
                  stroke="var(--color-accent)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              )}
              {hasDuration && (
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="duration"
                  name="Response Time"
                  stroke="var(--color-warning)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                  unit="s"
                />
              )}
              <Brush
                dataKey="formattedDate"
                height={30}
                stroke="var(--color-border)"
                fill="var(--color-bg-secondary)"
                travellerWidth={10}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </div>

      {/* Summary stats */}
      {data?.summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-surface-secondary rounded-lg p-3">
            <p className="text-xs text-text-[var(--color-text-muted)] font-medium">Total Questions</p>
            <p className="text-xl font-bold text-text-primary">{data.summary.totalAttempts}</p>
          </div>
          <div className="bg-surface-secondary rounded-lg p-3">
            <p className="text-xs text-text-[var(--color-text-muted)] font-medium">Avg Accuracy</p>
            <p className="text-xl font-bold text-text-primary">
              {data.summary.avgAccuracy.toFixed(1)}%
            </p>
          </div>
          {data.summary.avgStability && (
            <div className="bg-surface-secondary rounded-lg p-3">
              <p className="text-xs text-text-[var(--color-text-muted)] font-medium">Avg Stability</p>
              <p className="text-xl font-bold text-text-primary">
                {data.summary.avgStability.toFixed(1)}
              </p>
            </div>
          )}
          <div className="bg-surface-secondary rounded-lg p-3">
            <p className="text-xs text-text-[var(--color-text-muted)] font-medium">Active Days</p>
            <p className="text-xl font-bold text-text-primary">{chartData.length}</p>
          </div>
        </div>
      )}
    </div>
  );
};