import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import ChartContainer from '../shared/ChartContainer';
import chartTheme from '@/lib/chartTheme';

export interface TopicTrendPoint {
  /** Display label for the x-axis (e.g. "Apr 3"). */
  date: string;
  /** Performance percentage 0–100 for that point. */
  performance: number;
}

interface TopicTrendChartProps {
  topic: string; // e.g., 'Cardiology'
  /**
   * Real performance-trend data for the topic. When omitted/empty, the chart
   * renders an honest empty state — it never fabricates progress. (Previously
   * this component generated random `Math.random()` data, which would have shown
   * fake student progress if wired into a production surface.)
   */
  data?: TopicTrendPoint[];
}

const TopicTrendChart: React.FC<TopicTrendChartProps> = ({ topic, data }) => {
  const chartData = data ?? [];

  if (chartData.length === 0) {
    return (
      <div className="p-4 bg-[var(--color-bg-secondary)] rounded-xl shadow-md">
        <h3 className="text-lg font-bold text-data-neutral mb-4">
          Performance Trend: {topic}
        </h3>
        <div
          className="flex w-full min-h-[300px] items-center justify-center text-center"
          role="status"
        >
          <p className="text-sm text-[var(--color-text-muted)] max-w-xs">
            No performance-trend data yet for {topic}. Complete more questions in this
            topic to build your trend.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-[var(--color-bg-secondary)] rounded-xl shadow-md">
      <h3 className="text-lg font-bold text-data-neutral mb-4">
        Performance Trend: {topic}
      </h3>
      <div className="w-full min-h-[300px] h-[300px]">
        <ChartContainer minHeight={300} className="w-full h-full">
          <ResponsiveContainer width="100%" height={300} minHeight={200} minWidth={0}>
            <LineChart
              data={chartData}
              margin={{
                top: 5,
                right: 20,
                left: -10,
                bottom: 5,
              }}
            >
              <CartesianGrid {...chartTheme.grid} />
              <XAxis dataKey="date" tick={chartTheme.axis.tick} />
              <YAxis domain={[0, 100]} tick={chartTheme.axis.tick} />
              <Tooltip
                contentStyle={chartTheme.tooltip.contentStyle}
                labelStyle={chartTheme.tooltip.labelStyle}
                formatter={(value) => {
                  const numValue = typeof value === 'number' ? value : 0;
                  return [`${numValue.toFixed(1)}%`, 'Performance'];
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="performance"
                stroke="var(--color-accent)"
                strokeWidth={2}
                activeDot={{ r: 8 }}
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </div>
    </div>
  );
};

export default TopicTrendChart;
