/**
 * Card — Unified card primitive for PANaCEa
 *
 * Uses the ring-shadow elevation system (box-shadow: 0 0 0 1px border, 0 1px 2px ambient)
 * instead of Tailwind `shadow-sm` + `border` combos. This ensures consistent depth
 * language across all surfaces.
 *
 * Compound components: Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter
 * All components use cn() for safe class merging and React.forwardRef for Radix composition.
 */

import React from 'react';
import { cn } from '@/lib/utils';

/* ---------- Ring-shadow value (single source of truth) ---------- */
const RING_SHADOW = '0 0 0 1px var(--color-border), 0 1px 2px 0 rgba(0,0,0,0.03)';

/* ---------- Card ---------- */

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { onClick?: () => void }
>(({ className, onClick, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('bg-[var(--color-bg-secondary)] rounded-xl', className)}
    style={{ boxShadow: RING_SHADOW }}
    onClick={onClick}
    role={onClick ? 'button' : undefined}
    tabIndex={onClick ? 0 : undefined}
    {...props}
  />
));
Card.displayName = 'Card';

/* ---------- CardHeader ---------- */

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('px-5 py-3.5', className)}
      style={{ boxShadow: 'inset 0 -1px 0 0 var(--color-border)' }}
      {...props}
    />
  ),
);
CardHeader.displayName = 'CardHeader';

/* ---------- CardTitle ---------- */

const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement> & { as?: 'h2' | 'h3' | 'h4' }
>(({ className, as: Tag = 'h3', ...props }, ref) => (
  <Tag
    ref={ref}
    className={cn('text-base font-semibold text-[var(--color-text-primary)]', className)}
    {...props}
  />
));
CardTitle.displayName = 'CardTitle';

/* ---------- CardDescription ---------- */

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('text-sm text-[var(--color-text-muted)] mt-0.5', className)}
    {...props}
  />
));
CardDescription.displayName = 'CardDescription';

/* ---------- CardContent ---------- */

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('px-5 py-4', className)} {...props} />
  ),
);
CardContent.displayName = 'CardContent';

/* ---------- CardFooter ---------- */

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('px-5 py-3', className)}
      style={{ boxShadow: 'inset 0 1px 0 0 var(--color-border)' }}
      {...props}
    />
  ),
);
CardFooter.displayName = 'CardFooter';

/* ---------- Exports ---------- */

/** Re-export the ring-shadow value for components that need it inline */
const CARD_RING_SHADOW = RING_SHADOW;

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, CARD_RING_SHADOW };
