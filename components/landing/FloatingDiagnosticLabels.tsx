import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils';
import { HERO_DIAGNOSTIC_LABELS, type HeroDiagnosticLabel } from './content';

const positionClass: Record<HeroDiagnosticLabel['position'], string> = {
  'upper-left': 'left-4 top-5',
  'upper-right': 'right-4 top-8',
  'middle-left': 'left-2 top-[46%]',
  'middle-right': 'right-2 top-[44%]',
  'lower-left': 'bottom-10 left-5',
  'lower-right': 'bottom-8 right-5',
};

const toneClass: Record<HeroDiagnosticLabel['tone'], string> = {
  cyan: 'border-atlas-cyan/45 text-atlas-cyan shadow-[0_0_30px_-18px_var(--atlas-accent-cyan)]',
  blue: 'border-atlas-blue/45 text-atlas-blue shadow-[0_0_30px_-18px_var(--atlas-accent-blue)]',
  violet: 'border-atlas-violet/45 text-atlas-violet shadow-[0_0_30px_-18px_var(--atlas-accent-violet)]',
  pulse: 'border-atlas-pulse/45 text-atlas-pulse shadow-[0_0_30px_-18px_var(--atlas-accent-pulse-pink)]',
  success: 'border-atlas-success/45 text-atlas-success shadow-[0_0_30px_-18px_var(--atlas-success-green)]',
  warning: 'border-atlas-warning/45 text-atlas-warning shadow-[0_0_30px_-18px_var(--atlas-warning-amber)]',
};

export interface FloatingDiagnosticLabelsProps {
  compact?: boolean;
  className?: string;
}

export function FloatingDiagnosticLabels({ compact = false, className }: FloatingDiagnosticLabelsProps) {
  const prefersReducedMotion = useReducedMotion();

  if (compact) {
    return (
      <div className={cn('grid grid-cols-2 gap-2', className)} aria-hidden="true">
        {HERO_DIAGNOSTIC_LABELS.map((item) => (
          <div
            key={item.label}
            className={cn(
              'rounded-2xl border bg-atlas-background/65 px-3 py-2 shadow-atlas-glass backdrop-blur-xl',
              toneClass[item.tone],
            )}
          >
            <p className="text-[0.66rem] font-semibold uppercase tracking-[0.12em] text-atlas-muted">
              {item.label}
            </p>
            <p className="mt-1 font-mono text-xs font-semibold tabular-nums text-current">{item.metric}</p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn('pointer-events-none absolute inset-0 z-20 hidden lg:block', className)} aria-hidden="true">
      {HERO_DIAGNOSTIC_LABELS.map((item, index) => (
        <motion.div
          key={item.label}
          initial={prefersReducedMotion ? false : { opacity: 0, y: 8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45, delay: 0.18 + index * 0.06 }}
          className={cn(
            'absolute min-w-36 rounded-2xl border bg-atlas-background/72 px-3 py-2 shadow-atlas-glass backdrop-blur-xl',
            positionClass[item.position],
            toneClass[item.tone],
          )}
        >
          <p className="text-[0.66rem] font-semibold uppercase tracking-[0.12em] text-atlas-muted">
            {item.label}
          </p>
          <p className="mt-1 font-mono text-sm font-semibold tabular-nums text-current">{item.metric}</p>
        </motion.div>
      ))}
    </div>
  );
}
