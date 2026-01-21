/**
 * @fileoverview React Hook for Response Telemetry Collection
 * @description Wraps createTelemetryCollector() for use in drill components
 * @version 1.0.0
 * 
 * Phase 3 Milestone 3: Telemetry Injection
 * 
 * This hook provides React state management for behavioral telemetry collection
 * during question-answering sessions. It tracks:
 * 
 * 1. Response duration (MVRT detection)
 * 2. Time to first interaction
 * 3. Answer changes
 * 4. Hint viewing behavior
 * 
 * Usage:
 * ```tsx
 * const { 
 *   startQuestion, 
 *   recordInteraction, 
 *   finalizeTelemetry,
 *   isRapidGuess,
 *   elapsedMs 
 * } = useTelemetryCollector();
 * 
 * // When question loads
 * useEffect(() => {
 *   startQuestion('vignette');
 * }, [questionId]);
 * 
 * // On answer selection
 * const handleSelect = (optionId: string) => {
 *   recordInteraction('option_select', optionId);
 *   setSelectedAnswer(optionId);
 * };
 * 
 * // On submit
 * const handleSubmit = () => {
 *   const telemetry = finalizeTelemetry(sessionId);
 *   submitAnswer({ answer, telemetry });
 * };
 * ```
 */

import { useRef, useCallback, useState, useEffect } from 'react';
import {
  createTelemetryCollector,
  type QuestionType,
  type TelemetryData,
  type InteractionEvent,
} from '../types/telemetry';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Return type for useTelemetryCollector hook
 */
export interface TelemetryCollectorReturn {
  /**
   * Start telemetry collection for a new question
   * Call this when a new question is displayed
   */
  startQuestion: (questionType?: QuestionType) => void;

  /**
   * Record a user interaction event
   * Call this on clicks, hovers, option selections, etc.
   */
  recordInteraction: (type: InteractionEvent['type'], target?: string) => void;

  /**
   * Record hint panel being opened
   */
  recordHintOpen: () => void;

  /**
   * Record hint panel being closed
   */
  recordHintClose: () => void;

  /**
   * Finalize and return telemetry data for submission
   * Call this when the user submits their answer
   */
  finalizeTelemetry: (sessionId?: string) => TelemetryData | null;

  /**
   * Reset the collector (useful for question transitions)
   */
  reset: () => void;

  /**
   * Whether current response time would be flagged as rapid guess
   */
  isRapidGuess: boolean;

  /**
   * Current elapsed time in milliseconds
   */
  elapsedMs: number;

  /**
   * Whether collection is currently active
   */
  isActive: boolean;

  /**
   * Current question type being tracked
   */
  currentQuestionType: QuestionType | null;
}

/**
 * Options for the telemetry collector hook
 */
export interface UseTelemetryCollectorOptions {
  /**
   * Default question type if not specified in startQuestion()
   */
  defaultQuestionType?: QuestionType;

  /**
   * Interval for updating elapsed time state (ms)
   * Set to 0 to disable real-time updates
   * @default 100
   */
  updateInterval?: number;

  /**
   * Whether to automatically record scroll interactions
   * @default false
   */
  trackScrolling?: boolean;

