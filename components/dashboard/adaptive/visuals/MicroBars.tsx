import React from 'react';

type Segment = {
  label: string;
  value: number;
  className: string;
};

export function MicroBars({ segments, total, ariaLabel }: { segments: Segment[]; total: number; ariaLabel: string }) {
  const safeTotal = Math.max(1, total);
  return (
    <div aria-label={ariaLabel} role="img">
      <div className="flex h-2 overflow-hidden rounded-full bg-[var(--color-bg-tertiary)]">
        {segments.map((segment) => (
          <span
            key={segment.label}
            className={segment.className}
            style={{ width: `${Math.max(4, (segment.value / safeTotal) * 100)}%` }}
          />
        ))}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[0.68rem] text-[var(--color-text-muted)]">
        {segments.map((segment) => (
          <span key={segment.label}>
            {segment.label}: <span className="font-mono text-[var(--color-text-secondary)]">{segment.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
