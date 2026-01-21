/**
 * useMouseTrajectory - React hook for tracking mouse movements during MCQ answer selection
 *
 * Captures cursor trajectory data at 40ms intervals (25 Hz) and computes
 * micro-kinetic metrics for cognitive load inference.
 *
 * NEW: Tracks hover times over registered option elements for entropy calculation.
 *
 * Usage:
 * ```tsx
 * const { startTracking, stopTracking, registerOption, getMetrics } = useMouseTrajectory();
 *
 * // When question loads
 * useEffect(() => { startTracking(); }, [questionId]);
 *
 * // Register option elements for hover tracking
 * useEffect(() => {
 *   const cleanupA = registerOption('A', optionARef.current);
 *   const cleanupB = registerOption('B', optionBRef.current);
 *   return () => { cleanupA(); cleanupB(); };
 * }, []);
 *
 * // When answer button is clicked
 * const handleClick = (e: MouseEvent, optionId: string) => {
 *   const rect = e.currentTarget.getBoundingClientRect();
 *   const metrics = stopTracking({
 *     centerX: rect.left + rect.width / 2,
 *     centerY: rect.top + rect.height / 2,
 *     width: rect.width,
 *     height: rect.height,
 *   }, optionId);
 *   // metrics now contains MAD, hesitation, jitter, hoverEntropy, etc.
 * };
 * ```
 */

import { useRef, useCallback, useEffect } from 'react';
import {
  type TrajectoryPoint,
  type TrajectoryMetrics,
  type TargetInfo,
  type RawTrajectory,
  type AnalyzeTrajectoryOptions,
  type SerializedTrajectoryMetrics,
  analyzeTrajectory,
  serializeTrajectoryMetrics,
  SAMPLING_INTERVAL_MS,
} from '../lib/micro-kinetics';

/**
 * Internal hover tracking state for a single option
 */
interface HoverState {
  /** HTML element being tracked */
  element: HTMLElement;
  /** Total accumulated hover time in ms */
  totalTime: number;
  /** Number of times cursor entered this option */
  enterCount: number;
  /** Timestamp when current hover started (null if not hovering) */
  hoverStartTime: number | null;
}

/**
 * Cleanup function returned by registerOption
 */
export type UnregisterOptionFn = () => void;

/**
 * Hook return type
 */
export interface UseMouseTrajectoryReturn {
  /** Start tracking mouse movements for a new question */
  startTracking: () => void;
  /** Stop tracking and compute metrics for the clicked target */
  stopTracking: (target: TargetInfo, selectedOptionId?: string) => TrajectoryMetrics | null;
  /** Get current metrics without stopping (for preview) */
  getMetrics: (target: TargetInfo, selectedOptionId?: string) => TrajectoryMetrics | null;
  /** Check if currently tracking */
  isTracking: () => boolean;
  /** Reset tracking state */
  reset: () => void;
  /** Get raw trajectory data (for debugging) */
  getRawTrajectory: () => TrajectoryPoint[];
  /** Get serialized metrics for API submission */
  getSerializedMetrics: (target: TargetInfo, selectedOptionId?: string) => SerializedTrajectoryMetrics | null;
  /** Register an option element for hover tracking. Returns cleanup function. */
  registerOption: (optionId: string, element: HTMLElement | null) => UnregisterOptionFn;
  /** Get current hover times for all registered options */
  getHoverData: () => Record<string, number>;
  /** Get detailed hover state including enter counts */
  getDetailedHoverData: () => Array<{ optionId: string; hoverTime: number; enterCount: number }>;
}

/**
 * Hook for tracking mouse trajectory during MCQ answer selection
 */
