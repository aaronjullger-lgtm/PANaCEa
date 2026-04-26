/**
 * Badge - Shared pill/tag component for consistent styling
 *
 * Use for: mechanism, indications, test categories, "High Yield", system tags, etc.
 * Replaces ad-hoc pill classes across Condition Library, Pharmacopeia, Lab Reference.
 *
 * Uses Class Variance Authority (CVA) for type-safe variant definitions -
 * matching the pattern used by button.tsx and clinical-badge.tsx. Sizes align
 * with SystemBadge / YieldBadge / clinical-badge so the whole badge family
 * shares one spacing scale.
 */

import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/* ---------- CVA variant definitions ---------- */

const badgeVariants = cva(
  'inline-flex items-center rounded-full font-medium border',
  {
    variants: {
      variant: {
        default:
          'bg-[var(--color-accent)]/10 text-[var(--color-accent)] border-[var(--color-accent)]/30',
        highYield:
          'bg-[var(--color-accent)]/15 text-[var(--color-accent)] border-[var(--color-accent)]/30',
        category:
          'bg-[var(--color-accent-secondary)]/10 text-[var(--color-accent-secondary)] border-[var(--color-accent-secondary)]/30',
        mechanism:
          'bg-[var(--color-data-neutral)]/15 text-[var(--color-data-neutral)] border-[var(--color-data-neutral)]/30',
        muted:
          'bg-[var(--color-bg-secondary)]/50 text-[var(--color-text-muted)] border-transparent',
        secondary:
          'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] border-[var(--color-border)]',
        outline:
          'bg-transparent text-[var(--color-text-primary)] border-[var(--color-border)]',
        success:
          'bg-[var(--color-success)]/15 text-[var(--color-success)] border-[var(--color-success)]/30',
        risk:
          'bg-[var(--color-risk)]/15 text-[var(--color-risk)] border-[var(--color-risk)]/30',
        warning:
          'bg-[var(--color-risk)]/15 text-[var(--color-risk)] border-[var(--color-risk)]/30',
        danger:
          'bg-[var(--color-danger)]/15 text-[var(--color-danger)] border-[var(--color-danger)]/30',
      },
      size: {
        sm: 'px-2 py-0.5 text-[11px] gap-1',
        md: 'px-2.5 py-1 text-xs gap-1.5',
        lg: 'px-3 py-1.5 text-sm gap-2',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  },
);

export type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>['variant']>;
export type BadgeSize = NonNullable<VariantProps<typeof badgeVariants>['size']>;

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  children: React.ReactNode;
  /** When true, truncate long labels with ellipsis */
  truncate?: boolean;
  /** Max width (e.g. "max-w-[8rem]") when truncate is true */
  maxWidth?: string;
}

/**
 * Badge - Pill-shaped label for mechanisms, indications, categories, etc.
 */
export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ children, variant, size, className, truncate = false, maxWidth, ...rest }, ref) => (
    <span
      ref={ref}
      className={cn(
        badgeVariants({ variant, size }),
        truncate && 'truncate',
        maxWidth,
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  ),
);
Badge.displayName = 'Badge';

export const Pill = Badge;

export { badgeVariants };
export default Badge;
