/**
 * useTelemetryTracking Hook
 * 
 * Tracks timeToFirstClick and totalDwellTime via useRef (no re-renders).
 * Call getTelemetry() on submit to retrieve final values.
 */

import { useRef, useCallback, useEffect } from 'react';

export function useTelemetryTracking() {
  const startTime = useRef<number>(Date.now());
  const firstClickTime = useRef<number | null>(null);
  const answerSwitches = useRef<number>(0);

  const recordFirstClick = useCallback(() => {
    if (firstClickTime.current === null) {
      firstClickTime.current = Date.now();
    }
  }, []);

  const recordAnswerSwitch = useCallback(() => {
    answerSwitches.current += 1;
  }, []);

  const getTelemetry = useCallback(() => {
    const now = Date.now();
    return {
      timeToFirstClick: firstClickTime.current 
        ? firstClickTime.current - startTime.current 
        : now - startTime.current,
      totalDwellTime: now - startTime.current,
      answerSwitches: answerSwitches.current,
    };
  }, []);

  const reset = useCallback(() => {
    startTime.current = Date.now();
    firstClickTime.current = null;
    answerSwitches.current = 0;
  }, []);

  return { recordFirstClick, recordAnswerSwitch, getTelemetry, reset };
}
