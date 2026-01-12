/**
 * Fluency Scoring System
 * 
 * Determines whether a learner is in a "Flow State" (effortless retrieval)
 * or "Labored State" (struggling with cognitive load).
 * 
 * Combines multiple behavioral signals into a composite fluency score:
 * - Response stability (consistent timing)
 * - Deletion ratio (backspacing/changes)
 * - Pause penalties (hesitations)
 * - Trajectory smoothness
 * 
 * Research basis:
 * - Csikszentmihalyi (1990): Flow theory
 * - Kelley & Jacoby (1998): Subjective fluency as a cue
 * - Benjamin et al. (1998): Retrieval fluency and recall
 */

/**
 * Fluency state classification
 */
export type FluencyState = 
  | 'flow'        // Effortless, automatic retrieval
  | 'engaged'     // Effortful but productive
  | 'labored'     // Struggling, high cognitive load
  | 'frustrated'  // Overwhelmed, likely to disengage
  | 'disengaged'; // Minimal effort, possible guessing

/**
 * Individual response fluency metrics
 */
export interface ResponseFluency {
  /** Composite fluency score (0-1, higher = more fluent) */
  score: number;
  /** Classified fluency state */
  state: FluencyState;
  /** Individual metric contributions */
  components: FluencyComponents;
  /** Confidence in classification (0-1) */
  confidence: number;
}

/**
 * Component metrics that contribute to fluency
 */
export interface FluencyComponents {
  /** Latency stability (low variance = high stability) */
  stabilityScore: number;
  /** Deletion/change ratio (low = fewer corrections) */
  deletionScore: number;
  /** Pause penalty (fewer/shorter pauses = higher score) */
  pauseScore: number;
  /** Trajectory smoothness (if available) */
  trajectoryScore: number;
  /** Engagement indicator (moderate latency, not too fast/slow) */
  engagementScore: number;
}

/**
 * Session-level fluency tracking
 */
export interface SessionFluencyTracker {
  /** Running latencies for stability calculation */
  latencies: number[];
  /** Running fluency scores */
  scores: number[];
  /** State transition count */
  stateTransitions: number;
  /** Current dominant state */
  currentState: FluencyState;
  /** Time spent in each state (ms) */
  stateTime: Record<FluencyState, number>;
  /** Last response timestamp */
  lastTimestamp: number;
}

/**
 * Input for fluency calculation
 */
export interface FluencyInput {
  /** Response latency (ms) */
  latencyMs: number;
  /** Par time for question (ms) */
  parTimeMs: number;
  /** Number of answer switches/changes */
  answerSwitches: number;
  /** Trajectory metrics (optional) */
  trajectory?: {
    efficiency: number;
    hesitationIndex: number;
    jitterScore: number;
  };
  /** Previous latencies for stability (optional) */
  previousLatencies?: number[];
  /** Session stats for percentile (optional) */
  sessionMean?: number;
  sessionStdDev?: number;
}

/**
 * Thresholds for fluency classification
 */
const THRESHOLDS = {
  /** Latency ratio below which is considered "too fast" (guessing) */
  MIN_ENGAGED_RATIO: 0.3,
  /** Latency ratio above which is considered "labored" */
  MAX_FLUENT_RATIO: 1.2,
  /** Latency ratio above which is "frustrated" */
  FRUSTRATED_RATIO: 2.0,
  /** Answer switches above which indicates struggling */
  MAX_SWITCHES_FLUENT: 1,
  /** Coefficient of variation threshold for stability */
  CV_STABLE_THRESHOLD: 0.4,
  /** Hesitation index above which penalizes fluency */
  HESITATION_PENALTY_THRESHOLD: 0.3,
};

/**
 * Weights for composite score
 */
const WEIGHTS = {
  stability: 0.20,
  deletion: 0.15,
  pause: 0.25,
  trajectory: 0.20,
  engagement: 0.20,
};

/**
 * Calculate response fluency from behavioral metrics
 */
export function calculateFluency(input: FluencyInput): ResponseFluency {
  const components = calculateComponents(input);
  
  // Weighted composite score
  const score = 
    WEIGHTS.stability * components.stabilityScore +
    WEIGHTS.deletion * components.deletionScore +
    WEIGHTS.pause * components.pauseScore +
    WEIGHTS.trajectory * components.trajectoryScore +
    WEIGHTS.engagement * components.engagementScore;

  // Determine state from score and components
  const state = classifyState(score, components, input);
  
  // Confidence based on data availability
  let confidence = 0.7;
  if (input.previousLatencies && input.previousLatencies.length >= 5) {
    confidence += 0.15;
  }
  if (input.trajectory) {
    confidence += 0.15;
  }
  confidence = Math.min(1, confidence);

  return {
    score: Math.round(score * 100) / 100,
    state,
    components,
    confidence,
  };
}

