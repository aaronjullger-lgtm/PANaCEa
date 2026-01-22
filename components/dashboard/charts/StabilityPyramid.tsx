import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface StabilityData {
  bucket: string;
  count: number;
  color: string;
  order: number;
}

interface StabilityPyramidProps {
  data: { bucket: string; count: number; color: string }[];
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: StabilityData }>;
}

export const StabilityPyramid: React.FC<StabilityPyramidProps> = ({ data }) => {
  // Define stability order (weakest to strongest)
  const stabilityOrder: Record<string, number> = {
    '<1d': 5,
    '1-3d': 4,
    '3-7d': 3,
    '7-21d': 2,
    '21d+': 1,
  };

  // Sort data by stability (weakest at top when rendered)
  const sortedData: StabilityData[] = data
    .map((item) => ({
      ...item,
      order: stabilityOrder[item.bucket] || 0,
    }))
    .sort((a, b) => b.order - a.order);

  const CustomTooltip = ({ active, payload }: CustomTooltipProps) => {
    const firstPayload = payload?.[0];
    if (active && payload && payload.length && firstPayload) {
      const { bucket, count } = firstPayload.payload;
      return (
        <div className="bg-white border border-zinc-200 rounded-lg px-3 py-2 shadow-lg">
          <p className="text-zinc-900 font-semibold text-sm">
            {count} {count === 1 ? 'item' : 'items'}
          </p>
          <p className="text-zinc-600 text-xs">Stability: {bucket}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart
        data={sortedData}
        layout="vertical"
        margin={{ top: 5, right: 10, left: 60, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" horizontal={false} />

        <XAxis
          type="number"
          stroke="#71717a"
          tick={{ fill: '#71717a', fontSize: 11 }}
          tickLine={{ stroke: '#e4e4e7' }}
        />

        <YAxis
          type="category"
          dataKey="bucket"
          stroke="#71717a"
          tick={{ fill: '#71717a', fontSize: 11 }}
          tickLine={{ stroke: '#e4e4e7' }}
          width={60}
        />

        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f4f4f5' }} />

        <Bar dataKey="count" radius={[0, 8, 8, 0]} animationDuration={1000}>
          {sortedData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} opacity={0.85} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

export default StabilityPyramid;