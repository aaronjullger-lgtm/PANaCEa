import React from 'react';
import { cn } from '@/lib/utils';

export type OrganSystemBadgeState = 'neutral' | 'active' | 'weak' | 'strong' | 'watch';

export interface OrganSystemBadgeProps {
  label: string;
  score?: string | number;
  state?: OrganSystemBadgeState;
  onActivate?: () => void;
  className?: string;
  'aria-label'?: string;
}

const stateClass: Record<OrganSystemBadgeState, string> = {
  neutral: 'border-atlas-border bg-atlas-glass text-atlas-muted',
  active: 'atlas-border-glow bg-atlas-cyan/10 text-atlas-cyan',
  weak: 'border-atlas-pulse/45 bg-atlas-pulse/10 text-atlas-pulse',
  strong: 'border-atlas-success/45 bg-atlas-success/10 text-atlas-success',
  watch: 'border-atlas-warning/45 bg-atlas-warning/10 text-atlas-warning',
};

export function OrganSystemBadge({
  label,
  score,
  state = 'neutral',
  onActivate,
  className,
  'aria-label': ariaLabel,
}: OrganSystemBadgeProps) {
  const content = (
    <>
      <span className="truncate">{label}</span>
      {score !== undefined ? <span className="font-mono tabular-nums">{score}</span> : null}
    </>
  );

  const classes = cn(
    'inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold',
    'transition-[border-color,background-color,box-shadow,transform] duration-200',
    stateClass[state],
    onActivate && 'atlas-focus-ring cursor-pointer hover:-translate-y-0.5 motion-reduce:hover:translate-y-0',
    className,
  );

  if (onActivate) {
    return (
      <button type="button" className={classes} onClick={onActivate} aria-label={ariaLabel ?? `${label} organ system`}>
        {content}
      </button>
    );
  }

  return (
    <span className={classes} aria-label={ariaLabel ?? `${label} organ system`}>
      {content}
    </span>
  );
}
