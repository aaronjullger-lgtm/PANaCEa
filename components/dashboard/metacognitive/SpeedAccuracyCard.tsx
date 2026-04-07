/**
 * SpeedAccuracyCard — "Speed vs Accuracy" widget
 *
 * Shows accuracy by response-time quartile so the student can see
 * whether rushing hurts or deliberation helps.
 *
 * @module components/dashboard/metacognitive/SpeedAccuracyCard
 */

import React from 'react';
import type { SpeedAccuracyBucket } from '@/hooks/useMetacognitiveStats';

interface Props {
  buckets: SpeedAccuracyBucket[];
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export const SpeedAccuracyCard: React.FC<Props> = ({ buckets }) => {
  if (buckets.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-5">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">Speed vs Accuracy</h3>
        <p className="text-sm text-[var(--color-text-muted)]">
          Need more data to analyze your speed-accuracy tradeoff.
        </p>
      </div>
    );
  }

  // Find the best quartile
  const best = buckets.reduce((a, b) => a.accuracy > b.accuracy ? a : b);

  // Insight text
  const fastBucket = buckets[0];
  const slowBucket = buckets[buckets.length - 1];
  let insight = '';
  if (fastBucket && slowBucket) {
    const diff = slowBucket.accuracy - fastBucket.accuracy;
    if (diff > 0.1) {
      insight = 'Taking more time is helping your accuracy. Keep deliberating on tough questions.';
    } else if (diff < -0.1) {
      insight = 'Your quick answers are actually more accurate. Trust your pattern recognition.';
    } else {
      insight = 'Your accuracy is consistent regardless of speed. You have good pacing instincts.';
    }
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-5">
      <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">Speed vs Accuracy</h3>
      <p className="text-xs text-[var(--color-text-muted)] mb-4">
        How response time affects your accuracy
      </p>

      {/* Horizontal bar chart */}
      <div className="space-y-2.5">
        {buckets.map((b) => {
          const pct = Math.round(b.accuracy * 100);
          const isBest = b === best;

          return (
            <div key={b.label}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className={`${isBest ? 'text-[var(--color-text-primary)] font-medium' : 'text-[var(--color-text-muted)]'}`}>
                  {b.label}
                </span>
                <span className="text-[var(--color-text-muted)]">
                  {formatMs(b.lowerMs)}-{formatMs(b.upperMs)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-5 rounded-md bg-[var(--color-bg-tertiary)] overflow-hidden">
                  <div
                    className={`h-full rounded-md transition-all ${isBest ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-accent)]/50'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className={`text-xs font-mono w-10 text-right ${isBest ? 'font-semibold text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]'}`}>
                  {pct}%
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {insight && (
        <p className="text-xs text-[var(--color-text-secondary)] mt-4 leading-relaxed">
          {insight}
        </p>
      )}
    </div>
  );
};

export default SpeedAccuracyCard;
