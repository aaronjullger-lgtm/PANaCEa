/**
 * SafeChart Component
 *
 * Recharts wrapper with:
 * - NaN/Infinity protection (empty state fallback)
 * - Formatted X/Y axis labels
 * - Theme-aware styling via chartTheme (light + dark safe)
 */

import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import chartTheme, { safeChartDisplay } from '@/lib/chartTheme';

interface SafeChartProps {
  data: Array<{ x: string | number; y: number }>;
  xLabel: string;
  yLabel: string;
  emptyMessage?: string;
  onStartSession?: () => void;
}

export function SafeChart({
  data,
  xLabel,
  yLabel,
  emptyMessage = 'No data yet',
  onStartSession,
}: SafeChartProps) {
  // Filter out NaN/invalid values
  const validData = data.filter(
    (d) => typeof d.y === 'number' && !isNaN(d.y) && isFinite(d.y)
  );

  if (validData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-[var(--color-bg-secondary)]/50 border border-[var(--color-border)] rounded-lg">
        <TrendingUp className="w-12 h-12 text-[var(--color-text-muted)] mb-3" />
        <p className="text-[var(--color-text-muted)] text-sm mb-4">{emptyMessage}</p>
        {onStartSession && (
          <button
            onClick={onStartSession}
            className="px-4 py-2 bg-[var(--color-accent)] text-[var(--color-text-inverse)] rounded-lg font-medium hover:bg-[var(--color-accent)]/80 transition"
          >
            Start First Session
          </button>
        )}
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={validData}>
        <CartesianGrid
          strokeDasharray={chartTheme.grid.strokeDasharray}
          stroke={chartTheme.grid.stroke}
          vertical={chartTheme.grid.vertical}
        />
        <XAxis
          dataKey="x"
          stroke={chartTheme.axis.line.stroke}
          tick={chartTheme.axis.tick}
          label={{
            value: xLabel,
            position: 'insideBottom',
            ...chartTheme.axisLabel,
          }}
        />
        <YAxis
          stroke={chartTheme.axis.line.stroke}
          tick={chartTheme.axis.tick}
          label={{
            value: yLabel,
            angle: -90,
            position: 'insideLeft',
            style: chartTheme.axisLabel.style,
          }}
          tickFormatter={(value) =>
            typeof value === 'number' && isFinite(value) ? `${Math.round(value)}%` : '—'
          }
        />
        <Tooltip
          contentStyle={chartTheme.tooltip.contentStyle}
          labelStyle={chartTheme.tooltip.labelStyle}
          itemStyle={chartTheme.tooltip.itemStyle}
          formatter={(value, name) => {
            if (
              value == null ||
              (typeof value === 'number' && (!isFinite(value) || isNaN(value)))
            ) {
              return ['—', String(name ?? '')];
            }
            return [value, String(name ?? '')];
          }}
        />
        <Line
          type="monotone"
          dataKey="y"
          stroke={chartTheme.colors.primary}
          strokeWidth={2}
          dot={{ fill: chartTheme.colors.primary, r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