/**
 * Calculate individual fluency components
 */
function calculateComponents(input: FluencyInput): FluencyComponents {
  const latencyRatio = input.latencyMs / input.parTimeMs;

  // Stability score (from variance in recent latencies)
  let stabilityScore = 0.5; // Default if no history
  if (input.previousLatencies && input.previousLatencies.length >= 3) {
    const mean = input.previousLatencies.reduce((a, b) => a + b, 0) / input.previousLatencies.length;
    const variance = input.previousLatencies.reduce((sum, l) => sum + Math.pow(l - mean, 2), 0) / input.previousLatencies.length;
    const cv = Math.sqrt(variance) / mean; // Coefficient of variation
    stabilityScore = Math.max(0, 1 - cv / THRESHOLDS.CV_STABLE_THRESHOLD);
  }

  // Deletion score (penalize answer switches)
  const deletionScore = Math.max(0, 1 - input.answerSwitches * 0.25);

  // Pause score (moderate latency is ideal)
  // Too fast = no engagement, too slow = struggling
  let pauseScore: number;
  if (latencyRatio < THRESHOLDS.MIN_ENGAGED_RATIO) {
    // Too fast - likely guessing
    pauseScore = 0.3;
  } else if (latencyRatio < 0.7) {
    // Fast but engaged - good fluency
    pauseScore = 0.9;
  } else if (latencyRatio < 1.0) {
    // Moderate - effortful but good
    pauseScore = 0.8;
  } else if (latencyRatio < THRESHOLDS.MAX_FLUENT_RATIO) {
    // Slow but acceptable
    pauseScore = 0.6;
  } else if (latencyRatio < THRESHOLDS.FRUSTRATED_RATIO) {
    // Labored
    pauseScore = 0.3;
  } else {
    // Very slow - frustrated
    pauseScore = 0.1;
  }

  // Trajectory score (if available)
  let trajectoryScore = 0.5; // Default
  if (input.trajectory) {
    const { efficiency, hesitationIndex, jitterScore } = input.trajectory;
    trajectoryScore = (
      0.5 * efficiency +
      0.3 * (1 - hesitationIndex) +
      0.2 * (1 - jitterScore)
    );
  }

  // Engagement score (not too fast, not too slow)
  let engagementScore: number;
  if (latencyRatio < THRESHOLDS.MIN_ENGAGED_RATIO) {
    engagementScore = 0.2; // Disengaged/guessing
  } else if (latencyRatio > THRESHOLDS.FRUSTRATED_RATIO) {
    engagementScore = 0.3; // Frustrated
  } else {
    // Goldilocks zone
    engagementScore = Math.min(1, 1 - Math.abs(latencyRatio - 0.8) / 1.2);
  }

  return {
    stabilityScore: Math.round(stabilityScore * 100) / 100,
    deletionScore: Math.round(deletionScore * 100) / 100,
    pauseScore: Math.round(pauseScore * 100) / 100,
    trajectoryScore: Math.round(trajectoryScore * 100) / 100,
    engagementScore: Math.round(engagementScore * 100) / 100,
  };
}

/**
 * Classify fluency state from score and components
 */
function classifyState(
  score: number,
  components: FluencyComponents,
  input: FluencyInput
): FluencyState {
  const latencyRatio = input.latencyMs / input.parTimeMs;

  // Disengaged: Very fast with low engagement
  if (latencyRatio < THRESHOLDS.MIN_ENGAGED_RATIO && components.engagementScore < 0.3) {
    return 'disengaged';
  }

  // Frustrated: Very slow with low scores
  if (latencyRatio > THRESHOLDS.FRUSTRATED_RATIO || score < 0.3) {
    return 'frustrated';
  }

  // Labored: Slow with many switches
  if (latencyRatio > THRESHOLDS.MAX_FLUENT_RATIO || 
      (input.answerSwitches > THRESHOLDS.MAX_SWITCHES_FLUENT && score < 0.5)) {
    return 'labored';
  }

  // Flow: High fluency, stable, efficient
  if (score >= 0.75 && components.stabilityScore >= 0.6) {
    return 'flow';
  }

  // Engaged: Moderate effort, productive
  return 'engaged';
}

