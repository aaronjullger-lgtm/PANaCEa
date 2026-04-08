/**
 * CircadianHeatmap — "Your Best Study Hours" widget
 *
 * Shows accuracy and speed by hour-of-day so the student can optimize
 * when they study. Uses a compact heatmap row visualization.
 *
 * @module components/dashboard/metacognitive/CircadianHeatmap
 */

import React, { useMemo } from 'react';
import type { CircadianBucket } from '@/hooks/useMetacognitiveStats';

interface Props {
  buckets: CircadianBucket[];
  /** Minimum questions per hour to highlight as a study window */
  minCountForHighlight?: number;
}

/** Format hour number (0-23) as human-readable */
function formatHour(h: number): string {
  if (h === 0) return '12am';
  if (h === 12) return '12pm';
  return h < 12 ? `${h}am` : `${h - 12}pm`;
}

/** Map accuracy to a green intensity (0-1 scale → opacity) */
function accuracyToOpacity(accuracy: number, hasData: boolean): number {
  if (!hasData) return 0.05;
  return 0.15 + accuracy * 0.85; // Range: 0.15 - 1.0
}

export const CircadianHeatmap: React.FC<Props> = ({
  buckets,
  minCountForHighlight = 5,
}) => {
  const bucketMap = useMemo(() => {
    const map = new Map<number, CircadianBucket>();
    for (const b of buckets) map.set(b.hour, b);
    return map;
  }, [buckets]);

  // Find peak hour (highest accuracy with sufficient data)
  const peak = useMemo(() => {
    const eligible = buckets.filter(b => b.count >= minCountForHighlight);
    if (eligible.length === 0) return null;
    return eligible.reduce((best, b) => b.accuracy > best.accuracy ? b : best);
  }, [buckets, minCountForHighlight]);

  // Only show hours 5am - 1am (typical student range)
  const hours = useMemo(() => {
    const result: number[] = [];
    for (let h = 5; h <= 23; h++) result.push(h);
    result.push(0); // midnight
    return result;
  }, []);

  if (buckets.length < 3) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-5">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">Study Hours</h3>
        <p className="text-sm text-[var(--color-text-muted)]">
          Study across a few more time slots to see your circadian pattern.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-5">
      <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">Your Best Study Hours</h3>
      {peak && (
        <p className="text-xs text-[var(--color-text-muted)] mb-4">
          Peak accuracy at <span className="font-medium text-[var(--color-data-pass)]">{formatHour(peak.hour)}</span>
          {' '}({Math.round(peak.accuracy * 100)}% on {peak.count} questions)
        </p>
      )}

      {/* Heatmap row */}
      <div className="flex gap-0.5">
        {hours.map((h) => {
          const b = bucketMap.get(h);
          const hasData = !!b && b.count > 0;
          const opacity = accuracyToOpacity(b?.accuracy ?? 0, hasData);
          const isPeak = peak && h === peak.hour;

          return (
            <div
              key={h}
              className="flex-1 relative group"
              title={
                hasData
                  ? `${formatHour(h)}: ${Math.round(b!.accuracy * 100)}% accuracy, ${b!.count} questions`
                  : `${formatHour(h)}: no data`
              }
            >
              <div
                className={`h-8 rounded-sm transition-all ${isPeak ? 'ring-2 ring-emerald-500' : ''}`}
                style={{
                  backgroundColor: hasData
                    ? `rgba(16, 185, 129, ${opacity})` // emerald
                    : 'var(--color-bg-tertiary)',
                }}
              />
              {/* Hour label — show every 3 hours */}
              {h % 3 === 0 && (
                <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[9px] text-[var(--color-text-muted)]">
                  {formatHour(h)}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend spacer for labels */}
      <div className="h-4" />

      {/* Compact legend */}
      <div className="flex items-center justify-between text-[10px] text-[var(--color-text-muted)] mt-2">
        <span>Low accuracy</span>
        <div className="flex gap-0.5">
          {[0.2, 0.4, 0.6, 0.8, 1.0].map((v) => (
            <div
              key={v}
              className="w-3 h-2 rounded-sm"
              style={{ backgroundColor: `rgba(16, 185, 129, ${0.15 + v * 0.85})` }}
            />
          ))}
        </div>
        <span>High accuracy</span>
      </div>
    </div>
  );
};

export default CircadianHeatmap;
