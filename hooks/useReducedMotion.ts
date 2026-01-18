/**
 * Hook to detect and respond to user's reduced motion preference
 * Respects accessibility settings for animations
 */

import { useState, useEffect } from 'react';

export function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    // Check if window is available (SSR safety)
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    // Set initial value
    setPrefersReducedMotion(mediaQuery.matches);

    // Listen for changes
    const handleChange = (event: MediaQueryListEvent | MediaQueryList) => {
      // Type guard: MediaQueryListEvent has a 'type' property, MediaQueryList does not
      const matches = 'type' in event ? event.matches : (event as MediaQueryList).matches;
      setPrefersReducedMotion(matches);
    };

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
    // Legacy browsers - uses deprecated addListener/removeListener
    else if ('addListener' in mediaQuery && typeof mediaQuery.addListener === 'function') {
      mediaQuery.addListener(handleChange);
      return () => {
        if ('removeListener' in mediaQuery && typeof mediaQuery.removeListener === 'function') {
          mediaQuery.removeListener(handleChange);
        }
      };
    }
  }, []);

  return prefersReducedMotion;
}

/**
 * Get animation configuration that respects reduced motion preference
 *
 * @param normalDuration - Duration in seconds for normal animation
 * @param reducedDuration - Duration in seconds for reduced motion (default: 0.01)
 * @returns Duration that respects user preference
 */
export function useAccessibleAnimation(
  normalDuration: number,
  reducedDuration: number = 0.01
): number {
  const prefersReducedMotion = useReducedMotion();
  return prefersReducedMotion ? reducedDuration : normalDuration;
}

/**
 * Transition configuration type for Framer Motion
 */
export interface TransitionConfig {
  duration?: number;
  ease?: string | number[];
  type?: string;
  delay?: number;
  [key: string]: number | string | number[] | undefined;
}

/**
 * Get transition configuration that respects reduced motion preference
 *
 * @param normalConfig - Normal transition configuration
 * @returns Transition configuration that respects user preference
 */
export function useAccessibleTransition<T extends TransitionConfig>(normalConfig: T): T {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return {
      ...normalConfig,
      duration: 0.01,
      ease: 'linear',
    } as T;
  }

  return normalConfig;
}
