/**
 * CRPL (Cognitive Rhythm Perception Layer) Telemetry Hook
 * Phase 4: Neuro-Symbolic Integrity
 *
 * Captures behavioral metrics during question-answering sessions:
 * - Pause Analysis: Track interaction gaps and classify cognitive states
 * - Hesitation Mapping: Record hover time per answer option
 * - MVRT Detection: Flag responses under minimum valid response time
 *
 * @version 2.1.0
 */

import { useState, useCallback, useRef } from 'react';

export interface CRPLTelemetryOptions {
  questionDisplayTime: number; // performance.now() timestamp when question first displayed
  mvrtThresholdMs?: number; // Minimum Valid Response Time (default: 500ms)
  correctAnswerId?: string; // For hesitation flag detection
}

export interface CRPLTelemetry {
  duration_ms: number;
  time_to_first_interaction_ms: number | null;
  rapid_guess: boolean; // MVRT flag
  short_pauses: number; // 2-5s gaps
  medium_pauses: number; // 5-15s gaps
  long_pauses: number; // >15s gaps
  hover_map: Record<string, number>; // answerId → total_hover_ms
  hesitation_flag: boolean; // >2000ms hover on wrong answer
  mouse_efficiency_index: number; // optimal_distance / actual_distance
  hover_entropy: number; // Shannon entropy of hover time distribution
  total_mouse_distance: number; // pixels traveled
  answer_changes: number; // number of times user changed selection
}

interface InteractionEvent {
  timestamp: number;
  type: 'click' | 'hover' | 'focus' | 'mousemove';
  targetId: string;
  x?: number; // mouse coordinates
  y?: number;
}

export interface CRPLTelemetryHook {
  recordInteraction: (
    type: 'click' | 'hover' | 'focus',
    targetId: string,
    x?: number,
    y?: number
  ) => void;
  recordHover: (answerId: string, durationMs: number) => void;
  recordMouseMove: (x: number, y: number) => void;
  recordAnswerChange: () => void;
  finalize: () => CRPLTelemetry;
  reset: () => void;
}

/**
 * Custom hook for capturing CRPL telemetry during question responses
 *
 * @example
 * ```tsx
 * const telemetry = useResponseTelemetry({
 *   questionDisplayTime: performance.now(),
 *   mvrtThresholdMs: 500,
 *   correctAnswerId: 'answer-123',
 * });
 *
 * // Record interaction events
 * telemetry.recordInteraction('click', 'answer-option-1');
 * telemetry.recordHover('answer-option-2', 1500);
 *
 * // Finalize and retrieve telemetry data
 * const result = telemetry.finalize();
 * ```
 */
