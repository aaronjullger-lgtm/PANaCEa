/**
 * useMouseTrajectory - React hook for tracking mouse movements during MCQ answer selection
 *
 * Captures cursor trajectory data at 40ms intervals (25 Hz) and computes
 * micro-kinetic metrics for cognitive load inference.
 *
 * Usage:
 * ```tsx
 * const { startTracking, stopTracking, getMetrics } = useMouseTrajectory();
 *
 * // When question loads
 * useEffect(() => { startTracking(); }, [questionId]);
 *
 * // When answer button is clicked
 * const handleClick = (e: MouseEvent, optionId: string) => {
 *   const rect = e.currentTarget.getBoundingClientRect();
 *   const metrics = stopTracking({
 *     centerX: rect.left + rect.width / 2,
 *     centerY: rect.top + rect.height / 2,
 *     width: rect.width,
 *     height: rect.height,
 *   });
 *   // metrics now contains MAD, hesitation, jitter, etc.
 * };
 * ```
 */

import { useRef, useCallback, useEffect } from 'react';
import {
  type TrajectoryPoint,
  type TrajectoryMetrics,
  type TargetInfo,
  type RawTrajectory,
  analyzeTrajectory,
  serializeTrajectoryMetrics,
  SAMPLING_INTERVAL_MS,
} from '../lib/micro-kinetics';

/**
 * Hook return type
 */
export interface UseMouseTrajectoryReturn {
  /** Start tracking mouse movements for a new question */
  startTracking: () => void;
  /** Stop tracking and compute metrics for the clicked target */
  stopTracking: (target: TargetInfo) => TrajectoryMetrics | null;
  /** Get current metrics without stopping (for preview) */
  getMetrics: (target: TargetInfo) => TrajectoryMetrics | null;
  /** Check if currently tracking */
  isTracking: () => boolean;
  /** Reset tracking state */
  reset: () => void;
  /** Get raw trajectory data (for debugging) */
  getRawTrajectory: () => TrajectoryPoint[];
  /** Get serialized metrics for API submission */
  getSerializedMetrics: (target: TargetInfo) => Record<string, number> | null;
}

/**
 * Hook for tracking mouse trajectory during MCQ answer selection
 */
export function useMouseTrajectory(): UseMouseTrajectoryReturn {
  const isTrackingRef = useRef<boolean>(false);
  const startPointRef = useRef<{ x: number; y: number } | null>(null);
  const startTimeRef = useRef<number>(0);
  const pointsRef = useRef<TrajectoryPoint[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastPositionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  /**
   * Mouse move handler - updates last known position
   */
  const handleMouseMove = useCallback((e: MouseEvent) => {
    lastPositionRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  /**
   * Sample current mouse position and add to trajectory
   */
  const samplePosition = useCallback(() => {
    if (!isTrackingRef.current) return;

    const now = Date.now();
    const elapsed = now - startTimeRef.current;

    pointsRef.current.push({
      x: lastPositionRef.current.x,
      y: lastPositionRef.current.y,
      t: elapsed,
    });
  }, []);

  /**
   * Start tracking mouse movements
   */
  const startTracking = useCallback(() => {
    // Clean up any existing tracking
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Initialize tracking state
    isTrackingRef.current = true;
    startTimeRef.current = Date.now();
    pointsRef.current = [];
    startPointRef.current = { ...lastPositionRef.current };

    // Add global mouse move listener
    window.addEventListener('mousemove', handleMouseMove);

    // Start sampling at 40ms intervals (25 Hz)
    intervalRef.current = setInterval(samplePosition, SAMPLING_INTERVAL_MS);

    // Capture initial position
    samplePosition();
  }, [handleMouseMove, samplePosition]);

  /**
   * Stop tracking and compute metrics
   */
  const stopTracking = useCallback(
    (target: TargetInfo): TrajectoryMetrics | null => {
      if (!isTrackingRef.current) return null;

      // Stop tracking
      isTrackingRef.current = false;

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      window.removeEventListener('mousemove', handleMouseMove);

      // Final sample
      const endTime = Date.now();
      pointsRef.current.push({
        x: lastPositionRef.current.x,
        y: lastPositionRef.current.y,
        t: endTime - startTimeRef.current,
      });

      // Build raw trajectory
      if (!startPointRef.current || pointsRef.current.length < 2) {
        return null;
      }

      const rawTrajectory: RawTrajectory = {
        startPoint: startPointRef.current,
        points: pointsRef.current,
        target,
        startTime: startTimeRef.current,
        endTime,
      };

      // Analyze and return metrics
      return analyzeTrajectory(rawTrajectory);
    },
    [handleMouseMove]
  );

  /**
   * Get metrics without stopping tracking
   */
  const getMetrics = useCallback((target: TargetInfo): TrajectoryMetrics | null => {
    if (!startPointRef.current || pointsRef.current.length < 2) {
      return null;
    }

    const rawTrajectory: RawTrajectory = {
      startPoint: startPointRef.current,
      points: [...pointsRef.current],
      target,
      startTime: startTimeRef.current,
      endTime: Date.now(),
    };

    return analyzeTrajectory(rawTrajectory);
  }, []);

  /**
   * Check if currently tracking
   */
  const isTracking = useCallback(() => {
    return isTrackingRef.current;
  }, []);

  /**
   * Reset tracking state
   */
  const reset = useCallback(() => {
    isTrackingRef.current = false;

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    window.removeEventListener('mousemove', handleMouseMove);

    startPointRef.current = null;
    startTimeRef.current = 0;
    pointsRef.current = [];
  }, [handleMouseMove]);

  /**
   * Get raw trajectory data (for debugging)
   */
  const getRawTrajectory = useCallback(() => {
    return [...pointsRef.current];
  }, []);

  /**
   * Get serialized metrics for API submission
   */
  const getSerializedMetrics = useCallback(
    (target: TargetInfo): Record<string, number> | null => {
      const metrics = getMetrics(target);
      if (!metrics) return null;
      return serializeTrajectoryMetrics(metrics);
    },
    [getMetrics]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [handleMouseMove]);

  return {
    startTracking,
    stopTracking,
    getMetrics,
    isTracking,
    reset,
    getRawTrajectory,
    getSerializedMetrics,
  };
}

/**
 * Helper to extract target info from a clicked element
 */
export function getTargetInfoFromElement(element: HTMLElement): TargetInfo {
  const rect = element.getBoundingClientRect();
  return {
    centerX: rect.left + rect.width / 2,
    centerY: rect.top + rect.height / 2,
    width: rect.width,
    height: rect.height,
  };
}

/**
 * Helper to extract target info from a React mouse event
 */
export function getTargetInfoFromEvent(event: React.MouseEvent<HTMLElement>): TargetInfo {
  return getTargetInfoFromElement(event.currentTarget);
}

export default useMouseTrajectory;
