/**
 * Micro-Kinetics Telemetry Hook
 *
 * Tracks implicit confidence signals for the Ghost Grader:
 * 1. Hover Oscillation: A→B→A style revisits to answer choices (indecision)
 * 2. Vignette Regression: Scroll direction changes after answers revealed
 * 3. Selection Drift: Time between selecting an answer and clicking Submit (>3s = low confidence)
 * 4. Mouse Tremor: Erratic, non-linear movement correlating with high cognitive load
 *
 * Research basis: Freeman & Ambady (2010) MouseTracker, Kieslich & Henninger (2017) mousetrap
 *
 * @see lib/srs/ghostGrader.ts - Uses these signals to force Hard rating for honest history
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export interface MicroKineticsMetrics {
  /** Count of hover oscillations (A→B→A revisits) indicating indecision */
  oscillations: number;
  /** Count of scroll direction reversals after answer reveal (vignette re-reading) */
  vignetteRegressions: number;
  /** Time from last answer selection to submit (ms). High drift = verification anxiety. */
  selectionDriftMs: number | null;
  /** Mouse tremor score 0-1. High = erratic movement, cognitive load. */
  tremorScore: number;
  /** Cursor entropy: pathLength/idealDistance. >1 = meandering, confusion. */
  cursorEntropy: number;
}

export interface UseMicroKineticsResult {
  /** Call when user hovers over an answer option (A, B, C, D) */
  recordHoverEnter: (optionLabel: string) => void;
  /** Call when user selects an answer (clicks an option, before Submit) */
  recordSelection: () => void;
  /** Call to register the scroll container ref (question content area) */
  registerScrollContainer: (element: HTMLElement | null) => void;
  /** Call to register container for mouse tremor tracking (question + options area) */
  registerMouseTrackingContainer: (element: HTMLElement | null) => void;
  /** Call when answers are revealed (start tracking regression) */
  onAnswersRevealed: () => void;
  /** Get current metrics snapshot */
  getMetrics: () => MicroKineticsMetrics;
  /** Reset state for next question */
  reset: () => void;
  /** Current metrics (reactive) */
  metrics: MicroKineticsMetrics;
}

/** Detect oscillation: returning to a previously visited option (A→B→A = revisit) */
function countOscillations(sequence: string[]): number {
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

interface Point {
  x: number;
  y: number;
  t: number;
}

/** Compute cursor entropy: pathLength / idealDistance. >1 = meandering path. */
function computeCursorEntropy(points: Point[]): number {
  if (points.length < 2) return 0;
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const idealDistance = Math.hypot(last.x - first.x, last.y - first.y) || 1;
  let pathLength = 0;
  for (let i = 1; i < points.length; i++) {
    pathLength += Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y);
  }
  return pathLength / idealDistance;
}

/** Compute tremor score from sampled mouse path. High = erratic/non-linear. */
function computeTremorScore(points: Point[]): number {
  if (points.length < 5) return 0;
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const straightLine = Math.hypot(last.x - first.x, last.y - first.y) || 1;
  let pathLength = 0;
  let reversals = 0;
  let prevDx = 0;
  let prevDy = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i]!.x - points[i - 1]!.x;
    const dy = points[i]!.y - points[i - 1]!.y;
    const segLen = Math.hypot(dx, dy);
    pathLength += segLen;
    if (i > 1 && dx * prevDx + dy * prevDy < 0) reversals++;
    prevDx = dx;
    prevDy = dy;
  }
  const efficiency = straightLine / pathLength;
  const reversalDensity = reversals / Math.max(1, pathLength / 50);
  return Math.min(1, (1 - efficiency) * 0.6 + Math.min(1, reversalDensity) * 0.4);
}

const MOUSE_SAMPLE_INTERVAL_MS = 80;
const MAX_POINTS = 100;

