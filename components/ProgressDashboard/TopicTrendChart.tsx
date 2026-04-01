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
import { PANCE_TOPICS } from '@/src/constants';
import chartTheme from '@/lib/chartTheme';

// Mock data for demonstration purposes
// In a real application, this would be fetched from an analytics service
const getMockPerformanceData = (topic: string) => {
  const data = [];
  for (let i = 10; i > 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    data.push({
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      performance: 60 + Math.random() * 25 + (10 - i), // Simulate improvement
    });
  }
  return data;
};

interface TopicTrendChartProps {
  topic: string; // e.g., 'Cardiology'
}

const TopicTrendChart: React.FC<TopicTrendChartProps> = ({ topic }) => {
  // PANCE_TOPICS is an array of strings, not objects
  const chartData = getMockPerformanceData(topic);

  return (
    <div className="p-4 bg-[var(--color-bg-secondary)] rounded-xl shadow-md">
      <h3 className="text-lg font-bold text-data-neutral dark:text-data-neutral mb-4">
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
