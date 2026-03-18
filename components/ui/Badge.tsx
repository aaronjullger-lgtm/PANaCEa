/**
 * Badge - Shared pill/tag component for consistent styling
 *
 * Use for: mechanism, indications, test categories, "High Yield", system tags, etc.
 * Replaces ad-hoc pill classes across Condition Library, Pharmacopeia, Lab Reference.
 */

import React from 'react';

export type BadgeVariant = 'default' | 'highYield' | 'category' | 'mechanism' | 'muted';

const VARIANT_CLASSES: Record<
  BadgeVariant,
  string
> = {
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
};

export interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
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
  className = '',
  truncate = false,
  maxWidth,
}) => {
  const base =
    'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border';
  const variantClass = VARIANT_CLASSES[variant];
  const truncateClass = truncate ? 'truncate' : '';
  const widthClass = maxWidth ?? '';

  return (
    <span
      className={`${base} ${variantClass} ${truncateClass} ${widthClass} ${className}`.trim()}
    >
      {children}
    </span>
  );
};

export default Badge;
