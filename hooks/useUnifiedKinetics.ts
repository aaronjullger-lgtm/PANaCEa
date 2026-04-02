/**
 * Unified Kinetics Hook
 *
 * Adapts between useMicroKinetics (desktop/mouse) and useTouchKinetics (mobile/touch)
 * based on device detection. Provides a single interface to QuizView so the behavioral
 * telemetry pipeline works identically regardless of input method.
 *
 * Device detection happens once at hook initialization. The inactive hook's calls
 * are no-ops, so there's no overhead from having both imported.
 *
 * @see hooks/useMicroKinetics.ts — Desktop mouse-tracking signals
 * @see hooks/useTouchKinetics.ts — Mobile touch-tracking signals
 * @see lib/srs/ghostGrader.ts — Consumes the unified metrics
 */

import { useCallback, useMemo } from 'react';
import { useMicroKinetics, type MicroKineticsMetrics, type UseMicroKineticsResult } from './useMicroKinetics';
import { useTouchKinetics, type UseTouchKineticsResult } from './useTouchKinetics';

export interface UseUnifiedKineticsResult {
  /** Record hover (desktop) or tap (touch) on an answer option */
  recordOptionInteraction: (optionLabel: string) => void;
  /** Record answer selection */
  recordSelection: () => void;
  /** Register scroll container for vignette regression tracking */
  registerScrollContainer: (element: HTMLElement | null) => void;  /** Register mouse tracking container (desktop only, no-op on touch) */
  registerMouseTrackingContainer: (element: HTMLElement | null) => void;
  /** Called when answers are revealed */
  onAnswersRevealed: () => void;
  /** Get current metrics snapshot (same shape regardless of device) */
  getMetrics: () => MicroKineticsMetrics;
  /** Reset for next question */
  reset: () => void;
  /** Current metrics (reactive) */
  metrics: MicroKineticsMetrics;
  /** Whether using touch input */
  isTouchDevice: boolean;
  /** The active input method */
  inputMethod: 'mouse' | 'touch';
}

const noop = () => {};
const noopElement = (_el: HTMLElement | null) => {};

export function useUnifiedKinetics(): UseUnifiedKineticsResult {
  const mouse = useMicroKinetics();
  const touch = useTouchKinetics();
  const isTouch = touch.isTouchDevice;
  // Route option interaction to the correct hook
  const recordOptionInteraction = useCallback(
    (optionLabel: string) => {
      if (isTouch) {
        touch.recordOptionTap(optionLabel);
      } else {
        mouse.recordHoverEnter(optionLabel);
      }
    },
    [isTouch, touch, mouse]
  );

  const recordSelection = useCallback(() => {
    if (isTouch) {
      touch.recordSelection();
    } else {
      mouse.recordSelection();
    }
  }, [isTouch, touch, mouse]);

  const registerScrollContainer = useCallback(
    (element: HTMLElement | null) => {
      if (isTouch) {
        touch.registerScrollContainer(element);
      } else {
        mouse.registerScrollContainer(element);
      }
    },
    [isTouch, touch, mouse]
  );
  // Mouse tracking container only applies to desktop
  const registerMouseTrackingContainer = useCallback(
    (element: HTMLElement | null) => {
      if (!isTouch) {
        mouse.registerMouseTrackingContainer(element);
      }
    },
    [isTouch, mouse]
  );

  const onAnswersRevealed = useCallback(() => {
    if (isTouch) {
      touch.onAnswersRevealed();
    } else {
      mouse.onAnswersRevealed();
    }
  }, [isTouch, touch, mouse]);

  const getMetrics = useCallback((): MicroKineticsMetrics => {
    return isTouch ? touch.getMetrics() : mouse.getMetrics();
  }, [isTouch, touch, mouse]);

  const reset = useCallback(() => {
    // Reset both to be safe (the inactive one is cheap)
    mouse.reset();
    touch.reset();
  }, [mouse, touch]);

  const metrics = isTouch ? touch.metrics : mouse.metrics;

  return {
    recordOptionInteraction,
    recordSelection,
    registerScrollContainer,
    registerMouseTrackingContainer,
    onAnswersRevealed,
    getMetrics,
    reset,
    metrics,
    isTouchDevice: isTouch,
    inputMethod: isTouch ? 'touch' : 'mouse',
  };
}

export type { MicroKineticsMetrics } from './useMicroKinetics';
