/**
 * @fileoverview Behavioral Telemetry Types (CRPL Schema)
 * @description Captures response latency, interaction timing, rapid-guess detection,
 *              and CRPL (Cognitive Rhythm Perception Layer) micro-kinetics
 * @version 2.1.0
 *
 * Phase 3 Milestone 3: Telemetry Injection
 * Phase 4: Neuro-Symbolic Integrity - CRPL Integration Complete
 *
 * ============================================================================
 * STORAGE: QuestionAttempt.telemetryJson (Prisma JSONB field)
 * ============================================================================
 *
 * This module defines the TelemetryData interface that is stored as JSONB in
 * the QuestionAttempt.telemetryJson column. The companion QuestionAttempt.durationMs
 * field stores the integer duration for efficient querying.
 *
 * ============================================================================
 * .clinerules SYSTEM 2 ("THE NERVOUS SYSTEM") COMPLIANCE
 * ============================================================================
 *
 * Per .clinerules, this schema implements the following CRPL fields:
 *
 * | .clinerules Field              | Implementation                              |
 * |--------------------------------|---------------------------------------------|
 * | time_to_first_interaction_ms   | TelemetryData.time_to_first_interaction_ms  |
 * | dwell_time_ms                  | TelemetryData.duration_ms (alias)           |
 * | hesitation_index               | trajectory_metrics.hesitationIndex          |
 * | RAPID_GUESS flag               | TelemetryData.rapid_guess                   |
 * | MVRT filtering                 | MVRT_THRESHOLDS + detectRapidGuess()        |
 *
 * Anti-Gaming Protocol:
 * - MVRT (Minimum Valid Response Time): If dwell_time < 500ms on vignettes,
 *   flag as RAPID_GUESS and exclude from FSRS optimization.
 *
 * ============================================================================
 * CRPL METRICS CAPTURED
 * ============================================================================
 *
 * 1. Response Duration (duration_ms / dwell_time_ms):
 *    Total time from question display to answer submission
 *
 * 2. Time to First Interaction (time_to_first_interaction_ms):
 *    Cognitive processing time before user starts engaging with UI
 *
 * 3. Rapid Guess Detection (rapid_guess):
 *    Flag when response time is below Minimum Valid Response Time (MVRT)
 *
 * 4. Trajectory Metrics (trajectory_metrics - from lib/micro-kinetics.ts):
 *    - hesitationIndex: Velocity drops near target (0-1) - THE hesitation_index field
 *    - mad: Maximum Absolute Deviation from ideal path
 *    - hoverEntropy: Shannon entropy of time distribution across options
 *    - distractorHovers: Time spent hovering over wrong options
 *    - jitterScore: Micro-corrections during final approach
 *    - confidenceScore: Composite confidence derived from all metrics
 *
 * 5. Typing Metrics (typing_metrics - from lib/typing-rhythm.ts):
 *    - rhythm: Overall classification (fluent/deliberate/hesitant/fragmented/rushed)
 *    - cognitiveLoad: Inferred cognitive effort during typing (0-1)
 *    - fluencyScore: Measure of typing automaticity (0-1)
 *    - deletionRatio: Proportion of keystrokes that were deletions
 *
 * 6. Hesitation Count (hesitation_count):
 *    Aggregated count of significant cognitive pauses (>200ms)
 *
 * ============================================================================
 * MVRT THRESHOLDS
 * ============================================================================
 *
 * - Vignette questions (clinical scenarios): 3000ms minimum
 * - Simple recall questions: 1500ms minimum
 * - Image-based questions: 2000ms minimum
 * - Rapid recall drills: 800ms minimum
 *
 * These thresholds are based on cognitive load research and reading speed analysis.
 * A response below MVRT indicates the user likely guessed without reading the full question.
 */

// Re-export CRPL types from micro-kinetics module
import type { SerializedTrajectoryMetrics } from '../lib/micro-kinetics';
export type { SerializedTrajectoryMetrics };

// ============================================================================
// CRPL (Cognitive Rhythm Perception Layer) TYPES
// ============================================================================

/**
 * Typing rhythm classification from keystroke dynamics analysis
 * @see lib/typing-rhythm.ts for full analysis
 */
export type TypingRhythm = 'fluent' | 'deliberate' | 'hesitant' | 'fragmented' | 'rushed';