export function useResponseTelemetry(options: CRPLTelemetryOptions): CRPLTelemetryHook {
  const { questionDisplayTime, mvrtThresholdMs = 500, correctAnswerId } = options;

  const interactions = useRef<InteractionEvent[]>([]);
  const hoverMap = useRef<Record<string, number>>({});
  const firstInteractionTime = useRef<number | null>(null);
  const mousePositions = useRef<Array<{ x: number; y: number; timestamp: number }>>([]);
  const answerChanges = useRef<number>(0);
  const firstClickPosition = useRef<{ x: number; y: number } | null>(null);

  /**
   * Record a generic interaction event (click, hover, focus)
   */
  const recordInteraction = useCallback(
    (type: 'click' | 'hover' | 'focus', targetId: string, x?: number, y?: number) => {
      const timestamp = performance.now();

      interactions.current.push({
        timestamp,
        type,
        targetId,
        x,
        y,
      });

      // Track first interaction time
      if (firstInteractionTime.current === null) {
        firstInteractionTime.current = timestamp;
      }

      // Track first click position for efficiency calculation
      if (
        type === 'click' &&
        x !== undefined &&
        y !== undefined &&
        firstClickPosition.current === null
      ) {
        firstClickPosition.current = { x, y };
      }
    },
    []
  );

  /**
   * Record hover time for a specific answer option
   */
  const recordHover = useCallback((answerId: string, durationMs: number) => {
    hoverMap.current[answerId] = (hoverMap.current[answerId] || 0) + durationMs;
  }, []);

  /**
   * Record mouse movement for efficiency calculation
   */
  const recordMouseMove = useCallback((x: number, y: number) => {
    const timestamp = performance.now();
    mousePositions.current.push({ x, y, timestamp });

    // Trim to last 100 positions to prevent memory issues
    if (mousePositions.current.length > 100) {
      mousePositions.current.shift();
    }
  }, []);

  /**
   * Record when user changes their answer selection
   */
  const recordAnswerChange = useCallback(() => {
    answerChanges.current++;
  }, []);

  /**
   * Analyze pause patterns between interactions
   * Classifies gaps into: short (2-5s), medium (5-15s), long (>15s)
   */
  const analyzePauses = useCallback((): {
    short: number;
    medium: number;
    long: number;
  } => {
    let shortPauses = 0;
    let mediumPauses = 0;
    let longPauses = 0;

    for (let i = 1; i < interactions.current.length; i++) {
      const current = interactions.current[i];
      const previous = interactions.current[i - 1];
      if (!current || !previous) continue;

      const gap = current.timestamp - previous.timestamp;

      if (gap >= 15000) {
        longPauses++;
      } else if (gap >= 5000) {
        mediumPauses++;
      } else if (gap >= 2000) {
        shortPauses++;
      }
    }

    return { short: shortPauses, medium: mediumPauses, long: longPauses };
  }, []);

  /**
   * Calculate mouse movement efficiency
   * Returns ratio of optimal distance to actual distance traveled
   */
  const calculateMouseEfficiency = useCallback((): {
    efficiency: number;
    totalDistance: number;
  } => {
    if (mousePositions.current.length < 2 || !firstClickPosition.current) {
      return { efficiency: 1.0, totalDistance: 0 };
    }

    // Calculate total distance traveled
    let totalDistance = 0;
    for (let i = 1; i < mousePositions.current.length; i++) {
      const prev = mousePositions.current[i - 1];
      const curr = mousePositions.current[i];
      if (!prev || !curr) continue;

      const dx = curr.x - prev.x;
      const dy = curr.y - prev.y;
      totalDistance += Math.sqrt(dx * dx + dy * dy);
    }

    // Calculate optimal distance (straight line from start to first click)
    const start = mousePositions.current[0];
    if (!start) {
      return { efficiency: 1.0, totalDistance };
    }

    const end = firstClickPosition.current;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const optimalDistance = Math.sqrt(dx * dx + dy * dy);

    // Efficiency = optimal / actual (capped at 1.0)
    const efficiency = optimalDistance > 0 ? Math.min(1.0, optimalDistance / totalDistance) : 1.0;

    return { efficiency, totalDistance };
  }, []);

  /**
   * Calculate hover entropy (measure of focus vs. indecision)
   * High entropy = distributed attention, low entropy = focused on one option
   */
  const calculateHoverEntropy = useCallback((): number => {
    const hoverTimes = Object.values(hoverMap.current);
    if (hoverTimes.length === 0) return 0;

    const totalTime = hoverTimes.reduce((sum, time) => sum + time, 0);
    if (totalTime === 0) return 0;

    // Shannon entropy: -Σ(p * log2(p))
    let entropy = 0;
    for (const time of hoverTimes) {
      const p = time / totalTime;
      if (p > 0) {
        entropy -= p * Math.log2(p);
      }
    }

    return entropy;
  }, []);

  /**
   * Detect hesitation: >2000ms hover on a wrong answer
   */
  const detectHesitation = useCallback((): boolean => {
    if (!correctAnswerId) return false;

    return Object.entries(hoverMap.current).some(([answerId, hoverTime]) => {
      return answerId !== correctAnswerId && hoverTime > 2000;
    });
  }, [correctAnswerId]);

  /**
   * Finalize telemetry collection and return structured data
   */
  const finalize = useCallback((): CRPLTelemetry => {
    const endTime = performance.now();
    const duration = endTime - questionDisplayTime;

    const timeToFirstInteraction = firstInteractionTime.current
      ? firstInteractionTime.current - questionDisplayTime
      : null;

    const rapidGuess = duration < mvrtThresholdMs;

    const pauses = analyzePauses();
    const hesitationFlag = detectHesitation();
    const mouseMetrics = calculateMouseEfficiency();
    const hoverEntropy = calculateHoverEntropy();

    return {
      duration_ms: Math.round(duration),
      time_to_first_interaction_ms: timeToFirstInteraction
        ? Math.round(timeToFirstInteraction)
        : null,
      rapid_guess: rapidGuess,
      short_pauses: pauses.short,
      medium_pauses: pauses.medium,
      long_pauses: pauses.long,
      hover_map: { ...hoverMap.current },
      hesitation_flag: hesitationFlag,
      mouse_efficiency_index: mouseMetrics.efficiency,
      hover_entropy: hoverEntropy,
      total_mouse_distance: Math.round(mouseMetrics.totalDistance),
      answer_changes: answerChanges.current,
    };
  }, [
    questionDisplayTime,
    mvrtThresholdMs,
    analyzePauses,
    detectHesitation,
    calculateMouseEfficiency,
    calculateHoverEntropy,
  ]);

  /**
   * Reset telemetry state for new question
   */
  const reset = useCallback(() => {
    interactions.current = [];
    hoverMap.current = {};
    firstInteractionTime.current = null;
    mousePositions.current = [];
    answerChanges.current = 0;
    firstClickPosition.current = null;
  }, []);

  return {
    recordInteraction,
    recordHover,
    recordMouseMove,
    recordAnswerChange,
    finalize,
    reset,
  };
}