/**
 * Initialize session fluency tracker
 */
export function initFluencyTracker(): SessionFluencyTracker {
  return {
    latencies: [],
    scores: [],
    stateTransitions: 0,
    currentState: 'engaged',
    stateTime: {
      flow: 0,
      engaged: 0,
      labored: 0,
      frustrated: 0,
      disengaged: 0,
    },
    lastTimestamp: Date.now(),
  };
}

/**
 * Update tracker with new fluency observation
 */
export function updateFluencyTracker(
  tracker: SessionFluencyTracker,
  fluency: ResponseFluency,
  timestamp: number = Date.now()
): SessionFluencyTracker {
  const elapsed = timestamp - tracker.lastTimestamp;
  
  // Track state transitions
  const stateChanged = fluency.state !== tracker.currentState;
  
  // Update state time
  const newStateTime = { ...tracker.stateTime };
  newStateTime[tracker.currentState] += elapsed;

  return {
    latencies: [...tracker.latencies.slice(-19), fluency.components.pauseScore * 30000], // Keep last 20
    scores: [...tracker.scores.slice(-19), fluency.score],
    stateTransitions: tracker.stateTransitions + (stateChanged ? 1 : 0),
    currentState: fluency.state,
    stateTime: newStateTime,
    lastTimestamp: timestamp,
  };
}

/**
 * Analyze session fluency patterns
 */
export function analyzeSessionFluency(tracker: SessionFluencyTracker): {
  avgFluency: number;
  dominantState: FluencyState;
  flowPercentage: number;
  stabilityTrend: 'improving' | 'declining' | 'stable';
  recommendation: string;
} {
  const avgFluency = tracker.scores.length > 0
    ? tracker.scores.reduce((a, b) => a + b, 0) / tracker.scores.length
    : 0.5;

  // Find dominant state by time spent
  const totalTime = Object.values(tracker.stateTime).reduce((a, b) => a + b, 0);
  const dominantState = (Object.entries(tracker.stateTime) as [FluencyState, number][])
    .sort((a, b) => b[1] - a[1])[0][0];

  const flowPercentage = totalTime > 0
    ? Math.round((tracker.stateTime.flow / totalTime) * 100)
    : 0;

  // Trend analysis (compare first half to second half)
  let stabilityTrend: 'improving' | 'declining' | 'stable' = 'stable';
  if (tracker.scores.length >= 10) {
    const mid = Math.floor(tracker.scores.length / 2);
    const firstHalf = tracker.scores.slice(0, mid).reduce((a, b) => a + b, 0) / mid;
    const secondHalf = tracker.scores.slice(mid).reduce((a, b) => a + b, 0) / (tracker.scores.length - mid);
    if (secondHalf - firstHalf > 0.1) {
      stabilityTrend = 'improving';
    } else if (firstHalf - secondHalf > 0.1) {
      stabilityTrend = 'declining';
    }
  }

  // Generate recommendation
  let recommendation: string;
  if (flowPercentage >= 50) {
    recommendation = 'Excellent flow! Maintain this pace for optimal learning.';
  } else if (dominantState === 'frustrated' || dominantState === 'labored') {
    recommendation = 'Consider taking a break. Cognitive fatigue detected.';
  } else if (dominantState === 'disengaged') {
    recommendation = 'Increase challenge level - material may be too easy.';
  } else if (stabilityTrend === 'declining') {
    recommendation = 'Fluency declining. A short break may restore focus.';
  } else {
    recommendation = 'Good engagement. Continue at this pace.';
  }

  return {
    avgFluency: Math.round(avgFluency * 100) / 100,
    dominantState,
    flowPercentage,
    stabilityTrend,
    recommendation,
  };
}

/**
 * Serialize fluency for storage
 */
export function serializeFluency(fluency: ResponseFluency): Record<string, unknown> {
  return {
    score: fluency.score,
    state: fluency.state,
    stability: fluency.components.stabilityScore,
    engagement: fluency.components.engagementScore,
    confidence: fluency.confidence,
  };
}

export default {
  calculateFluency,
  initFluencyTracker,
  updateFluencyTracker,
  analyzeSessionFluency,
  serializeFluency,
};
