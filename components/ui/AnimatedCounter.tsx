/**
 * AnimatedCounter — Animates a numeric value counting up from 0 on mount.
 *
 * Uses requestAnimationFrame for smooth 60fps counting.
 * Respects reduced-motion preferences (renders final value immediately).
 * Handles both integer and decimal values.
 */

import { useState, useEffect, useRef } from 'react';
import { useReducedMotion } from '@/hooks/useReducedMotion';

interface AnimatedCounterProps {
  /** Target numeric value to animate to */
  value: number;
  /** Duration in ms (default 800) */
  duration?: number;
  /** Number of decimal places (default 0) */
  decimals?: number;
  /** Suffix to append (e.g. '%', 'h', ' min') */
  suffix?: string;
  /** Prefix to prepend (e.g. '+', '$') */
  prefix?: string;
  /** CSS class for the text */
  className?: string;
}

export function AnimatedCounter({
  value,
  duration = 800,
  decimals = 0,
  suffix = '',
  prefix = '',
  className,
}: AnimatedCounterProps) {
  const prefersReducedMotion = useReducedMotion();
  const [displayValue, setDisplayValue] = useState(
    prefersReducedMotion ? value : 0
  );
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const prevValueRef = useRef(value);

  useEffect(() => {
    if (prefersReducedMotion) {
      setDisplayValue(value);
      return;
    }

    // Reset if target value changed
    if (prevValueRef.current !== value) {
      prevValueRef.current = value;
      startRef.current = null;
    }

    const startValue = displayValue;
    const diff = value - startValue;

    // If diff is negligible, just set immediately
    if (Math.abs(diff) < 0.001) {
      setDisplayValue(value);
      return;
    }

    const animate = (timestamp: number) => {
      if (startRef.current === null) {
        startRef.current = timestamp;
      }

      const elapsed = timestamp - startRef.current;
      const progress = Math.min(elapsed / duration, 1);

      // Ease out cubic for natural deceleration
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startValue + diff * eased;

      setDisplayValue(current);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration, prefersReducedMotion]);

  const formatted =
    decimals > 0
      ? displayValue.toFixed(decimals)
      : Math.round(displayValue).toString();

  return (
    <span className={className}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}

export default AnimatedCounter;
