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
import ChartContainer from '../../shared/ChartContainer';
import { getStabilityColor } from '@/lib/chartTheme';

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
        <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg px-3 py-2 shadow-lg">
          <p className="text-[var(--color-text-primary)] font-semibold text-sm">
            {count} {count === 1 ? 'item' : 'items'}
          </p>
          <p className="text-[var(--color-text-muted)] text-xs">Stability: {bucket}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div role="figure" aria-label="Stability pyramid showing card distribution across memory stability buckets">
      <span className="sr-only">
        Horizontal bar chart showing how many cards fall into each stability range:
        {sortedData.map((d) => ` ${d.bucket}: ${d.count} cards`).join(',')}. Higher stability means longer-lasting memory.
      </span>
    <ChartContainer minHeight={300} className="min-h-[200px] w-full">
      <ResponsiveContainer width="100%" height={300} minHeight={200} minWidth={0}>
        <BarChart
          data={sortedData}
          layout="vertical"
          margin={{ top: 5, right: 10, left: 60, bottom: 5 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--chart-grid-stroke)"
            horizontal={false}
            vertical={true}
          />

          <XAxis
            type="number"
            stroke="var(--color-border)"
            tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
            tickLine={{ stroke: 'var(--chart-grid-stroke)' }}
          />

          <YAxis
            type="category"
            dataKey="bucket"
            stroke="var(--color-border)"
            tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
            tickLine={{ stroke: 'var(--chart-grid-stroke)' }}
            width={60}
          />

          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--color-bg-secondary)' }} />

          <Bar dataKey="count" radius={[0, 8, 8, 0]} animationDuration={1000}>
            {sortedData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getStabilityColor(entry.bucket)} opacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
    </div>
  );
};

export default StabilityPyramid;
