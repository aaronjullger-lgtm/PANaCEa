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

interface DecayCurveProps {
  data: { day: number; retentionProb: number }[];
}

export const DecayCurve: React.FC<DecayCurveProps> = ({ data }) => {
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const { day, retentionProb } = payload[0].payload;
      return (
        <div className="bg-white border border-zinc-200 rounded-lg px-3 py-2 shadow-lg">
          <p className="text-zinc-900 font-semibold text-sm">
            Day {day}: {Math.round(retentionProb)}%
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="retentionGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
        </defs>

        <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />

        <XAxis
          dataKey="day"
          stroke="#71717a"
          tick={{ fill: '#71717a', fontSize: 11 }}
          tickLine={{ stroke: '#e4e4e7' }}
          ticks={[0, 7, 14, 21, 30]}
        />

        <YAxis
          stroke="#71717a"
          tick={{ fill: '#71717a', fontSize: 11 }}
          tickLine={{ stroke: '#e4e4e7' }}
          domain={[0, 100]}
        />

        <ReferenceLine
          y={90}
          stroke="#ef4444"
          strokeDasharray="3 3"
          strokeWidth={1.5}
          label={{
            value: 'Critical',
            position: 'right',
            fill: '#ef4444',
            fontSize: 10,
            fontWeight: 600,
          }}
        />

        <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#3b82f6', strokeWidth: 1 }} />

        <Area
          type="monotone"
          dataKey="retentionProb"
          stroke="#3b82f6"
          strokeWidth={2}
          fill="url(#retentionGradient)"
          animationDuration={1000}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};

export default DecayCurve;
