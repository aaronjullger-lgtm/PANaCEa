/**
 * Calibration Trend Chart (Tier 2, Feature 3)
 *
 * Line chart showing weekly Brier score over time to visualize
 * metacognitive improvement longitudinally.
 *
 * @see lib/services/calibrationDashboardService.ts — computeWeeklyTrend()
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
  ReferenceLine,
} from 'recharts';
import type { CalibrationTrendPoint } from '@/lib/services/calibrationDashboardService';

// ─── Types ────────────────────────────────────────────────────────

interface CalibrationTrendChartProps {
  /** Weekly trend data points */
  trend: CalibrationTrendPoint[];
  /** Chart height */
  height?: number;
}

// ─── Custom Tooltip ───────────────────────────────────────────────

function TrendTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const pt = payload[0].payload as CalibrationTrendPoint;

  return (
    <div
      style={{
        background: 'var(--color-bg-primary)',
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        padding: '8px 12px',
        fontSize: 13,
        fontFamily: "'Inter', system-ui, sans-serif",
        boxShadow: '0 0 0 1px var(--color-glass-border), 0 8px 24px -4px var(--color-glass-shadow), 0 4px 8px -2px rgba(0,0,0,0.08)',
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 4 }}>
        Week of {pt.weekStart}
      </div>
      <div style={{ color: 'var(--color-text-secondary)', lineHeight: 1.6, fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums' }}>
        <div>Brier Score: {pt.brierScore.toFixed(3)}</div>
        <div>ECE: {pt.ece.toFixed(3)}</div>
        <div>Reviews: {pt.reviewCount}</div>
        <div>Bias: {pt.meanBias > 0 ? '+' : ''}{(pt.meanBias * 100).toFixed(1)}%</div>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────

export default function CalibrationTrendChart({
  trend,
  height = 220,
}: CalibrationTrendChartProps) {
  if (trend.length < 2) {
    return (
      <div style={{
        height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-bg-secondary)',
        borderRadius: 10,
        border: '1px solid var(--color-border)',
      }}>
        <p style={{
          color: 'var(--color-text-muted)',
          fontSize: 13,
          fontFamily: "'Inter', system-ui, sans-serif",
        }}>
          Need at least 2 weeks of data for trend analysis
        </p>
      </div>
    );
  }

  const data = trend.map((pt) => ({
    ...pt,
    label: pt.weekStart.slice(5), // 'MM-DD' format
  }));

  return (
    <div>
      <h3 style={{
        fontSize: 14,
        fontWeight: 600,
        fontFamily: "'Poppins', system-ui, sans-serif",
        color: 'var(--color-text-primary)',
        marginBottom: 8,
      }}>
        Calibration Trend
      </h3>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--color-border)"
            opacity={0.5}
          />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
            label={{
              value: 'Week',
              position: 'insideBottom',
              offset: -10,
              style: { fontSize: 12, fill: 'var(--color-text-secondary)' },
            }}
          />
          <YAxis
            domain={[0, 'auto']}
            tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
            tickFormatter={(v: number) => v.toFixed(2)}
            label={{
              value: 'Brier Score',
              angle: -90,
              position: 'insideLeft',
              offset: 5,
              style: { fontSize: 12, fill: 'var(--color-text-secondary)' },
            }}
          />
          {/* Random baseline for Brier Score */}
          <ReferenceLine
            y={0.25}
            stroke="var(--color-text-muted)"
            strokeDasharray="6 3"
            opacity={0.4}
            label={{ value: 'Random', position: 'right', fill: 'var(--color-text-muted)', fontSize: 10 }}
          />
          <Tooltip content={<TrendTooltip />} />
          <Line
            type="monotone"
            dataKey="brierScore"
            stroke="var(--color-accent)"
            strokeWidth={2.5}
            dot={{ r: 4, fill: 'var(--color-accent)' }}
            activeDot={{ r: 6, fill: 'var(--color-accent)' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
