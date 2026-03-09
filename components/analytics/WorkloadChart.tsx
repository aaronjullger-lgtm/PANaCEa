/**
 * CMRR Workload Chart Component (Phase 5: Self-Optimizing Engine)
 *
 * Visualizes the relationship between retention target and daily workload.
 * Highlights the CMRR point (Compute Minimum Recommended Retention) - the
 * optimal balance between retention and review burden.
 *
 * Reference: FSRS Paper - The "sweet spot" is typically 85-88% retention,
 * where you get maximum knowledge retention per minute of study time.
 */

import React from 'react';
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts';
import ChartContainer from '../shared/ChartContainer';
import { Bar } from 'recharts/es6/cartesian/Bar';
import { useWorkloadProjection } from '../../hooks/useWorkloadProjection';

interface WorkloadChartProps {
  dailyNewCards: number;
  availableTimeMinutes?: number;
  currentCardCount?: number;
  customParameters?: number[];
  showTimeAxis?: boolean;
  height?: number;
}

/**
 * Custom tooltip showing detailed workload breakdown
 */
const CustomTooltip: React.FC<any> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0].payload;

  return (
    <div className="bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-lg p-4 shadow-xl">
      <p className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">
        {(data.retention * 100).toFixed(0)}% Retention Target
        {data.isCMRR && (
          <span className="ml-2 px-2 py-0.5 bg-[var(--color-accent)]/15 text-[var(--color-accent)] text-xs rounded">
            CMRR
          </span>
        )}
      </p>

      <div className="space-y-1 text-xs">
        <div className="flex justify-between gap-4">
          <span className="text-[var(--color-text-secondary)]">Daily Reviews:</span>
          <span className="font-mono text-[var(--color-text-primary)]">
            {data.reviews.toFixed(0)} cards
          </span>
        </div>

        <div className="flex justify-between gap-4">
          <span className="text-[var(--color-text-secondary)]">Time Required:</span>
          <span className="font-mono text-[var(--color-text-primary)]">
            {data.minutes.toFixed(0)} min/day
          </span>
        </div>

        <div className="flex justify-between gap-4">
          <span className="text-[var(--color-text-secondary)]">Sustainability:</span>
          <span
            className={`font-mono ${
              data.minutes <= 30
                ? 'text-[var(--color-success)]'
                : data.minutes <= 60
                  ? 'text-[var(--color-warning)]'
                  : 'text-[var(--color-error)]'
            }`}
          >
            {data.minutes <= 30 ? 'High' : data.minutes <= 60 ? 'Medium' : 'Low'}
          </span>
        </div>
      </div>

      {data.isCMRR && (
        <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
          <p className="text-xs text-[var(--color-accent)]">
            Optimal balance of retention and workload
          </p>
        </div>
      )}
    </div>
  );
};

/**
 * Main CMRR Workload Chart Component
 */
