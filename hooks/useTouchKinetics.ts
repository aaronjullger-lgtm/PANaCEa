/**
 * Touch Kinetics Telemetry Hook
 *
 * Mobile-equivalent of useMicroKinetics. Provides behavioral confidence
 * signals from touch interactions that feed the Ghost Grader pipeline.
 *
 * Touch signals mapped to desktop equivalents:
 * - Tap oscillations: rapid option-switching (A→B→A taps) → oscillations
 * - Scroll regressions: scroll-back events on vignette → vignetteRegressions
 * - Selection drift: time from last tap to submit → selectionDriftMs (shared)
 * - Touch confidence score: composite of pressure + jitter → tremorScore equivalent
 * - Tap spread: distance between successive taps → cursorEntropy equivalent
 *
 * All signals normalize to the same [0-1] or count ranges as useMicroKinetics
 * so the Ghost Grader thresholds work identically for both input methods.
 *
 * @see hooks/useMicroKinetics.ts — Desktop counterpart
 * @see lib/srs/ghostGrader.ts — Consumes these signals
 */

import { useCallback, useRef, useState } from 'react';
import type { MicroKineticsMetrics } from './useMicroKinetics';

export interface UseTouchKineticsResult {
  /** Record when user taps an answer option */
  recordOptionTap: (optionLabel: string) => void;
  /** Record when user selects (confirms) an answer */
  recordSelection: () => void;
  /** Register scroll container for vignette regression tracking */
  registerScrollContainer: (element: HTMLElement | null) => void;
  /** Called when answers are revealed */
  onAnswersRevealed: () => void;
  /** Get current metrics (same shape as MicroKineticsMetrics) */
  getMetrics: () => MicroKineticsMetrics;
  /** Reset for next question */
  reset: () => void;
  /** Whether this hook is active (touch device detected) */
  isTouchDevice: boolean;
  /** Current metrics (reactive) */
  metrics: MicroKineticsMetrics;
}

const INITIAL_METRICS: MicroKineticsMetrics = {
  oscillations: 0,
  vignetteRegressions: 0,
  selectionDriftMs: null,
  tremorScore: 0,
  cursorEntropy: 0,
};

/** Detect touch oscillations: tapping back to a previously selected option */
function countTapOscillations(sequence: string[]): number {
  if (sequence.length < 2) return 0;
  let count = 0;
  const seen = new Set<string>();
  for (let i = 0; i < sequence.length; i++) {
    const label = sequence[i]!;
    const prev = i > 0 ? sequence[i - 1]! : null;
    if (seen.has(label) && prev !== label) count++;
    seen.add(label);
  }
  return count;
}

/**
 * Compute touch confidence score from tap timing and pressure.
 * Replaces mouse tremor score for touch devices.
 *
 * Factors:
 * - Rapid re-taps (< 500ms between option changes) indicate indecision
 * - Average touch pressure (where available) below 0.3 suggests hesitancy
 * - High tap spread (distance between successive taps) suggests scanning/confusion
 *
 * Returns 0-1 where higher = more signs of cognitive load (matches tremorScore semantics)
 */
function computeTouchConfidenceScore(
  tapTimestamps: number[],
  tapPressures: number[],
  tapPositions: Array<{ x: number; y: number }>
): number {
  let score = 0;

  // Rapid re-tap factor: fraction of inter-tap intervals < 500ms
  if (tapTimestamps.length >= 2) {
    let rapidCount = 0;
    for (let i = 1; i < tapTimestamps.length; i++) {
      if (tapTimestamps[i]! - tapTimestamps[i - 1]! < 500) rapidCount++;
    }
    const rapidFraction = rapidCount / (tapTimestamps.length - 1);
    score += rapidFraction * 0.4; // Weight: 40%
  }

  // Pressure factor (when available): low pressure = hesitant
  const validPressures = tapPressures.filter(p => p > 0 && p <= 1);
  if (validPressures.length > 0) {
    const avgPressure = validPressures.reduce((a, b) => a + b, 0) / validPressures.length;
    // Low pressure (< 0.3) adds to score; high pressure (> 0.7) subtracts
    const pressureFactor = Math.max(0, 0.5 - avgPressure) * 2;
    score += pressureFactor * 0.3; // Weight: 30%
  }

  // Tap spread factor: normalized distance between successive taps
  if (tapPositions.length >= 2) {
    let totalDist = 0;
    for (let i = 1; i < tapPositions.length; i++) {
      totalDist += Math.hypot(
        tapPositions[i]!.x - tapPositions[i - 1]!.x,
        tapPositions[i]!.y - tapPositions[i - 1]!.y
      );
    }
    const avgDist = totalDist / (tapPositions.length - 1);
    // Normalize: > 200px average distance suggests scanning around
    const spreadFactor = Math.min(1, avgDist / 300);
    score += spreadFactor * 0.3; // Weight: 30%
  }

  return Math.min(1, Math.max(0, score));
}

/**
 * Compute tap entropy: total tap distance / direct distance.
 * Equivalent to cursor entropy for touch devices.
 */
