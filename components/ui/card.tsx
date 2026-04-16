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
import {
  bodySupportClass,
  sectionHeadingClass,
  surfaceBaseClass,
  surfaceCompactPaddingClass,
  surfaceInteractiveClass,
  surfacePaddingClass,
  surfaceRaisedStyle,
  surfaceShadowStyle,
} from '@/components/ui/system';

/* ---------- Ring-shadow value (single source of truth) ---------- */
const RING_SHADOW =
  '0 0 0 1px color-mix(in srgb, var(--color-text-primary) 4%, transparent), 0 20px 42px -30px rgba(15,23,42,0.58), 0 8px 16px -12px rgba(15,23,42,0.36)';

/* ---------- Glassmorphism card style ---------- */
const GLASS_CARD_STYLE: React.CSSProperties = {
  ...surfaceShadowStyle,
  background: 'var(--color-card-bg, var(--color-bg-secondary))',
};

/* ---------- Card ---------- */

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { onClick?: () => void }
>(({ className, onClick, style, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      surfaceBaseClass,
      surfaceInteractiveClass,
      'rounded-[1.25rem]',
      onClick && 'cursor-pointer hover:-translate-y-0.5 hover:border-[var(--color-accent)]/16',
      className
    )}
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
      className={cn('border-b border-[var(--color-border)] px-5 py-4 sm:px-6', className)}
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
    className={cn(sectionHeadingClass, className)}
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
    className={cn('mt-1', bodySupportClass, className)}
    {...props}
  />
));
CardDescription.displayName = 'CardDescription';

/* ---------- CardContent ---------- */

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn(surfacePaddingClass, className)} {...props} />
  ),
);
CardContent.displayName = 'CardContent';

/* ---------- CardFooter ---------- */

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('border-t border-[var(--color-border)] px-5 py-4 sm:px-6', className)}
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
      className={cn(
        surfaceBaseClass,
        surfaceInteractiveClass,
        surfaceCompactPaddingClass,
        'rounded-[1.25rem]',
        className
      )}
      style={{ ...surfaceRaisedStyle, ...style }}
      {...props}
    />
  ),
);
AnimatedCard.displayName = 'AnimatedCard';

/* ---------- Exports ---------- */

/** Re-export the ring-shadow value for components that need it inline */
const CARD_RING_SHADOW = RING_SHADOW;

export { Card, AnimatedCard, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, CARD_RING_SHADOW };
