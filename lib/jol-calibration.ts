/**
 * Judgment of Learning (JOL) Calibration System
 *
 * Tracks the alignment between a user's implicit confidence signals
 * and their actual performance to detect metacognitive biases.
 *
 * Key Metrics:
 * - JOL Accuracy: Delta between predicted and actual performance
 * - Overconfidence: High implicit confidence + low accuracy
 * - Underconfidence: Low implicit confidence + high accuracy
 * - Illusion of Competence: Fast RT + high errors (false fluency)
 *
 * Research basis:
 * - Koriat (1997): Monitoring one's own knowledge
 * - Bjork & Bjork (2011): Desirable difficulties in learning
 * - Rhodes & Castel (2008): Memory predictions and metacognition
 */

/**
 * Calibration state categories
 */
export type CalibrationState =
  | 'well_calibrated' // Predictions match performance
  | 'overconfident' // Thinks they know more than they do
  | 'underconfident' // Performs better than they expect
  | 'fluctuating' // Inconsistent calibration
  | 'unknown'; // Insufficient data

/**
 * Individual JOL observation
 */
export interface JOLObservation {
  /** Question ID */
  questionId: string;
  /** Implicit confidence signal (0-1) derived from behavior */
  implicitConfidence: number;
  /** Actual outcome (correct = 1, incorrect = 0) */
  actualOutcome: number;
  /** Response latency (ms) */
  latencyMs: number;
  /** Latency ratio (actual / par) */
  latencyRatio: number;
  /** Timestamp */
  timestamp: string;
  /** Organ system for stratification */
  organSystem?: string;
}

/**
 * Calibration analysis result
 */
export interface CalibrationAnalysis {
  /** Overall calibration state */
  state: CalibrationState;
  /** Brier score (lower is better, 0-1) */
  brierScore: number;
  /** Average overconfidence (positive = overconfident) */
  overconfidenceBias: number;
  /** Resolution: How well predictions discriminate */
  resolution: number;
  /** Total observations used */
  sampleSize: number;
  /** Confidence in this analysis (0-1) */
  analysisConfidence: number;
  /** Breakdown by confidence bins */
  calibrationCurve: CalibrationBin[];
  /** Detected illusion of competence */
  illusionOfCompetence: boolean;
  /** Recommendation based on analysis */
  recommendation: string;
}

/**
 * Calibration bin for curve plotting
 */
export interface CalibrationBin {
  /** Confidence range label (e.g., "0.0-0.2") */
  label: string;
  /** Average implicit confidence in this bin */
  avgConfidence: number;
  /** Actual accuracy in this bin */
  actualAccuracy: number;
  /** Number of observations */
  count: number;
  /** Perfect calibration would be avgConfidence = actualAccuracy */
  calibrationError: number;
}

/**
 * Running calibration state for a user session
 */
export interface CalibrationTracker {
  /** All observations in current window */
  observations: JOLObservation[];
  /** Running sum for Brier score calculation */
  brierSum: number;
  /** Running sum for overconfidence */
  confidenceSum: number;
  /** Running sum for accuracy */
  accuracySum: number;
  /** Count of observations */
  count: number;
  /** Last analysis timestamp */
  lastAnalysis?: string;
}

/**
 * Minimum observations required for reliable analysis
 */
const MIN_OBSERVATIONS = 10;

/**
 * Window size for rolling calibration analysis
 */
const ANALYSIS_WINDOW = 50;

/**
 * Confidence bins for calibration curve
 */
const CONFIDENCE_BINS = [
  { min: 0.0, max: 0.2, label: '0-20%' },
  { min: 0.2, max: 0.4, label: '20-40%' },
  { min: 0.4, max: 0.6, label: '40-60%' },
  { min: 0.6, max: 0.8, label: '60-80%' },
  { min: 0.8, max: 1.0, label: '80-100%' },
];

/**
 * Derive implicit confidence from behavioral signals
 *
 * Maps latency ratio and trajectory confidence to predicted success probability
 */
export function deriveImplicitConfidence(params: {
  latencyRatio: number;
  answerSwitches: number;
  trajectoryConfidence?: number;
}): number {
  const { latencyRatio, answerSwitches, trajectoryConfidence } = params;

  // Base confidence from latency (fast = high confidence)
  // Uses logistic transform
  let latencyConfidence = 1 / (1 + Math.exp(2 * (latencyRatio - 0.8)));

  // Penalty for answer switches (uncertainty signal)
  const switchPenalty = Math.max(0, 1 - answerSwitches * 0.2);

  // Combine with trajectory confidence if available
  if (trajectoryConfidence !== undefined) {
    return 0.4 * latencyConfidence * switchPenalty + 0.6 * trajectoryConfidence;
  }

  return latencyConfidence * switchPenalty;
}

