/**
 * Calibration Integration Service
 *
 * Bridges the submit-review API response to JOL calibration tracking.
 * Uses implicit confidence derived from behavioral metrics to track
 * metacognitive calibration during study sessions.
 *
 * Flow:
 * 1. On each answer: createJOLObservation() from submit-review response
 * 2. During session: accumulate observations in CalibrationTracker
 * 3. On session end: analyzeCalibration() for insights
 * 4. Persist calibration history for trend analysis
 */

import {
  deriveImplicitConfidence,
  initCalibrationTracker,
  addJOLObservation,
  analyzeCalibration,
  serializeCalibration,
  type CalibrationTracker,
  type CalibrationAnalysis,
  type JOLObservation,
  type CalibrationState,
} from '../lib/jol-calibration';

/**
 * Response shape from /api/drills/submit-review
 */
export interface SubmitReviewResponse {
  success: boolean;
  isCorrect: boolean;
  quality: number;
  parTimeMs: number;
  timeSpentMs: number;
  implicitMetrics: {
    rating: number;
    confidence: number;
    latencyRatio: number;
    answerSwitches: number;
  };
  circadian?: {
    phase: string;
    stabilityModifier: number;
    localHour: number;
  };
}

/**
 * Session calibration state for tracking across a study session
 */
export interface SessionCalibration {
  /** The calibration tracker accumulating observations */
  tracker: CalibrationTracker;
  /** Session start timestamp */
  sessionStart: string;
  /** Total questions answered */
  questionsAnswered: number;
  /** Running accuracy */
  runningAccuracy: number;
  /** Last computed analysis (updated periodically) */
  lastAnalysis: CalibrationAnalysis | null;
}

/**
 * Calibration summary for session end display
 */
export interface CalibrationSummary {
  /** Overall calibration state */
  state: CalibrationState;
  /** Brier score (lower is better) */
  brierScore: number;
  /** Overconfidence bias (-1 to 1, positive = overconfident) */
  overconfidenceBias: number;
  /** Sample size used */
  sampleSize: number;
  /** Actionable recommendation */
  recommendation: string;
  /** Whether illusion of competence detected */
  illusionOfCompetence: boolean;
  /** Calibration curve for visualization */
  calibrationCurve: Array<{
    label: string;
    avgConfidence: number;
    actualAccuracy: number;
    count: number;
  }>;
}

/**
 * Initialize a new session calibration tracker
 */
export function initSessionCalibration(): SessionCalibration {
  return {
    tracker: initCalibrationTracker(),
    sessionStart: new Date().toISOString(),
    questionsAnswered: 0,
    runningAccuracy: 0,
    lastAnalysis: null,
  };
}

/**
 * Create a JOL observation from submit-review response
 *
 * @param questionId - The question UUID
 * @param response - The response from submit-review API
 * @param organSystem - Optional organ system for stratification
 */
export function createJOLObservation(
  questionId: string,
  response: SubmitReviewResponse,
  organSystem?: string
): JOLObservation {
  const { implicitMetrics, isCorrect, timeSpentMs, parTimeMs } = response;

  // Derive implicit confidence from behavioral signals
  // Uses latency ratio and answer switches as primary signals
  const implicitConfidence = deriveImplicitConfidence({
    latencyRatio: implicitMetrics.latencyRatio,
    answerSwitches: implicitMetrics.answerSwitches,
    // Use the server-computed confidence as trajectory confidence
    trajectoryConfidence: implicitMetrics.confidence,
  });

  return {
    questionId,
    implicitConfidence,
    actualOutcome: isCorrect ? 1 : 0,
    latencyMs: timeSpentMs,
    latencyRatio: implicitMetrics.latencyRatio,
    timestamp: new Date().toISOString(),
    organSystem,
  };
}

/**
 * Record an observation and update session calibration
 *
 * @param session - Current session calibration state
 * @param observation - The JOL observation to add
 * @returns Updated session calibration
 */
export function recordObservation(
  session: SessionCalibration,
  observation: JOLObservation
): SessionCalibration {
  const updatedTracker = addJOLObservation(session.tracker, observation);
  const questionsAnswered = session.questionsAnswered + 1;
  const totalCorrect =
    session.runningAccuracy * session.questionsAnswered + observation.actualOutcome;
  const runningAccuracy = totalCorrect / questionsAnswered;

  // Analyze every 5 questions or at minimum threshold
  let lastAnalysis = session.lastAnalysis;
  if (questionsAnswered % 5 === 0 || questionsAnswered === 10) {
    lastAnalysis = analyzeCalibration(updatedTracker);
  }

  return {
    tracker: updatedTracker,
    sessionStart: session.sessionStart,
    questionsAnswered,
    runningAccuracy,
    lastAnalysis,
  };
}

/**
 * Get final calibration summary for session end
 *
 * @param session - The completed session calibration
 * @returns Calibration summary for display
 */
export function getCalibrationSummary(session: SessionCalibration): CalibrationSummary {
  const analysis = analyzeCalibration(session.tracker);

  return {
    state: analysis.state,
    brierScore: analysis.brierScore,
    overconfidenceBias: analysis.overconfidenceBias,
    sampleSize: analysis.sampleSize,
    recommendation: analysis.recommendation,
    illusionOfCompetence: analysis.illusionOfCompetence,
    calibrationCurve: analysis.calibrationCurve.map((bin) => ({
      label: bin.label,
      avgConfidence: bin.avgConfidence,
      actualAccuracy: bin.actualAccuracy,
      count: bin.count,
    })),
  };
}

/**
 * Serialize calibration data for storage/API persistence
 */
export function serializeSessionCalibration(session: SessionCalibration): Record<string, unknown> {
  const analysis = analyzeCalibration(session.tracker);
  return {
    sessionStart: session.sessionStart,
    sessionEnd: new Date().toISOString(),
    questionsAnswered: session.questionsAnswered,
    runningAccuracy: Math.round(session.runningAccuracy * 100) / 100,
    calibration: serializeCalibration(analysis),
  };
}

/**
 * Get calibration state label for UI display
 */
export function getCalibrationStateLabel(state: CalibrationState): {
  label: string;
  color: 'green' | 'amber' | 'red' | 'blue' | 'gray';
  icon: 'check' | 'alert' | 'trending-up' | 'trending-down' | 'help';
} {
  switch (state) {
    case 'well_calibrated':
      return { label: 'Well Calibrated', color: 'green', icon: 'check' };
    case 'overconfident':
      return { label: 'Overconfident', color: 'amber', icon: 'trending-up' };
    case 'underconfident':
      return { label: 'Underconfident', color: 'blue', icon: 'trending-down' };
    case 'fluctuating':
      return { label: 'Fluctuating', color: 'amber', icon: 'alert' };
    case 'unknown':
    default:
      return { label: 'Gathering Data', color: 'gray', icon: 'help' };
  }
}

/**
 * Check if enough data exists for reliable calibration analysis
 */
export function hasReliableCalibration(session: SessionCalibration): boolean {
  return session.questionsAnswered >= 10;
}

/**
 * Get progress towards reliable calibration
 */
export function getCalibrationProgress(session: SessionCalibration): {
  current: number;
  required: number;
  percentage: number;
} {
  const required = 10;
  return {
    current: session.questionsAnswered,
    required,
    percentage: Math.min(100, Math.round((session.questionsAnswered / required) * 100)),
  };
}

export default {
  initSessionCalibration,
  createJOLObservation,
  recordObservation,
  getCalibrationSummary,
  serializeSessionCalibration,
  getCalibrationStateLabel,
  hasReliableCalibration,
  getCalibrationProgress,
};