  /**
   * Whether to record detailed interaction timeline
   * Set to false in production to reduce payload size
   * @default true
   */
  recordInteractions?: boolean;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

/**
 * React hook for collecting behavioral telemetry during question sessions
 * 
 * @param options - Configuration options
 * @returns Telemetry collector methods and state
 */
export function useTelemetryCollector(
  options: UseTelemetryCollectorOptions = {}
): TelemetryCollectorReturn {
  const {
    defaultQuestionType = 'unknown',
    updateInterval = 100,
    trackScrolling = false,
    recordInteractions = true,
  } = options;

  // Collector instance ref (persists across renders)
  const collectorRef = useRef<ReturnType<typeof createTelemetryCollector> | null>(null);

  // State for reactive UI updates
  const [isActive, setIsActive] = useState(false);
  const [isRapidGuess, setIsRapidGuess] = useState(true);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [currentQuestionType, setCurrentQuestionType] = useState<QuestionType | null>(null);

  // Interval ref for cleanup
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /**
   * Start collecting telemetry for a new question
   */
  const startQuestion = useCallback((questionType: QuestionType = defaultQuestionType) => {
    // Clean up any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Create new collector
    collectorRef.current = createTelemetryCollector(questionType);
    setIsActive(true);
    setCurrentQuestionType(questionType);
    setElapsedMs(0);
    setIsRapidGuess(true);

    // Start update interval if enabled
    if (updateInterval > 0) {
      intervalRef.current = setInterval(() => {
        if (collectorRef.current) {
          const elapsed = collectorRef.current.getElapsedMs();
          setElapsedMs(elapsed);
          setIsRapidGuess(collectorRef.current.wouldBeRapidGuess());
        }
      }, updateInterval);
    }
  }, [defaultQuestionType, updateInterval]);

  /**
   * Record a user interaction
   */
  const recordInteraction = useCallback((
    type: InteractionEvent['type'],
    target?: string
  ) => {
    if (!collectorRef.current || !recordInteractions) return;
    collectorRef.current.recordInteraction(type, target);
  }, [recordInteractions]);

  /**
   * Record hint panel being opened
   */
  const recordHintOpen = useCallback(() => {
    if (!collectorRef.current) return;
    collectorRef.current.recordInteraction('hint_view');
  }, []);

  /**
   * Record hint panel being closed
   */
  const recordHintClose = useCallback(() => {
    if (!collectorRef.current) return;
    collectorRef.current.recordHintClose();
  }, []);

  /**
   * Finalize telemetry and return data
   */
  const finalizeTelemetry = useCallback((sessionId?: string): TelemetryData | null => {
    if (!collectorRef.current) return null;

    // Stop update interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    const telemetry = collectorRef.current.finalize(sessionId);
    setIsActive(false);
    
    // Update final state
    setElapsedMs(telemetry.duration_ms);
    setIsRapidGuess(telemetry.rapid_guess);

    return telemetry;
  }, []);

  /**
   * Reset the collector
   */
  const reset = useCallback(() => {
    // Clean up interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    collectorRef.current = null;
    setIsActive(false);
    setIsRapidGuess(true);
    setElapsedMs(0);
    setCurrentQuestionType(null);
  }, []);

  // Set up scroll tracking if enabled
  useEffect(() => {
    if (!trackScrolling || !isActive) return;

    const handleScroll = () => {
      recordInteraction('scroll');
    };

    // Throttle scroll events
    let lastScroll = 0;
    const throttledScroll = () => {
      const now = Date.now();
      if (now - lastScroll > 200) {
        lastScroll = now;
        handleScroll();
      }
    };

    window.addEventListener('scroll', throttledScroll, { passive: true });
    return () => window.removeEventListener('scroll', throttledScroll);
  }, [trackScrolling, isActive, recordInteraction]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    startQuestion,
    recordInteraction,
    recordHintOpen,
    recordHintClose,
    finalizeTelemetry,
    reset,
    isRapidGuess,
    elapsedMs,
    isActive,
    currentQuestionType,
  };
}

// ============================================================================
// UTILITY HOOKS
// ============================================================================

/**
 * Hook to automatically start telemetry when a question ID changes
 * 
 * Usage:
 * ```tsx
 * const telemetry = useAutoTelemetry(questionId, getQuestionType(question));
 * ```
 */
export function useAutoTelemetry(
  questionId: string | undefined,
  questionType: QuestionType = 'unknown',
  options?: UseTelemetryCollectorOptions
): TelemetryCollectorReturn {
  const collector = useTelemetryCollector(options);

  useEffect(() => {
    if (questionId) {
      collector.startQuestion(questionType);
    }
    
    return () => {
      collector.reset();
    };
  }, [questionId]); // eslint-disable-line react-hooks/exhaustive-deps

  return collector;
}

/**
 * Determine question type from question metadata
 * 
 * @param question - Question object with optional metadata
 * @returns Appropriate question type for MVRT calculation
 */
export function inferQuestionType(question: {
  type?: string;
  stem?: string;
  hasImage?: boolean;
  mediaAssets?: unknown[];
}): QuestionType {
  // Check for image-based questions
  if (question.hasImage || (question.mediaAssets && question.mediaAssets.length > 0)) {
    return 'image';
  }

  // Check question type field
  if (question.type) {
    const typeLower = question.type.toLowerCase();
    if (typeLower.includes('rapid') || typeLower.includes('recall')) {
      return 'rapid_recall';
    }
    if (typeLower.includes('vignette') || typeLower.includes('clinical')) {
      return 'vignette';
    }
  }

  // Infer from stem length (vignettes tend to be longer)
  if (question.stem) {
    const wordCount = question.stem.split(/\s+/).length;
    if (wordCount > 50) {
      return 'vignette';
    }
    if (wordCount < 15) {
      return 'recall';
    }
  }

  return 'unknown';
}

export default useTelemetryCollector;