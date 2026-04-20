/**
 * ClinicalBadge — CVA-styled badge with clinical-semantic variants.
 *
 * Leverages the OKLCH clinical color tokens (Phase 2) for medical
 * traffic-light conventions: normal (green), warning (amber),
 * critical (red), info (blue).
 *
 * Also provides standard non-clinical variants for general use.
 */

import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const clinicalBadgeVariants = cva(
  // Base: pill shape, small text, consistent padding
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border transition-colors',
  {
    variants: {
      variant: {
        // ── Standard variants ──
        default:
          'bg-[var(--color-accent)]/10 text-[var(--color-accent)] border-[var(--color-accent)]/30',
        secondary:
          'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] border-[var(--color-border)]',
        outline:
          'bg-transparent text-[var(--color-text-primary)] border-[var(--color-border)]',
        muted:
          'bg-[var(--color-bg-secondary)]/50 text-[var(--color-text-muted)] border-transparent',

        // ── Clinical-semantic variants (OKLCH tokens) ──
        // Green: correct answers, mastered content, safe indicators
        'clinical-normal':
          'bg-clinical-semantic-normal/15 text-clinical-semantic-normal border-clinical-semantic-normal/30',
        // Amber: borderline performance, content needing review
        'clinical-warning':
          'bg-clinical-semantic-warning/15 text-clinical-semantic-warning border-clinical-semantic-warning/30',
        // Red: incorrect answers, failed items, urgent review needed
        'clinical-critical':
          'bg-clinical-semantic-critical/15 text-clinical-semantic-critical border-clinical-semantic-critical/30',
        // Blue: neutral clinical data, informational elements
        'clinical-info':
          'bg-clinical-semantic-info/15 text-clinical-semantic-info border-clinical-semantic-info/30',

        // ── Data variants (existing PANaCEa palette) ──
        pass: 'bg-[var(--color-data-pass)]/15 text-[var(--color-data-pass)] border-[var(--color-data-pass)]/30',
        fail: 'bg-[var(--color-data-fail)]/15 text-[var(--color-data-fail)] border-[var(--color-data-fail)]/30',
        'high-yield':
          'bg-[var(--color-data-provisional)]/15 text-[var(--color-data-provisional)] border-[var(--color-data-provisional)]/30',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

type ClinicalBadgeVariant = NonNullable<VariantProps<typeof clinicalBadgeVariants>['variant']>;

interface ClinicalBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof clinicalBadgeVariants> {
  /** When true, truncate long labels with ellipsis */
  truncate?: boolean;
}

const ClinicalBadge = React.forwardRef<HTMLSpanElement, ClinicalBadgeProps>(
  ({ variant, truncate, className, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        clinicalBadgeVariants({ variant }),
        truncate && 'truncate max-w-[10rem]',
        className,
      )}
      {...props}
    />
  ),
);

ClinicalBadge.displayName = 'ClinicalBadge';

export { ClinicalBadge, clinicalBadgeVariants };
export type { ClinicalBadgeVariant, ClinicalBadgeProps };
