/**
 * Badge - Shared pill/tag component for consistent styling
 *
 * Use for: mechanism, indications, test categories, "High Yield", system tags, etc.
 * Replaces ad-hoc pill classes across Condition Library, Pharmacopeia, Lab Reference.
 */

import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { badgeBaseClass, badgeSizeClasses } from '@/components/ui/system';

const badgeVariants = cva(badgeBaseClass, {
  variants: {
    variant: {
      default:
        'border-[var(--color-accent)]/26 bg-[var(--color-accent)]/12 text-[var(--color-accent)]',
      highYield:
        'border-[var(--color-data-provisional)]/34 bg-[var(--color-data-provisional)]/14 text-[var(--color-data-provisional)]',
      category:
        'border-[var(--color-accent-secondary)]/26 bg-[var(--color-accent-secondary)]/12 text-[var(--color-accent-secondary)]',
      mechanism:
        'border-[var(--color-data-neutral)]/30 bg-[var(--color-data-neutral)]/14 text-[var(--color-data-neutral)]',
      muted:
        'border-transparent bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)]',
      secondary:
        'border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]',
      outline:
        'border-[var(--color-border)] bg-transparent text-[var(--color-text-primary)]',
      success:
        'border-[var(--color-data-pass)]/34 bg-[var(--color-data-pass)]/14 text-[var(--color-data-pass)]',
      warning:
        'border-[var(--color-data-provisional)]/34 bg-[var(--color-data-provisional)]/14 text-[var(--color-data-provisional)]',
      danger:
        'border-[var(--color-data-fail)]/34 bg-[var(--color-data-fail)]/14 text-[var(--color-data-fail)]',
      neutral:
        'border-[var(--color-border)] bg-[var(--color-bg-primary)]/70 text-[var(--color-text-secondary)]',
    },
    size: {
      sm: badgeSizeClasses.sm,
      md: badgeSizeClasses.md,
      lg: badgeSizeClasses.lg,
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'md',
  },
});

export type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>['variant']>;
export type BadgeSize = NonNullable<VariantProps<typeof badgeVariants>['size']>;

export interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  className?: string;
  /** When true, truncate long labels with ellipsis */
  truncate?: boolean;
  /** Max width (e.g. "max-w-[8rem]") when truncate is true */
  maxWidth?: string;
}

/**
 * Badge - Pill-shaped label for mechanisms, indications, categories, etc.
 */
export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'md',
  className = '',
  truncate = false,
  maxWidth,
}) => {
  return (
    <span
      className={cn(
        badgeVariants({ variant, size }),
        truncate && 'truncate',
        maxWidth,
        className,
      )}
    >
      {children}
    </span>
  );
};

export { badgeVariants };
export default Badge;