/**
 * Initialize a new calibration tracker
 */
export function initCalibrationTracker(): CalibrationTracker {
  return {
    observations: [],
    brierSum: 0,
    confidenceSum: 0,
    accuracySum: 0,
    count: 0,
  };
}

/**
 * Add a new observation to the tracker
 */
export function addJOLObservation(
  tracker: CalibrationTracker,
  observation: JOLObservation
): CalibrationTracker {
  const updatedObservations = [...tracker.observations, observation];

  // Keep only the most recent observations
  const windowedObservations = updatedObservations.slice(-ANALYSIS_WINDOW);

  // Update running stats
  const brierContribution = Math.pow(observation.implicitConfidence - observation.actualOutcome, 2);

  return {
    observations: windowedObservations,
    brierSum: tracker.brierSum + brierContribution,
    confidenceSum: tracker.confidenceSum + observation.implicitConfidence,
    accuracySum: tracker.accuracySum + observation.actualOutcome,
    count: tracker.count + 1,
  };
}

/**
 * Analyze calibration from observations
 */
export function analyzeCalibration(tracker: CalibrationTracker): CalibrationAnalysis {
  const n = Math.min(tracker.count, ANALYSIS_WINDOW);

  if (n < MIN_OBSERVATIONS) {
    return {
      state: 'unknown',
      brierScore: 0.25, // Baseline for random
      overconfidenceBias: 0,
      resolution: 0,
      sampleSize: n,
      analysisConfidence: n / MIN_OBSERVATIONS,
      calibrationCurve: [],
      illusionOfCompetence: false,
      recommendation: `Need ${MIN_OBSERVATIONS - n} more responses for reliable analysis.`,
    };
  }

  const recentObs = tracker.observations.slice(-ANALYSIS_WINDOW);

  // Calculate Brier score from recent observations
  const brierScore =
    recentObs.reduce(
      (sum, obs) => sum + Math.pow(obs.implicitConfidence - obs.actualOutcome, 2),
      0
    ) / recentObs.length;

  // Calculate overconfidence bias
  const avgConfidence = recentObs.reduce((s, o) => s + o.implicitConfidence, 0) / recentObs.length;
  const avgAccuracy = recentObs.reduce((s, o) => s + o.actualOutcome, 0) / recentObs.length;
  const overconfidenceBias = avgConfidence - avgAccuracy;

  // Calculate calibration curve
  const calibrationCurve = calculateCalibrationCurve(recentObs);

  // Calculate resolution (discrimination ability)
  const resolution = calculateResolution(recentObs, avgAccuracy);

  // Detect illusion of competence
  // Fast responses (low latency ratio) + low accuracy
  const fastResponses = recentObs.filter((o) => o.latencyRatio < 0.6);
  const fastAccuracy =
    fastResponses.length > 5
      ? fastResponses.reduce((s, o) => s + o.actualOutcome, 0) / fastResponses.length
      : avgAccuracy;
  const illusionOfCompetence = fastResponses.length > 5 && fastAccuracy < 0.5;

  // Determine calibration state
  const state = determineCalibrationState(overconfidenceBias, brierScore, calibrationCurve);

  // Generate recommendation
  const recommendation = generateRecommendation(state, overconfidenceBias, illusionOfCompetence);

  return {
    state,
    brierScore: Math.round(brierScore * 1000) / 1000,
    overconfidenceBias: Math.round(overconfidenceBias * 100) / 100,
    resolution: Math.round(resolution * 1000) / 1000,
    sampleSize: recentObs.length,
    analysisConfidence: Math.min(1, recentObs.length / 30),
    calibrationCurve,
    illusionOfCompetence,
    recommendation,
  };
}

/**
 * Calculate calibration curve (binned accuracy vs confidence)
 */
