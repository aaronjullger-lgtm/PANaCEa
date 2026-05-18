'use client';

import React from 'react';
import { useReducedMotion } from '@/hooks/useReducedMotion';

export interface AnimatedNumberProps extends React.HTMLAttributes<HTMLSpanElement> {
  value: number;
  formatter?: (value: number) => string;
  durationMs?: number;
  ariaLabel?: string;
}

const defaultFormatter = (value: number) => Math.round(value).toLocaleString();

export function AnimatedNumber({
  value,
  formatter = defaultFormatter,
  durationMs = 700,
  ariaLabel,
  ...props
}: AnimatedNumberProps) {
  const prefersReducedMotion = useReducedMotion();
  const [displayValue, setDisplayValue] = React.useState(value);
  const previousValue = React.useRef(value);
  const frameRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
    }

    const startValue = previousValue.current;
    previousValue.current = value;

    if (prefersReducedMotion || durationMs <= 0 || startValue === value) {
      setDisplayValue(value);
      return undefined;
    }

    const startTime = window.performance.now();
    const delta = value - startValue;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);

      setDisplayValue(startValue + delta * eased);

      if (progress < 1) {
        frameRef.current = window.requestAnimationFrame(tick);
      }
    };

    frameRef.current = window.requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, [durationMs, prefersReducedMotion, value]);

  return (
    <span aria-label={ariaLabel ?? formatter(value)} {...props}>
      {formatter(displayValue)}
    </span>
  );
}
