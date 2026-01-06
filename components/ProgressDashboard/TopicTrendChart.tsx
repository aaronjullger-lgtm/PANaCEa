import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { PANCE_TOPICS } from '../../src/constants';

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
    <div className="p-4 bg-white dark:bg-slate-800 rounded-xl shadow-md">
      <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-4">
        Performance Trend: {topic}
      </h3>
      <div style={{ width: '100%', height: 300 }}>
        <ResponsiveContainer>
          <LineChart
            data={chartData}
            margin={{
              top: 5,
              right: 20,
              left: -10,
              bottom: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(128, 128, 128, 0.3)" />
            <XAxis dataKey="date" stroke="rgba(128, 128, 128, 0.8)" />
            <YAxis domain={[0, 100]} stroke="rgba(128, 128, 128, 0.8)" />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(255, 255, 255, 0.8)',
                backdropFilter: 'blur(5px)',
                border: '1px solid #ccc',
                borderRadius: '8px',
              }}
              labelStyle={{ fontWeight: 'bold' }}
              formatter={(value: number) => [`${value.toFixed(1)}%`, 'Performance']}
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
      </div>
    </div>
  );
};

export default TopicTrendChart;