function calculateCalibrationCurve(observations: JOLObservation[]): CalibrationBin[] {
  return CONFIDENCE_BINS.map((bin) => {
    const binObs = observations.filter(
      (o) =>
        o.implicitConfidence >= bin.min && o.implicitConfidence < (bin.max === 1.0 ? 1.01 : bin.max)
    );

    if (binObs.length === 0) {
      return {
        label: bin.label,
        avgConfidence: (bin.min + bin.max) / 2,
        actualAccuracy: 0,
        count: 0,
        calibrationError: 0,
      };
    }

    const avgConf = binObs.reduce((s, o) => s + o.implicitConfidence, 0) / binObs.length;
    const actualAcc = binObs.reduce((s, o) => s + o.actualOutcome, 0) / binObs.length;

    return {
      label: bin.label,
      avgConfidence: Math.round(avgConf * 100) / 100,
      actualAccuracy: Math.round(actualAcc * 100) / 100,
      count: binObs.length,
      calibrationError: Math.round((avgConf - actualAcc) * 100) / 100,
    };
  });
}

/**
 * Calculate resolution (Murphy decomposition)
 */
function calculateResolution(observations: JOLObservation[], overallAccuracy: number): number {
  // Resolution measures how well confidence discriminates outcomes
  let resolutionSum = 0;

  for (const bin of CONFIDENCE_BINS) {
    const binObs = observations.filter(
      (o) =>
        o.implicitConfidence >= bin.min && o.implicitConfidence < (bin.max === 1.0 ? 1.01 : bin.max)
    );

    if (binObs.length > 0) {
      const binAccuracy = binObs.reduce((s, o) => s + o.actualOutcome, 0) / binObs.length;
      resolutionSum += binObs.length * Math.pow(binAccuracy - overallAccuracy, 2);
    }
  }

  return resolutionSum / observations.length;
}

/**
 * Determine overall calibration state
 */
function determineCalibrationState(
  bias: number,
  brierScore: number,
  curve: CalibrationBin[]
): CalibrationState {
  // Check for consistent over/underconfidence
  const significantBins = curve.filter((b) => b.count >= 3);

  if (significantBins.length < 2) {
    return 'unknown';
  }

  // Check calibration errors across bins
  const avgError =
    significantBins.reduce((s, b) => s + Math.abs(b.calibrationError), 0) / significantBins.length;
  const errorVariance =
    significantBins.reduce((s, b) => s + Math.pow(b.calibrationError - bias, 2), 0) /
    significantBins.length;

  // Well calibrated: low bias, low error
  if (Math.abs(bias) < 0.1 && avgError < 0.15) {
    return 'well_calibrated';
  }

  // Overconfident: consistent positive bias
  if (bias > 0.15 && errorVariance < 0.04) {
    return 'overconfident';
  }

  // Underconfident: consistent negative bias
  if (bias < -0.15 && errorVariance < 0.04) {
    return 'underconfident';
  }

  // Fluctuating: high variance in errors
  if (errorVariance > 0.05) {
    return 'fluctuating';
  }

  // Default based on bias direction
  return bias > 0.1 ? 'overconfident' : bias < -0.1 ? 'underconfident' : 'well_calibrated';
}

/**
 * Generate actionable recommendation
 */
function generateRecommendation(state: CalibrationState, bias: number, illusion: boolean): string {
  if (illusion) {
    return 'Warning: Fast responses are often incorrect. Slow down and engage deeper with questions.';
  }

  switch (state) {
    case 'overconfident':
      return `Overconfidence detected (${Math.round(bias * 100)}%). Practice slower, more deliberate retrieval.`;
    case 'underconfident':
      return `Underconfidence detected. You know more than you think! Trust your first instincts.`;
    case 'fluctuating':
      return 'Calibration varies widely. Focus on consistent study habits and self-testing.';
    case 'well_calibrated':
      return 'Excellent metacognitive calibration! Your confidence matches your actual knowledge.';
    default:
      return 'Continue practicing to build reliable self-assessment.';
  }
}

/**
 * Serialize calibration analysis for storage
 */
export function serializeCalibration(analysis: CalibrationAnalysis): Record<string, unknown> {
  return {
    state: analysis.state,
    brierScore: analysis.brierScore,
    bias: analysis.overconfidenceBias,
    resolution: analysis.resolution,
    sampleSize: analysis.sampleSize,
    illusion: analysis.illusionOfCompetence,
    curve: analysis.calibrationCurve.map((b) => ({
      conf: b.avgConfidence,
      acc: b.actualAccuracy,
      n: b.count,
    })),
  };
}

export default {
  deriveImplicitConfidence,
  initCalibrationTracker,
  addJOLObservation,
  analyzeCalibration,
  serializeCalibration,
};
