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
import { motion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';
import { cardHoverVariants, springs } from '@/config/appViews';

/* ---------- Ring-shadow value (single source of truth) ---------- */
const RING_SHADOW = '0 0 0 1px var(--color-glass-border), 0 2px 8px -2px var(--color-glass-shadow), 0 1px 3px -1px rgba(0,0,0,0.04)';

/* ---------- Glassmorphism card style ---------- */
const GLASS_CARD_STYLE: React.CSSProperties = {
  boxShadow: '0 0 0 1px var(--color-glass-border, var(--color-border)), 0 4px 16px -4px var(--color-glass-shadow, rgba(0,0,0,0.12)), 0 2px 6px -2px rgba(0,0,0,0.04)',
  backdropFilter: 'blur(16px) saturate(140%)',
  WebkitBackdropFilter: 'blur(16px) saturate(140%)',
  background: 'var(--color-card-bg, var(--color-bg-secondary))',
};

/* ---------- Card ---------- */

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { onClick?: () => void }
>(({ className, onClick, style, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('rounded-xl transition-shadow duration-200', className)}
    style={{ ...GLASS_CARD_STYLE, ...style }}
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
      style={{ boxShadow: 'inset 0 -1px 0 0 var(--color-glass-border, var(--color-border))', borderBottom: '1px solid transparent' }}
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
      style={{ boxShadow: 'inset 0 1px 0 0 var(--color-glass-border, var(--color-border))' }}
      {...props}
    />
  ),
);
CardFooter.displayName = 'CardFooter';

/* ---------- AnimatedCard (motion.div with hover/tap micro-interactions) ---------- */

type AnimatedCardProps = HTMLMotionProps<'div'> & {
  /** Disable hover lift + glow (e.g. for reduced-motion or static contexts) */
  disableHover?: boolean;
};

const AnimatedCard = React.forwardRef<HTMLDivElement, AnimatedCardProps>(
  ({ className, style, disableHover, ...props }, ref) => (
    <motion.div
      ref={ref}
      variants={disableHover ? undefined : cardHoverVariants}
      initial="rest"
      whileHover={disableHover ? undefined : 'hover'}
      whileTap={disableHover ? undefined : 'tap'}
      className={cn('rounded-xl', className)}
      style={{ ...GLASS_CARD_STYLE, ...style }}
      {...props}
    />
  ),
);
AnimatedCard.displayName = 'AnimatedCard';

/* ---------- Exports ---------- */

/** Re-export the ring-shadow value for components that need it inline */
const CARD_RING_SHADOW = RING_SHADOW;

export { Card, AnimatedCard, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, CARD_RING_SHADOW };
