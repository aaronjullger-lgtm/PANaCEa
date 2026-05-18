import React from 'react';
import { cn } from '@/lib/utils';

export type MetricVitalStatus = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export interface MetricVitalProps extends React.HTMLAttributes<HTMLDivElement> {
  label: React.ReactNode;
  value: React.ReactNode;
  change?: React.ReactNode;
  status?: MetricVitalStatus;
  compact?: boolean;
  accessibleText?: string;
}

const statusClass: Record<MetricVitalStatus, string> = {
  neutral: 'border-atlas-border text-atlas-muted',
  info: 'border-atlas-cyan/40 text-atlas-cyan',
  success: 'border-atlas-success/40 text-atlas-success',
  warning: 'border-atlas-warning/45 text-atlas-warning',
  danger: 'border-atlas-pulse/45 text-atlas-pulse',
};

export function MetricVital({
  label,
  value,
  change,
  status = 'neutral',
  compact = false,
  accessibleText,
  className,
  ...props
}: MetricVitalProps) {
  return (
    <div
      role="group"
      aria-label={accessibleText}
      className={cn(
        'rounded-2xl border bg-atlas-glass shadow-atlas-glass backdrop-blur-xl',
        compact ? 'px-3 py-2' : 'px-4 py-3',
        statusClass[status],
        className,
      )}
      {...props}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-[0.08em] text-atlas-muted">{label}</p>
        <span
          className={cn('mt-1 size-2 rounded-full bg-current', status === 'neutral' && 'opacity-50')}
          aria-hidden="true"
        />
      </div>
      <div className={cn('font-mono font-semibold tabular-nums text-atlas-white', compact ? 'mt-1 text-xl' : 'mt-2 text-3xl')}>
        {value}
      </div>
      {change ? <div className="mt-1 text-xs font-medium text-current">{change}</div> : null}
    </div>
  );
}