/**
 * Serialized typing analysis for API submission
 * Captures cognitive load indicators from keystroke dynamics
 *
 * Metrics explained:
 * - rhythm: Overall classification of typing pattern
 * - confidence: Confidence in rhythm classification (0-1)
 * - cpm: Characters per minute (typing speed)
 * - deletionRatio: Proportion of keystrokes that were deletions (0-1)
 * - cognitiveLoad: Inferred cognitive effort during typing (0-1, higher = more load)
 * - fluencyScore: Measure of typing automaticity (0-1, higher = more fluent)
 * - pauseCount: Number of significant pauses (>200ms)
 * - burstCoverage: Proportion of text written in fast bursts (0-1)
 */
export interface SerializedTypingAnalysis {
  /** Overall typing rhythm classification */
  rhythm: TypingRhythm;

  /** Confidence in rhythm classification (0-1) */
  confidence: number;

  /** Characters per minute */
  cpm: number;

  /** Ratio of deletions to total keystrokes (0-1) */
  deletionRatio: number;

  /** Cognitive load indicator (0-1, higher = more cognitive effort) */
  cognitiveLoad: number;

  /** Fluency score (0-1, higher = more automatic/fluent) */
  fluencyScore: number;

  /** Number of significant pauses (>200ms between keystrokes) */
  pauseCount: number;

  /** Proportion of text written in fast typing bursts (0-1) */
  burstCoverage: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Minimum Valid Response Time (MVRT) thresholds in milliseconds
 * Responses faster than these are flagged as RAPID_GUESS
 */
export const MVRT_THRESHOLDS = {
  /** Clinical vignette questions with multi-paragraph stems */
  VIGNETTE: 3000,

  /** Simple one-liner recall questions */
  RECALL: 1500,

  /** Questions with image/media to analyze */
  IMAGE: 2000,

  /** Rapid recall drills (expected to be fast) */
  RAPID_RECALL: 800,

  /** Default threshold when question type is unknown */
  DEFAULT: 2000,
} as const;

/**
 * Question type identifiers for MVRT selection
 */
export type QuestionType = 'vignette' | 'recall' | 'image' | 'rapid_recall' | 'unknown';

/**
 * Maps question types to their MVRT thresholds
 */
export function getMVRTThreshold(questionType: QuestionType): number {
  switch (questionType) {
    case 'vignette':
      return MVRT_THRESHOLDS.VIGNETTE;
    case 'recall':
      return MVRT_THRESHOLDS.RECALL;
    case 'image':
      return MVRT_THRESHOLDS.IMAGE;
    case 'rapid_recall':
      return MVRT_THRESHOLDS.RAPID_RECALL;
    default:
      return MVRT_THRESHOLDS.DEFAULT;
  }
}

// ============================================================================
// CORE TELEMETRY TYPES
// ============================================================================

/**
 * Rapid guess detection result
 */
export interface RapidGuessResult {
  /** Whether the response was flagged as a rapid guess */
  is_rapid_guess: boolean;

  /** Actual response duration in milliseconds */
  actual_duration_ms: number;

  /** MVRT threshold that was applied */
  threshold_ms: number;

  /** Question type used for threshold selection */
  question_type: QuestionType;

  /** How much faster than threshold (negative if slower) */
  delta_ms: number;
}

/**
 * Interaction event during question answering
 */
export interface InteractionEvent {
  /** Type of interaction */
  type:
    | 'click'
    | 'hover'
    | 'scroll'
    | 'keypress'
    | 'option_select'
    | 'hint_view'
    | 'explanation_expand';

  /** Timestamp relative to question display (milliseconds) */
  timestamp_ms: number;

  /** Optional target element or action identifier */
  target?: string;
}

/**
 * Core telemetry data captured for each question response
 * Stored in ReviewLog.telemetry_json as JSONB
 */
export interface TelemetryData {
  /** Total response time from question display to answer submission (ms) */
  duration_ms: number;

  /** Time until first user interaction with the question UI (ms) */
  time_to_first_interaction_ms: number | null;

  /** Whether this response was flagged as a rapid guess */
  rapid_guess: boolean;

  /** Question type used for MVRT calculation */
  question_type: QuestionType;

  /** MVRT threshold applied (ms) */
  mvrt_threshold_ms: number;

  /** Timestamp when question was displayed (ISO 8601) */
  question_displayed_at: string;

  /** Timestamp when answer was submitted (ISO 8601) */
  answer_submitted_at: string;

  /** Number of times user changed their answer before submitting */
  answer_changes: number;

  /** Whether user viewed a hint before answering */
  hint_viewed: boolean;