export const WorkloadChart: React.FC<WorkloadChartProps> = ({
  dailyNewCards,
  availableTimeMinutes = 60,
  currentCardCount = 0,
  customParameters,
  showTimeAxis = true,
  height = 400,
}) => {
  const { chartData, recommended, isLoading, error } = useWorkloadProjection({
    dailyNewCards,
    availableTimeMinutes,
    currentCardCount,
    customParameters,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-accent)] mx-auto mb-4"></div>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Simulating workload over 365 days...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <div className="text-center text-[var(--color-error)]">
          <p className="text-sm">Failed to generate workload projection</p>
          <p className="text-xs mt-2 text-[var(--color-text-secondary)]">{error}</p>
        </div>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <p className="text-sm text-[var(--color-text-secondary)]">No workload data available</p>
      </div>
    );
  }

  const cmrrPoint = chartData.find((d) => d.isCMRR);
  const maxTime = Math.max(...chartData.map((d) => d.minutes));

  return (
    <div className="w-full">
      {/* Header with CMRR Info */}
      {cmrrPoint && (
        <div className="mb-4 p-4 bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/30 rounded-lg">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-accent)] mb-1">
                Recommended Retention: {(cmrrPoint.retention * 100).toFixed(0)}%
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Optimal balance: {cmrrPoint.reviews.toFixed(0)} reviews/day (
                {cmrrPoint.minutes.toFixed(0)} min) -{' '}
                {cmrrPoint.minutes <= 30 ? 'High' : cmrrPoint.minutes <= 60 ? 'Medium' : 'Low'}{' '}
                sustainability
              </p>
            </div>

            {recommended && (
              <div className="text-right">
                <p className="text-xs text-[var(--color-text-secondary)]">
                  For {availableTimeMinutes} min/day:
                </p>
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                  Target {(recommended.recommendedRetention * 100).toFixed(0)}%
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Chart - use fallback height so Recharts never receives -1 when parent has no size yet */}
      <ChartContainer minHeight={height ?? 300} className="min-h-[200px] w-full">
        <ResponsiveContainer width="100%" height={height ?? 300} minHeight={200} minWidth={0}>
          <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid-stroke)" />

            <XAxis
              dataKey="retention"
              tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
              label={{
                value: 'Retention Target',
                position: 'insideBottom',
                offset: -10,
                style: { fill: 'var(--color-text-secondary)', fontSize: 12 },
              }}
              stroke="var(--color-text-secondary)"
              tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }}
            />

            <YAxis
              yAxisId="left"
              label={{
                value: 'Daily Reviews',
                angle: -90,
                position: 'insideLeft',
                style: { fill: 'var(--color-text-secondary)', fontSize: 12 },
              }}
              stroke="var(--color-text-secondary)"
              tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }}
            />

            {showTimeAxis && (
              <YAxis
                yAxisId="right"
                orientation="right"
                label={{
                  value: 'Time (minutes)',
                  angle: 90,
                  position: 'insideRight',
                  style: { fill: 'var(--color-text-secondary)', fontSize: 12 },
                }}
                stroke="var(--color-text-secondary)"
                tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }}
              />
            )}

            <Tooltip content={<CustomTooltip />} />

            <Legend
              wrapperStyle={{
                paddingTop: '20px',
                fontSize: '12px',
              }}
            />

            {/* Highlight CMRR point */}
            {cmrrPoint && (
              <ReferenceLine
                x={cmrrPoint.retention}
                stroke="var(--color-accent)"
                strokeDasharray="5 5"
                strokeWidth={2}
                yAxisId="left"
                label={{
                  value: 'CMRR',
                  position: 'top',
                  fill: 'var(--color-accent)',
                  fontSize: 11,
                  fontWeight: 'bold',
                }}
              />
            )}

            {/* Workload bars with color coding */}
            <Bar yAxisId="left" dataKey="reviews" name="Daily Reviews" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, index) => {
                // Derive sustainability from minutes (no sustainability property exists)
                const sustainability = entry.minutes <= 30 ? 70 : entry.minutes <= 60 ? 40 : 10;
                return (
                  <Cell
                    key={`cell-${index}`}
                    fill={
                      entry.isCMRR
                        ? 'var(--color-accent)' // CMRR highlight
                        : sustainability >= 70
                          ? 'var(--color-success)' // Sustainable
                          : sustainability >= 40
                            ? 'var(--color-warning)' // Moderate
                            : 'var(--color-error)' // Unsustainable
                    }
                    opacity={entry.isCMRR ? 1 : 0.7}
                  />
                );
              })}
            </Bar>

            {/* Time requirement line */}
            {showTimeAxis && (
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="minutes"
                name="Time Required"
                stroke="var(--color-text-primary)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 6, fill: 'var(--color-text-primary)' }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </ChartContainer>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-xs text-[var(--color-text-secondary)]">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-[var(--color-accent)] rounded"></div>
          <span>CMRR (Optimal)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-[var(--color-success)] rounded"></div>
          <span>Sustainable (&lt;30 min/day)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-[var(--color-warning)] rounded"></div>
          <span>Moderate (30-60 min/day)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-[var(--color-error)] rounded"></div>
          <span>Unsustainable (&gt;60 min/day)</span>
        </div>
      </div>
    </div>
  );
};

export default WorkloadChart;
