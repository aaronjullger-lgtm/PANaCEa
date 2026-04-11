/**
 * TimeAccuracyScatter - Metacognitive Mirror Widget
 *
 * Scatter plot of response time vs accuracy per organ system.
 * Highlights systems where more time does not yield better results.
 *
 * Data source: ReviewLog responseTimeMs + wasCorrect + system
 */

import React from 'react';
import { GlassCard, GlassCardHeader } from '@/components/ui/GlassCard';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ZAxis,
  Cell,
} from 'recharts';
import { Clock, AlertTriangle } from 'lucide-react';
import chartTheme from '@/lib/chartTheme';

export interface TimeAccuracyPoint {
  system: string;
  avgTimeSec: number;
  accuracy: number; // 0-1
  count: number;
}

export interface TimeAccuracyScatterProps {
  data: TimeAccuracyPoint[];
  loading?: boolean;
  className?: string;
}

function Skeleton() {
  return (
    <GlassCard variant="warning" className="animate-pulse">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-[var(--color-bg-tertiary)]" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-40 rounded bg-[var(--color-bg-tertiary)]" />
          <div className="h-3 w-56 rounded bg-[var(--color-bg-tertiary)]" />
        </div>
      </div>
      <div className="h-64 rounded-lg bg-[var(--color-bg-tertiary)]" />
    </GlassCard>
  );
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: TimeAccuracyPoint }> }) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  return (
    <div style={chartTheme.tooltip.contentStyle}>
      <p style={chartTheme.tooltip.labelStyle as React.CSSProperties}>{d.system}</p>
      <p style={chartTheme.tooltip.itemStyle as React.CSSProperties}>
        Avg time: {d.avgTimeSec.toFixed(1)}s
      </p>
      <p style={chartTheme.tooltip.itemStyle as React.CSSProperties}>
        Accuracy: {Math.round(d.accuracy * 100)}%
      </p>
      <p style={chartTheme.tooltip.itemStyle as React.CSSProperties}>
        Questions: {d.count}
      </p>
    </div>
  );
}

export const TimeAccuracyScatter: React.FC<TimeAccuracyScatterProps> = ({
  data,
  loading = false,
  className,
}) => {
  if (loading) return <Skeleton />;

  if (!data || data.length === 0) {
    return (
      <GlassCard variant="warning" className={className}>
        <GlassCardHeader
          icon={Clock}
          title="Time vs Accuracy"
          subtitle="Does spending more time actually help?"
        />
        <EmptyState
          variant="quiz"
          compact
          title="No timing data yet"
          description="Complete more sessions to see your time-accuracy patterns."
        />
      </GlassCard>
    );
  }

  // Find inefficiency: systems where time is above median but accuracy is below median
  const sortedByTime = [...data].sort((a, b) => a.avgTimeSec - b.avgTimeSec);
  const medianTime = sortedByTime[Math.floor(sortedByTime.length / 2)]?.avgTimeSec ?? 0;
  const sortedByAcc = [...data].sort((a, b) => a.accuracy - b.accuracy);
  const medianAcc = sortedByAcc[Math.floor(sortedByAcc.length / 2)]?.accuracy ?? 0;

  const inefficient = data
    .filter((d) => d.avgTimeSec > medianTime && d.accuracy < medianAcc)
    .sort((a, b) => a.avgTimeSec - b.avgTimeSec)[0];

  return (
    <GlassCard variant="warning" className={className}>
      <GlassCardHeader
        icon={Clock}
        title="Time vs Accuracy"
        subtitle="Does spending more time actually help?"
        badge={{ text: data.length + ' systems', color: 'bg-[var(--color-data-provisional)]/10 text-[var(--color-data-provisional)]' }}
      />

      {inefficient && (
        <div className="flex items-start gap-2 px-3 py-2 mb-4 rounded-lg bg-[var(--color-data-provisional)]/5 border border-[var(--color-data-provisional)]/10">
          <AlertTriangle className="w-4 h-4 mt-0.5 text-[var(--color-data-provisional)] shrink-0" />
          <p className="text-sm text-[var(--color-text-secondary)]">
            You spend more time on <span className="font-medium text-[var(--color-text-primary)]">{inefficient.system}</span> ({inefficient.avgTimeSec.toFixed(1)}s avg) but score below your median accuracy ({Math.round(inefficient.accuracy * 100)}%).
          </p>
        </div>
      )}

      <ResponsiveContainer width="100%" height={260}>
        <ScatterChart margin={{ top: 8, right: 16, bottom: 24, left: 0 }}>
          <CartesianGrid
            strokeDasharray={chartTheme.grid.strokeDasharray}
            stroke={chartTheme.grid.stroke}
            vertical={false}
          />
          <XAxis
            dataKey="avgTimeSec"
            type="number"
            name="Time (s)"
            tick={chartTheme.axis.tick}
            stroke={chartTheme.axis.line.stroke}
            label={{
              value: 'Avg Time (s)',
              position: 'insideBottom',
              ...chartTheme.axisLabel,
            }}
          />
          <YAxis
            dataKey="accuracy"
            type="number"
            name="Accuracy"
            domain={[0, 1]}
            tick={chartTheme.axis.tick}
            stroke={chartTheme.axis.line.stroke}
            tickFormatter={(v: number) => Math.round(v * 100) + '%'}
          />
          <ZAxis dataKey="count" range={[60, 300]} />
          <Tooltip content={<CustomTooltip />} />
          <Scatter data={data} fill={chartTheme.colors.primary}>
            {data.map((entry) => {
              const isSlow = entry.avgTimeSec > medianTime;
              const isInaccurate = entry.accuracy < medianAcc;
              return (
                <Cell
                  key={entry.system}
                  fill={
                    isSlow && isInaccurate
                      ? 'var(--color-data-fail)'
                      : isSlow
                        ? 'var(--color-data-provisional)'
                        : 'var(--color-data-pass)'
                  }
                />
              );
            })}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </GlassCard>
  );
};

export default TimeAccuracyScatter;