function computeTapEntropy(positions: Array<{ x: number; y: number }>): number {
  if (positions.length < 2) return 0;
  const first = positions[0]!;
  const last = positions[positions.length - 1]!;
  const idealDist = Math.hypot(last.x - first.x, last.y - first.y) || 1;
  let pathDist = 0;
  for (let i = 1; i < positions.length; i++) {
    pathDist += Math.hypot(
      positions[i]!.x - positions[i - 1]!.x,
      positions[i]!.y - positions[i - 1]!.y
    );
  }
  return pathDist / idealDist;
}

export function useTouchKinetics(): UseTouchKineticsResult {
  const tapSequenceRef = useRef<string[]>([]);
  const tapTimestampsRef = useRef<number[]>([]);
  const tapPressuresRef = useRef<number[]>([]);
  const tapPositionsRef = useRef<Array<{ x: number; y: number }>>([]);
  const selectionTimeRef = useRef<number | null>(null);
  const scrollContainerRef = useRef<HTMLElement | null>(null);
  const lastScrollTopRef = useRef<number>(0);
  const scrollRegressionsRef = useRef<number>(0);
  const answersRevealedRef = useRef(false);
  const isTouchRef = useRef(
    typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0)
  );

  const [metrics, setMetrics] = useState<MicroKineticsMetrics>(INITIAL_METRICS);

  const recordOptionTap = useCallback((optionLabel: string) => {
    tapSequenceRef.current.push(optionLabel);
    tapTimestampsRef.current.push(Date.now());

    // Try to capture touch pressure and position from the last touch event
    // These are captured via passive listeners on the document
    const lastTouch = (window as any).__lastTouchEvent as Touch | undefined;
    if (lastTouch) {
      tapPressuresRef.current.push(lastTouch.force ?? 0);
      tapPositionsRef.current.push({ x: lastTouch.clientX, y: lastTouch.clientY });
    } else {
      tapPressuresRef.current.push(0);
      // Fallback: no position data
    }
  }, []);

  const recordSelection = useCallback(() => {
    selectionTimeRef.current = Date.now();
  }, []);

  const registerScrollContainer = useCallback((element: HTMLElement | null) => {
    // Clean up previous listener
    const prev = scrollContainerRef.current;
    if (prev) {
      prev.removeEventListener('scroll', handleScroll);
    }

    scrollContainerRef.current = element;
    if (element) {
      lastScrollTopRef.current = element.scrollTop;
      element.addEventListener('scroll', handleScroll, { passive: true });
    }
  }, []);

  const handleScroll = useCallback(() => {
    if (!answersRevealedRef.current || !scrollContainerRef.current) return;
    const currentTop = scrollContainerRef.current.scrollTop;
    // Scrolling up after answer reveal = regression (re-reading vignette)
    if (currentTop < lastScrollTopRef.current - 20) {
      scrollRegressionsRef.current++;
    }
    lastScrollTopRef.current = currentTop;
  }, []);

  const onAnswersRevealed = useCallback(() => {
    answersRevealedRef.current = true;
    if (scrollContainerRef.current) {
      lastScrollTopRef.current = scrollContainerRef.current.scrollTop;
    }
  }, []);

  const getMetrics = useCallback((): MicroKineticsMetrics => {
    const oscillations = countTapOscillations(tapSequenceRef.current);
    const vignetteRegressions = scrollRegressionsRef.current;

    const selectionDriftMs = selectionTimeRef.current
      ? Date.now() - selectionTimeRef.current
      : null;

    const tremorScore = computeTouchConfidenceScore(
      tapTimestampsRef.current,
      tapPressuresRef.current,
      tapPositionsRef.current
    );

    const cursorEntropy = computeTapEntropy(tapPositionsRef.current);

    const result: MicroKineticsMetrics = {
      oscillations,
      vignetteRegressions,
      selectionDriftMs,
      tremorScore,
      cursorEntropy,
    };

    setMetrics(result);
    return result;
  }, []);

  const reset = useCallback(() => {
    tapSequenceRef.current = [];
    tapTimestampsRef.current = [];
    tapPressuresRef.current = [];
    tapPositionsRef.current = [];
    selectionTimeRef.current = null;
    scrollRegressionsRef.current = 0;
    answersRevealedRef.current = false;
    lastScrollTopRef.current = scrollContainerRef.current?.scrollTop ?? 0;
    setMetrics(INITIAL_METRICS);
  }, []);

  return {
    recordOptionTap,
    recordSelection,
    registerScrollContainer,
    onAnswersRevealed,
    getMetrics,
    reset,
    isTouchDevice: isTouchRef.current,
    metrics,
  };
}

// ── Global touch event capture ──
// Passive listener to capture the last touch event for pressure/position data.
// This runs once on module load in the browser.
if (typeof window !== 'undefined') {
  window.addEventListener(
    'touchstart',
    (e: TouchEvent) => {
      if (e.touches.length > 0) {
        (window as any).__lastTouchEvent = e.touches[0];
      }
    },
    { passive: true }
  );
}