/**
 * Calculate cognitive load index from CRPL telemetry
 *
 * Combines pause patterns and hesitation to estimate cognitive state:
 * - Low cognitive load: Few pauses, no hesitation
 * - High cognitive load: Many long pauses, hesitation present
 *
 * @param telemetry - CRPL telemetry data
 * @returns Cognitive load index (0-100, higher = more load)
 */
export function calculateCognitiveLoadIndex(telemetry: CRPLTelemetry): number {
  const totalPauses = telemetry.short_pauses + telemetry.medium_pauses + telemetry.long_pauses;

  // Weighted pause score (long pauses contribute more)
  const pauseScore =
    telemetry.short_pauses * 1 + telemetry.medium_pauses * 3 + telemetry.long_pauses * 5;

  // Hesitation adds significant cognitive load
  const hesitationScore = telemetry.hesitation_flag ? 20 : 0;

  // Rapid guess indicates low cognitive engagement (or panic)
  const rapidGuessScore = telemetry.rapid_guess ? 10 : 0;

  // Normalize to 0-100 scale
  const rawScore = pauseScore + hesitationScore + rapidGuessScore;
  return Math.min(100, Math.round(rawScore));
}

/**
 * Determine if response pattern indicates guessing behavior
 *
 * Guessing indicators:
 * - Rapid response (<500ms)
 * - No pauses or hover activity
 * - Minimal time to first interaction
 *
 * @param telemetry - CRPL telemetry data
 * @returns True if pattern suggests guessing
 */
export function isGuessingPattern(telemetry: CRPLTelemetry): boolean {
  const totalPauses = telemetry.short_pauses + telemetry.medium_pauses + telemetry.long_pauses;
  const totalHoverTime = Object.values(telemetry.hover_map).reduce((sum, time) => sum + time, 0);

  // Rapid response with minimal hover time
  if (telemetry.rapid_guess && totalHoverTime < 500) {
    return true;
  }

  // Fast response with no pauses or reflection
  if (
    telemetry.duration_ms < 3000 &&
    totalPauses === 0 &&
    (telemetry.time_to_first_interaction_ms || 0) < 1000
  ) {
    return true;
  }

  return false;
}