export function useMicroKinetics(): UseMicroKineticsResult {
  const hoverSequenceRef = useRef<string[]>([]);
  const selectionTimestampRef = useRef<number | null>(null);
  const mousePointsRef = useRef<Point[]>([]);
  const lastMouseSampleRef = useRef<number>(0);
  const [metrics, setMetrics] = useState<MicroKineticsMetrics>({
    oscillations: 0,
    vignetteRegressions: 0,
    selectionDriftMs: null,
    tremorScore: 0,
    cursorEntropy: 0,
  });

  const [answersRevealed, setAnswersRevealed] = useState(false);
  const scrollContainerRef = useRef<HTMLElement | null>(null);
  const mouseContainerRef = useRef<HTMLElement | null>(null);
  const lastScrollTopRef = useRef<number>(0);
  const lastDirectionRef = useRef<'up' | 'down' | null>(null);
  const regressionCountRef = useRef(0);

  const recordHoverEnter = useCallback((optionLabel: string) => {
    hoverSequenceRef.current.push(optionLabel);
    const oscillations = countOscillations(hoverSequenceRef.current);
    setMetrics((prev) => ({ ...prev, oscillations }));
  }, []);

  /** Record answer selection (or change). Commitment gap = time from last selection to submit. */
  const recordSelection = useCallback(() => {
    selectionTimestampRef.current = Date.now();
  }, []);

  const onAnswersRevealed = useCallback(() => {
    setAnswersRevealed(true);
    if (scrollContainerRef.current) {
      lastScrollTopRef.current = scrollContainerRef.current.scrollTop;
    }
  }, []);

  const [scrollContainerReady, setScrollContainerReady] = useState(false);
  const registerScrollContainer = useCallback((element: HTMLElement | null) => {
    scrollContainerRef.current = element;
    setScrollContainerReady(!!element);
    if (element) {
      lastScrollTopRef.current = element.scrollTop;
    }
  }, []);

  const [mouseContainerReady, setMouseContainerReady] = useState(false);
  const registerMouseTrackingContainer = useCallback((element: HTMLElement | null) => {
    mouseContainerRef.current = element;
    setMouseContainerReady(!!element);
  }, []);

  useEffect(() => {
    const el = mouseContainerRef.current;
    if (!el || !mouseContainerReady) return;
    const handleMove = (e: MouseEvent) => {
      const now = Date.now();
      if (now - lastMouseSampleRef.current < MOUSE_SAMPLE_INTERVAL_MS) return;
      lastMouseSampleRef.current = now;
      const rect = el.getBoundingClientRect();
      mousePointsRef.current.push({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        t: now,
      });
      if (mousePointsRef.current.length > MAX_POINTS) {
        mousePointsRef.current.shift();
      }
    };
    el.addEventListener('mousemove', handleMove, { passive: true });
    return () => el.removeEventListener('mousemove', handleMove);
  }, [mouseContainerReady]);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el || !answersRevealed || !scrollContainerReady) return;

    const handleScroll = () => {
      const currentTop = el.scrollTop;
      const prevTop = lastScrollTopRef.current;
      if (currentTop === prevTop) return;

      const direction: 'up' | 'down' = currentTop < prevTop ? 'up' : 'down';
      if (lastDirectionRef.current !== null && lastDirectionRef.current !== direction) {
        regressionCountRef.current += 1;
        setMetrics((prev) => ({ ...prev, vignetteRegressions: regressionCountRef.current }));
      }
      lastDirectionRef.current = direction;
      lastScrollTopRef.current = currentTop;
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [scrollContainerReady, answersRevealed]);

  const getMetrics = useCallback((): MicroKineticsMetrics => {
    const oscillations = countOscillations(hoverSequenceRef.current);
    const selectionDriftMs =
      selectionTimestampRef.current !== null ? Date.now() - selectionTimestampRef.current : null;
    const tremorScore = computeTremorScore(mousePointsRef.current);
    const cursorEntropy = computeCursorEntropy(mousePointsRef.current);
    return {
      oscillations,
      vignetteRegressions: regressionCountRef.current,
      selectionDriftMs,
      tremorScore,
      cursorEntropy,
    };
  }, []);

  const reset = useCallback(() => {
    hoverSequenceRef.current = [];
    selectionTimestampRef.current = null;
    mousePointsRef.current = [];
    lastMouseSampleRef.current = 0;
    setAnswersRevealed(false);
    setScrollContainerReady(false);
    setMouseContainerReady(false);
    scrollContainerRef.current = null;
    mouseContainerRef.current = null;
    lastScrollTopRef.current = 0;
    lastDirectionRef.current = null;
    regressionCountRef.current = 0;
    setMetrics({
      oscillations: 0,
      vignetteRegressions: 0,
      selectionDriftMs: null,
      tremorScore: 0,
      cursorEntropy: 0,
    });
  }, []);

  return {
    recordHoverEnter,
    recordSelection,
    registerScrollContainer,
    registerMouseTrackingContainer,
    onAnswersRevealed,
    getMetrics,
    reset,
    metrics,
  };
}
