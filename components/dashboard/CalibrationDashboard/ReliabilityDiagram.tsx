/**
 * Reliability Diagram (Tier 2, Feature 3)
 *
 * Scatter plot showing predicted probability (x) vs actual accuracy (y) per bin.
 * Perfect calibration = all points on the diagonal. Points above the diagonal
 * indicate underconfidence; points below indicate overconfidence.
 *
 * Uses Recharts ScatterChart with a diagonal ReferenceLine.
 *
 * @see lib/services/calibrationDashboardService.ts — buildReliabilityBins()
 */

import React from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { ReliabilityBin } from '@/lib/services/calibrationDashboardService';

// ─── Types ────────────────────────────────────────────────────────

interface ReliabilityDiagramProps {
  /** Reliability bins to plot */
  bins: ReliabilityBin[];
  /** Chart title */
  title: string;
  /** Accent color for data points */
  accentColor?: string;
  /** Height of the chart */
  height?: number;
}

// ─── Custom Tooltip ───────────────────────────────────────────────

function CalibrationTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const bin = payload[0].payload as ReliabilityBin;

  return (
    <div
      style={{
        background: 'var(--color-bg-primary)',
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        padding: '8px 12px',
        fontSize: 13,
        fontFamily: "'Inter', system-ui, sans-serif",
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 4 }}>
        Bin {bin.index + 1}
      </div>
      <div style={{ color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
        <div>Predicted: <span style={{ fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums' }}>
          {(bin.meanPredicted * 100).toFixed(1)}%
        </span></div>
        <div>Actual: <span style={{ fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums' }}>
          {(bin.meanActual * 100).toFixed(1)}%
        </span></div>
        <div>Samples: <span style={{ fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums' }}>
          {bin.count}
        </span></div>
        <div style={{ color: bin.calibrationError > 0.1 ? 'var(--color-data-fail)' : 'var(--color-data-pass)', fontWeight: 600 }}>
          Error: {(bin.calibrationError * 100).toFixed(1)}%
        </div>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────

export default function ReliabilityDiagram({
  bins,
  title,
  accentColor = 'var(--color-accent)',
  height = 280,
}: ReliabilityDiagramProps) {
  if (bins.length === 0) {
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
          Not enough data for reliability diagram
        </p>
      </div>
    );
  }

  // Map bins to scatter data with x=meanPredicted, y=meanActual
  const data = bins.map((b) => ({
    ...b,
    x: b.meanPredicted,
    y: b.meanActual,
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
        {title}
      </h3>
      <ResponsiveContainer width="100%" height={height}>
        <ScatterChart margin={{ top: 10, right: 20, bottom: 30, left: 10 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--color-border)"
            opacity={0.5}
          />
          <XAxis
            type="number"
            dataKey="x"
            domain={[0, 1]}
            tickCount={6}
            tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
            tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
            label={{
              value: 'Predicted',
              position: 'insideBottom',
              offset: -15,
              style: { fontSize: 12, fill: 'var(--color-text-secondary)' },
            }}
          />
          <YAxis
            type="number"
            dataKey="y"
            domain={[0, 1]}
            tickCount={6}
            tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
            tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
            label={{
              value: 'Actual',
              angle: -90,
              position: 'insideLeft',
              offset: 5,
              style: { fontSize: 12, fill: 'var(--color-text-secondary)' },
            }}
          />
          {/* Perfect calibration diagonal */}
          <ReferenceLine
            segment={[{ x: 0, y: 0 }, { x: 1, y: 1 }]}
            stroke="var(--color-text-muted)"
            strokeDasharray="6 3"
            strokeWidth={1.5}
            opacity={0.6}
          />
          <Tooltip content={<CalibrationTooltip />} />
          <Scatter data={data} fill={accentColor}>
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={accentColor}
                r={Math.max(5, Math.min(12, Math.sqrt(entry.count) * 1.5))}
                opacity={0.85}
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