  /** Time spent viewing hint if applicable (ms) */
  hint_view_duration_ms: number | null;

  /** Detailed interaction timeline (optional, for debugging) */
  interactions?: InteractionEvent[];

  /** Client-side session identifier for grouping */
  session_id?: string;

  /** Device/viewport info for context */
  device_info?: DeviceInfo;

  // =========================================================================
  // CRPL (Cognitive Rhythm Perception Layer) Fields - Phase 4
  // =========================================================================

  /**
   * Mouse trajectory analysis metrics
   * @see lib/micro-kinetics.ts for SerializedTrajectoryMetrics
   */
  trajectory_metrics?: SerializedTrajectoryMetrics;

  /**
   * Keystroke dynamics analysis
   * Captures typing rhythm, cognitive load, and fluency indicators
   */
  typing_metrics?: SerializedTypingAnalysis;

  /**
   * Count of significant hesitation events during response
   * Hesitation = pause > 200ms during mouse movement or typing
   */
  hesitation_count?: number;
}

/**
 * Device and viewport information for context
 */
export interface DeviceInfo {
  /** Viewport width in pixels */
  viewport_width: number;

  /** Viewport height in pixels */
  viewport_height: number;

  /** Device pixel ratio */
  device_pixel_ratio: number;

  /** Whether touch events are available */
  is_touch_device: boolean;

  /** User agent string (truncated) */
  user_agent_short?: string;
}

// ============================================================================
// TELEMETRY COLLECTION HELPERS
// ============================================================================

/**
 * Creates a new telemetry collector for a question session
 * @returns Collector instance with methods to track interactions
 */
export function createTelemetryCollector(questionType: QuestionType = 'unknown') {
  const startTime = Date.now();
  const startIso = new Date().toISOString();
  const interactions: InteractionEvent[] = [];
  let firstInteractionTime: number | null = null;
  let answerChanges = 0;
  let hintViewed = false;
  let hintViewStart: number | null = null;
  let totalHintViewTime = 0;

  return {
    /**
     * Record a user interaction
     */
    recordInteraction(type: InteractionEvent['type'], target?: string) {
      const timestamp = Date.now() - startTime;

      if (firstInteractionTime === null) {
        firstInteractionTime = timestamp;
      }

      if (type === 'hint_view') {
        hintViewed = true;
        hintViewStart = Date.now();
      }

      if (type === 'option_select') {
        answerChanges++;
      }

      interactions.push({ type, timestamp_ms: timestamp, target });
    },

    /**
     * Record hint panel being closed
     */
    recordHintClose() {
      if (hintViewStart !== null) {
        totalHintViewTime += Date.now() - hintViewStart;
        hintViewStart = null;
      }
    },

    /**
     * Finalize telemetry data on answer submission
     */
    finalize(sessionId?: string): TelemetryData {
      const endTime = Date.now();
      const duration = endTime - startTime;
      const threshold = getMVRTThreshold(questionType);

      // Close any open hint viewing
      if (hintViewStart !== null) {
        totalHintViewTime += endTime - hintViewStart;
      }

      return {
        duration_ms: duration,
        time_to_first_interaction_ms: firstInteractionTime,
        rapid_guess: duration < threshold,
        question_type: questionType,
        mvrt_threshold_ms: threshold,
        question_displayed_at: startIso,
        answer_submitted_at: new Date().toISOString(),
        answer_changes: Math.max(0, answerChanges - 1), // First selection doesn't count as a change
        hint_viewed: hintViewed,
        hint_view_duration_ms: hintViewed ? totalHintViewTime : null,
        interactions,
        session_id: sessionId,
        device_info: typeof window !== 'undefined' ? getDeviceInfo() : undefined,
      };
    },

    /**
     * Get current elapsed time
     */
    getElapsedMs(): number {
      return Date.now() - startTime;
    },

    /**
     * Check if current duration would be flagged as rapid guess
     */
    wouldBeRapidGuess(): boolean {
      return this.getElapsedMs() < getMVRTThreshold(questionType);
    },
  };
}

/**
 * Detect rapid guess from response duration
 */
export function detectRapidGuess(
  durationMs: number,
  questionType: QuestionType = 'unknown'
): RapidGuessResult {
  const threshold = getMVRTThreshold(questionType);

  return {
    is_rapid_guess: durationMs < threshold,
    actual_duration_ms: durationMs,
    threshold_ms: threshold,
    question_type: questionType,
    delta_ms: durationMs - threshold,
  };
}

/**
 * Get device info for telemetry context
 */
function getDeviceInfo(): DeviceInfo {
  return {
    viewport_width: window.innerWidth,
    viewport_height: window.innerHeight,
    device_pixel_ratio: window.devicePixelRatio || 1,
    is_touch_device: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
    user_agent_short: navigator.userAgent.substring(0, 100),
  };
}

// ============================================================================
// AGGREGATION TYPES
// ============================================================================

/**
 * Aggregated telemetry statistics for a session or time period
 */
export interface TelemetryAggregate {
  /** Total number of responses */
  total_responses: number;

