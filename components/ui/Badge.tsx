/**
 * Badge - Shared pill/tag component for consistent styling
 *
 * Use for: mechanism, indications, test categories, "High Yield", system tags, etc.
 * Replaces ad-hoc pill classes across Condition Library, Pharmacopeia, Lab Reference.
 *
 * Sizes align with SystemBadge / YieldBadge / clinical-badge so the whole badge
 * family shares one spacing scale.
 */

import React from 'react';
import { cn } from '@/lib/utils';

export type BadgeVariant =
  | 'default'
  | 'highYield'
  | 'category'
  | 'mechanism'
  | 'muted'
  | 'success'
  | 'warning'
  | 'danger';

export type BadgeSize = 'sm' | 'md' | 'lg';

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  default:
    'bg-[var(--color-accent)]/10 text-[var(--color-accent)] border-[var(--color-accent)]/30',
  highYield:
    'bg-[var(--color-accent)]/15 text-[var(--color-accent)] border-[var(--color-accent)]/30',
  category:
    'bg-[var(--color-accent)]/10 text-[var(--color-accent)] border-[var(--color-accent)]/30',
  mechanism:
    'bg-[var(--color-data-neutral)]/15 text-[var(--color-data-neutral)] dark:text-[var(--color-data-neutral)] border-[var(--color-data-neutral)]/30',
  muted:
    'bg-[var(--color-bg-secondary)]/50 text-[var(--color-text-muted)] border-transparent',
  success:
    'bg-[var(--color-data-pass)]/15 text-[var(--color-data-pass)] border-[var(--color-data-pass)]/30',
  warning:
    'bg-[var(--color-data-provisional)]/15 text-[var(--color-data-provisional)] border-[var(--color-data-provisional)]/30',
  danger:
    'bg-[var(--color-data-fail)]/15 text-[var(--color-data-fail)] border-[var(--color-data-fail)]/30',
};

const SIZE_CLASSES: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-[11px] gap-1',
  md: 'px-2.5 py-1 text-xs gap-1.5',
  lg: 'px-3 py-1.5 text-sm gap-2',
};

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
        'inline-flex items-center rounded-full font-medium border',
        SIZE_CLASSES[size],
        VARIANT_CLASSES[variant],
        truncate && 'truncate',
        maxWidth,
        className,
      )}
    >
      {children}
    </span>
  );
};

export default Badge;
