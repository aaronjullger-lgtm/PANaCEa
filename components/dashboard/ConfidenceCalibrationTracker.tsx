/**
 * ConfidenceCalibrationTracker - Metacognitive Mirror Widget
 *
 * Line chart comparing predicted confidence vs actual accuracy over time.
 * Helps users understand whether they are overconfident or underconfident.
 *
 * Data source: ReviewLog implicit_confidence + wasCorrect, grouped by rolling 7-day windows
 */

import React from 'react';
import { GlassCard, GlassCardHeader } from '@/components/ui/GlassCard';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Brain, TrendingUp, TrendingDown } from 'lucide-react';
import chartTheme from '@/lib/chartTheme';
import { safeChartValue } from '@/lib/chartTheme';

export interface CalibrationDataPoint {
  date: string; // e.g. 'Mar 24'
  predictedAccuracy: number; // 0-1: average implicit_confidence
  actualAccuracy: number; // 0-1: actual correctness rate
}

export interface ConfidenceCalibrationTrackerProps {
  data: CalibrationDataPoint[];
  loading?: boolean;
  className?: string;
}

function Skeleton() {
  return (
    <GlassCard variant="primary" className="animate-pulse">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-[var(--color-bg-tertiary)]" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-48 rounded bg-[var(--color-bg-tertiary)]" />
          <div className="h-3 w-64 rounded bg-[var(--color-bg-tertiary)]" />
        </div>
      </div>
      <div className="h-64 rounded-lg bg-[var(--color-bg-tertiary)]" />
    </GlassCard>
  );
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; dataKey: string; color: string }>; label?: string }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div style={chartTheme.tooltip.contentStyle}>
      <p style={chartTheme.tooltip.labelStyle as React.CSSProperties}>{label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} style={{ ...chartTheme.tooltip.itemStyle as React.CSSProperties, color: entry.color }}>
          {entry.dataKey === 'predictedAccuracy' ? 'Predicted' : 'Actual'}: {Math.round(entry.value * 100)}%
        </p>
      ))}
    </div>
  );
}

export const ConfidenceCalibrationTracker: React.FC<ConfidenceCalibrationTrackerProps> = ({
  data,
  loading = false,
  className,
}) => {
  if (loading) return <Skeleton />;

  if (!data || data.length === 0) {
    return (
      <GlassCard variant="primary" className={className}>
        <GlassCardHeader
          icon={Brain}
          title="Confidence Calibration"
          subtitle="How well does your confidence match reality?"
        />
        <EmptyState
          variant="quiz"
          compact
          title="No calibration data yet"
          description="Complete more sessions to track your confidence calibration trend."
        />
      </GlassCard>
    );
  }

  const validData = data
    .map((d) => ({
      ...d,
      predictedAccuracy: safeChartValue(d.predictedAccuracy),
      actualAccuracy: safeChartValue(d.actualAccuracy),
    }))
    .filter((d) => d.predictedAccuracy > 0 || d.actualAccuracy > 0);

  if (validData.length === 0) {
    return (
      <GlassCard variant="primary" className={className}>
        <GlassCardHeader
          icon={Brain}
          title="Confidence Calibration"
          subtitle="How well does your confidence match reality?"
        />
        <EmptyState
          variant="quiz"
          compact
          title="No valid data"
          description="Calibration data is being collected."
        />
      </GlassCard>
    );
  }

  // Compare latest week to earliest week
  const latest = validData[validData.length - 1];
  const earliest = validData[0];
  const predictedDelta = latest.predictedAccuracy - earliest.predictedAccuracy;
  const actualDelta = latest.actualAccuracy - earliest.actualAccuracy;
  const gap = Math.abs(latest.predictedAccuracy - latest.actualAccuracy);
  const isImproving = gap < Math.abs(earliest.predictedAccuracy - earliest.actualAccuracy);

  // Determine if overconfident or underconfident
  const calibrationDirection =
    latest.predictedAccuracy > latest.actualAccuracy + 0.1 ? 'overconfident' :
    latest.actualAccuracy > latest.predictedAccuracy + 0.1 ? 'underconfident' :
    'well-calibrated';

  return (
    <GlassCard variant="primary" className={className}>
      <GlassCardHeader
        icon={Brain}
        title="Confidence Calibration"
        subtitle="How well does your confidence match reality?"
        badge={{
          text: calibrationDirection === 'well-calibrated' ? 'On Target' :
               calibrationDirection === 'overconfident' ? 'Overconfident' : 'Underconfident',
          color: calibrationDirection === 'well-calibrated'
            ? 'bg-[var(--color-data-pass)]/10 text-[var(--color-data-pass)]'
            : 'bg-[var(--color-data-provisional)]/10 text-[var(--color-data-provisional)]',
        }}
      />

      <div className="flex items-start gap-2 px-3 py-2 mb-4 rounded-lg bg-[var(--color-accent)]/5 border border-[var(--color-accent)]/10">
        {isImproving ? (
          <TrendingUp className="w-4 h-4 mt-0.5 text-[var(--color-data-pass)] shrink-0" />
        ) : (
          <TrendingDown className="w-4 h-4 mt-0.5 text-[var(--color-data-provisional)] shrink-0" />
        )}
        <p className="text-sm text-[var(--color-text-secondary)]">
          Your confidence calibration is {isImproving ? 'improving' : 'worsening'}: predicted {Math.round(latest.predictedAccuracy * 100)}%, actual {Math.round(latest.actualAccuracy * 100)}%.
          {calibrationDirection === 'overconfident' && ' You tend to be overconfident.'}
          {calibrationDirection === 'underconfident' && ' You know more than you think.'}
        </p>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={validData} margin={{ top: 8, right: 16, bottom: 24, left: 0 }}>
          <CartesianGrid
            strokeDasharray={chartTheme.grid.strokeDasharray}
            stroke={chartTheme.grid.stroke}
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tick={chartTheme.axis.tick}
            stroke={chartTheme.axis.line.stroke}
          />
          <YAxis
            domain={[0, 1]}
            tick={chartTheme.axis.tick}
            stroke={chartTheme.axis.line.stroke}
            tickFormatter={(v: number) => Math.round(v * 100) + '%'}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            iconType={chartTheme.legend.iconType}
            wrapperStyle={chartTheme.legend.wrapperStyle}
            formatter={(value: string) =>
              value === 'predictedAccuracy' ? 'Predicted' : 'Actual'
            }
          />
          <Line
            type="monotone"
            dataKey="predictedAccuracy"
            stroke={chartTheme.colors.primary}
            strokeWidth={2}
            strokeDasharray="6 3"
            dot={false}
            name="predictedAccuracy"
          />
          <Line
            type="monotone"
            dataKey="actualAccuracy"
            stroke={chartTheme.colors.success}
            strokeWidth={2}
            dot={false}
            name="actualAccuracy"
          />
        </LineChart>
      </ResponsiveContainer>
    </GlassCard>
  );
};

export default ConfidenceCalibrationTracker;