export function useMouseTrajectory(): UseMouseTrajectoryReturn {
  const isTrackingRef = useRef<boolean>(false);
  const startPointRef = useRef<{ x: number; y: number } | null>(null);
  const startTimeRef = useRef<number>(0);
  const pointsRef = useRef<TrajectoryPoint[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPositionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Hover tracking state
  const hoverStatesRef = useRef<Map<string, HoverState>>(new Map());
  const handlersRef = useRef<Map<string, { enter: () => void; leave: () => void }>>(new Map());

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
   * Get current hover times for all registered options
   */
  const getHoverData = useCallback((): Record<string, number> => {
    const now = Date.now();
    const hoverTimes: Record<string, number> = {};

    hoverStatesRef.current.forEach((state, optionId) => {
      let totalTime = state.totalTime;
      // Add current hover time if still hovering
      if (state.hoverStartTime !== null) {
        totalTime += now - state.hoverStartTime;
      }
      hoverTimes[optionId] = totalTime;
    });

    return hoverTimes;
  }, []);

  /**
   * Get detailed hover state including enter counts
   */
  const getDetailedHoverData = useCallback(() => {
    const now = Date.now();
    const result: Array<{ optionId: string; hoverTime: number; enterCount: number }> = [];

    hoverStatesRef.current.forEach((state, optionId) => {
      let totalTime = state.totalTime;
      if (state.hoverStartTime !== null) {
        totalTime += now - state.hoverStartTime;
      }
      result.push({
        optionId,
        hoverTime: totalTime,
        enterCount: state.enterCount,
      });
    });

    return result;
  }, []);

  /**
   * Register an option element for hover tracking
   */
  const registerOption = useCallback((optionId: string, element: HTMLElement | null): UnregisterOptionFn => {
    // If element is null, return no-op cleanup
    if (!element) {
      return () => {};
    }

    // Create hover state for this option
    const state: HoverState = {
      element,
      totalTime: 0,
      enterCount: 0,
      hoverStartTime: null,
    };

    // Mouse enter handler
    const handleEnter = () => {
      if (!isTrackingRef.current) return;

      const currentState = hoverStatesRef.current.get(optionId);
      if (currentState && currentState.hoverStartTime === null) {
        currentState.hoverStartTime = Date.now();
        currentState.enterCount++;
      }
    };

    // Mouse leave handler
    const handleLeave = () => {
      if (!isTrackingRef.current) return;

      const currentState = hoverStatesRef.current.get(optionId);
      if (currentState && currentState.hoverStartTime !== null) {
        currentState.totalTime += Date.now() - currentState.hoverStartTime;
        currentState.hoverStartTime = null;
      }
    };

    // Store state and handlers
    hoverStatesRef.current.set(optionId, state);
    handlersRef.current.set(optionId, { enter: handleEnter, leave: handleLeave });

    // Attach event listeners
    element.addEventListener('mouseenter', handleEnter);
    element.addEventListener('mouseleave', handleLeave);

    // Return cleanup function
    return () => {
      element.removeEventListener('mouseenter', handleEnter);
      element.removeEventListener('mouseleave', handleLeave);
      hoverStatesRef.current.delete(optionId);
      handlersRef.current.delete(optionId);
    };
  }, []);

  /**
   * Finalize any ongoing hovers (called when tracking stops)
   */
  const finalizeHovers = useCallback(() => {
    const now = Date.now();
    hoverStatesRef.current.forEach((state) => {
      if (state.hoverStartTime !== null) {
        state.totalTime += now - state.hoverStartTime;
        state.hoverStartTime = null;
      }
    });
  }, []);

  /**
   * Reset hover tracking state
   */
  const resetHovers = useCallback(() => {
    hoverStatesRef.current.forEach((state) => {
      state.totalTime = 0;
      state.enterCount = 0;
      state.hoverStartTime = null;
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

    // Reset hover times for new question
    resetHovers();

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
  }, [handleMouseMove, samplePosition, resetHovers]);

  /**
   * Stop tracking and compute metrics
   */
  const stopTracking = useCallback(
    (target: TargetInfo, selectedOptionId?: string): TrajectoryMetrics | null => {
      if (!isTrackingRef.current) return null;

      // Stop tracking
      isTrackingRef.current = false;

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      window.removeEventListener('mousemove', handleMouseMove);

      // Finalize any ongoing hovers
      finalizeHovers();

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

      // Build options for hover data
      const options: AnalyzeTrajectoryOptions | undefined =
        selectedOptionId && hoverStatesRef.current.size > 0
          ? {
              hoverTimes: getHoverData(),
              selectedOptionId,
            }
          : undefined;

      // Analyze and return metrics
      return analyzeTrajectory(rawTrajectory, options);
    },
    [handleMouseMove, finalizeHovers, getHoverData]
  );

  /**
   * Get metrics without stopping tracking
   */
  const getMetrics = useCallback(
    (target: TargetInfo, selectedOptionId?: string): TrajectoryMetrics | null => {
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

      // Build options for hover data
      const options: AnalyzeTrajectoryOptions | undefined =
        selectedOptionId && hoverStatesRef.current.size > 0
          ? {
              hoverTimes: getHoverData(),
              selectedOptionId,
            }
          : undefined;

      return analyzeTrajectory(rawTrajectory, options);
    },
    [getHoverData]
  );

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

    // Reset hover tracking
    resetHovers();
  }, [handleMouseMove, resetHovers]);

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
    (target: TargetInfo, selectedOptionId?: string): SerializedTrajectoryMetrics | null => {
      const metrics = getMetrics(target, selectedOptionId);
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

      // Clean up all hover listeners
      handlersRef.current.forEach((handlers, optionId) => {
        const state = hoverStatesRef.current.get(optionId);
        if (state?.element) {
          state.element.removeEventListener('mouseenter', handlers.enter);
          state.element.removeEventListener('mouseleave', handlers.leave);
        }
      });
      hoverStatesRef.current.clear();
      handlersRef.current.clear();
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
    registerOption,
    getHoverData,
    getDetailedHoverData,
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