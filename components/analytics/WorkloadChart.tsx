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
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Cell
} from 'recharts';
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
          <span className="ml-2 px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded">
            CMRR
          </span>
        )}
      </p>
      
      <div className="space-y-1 text-xs">
        <div className="flex justify-between gap-4">
          <span className="text-[var(--color-text-secondary)]">Daily Reviews:</span>
          <span className="font-mono text-[var(--color-text-primary)]">
            {data.dailyReviews.toFixed(0)} cards
          </span>
        </div>
        
        <div className="flex justify-between gap-4">
          <span className="text-[var(--color-text-secondary)]">Time Required:</span>
          <span className="font-mono text-[var(--color-text-primary)]">
            {data.timeMinutes.toFixed(0)} min/day
          </span>
        </div>
        
        <div className="flex justify-between gap-4">
          <span className="text-[var(--color-text-secondary)]">Sustainability:</span>
          <span className={`font-mono ${
            data.sustainability >= 70 ? 'text-green-400' :
            data.sustainability >= 40 ? 'text-yellow-400' :
            'text-red-400'
          }`}>
            {data.sustainability.toFixed(0)}%
          </span>
        </div>
      </div>

      {data.isCMRR && (
        <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
          <p className="text-xs text-blue-400">
            ⭐ Optimal balance of retention and workload
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
  height = 400
}) => {
  const { chartData, recommended, isLoading, error } = useWorkloadProjection({
    dailyNewCards,
    availableTimeMinutes,
    currentCardCount,
    customParameters
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
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
        <div className="text-center text-red-400">
          <p className="text-sm">Failed to generate workload projection</p>
          <p className="text-xs mt-2 text-[var(--color-text-secondary)]">{error}</p>
        </div>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <p className="text-sm text-[var(--color-text-secondary)]">
          No workload data available
        </p>
      </div>
    );
  }

  const cmrrPoint = chartData.find(d => d.isCMRR);
  const maxTime = Math.max(...chartData.map(d => d.timeMinutes));

  return (
    <div className="w-full">
      {/* Header with CMRR Info */}
      {cmrrPoint && (
        <div className="mb-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-semibold text-blue-400 mb-1">
                ⭐ Recommended Retention: {(cmrrPoint.retention * 100).toFixed(0)}%
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Optimal balance: {cmrrPoint.dailyReviews.toFixed(0)} reviews/day 
                ({cmrrPoint.timeMinutes.toFixed(0)} min) with {cmrrPoint.sustainability.toFixed(0)}% sustainability
              </p>
            </div>
            
            {recommended && (
              <div className="text-right">
                <p className="text-xs text-[var(--color-text-secondary)]">
                  For {availableTimeMinutes} min/day:
                </p>
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                  Target {(recommended.retention * 100).toFixed(0)}%
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Chart */}
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 20, bottom: 40 }}
        >
          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke="var(--color-border)" 
            opacity={0.3}
          />
          
          <XAxis
            dataKey="retention"
            tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
            label={{ 
              value: 'Retention Target', 
              position: 'insideBottom', 
              offset: -10,
              style: { fill: 'var(--color-text-secondary)', fontSize: 12 }
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
              style: { fill: 'var(--color-text-secondary)', fontSize: 12 }
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
                style: { fill: 'var(--color-text-secondary)', fontSize: 12 }
              }}
              stroke="var(--color-text-secondary)"
              tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }}
            />
          )}
          
          <Tooltip content={<CustomTooltip />} />
          
          <Legend 
            wrapperStyle={{ 
              paddingTop: '20px',
              fontSize: '12px'
            }}
          />

          {/* Highlight CMRR point */}
          {cmrrPoint && (
            <ReferenceLine
              x={cmrrPoint.retention}
              stroke="#3b82f6"
              strokeDasharray="5 5"
              strokeWidth={2}
              yAxisId="left"
              label={{
                value: 'CMRR',
                position: 'top',
                fill: '#3b82f6',
                fontSize: 11,
                fontWeight: 'bold'
              }}
            />
          )}

          {/* Workload bars with color coding */}
          <Bar 
            yAxisId="left"
            dataKey="dailyReviews" 
            name="Daily Reviews"
            radius={[4, 4, 0, 0]}
          >
            {chartData.map((entry, index) => (
              <Cell 
                key={`cell-${index}`}
                fill={
                  entry.isCMRR ? '#3b82f6' : // Blue for CMRR
                  entry.sustainability >= 70 ? '#1e293b' : // Stormy slate for sustainable
                  entry.sustainability >= 40 ? '#f59e0b' : // Amber for moderate
                  '#ef4444' // Red for unsustainable
                }
                opacity={entry.isCMRR ? 1 : 0.7}
              />
            ))}
          </Bar>

          {/* Time requirement line */}
          {showTimeAxis && (
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="timeMinutes"
              name="Time Required"
              stroke="#f8fafc"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 6, fill: '#f8fafc' }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-xs text-[var(--color-text-secondary)]">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-blue-500 rounded"></div>
          <span>CMRR (Optimal)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-[#1e293b] rounded"></div>
          <span>Sustainable (&lt;30 min/day)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-amber-500 rounded"></div>
          <span>Moderate (30-60 min/day)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-red-500 rounded"></div>
          <span>Unsustainable (&gt;60 min/day)</span>
        </div>
      </div>
    </div>
  );
};

export default WorkloadChart;
