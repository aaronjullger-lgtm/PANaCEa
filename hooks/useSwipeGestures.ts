/**
 * useSwipeGestures - Touch gesture detection for mobile navigation
 * 
 * Provides swipe left/right/down detection for quiz navigation and dismissal.
 * Respects minimum swipe distance to prevent accidental triggers.
 */

import { useEffect, useRef, useState } from 'react';

interface SwipeHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeDown?: () => void;
  onSwipeUp?: () => void;
}

interface SwipeOptions {
  /** Minimum swipe distance in pixels */
  minDistance?: number;
  /** Maximum time for swipe gesture (ms) */
  maxDuration?: number;
  /** Disable on text selection */
  preventOnTextSelect?: boolean;
  /** Only track touch (not mouse) */
  touchOnly?: boolean;
}

interface TouchPoint {
  x: number;
  y: number;
  time: number;
}

const DEFAULT_OPTIONS: Required<SwipeOptions> = {
  minDistance: 80,
  maxDuration: 500,
  preventOnTextSelect: true,
  touchOnly: true,
};

/**
 * Hook for detecting swipe gestures on an element
 */
export function useSwipeGestures(
  handlers: SwipeHandlers,
  options: SwipeOptions = {}
): React.RefObject<HTMLDivElement | null> {
  const ref = useRef<HTMLDivElement>(null);
  const touchStart = useRef<TouchPoint | null>(null);
  const opts = { ...DEFAULT_OPTIONS, ...options };

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const handleStart = (e: TouchEvent | MouseEvent) => {
      // Skip if touchOnly and this is a mouse event
      if (opts.touchOnly && e instanceof MouseEvent) return;

      // Skip if there's active text selection
      if (opts.preventOnTextSelect) {
        const selection = window.getSelection();
        if (selection && selection.toString().length > 0) return;
      }

      // Skip if touching an input, textarea, or button
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'BUTTON' ||
        target.tagName === 'SELECT'
      ) {
        return;
      }

      const point = e instanceof TouchEvent ? e.touches[0] : e;
      if (!point) return;
      touchStart.current = {
        x: point.clientX,
        y: point.clientY,
        time: Date.now(),
      };
    };

    const handleEnd = (e: TouchEvent | MouseEvent) => {
      if (!touchStart.current) return;
      if (opts.touchOnly && e instanceof MouseEvent) return;

      const point = e instanceof TouchEvent ? e.changedTouches[0] : e;
      if (!point) return;
      const deltaX = point.clientX - touchStart.current.x;
      const deltaY = point.clientY - touchStart.current.y;
      const duration = Date.now() - touchStart.current.time;

      // Reset
      touchStart.current = null;

      // Check duration
      if (duration > opts.maxDuration) return;

      // Determine direction (prioritize larger delta)
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      // Horizontal swipe
      if (absX > absY && absX > opts.minDistance) {
        if (deltaX > 0 && handlers.onSwipeRight) {
          handlers.onSwipeRight();
        } else if (deltaX < 0 && handlers.onSwipeLeft) {
          handlers.onSwipeLeft();
        }
        return;
      }

      // Vertical swipe
      if (absY > absX && absY > opts.minDistance) {
        if (deltaY > 0 && handlers.onSwipeDown) {
          handlers.onSwipeDown();
        } else if (deltaY < 0 && handlers.onSwipeUp) {
          handlers.onSwipeUp();
        }
      }
    };

    const handleCancel = () => {
      touchStart.current = null;
    };

    // Add listeners
    element.addEventListener('touchstart', handleStart, { passive: true });
    element.addEventListener('touchend', handleEnd);
    element.addEventListener('touchcancel', handleCancel);

    if (!opts.touchOnly) {
      element.addEventListener('mousedown', handleStart);
      element.addEventListener('mouseup', handleEnd);
    }

    return () => {
      element.removeEventListener('touchstart', handleStart);
      element.removeEventListener('touchend', handleEnd);
      element.removeEventListener('touchcancel', handleCancel);
      if (!opts.touchOnly) {
        element.removeEventListener('mousedown', handleStart);
        element.removeEventListener('mouseup', handleEnd);
      }
    };
  }, [handlers, opts]);

  return ref;
}

/**
 * Hook for detecting pull-to-refresh gesture
 */
export function usePullToRefresh(
  onRefresh: () => void | Promise<void>,
  options: { threshold?: number; enabled?: boolean } = {}
): React.RefObject<HTMLDivElement | null> {
  const ref = useRef<HTMLDivElement>(null);
  const { threshold = 80, enabled = true } = options;
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStart = useRef<TouchPoint | null>(null);
  const [pullDistance, setPullDistance] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const element = ref.current;
    if (!element) return;

    const handleStart = (e: TouchEvent) => {
      // Only trigger if scrolled to top
      if (element.scrollTop > 0) return;

      const point = e.touches[0];
      if (!point) return;
      touchStart.current = {
        x: point.clientX,
        y: point.clientY,
        time: Date.now(),
      };
    };

    const handleMove = (e: TouchEvent) => {
      if (!touchStart.current) return;
      if (element.scrollTop > 0) {
        touchStart.current = null;
        return;
      }

      const point = e.touches[0];
      if (!point) return;
      const deltaY = point.clientY - touchStart.current.y;

      // Only track downward pull
      if (deltaY > 0) {
        setPullDistance(Math.min(deltaY, threshold * 1.5));
        // Prevent default scroll if pulling
        if (deltaY > 10) {
          e.preventDefault();
        }
      }
    };

    const handleEnd = async () => {
      if (!touchStart.current) return;

      const distance = pullDistance;
      touchStart.current = null;
      setPullDistance(0);

      // Trigger refresh if threshold met
      if (distance >= threshold && !isRefreshing) {
        setIsRefreshing(true);
        try {
          await onRefresh();
        } finally {
          setIsRefreshing(false);
        }
      }
    };

    element.addEventListener('touchstart', handleStart, { passive: true });
    element.addEventListener('touchmove', handleMove, { passive: false });
    element.addEventListener('touchend', handleEnd);

    return () => {
      element.removeEventListener('touchstart', handleStart);
      element.removeEventListener('touchmove', handleMove);
      element.removeEventListener('touchend', handleEnd);
    };
  }, [enabled, threshold, pullDistance, isRefreshing, onRefresh]);

  return ref;
}