  /** Number flagged as rapid guess */
  rapid_guess_count: number;

  /** Rapid guess rate (0-1) */
  rapid_guess_rate: number;

  /** Average response time (ms) */
  avg_duration_ms: number;

  /** Median response time (ms) */
  median_duration_ms: number;

  /** 90th percentile response time (ms) */
  p90_duration_ms: number;

  /** Average time to first interaction (ms) */
  avg_time_to_first_interaction_ms: number | null;

  /** Rate of hint usage (0-1) */
  hint_usage_rate: number;

  /** Average answer changes per question */
  avg_answer_changes: number;

  /** Breakdown by question type */
  by_question_type: Record<
    QuestionType,
    {
      count: number;
      rapid_guess_rate: number;
      avg_duration_ms: number;
    }
  >;
}

/**
 * Calculate aggregate statistics from telemetry data array
 */
export function aggregateTelemetry(data: TelemetryData[]): TelemetryAggregate | null {
  if (data.length === 0) return null;

  const durations = data.map((d) => d.duration_ms).sort((a, b) => a - b);
  const rapidGuessCount = data.filter((d) => d.rapid_guess).length;
  const hintViewedCount = data.filter((d) => d.hint_viewed).length;
  const firstInteractions = data
    .map((d) => d.time_to_first_interaction_ms)
    .filter((t): t is number => t !== null);

  // Group by question type
  const byType = data.reduce(
    (acc, d) => {
      if (!acc[d.question_type]) {
        acc[d.question_type] = { durations: [], rapidGuesses: 0 };
      }
      acc[d.question_type].durations.push(d.duration_ms);
      if (d.rapid_guess) acc[d.question_type].rapidGuesses++;
      return acc;
    },
    {} as Record<QuestionType, { durations: number[]; rapidGuesses: number }>
  );

  const byQuestionType = Object.entries(byType).reduce(
    (acc, [type, stats]) => {
      acc[type as QuestionType] = {
        count: stats.durations.length,
        rapid_guess_rate: stats.rapidGuesses / stats.durations.length,
        avg_duration_ms: stats.durations.reduce((a, b) => a + b, 0) / stats.durations.length,
      };
      return acc;
    },
    {} as TelemetryAggregate['by_question_type']
  );

  const medianIdx = Math.floor(durations.length / 2);
  const p90Idx = Math.floor(durations.length * 0.9);
  return {
    total_responses: data.length,
    rapid_guess_count: rapidGuessCount,
    rapid_guess_rate: rapidGuessCount / data.length,
    avg_duration_ms: durations.reduce((a, b) => a + b, 0) / durations.length,
    median_duration_ms: durations[medianIdx] ?? 0,
    p90_duration_ms: durations[p90Idx] ?? 0,
    avg_time_to_first_interaction_ms:
      firstInteractions.length > 0
        ? firstInteractions.reduce((a, b) => a + b, 0) / firstInteractions.length
        : null,
    hint_usage_rate: hintViewedCount / data.length,
    avg_answer_changes: data.reduce((sum, d) => sum + d.answer_changes, 0) / data.length,
    by_question_type: byQuestionType,
  };
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard to check if an object is valid TelemetryData
 */
export function isTelemetryData(obj: unknown): obj is TelemetryData {
  if (typeof obj !== 'object' || obj === null) return false;

  const data = obj as Record<string, unknown>;

  return (
    typeof data.duration_ms === 'number' &&
    typeof data.rapid_guess === 'boolean' &&
    typeof data.question_type === 'string' &&
    typeof data.mvrt_threshold_ms === 'number' &&
    typeof data.question_displayed_at === 'string' &&
    typeof data.answer_submitted_at === 'string' &&
    typeof data.answer_changes === 'number' &&
    typeof data.hint_viewed === 'boolean'
  );
}
