/**
 * Animation utilities and constants for consistent, smooth transitions
 * Follows WCAG 2.1 Success Criterion 2.3.3 (Animation from Interactions)
 */

import { Variants } from 'framer-motion';

/**
 * Animation timing constants (in seconds)
 */
export const ANIMATION_DURATIONS = {
  /** Ultra-fast: 100ms - for micro-interactions, button presses */
  ultraFast: 0.1,
  /** Fast: 150ms - for hover states, focus changes */
  fast: 0.15,
  /** Normal: 200ms - for standard transitions */
  normal: 0.2,
  /** Slow: 300ms - for page transitions, modal appearances */
  slow: 0.3,
  /** Very slow: 500ms - for dramatic effects, hero animations */
  verySlow: 0.5,
} as const;

/**
 * Easing functions for smooth animations
 * Uses cubic-bezier values that match Tailwind's default easing
 */
export const EASING = {
  /** Linear: constant speed */
  linear: 'linear',
  /** Ease-in: starts slow, accelerates */
  easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
  /** Ease-out: starts fast, decelerates */
  easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
  /** Ease-in-out: smooth acceleration and deceleration */
  easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  /** Spring-like bounce for playful interactions */
  bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
} as const;

/**
 * Standard animation variants for common patterns
 */
export const ANIMATION_VARIANTS = {
  /** Slide in from below (no opacity — prevents ghost UI on animation failure) */
  fadeInUp: {
    initial: { y: 20 },
    animate: { y: 0 },
    exit: { y: -20 },
  },

  /** Slide in from above */
  fadeInDown: {
    initial: { y: -20 },
    animate: { y: 0 },
    exit: { y: 20 },
  },

  /** Slide in from left */
  fadeInLeft: {
    initial: { x: -20 },
    animate: { x: 0 },
    exit: { x: 20 },
  },

  /** Slide in from right */
  fadeInRight: {
    initial: { x: 20 },
    animate: { x: 0 },
    exit: { x: -20 },
  },

  /** Scale in from center */
  scaleIn: {
    initial: { scale: 0.95 },
    animate: { scale: 1 },
    exit: { scale: 0.95 },
  },

  /** Scale in with slight bounce */
  scaleInBounce: {
    initial: { opacity: 0, scale: 0.8 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.8 },
  },

  /** Slide in from bottom (for modals, drawers) */
  slideUp: {
    initial: { y: '100%' },
    animate: { y: 0 },
    exit: { y: '100%' },
  },

  /** Slide in from right (for side panels) */
  slideLeft: {
    initial: { x: '100%' },
    animate: { x: 0 },
    exit: { x: '100%' },
  },
} as const;

/**
 * Standard transition configurations
 */
export const TRANSITIONS = {
  /** Fast transition for interactive elements */
  fast: {
    duration: ANIMATION_DURATIONS.fast,
    ease: EASING.easeOut,
  },

  /** Standard transition for most animations */
  normal: {
    duration: ANIMATION_DURATIONS.normal,
    ease: EASING.easeOut,
  },

  /** Smooth transition for page/content changes */
  smooth: {
    duration: ANIMATION_DURATIONS.slow,
    ease: EASING.easeInOut,
  },

  /** Bouncy transition for playful elements */
  bouncy: {
    duration: ANIMATION_DURATIONS.normal,
    ease: EASING.bounce,
  },

  /** Spring physics for natural feeling animations */
  spring: {
    type: 'spring',
    stiffness: 300,
    damping: 25,
  },
} as const;

/**
 * Stagger animations for lists and grids
 */
export function getStaggerChildren(delay: number = 0.05): Variants {
  return {
    animate: {
      transition: {
        staggerChildren: delay,
      },
    },
  };
}

/**
 * Check if user prefers reduced motion
 * Follows WCAG 2.1 Success Criterion 2.3.3
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Get safe animation properties that respect user preferences
 */
export function getSafeAnimation<T extends object>(animation: T, fallback: Partial<T> = {}): T {
  if (prefersReducedMotion()) {
    return {
      ...animation,
      ...fallback,
      transition: { duration: 0.01 } as T extends { transition?: infer Tr } ? Tr : { duration: number },
    };
  }
  return animation;
}

/**
 * Create a hover animation variant
 */
export function createHoverAnimation(
  scale: number = 1.02,
  lift: number = -2
): { whileHover: object; whileTap: object } {
  return {
    whileHover: {
      scale,
      y: lift,
      transition: TRANSITIONS.fast,
    },
    whileTap: {
      scale: 0.98,
      transition: TRANSITIONS.ultraFast,
    },
  };
}

/**
 * Create a focus animation for accessibility
 */
export function createFocusAnimation(): { whileFocus: object } {
  return {
    whileFocus: {
      scale: 1.02,
      transition: TRANSITIONS.fast,
    },
  };
}

/**
 * Standard page transition for route changes
 */
export const PAGE_TRANSITION = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
  transition: TRANSITIONS.smooth,
};

/**
 * Standard modal/dialog transition
 */
export const MODAL_TRANSITION = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
  transition: TRANSITIONS.spring,
};

/**
 * Standard toast/notification transition
 */
export const TOAST_TRANSITION = {
  initial: { opacity: 0, y: -20, scale: 0.9 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, scale: 0.9 },
  transition: TRANSITIONS.bouncy,
};

/**
 * Standard list item transition
 */
export const LIST_ITEM_TRANSITION = {
  initial: { opacity: 0, x: -10 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 10 },
  transition: TRANSITIONS.normal,
};

/**
 * Helper to create consistent animation props
 */
export function createAnimationProps(
  variant: keyof typeof ANIMATION_VARIANTS = 'fadeInUp',
  transition: keyof typeof TRANSITIONS = 'normal',
  custom?: Partial<typeof ANIMATION_VARIANTS.fadeInUp>
) {
  const baseVariant = ANIMATION_VARIANTS[variant];
  const baseTransition = TRANSITIONS[transition];

  return {
    ...baseVariant,
    ...custom,
    transition: baseTransition,
  };
}

/**
 * CSS transition classes for Tailwind
 */
export const CSS_TRANSITIONS = {
  /** Standard transition for colors and opacity */
  colors: 'transition-colors duration-200 ease-out',

  /** Transition for transforms (scale, translate) */
  transforms: 'transition-transform duration-200 ease-out',

  /** Transition for opacity only */
  opacity: 'transition-opacity duration-200 ease-out',

  /** Transition for all properties */
  all: 'transition-all duration-200 ease-out',

  /** Fast transition for interactive feedback */
  fast: 'transition-all duration-150 ease-out',

  /** Slow transition for dramatic effects */
  slow: 'transition-all duration-300 ease-in-out',
} as const;

/**
 * Animation delay classes for staggered animations
 */
export const ANIMATION_DELAYS = {
  0: 'delay-0',
  50: 'delay-50',
  100: 'delay-100',
  150: 'delay-150',
  200: 'delay-200',
  300: 'delay-300',
  500: 'delay-500',
} as const;
