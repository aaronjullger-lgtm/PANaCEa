/**
 * useSwipeGesture Hook
 * 2026 PA Student Optimization - Touch gesture support for mobile
 * 
 * Detects swipe gestures on touch devices:
 * - Swipe right: Correct/Continue
 * - Swipe left: Incorrect/Go back
 * - Configurable threshold and velocity requirements
 */

import { useEffect, useRef, useState } from 'react';

interface SwipeConfig {
  minDistance?: number; // Minimum swipe distance in pixels (default: 50)
  maxTime?: number; // Maximum time for swipe in ms (default: 300)
  threshold?: number; // Velocity threshold (default: 0.3)
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  enabled?: boolean;
}

interface TouchPosition {
  x: number;
  y: number;
  time: number;
}

export function useSwipeGesture({
  minDistance = 50,
  maxTime = 300,
  threshold = 0.3,
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  enabled = true,
}: SwipeConfig) {
  const [touchStart, setTouchStart] = useState<TouchPosition | null>(null);
  const [touchEnd, setTouchEnd] = useState<TouchPosition | null>(null);
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled || !elementRef.current) return;

    const element = elementRef.current;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (touch) {
        setTouchStart({
          x: touch.clientX,
          y: touch.clientY,
          time: Date.now(),
        });
        setTouchEnd(null);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (touch) {
        setTouchEnd({
          x: touch.clientX,
          y: touch.clientY,
          time: Date.now(),
        });
      }
    };

    const handleTouchEnd = () => {
      if (!touchStart || !touchEnd) return;

      const distanceX = touchEnd.x - touchStart.x;
      const distanceY = touchEnd.y - touchStart.y;
      const elapsedTime = touchEnd.time - touchStart.time;

      // Check if swipe was fast enough
      if (elapsedTime > maxTime) {
        setTouchStart(null);
        setTouchEnd(null);
        return;
      }

      const absDistanceX = Math.abs(distanceX);
      const absDistanceY = Math.abs(distanceY);

      // Determine if horizontal or vertical swipe
      const isHorizontal = absDistanceX > absDistanceY;

      if (isHorizontal && absDistanceX >= minDistance) {
        // Horizontal swipe
        const velocity = absDistanceX / elapsedTime;
        if (velocity >= threshold) {
          if (distanceX > 0) {
            onSwipeRight?.();
          } else {
            onSwipeLeft?.();
          }
        }
      } else if (!isHorizontal && absDistanceY >= minDistance) {
        // Vertical swipe
        const velocity = absDistanceY / elapsedTime;
        if (velocity >= threshold) {
          if (distanceY > 0) {
            onSwipeDown?.();
          } else {
            onSwipeUp?.();
          }
        }
      }

      setTouchStart(null);
      setTouchEnd(null);
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: true });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [
    enabled,
    touchStart,
    touchEnd,
    minDistance,
    maxTime,
    threshold,
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
  ]);

  return { ref: elementRef, touchStart, touchEnd };
}

export default useSwipeGesture;
