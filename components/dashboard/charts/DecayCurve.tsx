import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import ChartContainer from '../../shared/ChartContainer';
import { EmptyChartState } from '@/components/analytics/EmptyChartState';

interface DecayCurveData {
  day: number;
  /**
   * Retention probability as a percent in [0, 100].
   * May be null when the backend returns an explicit insufficient-data marker
   * for a point (e.g. no review history to compute retrievability). Null points
   * are filtered out; if every point is null, an empty state is rendered.
   */
  retentionProb: number | null;
}

interface DecayCurveProps {
  data: DecayCurveData[];
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: DecayCurveData }>;
}

export const DecayCurve: React.FC<DecayCurveProps> = ({ data }) => {
  // Null-safe normalization: drop points without a retentionProb. If nothing
  // is left, show an explicit empty state instead of a flat/fake curve.
  const safeData = React.useMemo(
    () =>
      (data ?? []).filter(
        (d): d is { day: number; retentionProb: number } =>
          d != null &&
          typeof d.day === 'number' &&
          Number.isFinite(d.day) &&
          typeof d.retentionProb === 'number' &&
          Number.isFinite(d.retentionProb)
      ),
    [data]
  );

  if (safeData.length === 0) {
    return (
      <EmptyChartState
        chartType="area"
        height={300}
        message="Not enough review history yet to plot a forgetting curve."
      />
    );
  }

  const CustomTooltip = ({ active, payload }: CustomTooltipProps) => {
    const firstPayload = payload?.[0];
    if (active && payload && payload.length && firstPayload) {
      const { day, retentionProb } = firstPayload.payload;
      if (retentionProb == null || !Number.isFinite(retentionProb)) return null;
      return (
        <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg px-3 py-2 shadow-lg">
          <p className="text-[var(--color-text-primary)] font-semibold text-sm">
            Day {day}: {Math.round(retentionProb)}%
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div role="figure" aria-label="Memory decay curve showing retention probability over 30 days">
      <span className="sr-only">
        Chart showing how memory retention decays over time. A reference line at 90% marks the critical threshold.
      </span>
    <ChartContainer minHeight={300} className="min-h-[200px] w-full">
      <ResponsiveContainer width="100%" height={300} minHeight={200} minWidth={0}>
        <AreaChart data={safeData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="retentionGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid-stroke)" vertical={false} />

          <XAxis
            dataKey="day"
            stroke="var(--color-border)"
            tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
            tickLine={{ stroke: 'var(--chart-grid-stroke)' }}
            ticks={[0, 7, 14, 21, 30]}
          />

          <YAxis
            stroke="var(--color-border)"
            tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
            tickLine={{ stroke: 'var(--chart-grid-stroke)' }}
            domain={[0, 100]}
          />

          <ReferenceLine
            y={90}
            stroke="var(--color-data-fail)"
            strokeDasharray="3 3"
            strokeWidth={1.5}
            label={{
              value: 'Critical',
              position: 'right',
              fill: 'var(--color-data-fail)',
              fontSize: 10,
              fontWeight: 600,
            }}
          />

          <Tooltip
            content={<CustomTooltip />}
            cursor={{ stroke: 'var(--color-accent)', strokeWidth: 1 }}
          />

          <Area
            type="monotone"
            dataKey="retentionProb"
            stroke="var(--color-accent)"
            strokeWidth={2}
            fill="url(#retentionGradient)"
            animationDuration={1000}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartContainer>
    </div>
  );
};

export default DecayCurve;
