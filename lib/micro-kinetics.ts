/**
 * Micro-Kinetic Telemetry System
 *
 * Tracks mouse cursor movement patterns to infer cognitive load, uncertainty,
 * and expertise level during MCQ answer selection.
 *
 * Research basis:
 * - Fitts's Law: Movement time = a + b × log2(2D/W)
 * - Mouse trajectory analysis reveals decision conflict and hesitation
 * - MAD (Maximum Absolute Deviation) quantifies response competition
 *
 * References:
 * - Freeman & Ambady (2010): "MouseTracker software"
 * - Kieslich & Henninger (2017): "mousetrap R package"
 * - Song & Nakayama (2009): "Hidden cognitive states"
 */

/**
 * Single point in mouse trajectory
 */
export interface TrajectoryPoint {
  /** X coordinate (pixels from origin) */
  x: number;
  /** Y coordinate (pixels from origin) */
  y: number;
  /** Timestamp (ms since trajectory start) */
  t: number;
  /** Velocity at this point (pixels/ms) */
  velocity?: number;
}

/**
 * Hover data for a single option element
 */
export interface OptionHoverData {
  /** Option identifier (e.g., 'A', 'B', 'C', 'D') */
  optionId: string;
  /** Total hover time in milliseconds */
  hoverTime: number;
  /** Number of times cursor entered this option */
  enterCount: number;
  /** Whether this was the selected (clicked) option */
  wasSelected: boolean;
}

/**
 * Computed trajectory metrics for a single answer selection
 */
export interface TrajectoryMetrics {
  /** Maximum Absolute Deviation - perpendicular distance from ideal path */
  mad: number;
  /** Area Under Curve - total deviation area (normalized) */
  auc: number;
  /** Hesitation Index - velocity drops near target (0-1) */
  hesitationIndex: number;
  /** Jitter Score - micro-corrections during final approach */
  jitterScore: number;
  /** Trajectory Efficiency - actual distance / ideal distance */
  efficiency: number;
  /** Movement time in milliseconds */
  movementTime: number;
  /** Total path length in pixels */
  pathLength: number;
  /** Ideal (straight-line) distance in pixels */
  idealDistance: number;
  /** Number of direction reversals */
  reversals: number;
  /** Confidence score (0-1) derived from all metrics */
  confidenceScore: number;
  /** Hover entropy - Shannon entropy of time distribution across options (0 = focused, high = scattered) */
  hoverEntropy: number;
  /** Map of option IDs to hover times in ms */
  distractorHovers: Record<string, number>;
  /** Option ID with longest hover time (excluding selected) */
  peakDistractorHover: string | null;
  /** Total distractor hover time as percentage of movement time */
  distractorHoverRatio: number;
}

/**
 * Target information for trajectory analysis
 */
export interface TargetInfo {
  /** Target element center X */
  centerX: number;
  /** Target element center Y */
  centerY: number;
  /** Target element width */
  width: number;
  /** Target element height */
  height: number;
}

/**
 * Raw trajectory data collected during answer selection
 */
export interface RawTrajectory {
  /** Starting position (where cursor was when question appeared) */
  startPoint: { x: number; y: number };
  /** All sampled points (40ms intervals recommended) */
  points: TrajectoryPoint[];
  /** Target element info */
  target: TargetInfo;
  /** Timestamp when tracking started */
  startTime: number;
  /** Timestamp when click occurred */
  endTime: number;
}

/**
 * Sampling interval for mouse tracking (40ms = 25 Hz)
 */
export const SAMPLING_INTERVAL_MS = 40;

/**
 * Distance threshold for detecting micro-corrections (pixels)
 */
const JITTER_THRESHOLD_PX = 3;

/**
 * Velocity threshold for detecting hesitation (pixels/ms)
 */
const HESITATION_VELOCITY_THRESHOLD = 0.1;

/**
 * Window size for final approach analysis (pixels from target)
 */
const FINAL_APPROACH_DISTANCE = 100;

/**
 * Calculate Shannon entropy from a probability distribution
 *
 * H = -Σ p(x) * log2(p(x))
 *
 * @param probabilities - Array of probabilities (must sum to 1)
 * @returns Entropy in bits (0 = certain, log2(n) = uniform)
 */
export function calculateShannonEntropy(probabilities: number[]): number {
  if (probabilities.length === 0) return 0;

  let entropy = 0;
  for (const p of probabilities) {
    if (p > 0) {
      entropy -= p * Math.log2(p);
    }
  }
  return entropy;
}

/**
 * Calculate hover entropy from option hover times
 *
 * Measures uncertainty in answer selection based on hover time distribution.
 * - Low entropy (near 0) = focused on one option = confident
 * - High entropy (near log2(n)) = evenly distributed = uncertain
 *
 * @param hoverTimes - Map of option IDs to hover times in ms
 * @param selectedOptionId - The option that was ultimately selected
 * @returns Object with entropy metrics
 */
export function calculateHoverMetrics(
  hoverTimes: Record<string, number>,
  selectedOptionId: string
): {
  hoverEntropy: number;
  distractorHovers: Record<string, number>;
  peakDistractorHover: string | null;
  distractorHoverRatio: number;
  normalizedEntropy: number;
} {
  const optionIds = Object.keys(hoverTimes);
  const totalTime = Object.values(hoverTimes).reduce((sum, t) => sum + t, 0);

  // Handle edge case of no hover data
  if (totalTime === 0 || optionIds.length === 0) {
    return {
      hoverEntropy: 0,
      distractorHovers: {},
      peakDistractorHover: null,
      distractorHoverRatio: 0,
      normalizedEntropy: 0,
    };
  }

  // Calculate probabilities (normalized hover times)
  const probabilities = optionIds.map((id) => (hoverTimes[id] ?? 0) / totalTime);

  // Shannon entropy
  const entropy = calculateShannonEntropy(probabilities);

  // Maximum possible entropy for this number of options
  const maxEntropy = Math.log2(optionIds.length);

  // Normalized entropy (0-1 scale, 1 = maximum uncertainty)
  const normalizedEntropy = maxEntropy > 0 ? entropy / maxEntropy : 0;

  // Build distractor hovers map (excluding selected option)
  const distractorHovers: Record<string, number> = {};
  let peakDistractorHover: string | null = null;
  let maxDistractorTime = 0;
  let totalDistractorTime = 0;

  for (const [optionId, time] of Object.entries(hoverTimes)) {
    if (optionId !== selectedOptionId) {
      distractorHovers[optionId] = time;
      totalDistractorTime += time;
      if (time > maxDistractorTime) {
        maxDistractorTime = time;
        peakDistractorHover = optionId;
      }
    }
  }

  // Distractor hover ratio (time on wrong options / total time)
  const distractorHoverRatio = totalTime > 0 ? totalDistractorTime / totalTime : 0;

  return {
    hoverEntropy: entropy,
    distractorHovers,
    peakDistractorHover,
    distractorHoverRatio,
    normalizedEntropy,
  };
}

/**
 * Calculate Euclidean distance between two points
 */
function distance(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

/**
 * Calculate perpendicular distance from point to line segment
 */
function perpendicularDistance(
  point: { x: number; y: number },
  lineStart: { x: number; y: number },
  lineEnd: { x: number; y: number }
): number {
  const lineLength = distance(lineStart, lineEnd);
  if (lineLength === 0) return distance(point, lineStart);

  // Calculate perpendicular distance using cross product
  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.x - lineStart.x) * (lineEnd.x - lineStart.x) +
        (point.y - lineStart.y) * (lineEnd.y - lineStart.y)) /
        (lineLength * lineLength)
    )
  );

  const projX = lineStart.x + t * (lineEnd.x - lineStart.x);
  const projY = lineStart.y + t * (lineEnd.y - lineStart.y);

  return distance(point, { x: projX, y: projY });
}

/**
 * Calculate velocity at each point in trajectory
 */
function calculateVelocities(points: TrajectoryPoint[]): TrajectoryPoint[] {
  if (points.length < 2) return points;

  return points.map((point, i) => {
    if (i === 0) {
      return { ...point, velocity: 0 };
    }
    const prev = points[i - 1];
    if (!prev) {
      return { ...point, velocity: 0 };
    }
    const dt = point.t - prev.t;
    const dist = distance(prev, point);
    const velocity = dt > 0 ? dist / dt : 0;
    return { ...point, velocity };
  });
}

/**
 * Calculate Maximum Absolute Deviation (MAD)
 *
 * MAD measures the largest perpendicular distance from the actual trajectory
 * to the ideal straight-line path. Higher MAD indicates more decision conflict.
 */
function calculateMAD(trajectory: RawTrajectory): number {
  if (trajectory.points.length < 2) return 0;

  const start = trajectory.startPoint;
  const end = { x: trajectory.target.centerX, y: trajectory.target.centerY };

  let maxDeviation = 0;

  for (const point of trajectory.points) {
    const deviation = perpendicularDistance(point, start, end);
    maxDeviation = Math.max(maxDeviation, deviation);
  }

  // Normalize by ideal distance
  const idealDist = distance(start, end);
  return idealDist > 0 ? maxDeviation / idealDist : 0;
}

/**
 * Calculate Area Under Curve (AUC)
 *
 * AUC measures the total area between the actual trajectory and the ideal path.
 * Uses trapezoidal integration of perpendicular deviations.
 */
function calculateAUC(trajectory: RawTrajectory): number {
  if (trajectory.points.length < 2) return 0;

  const start = trajectory.startPoint;
  const end = { x: trajectory.target.centerX, y: trajectory.target.centerY };
  const idealDist = distance(start, end);

  if (idealDist === 0) return 0;

  let totalArea = 0;

  for (let i = 1; i < trajectory.points.length; i++) {
    const p1 = trajectory.points[i - 1];
    const p2 = trajectory.points[i];
    if (!p1 || !p2) continue;

    const dev1 = perpendicularDistance(p1, start, end);
    const dev2 = perpendicularDistance(p2, start, end);
    const segmentLength = distance(p1, p2);

    // Trapezoidal area
    totalArea += ((dev1 + dev2) / 2) * segmentLength;
  }

  // Normalize by ideal distance squared (area normalization)
  return totalArea / (idealDist * idealDist);
}

/**
 * Calculate Hesitation Index
 *
 * Detects velocity drops (near-stops) during the trajectory, especially
 * near the target. Higher values indicate more hesitation/second-guessing.
 */
function calculateHesitationIndex(trajectory: RawTrajectory): number {
  const pointsWithVelocity = calculateVelocities(trajectory.points);
  if (pointsWithVelocity.length < 3) return 0;

  const target = { x: trajectory.target.centerX, y: trajectory.target.centerY };
  let hesitationCount = 0;
  let totalPoints = 0;

  // Focus on points within final approach distance
  for (const point of pointsWithVelocity) {
    const distToTarget = distance(point, target);
    if (distToTarget < FINAL_APPROACH_DISTANCE) {
      totalPoints++;
      if (point.velocity !== undefined && point.velocity < HESITATION_VELOCITY_THRESHOLD) {
        hesitationCount++;
      }
    }
  }

  return totalPoints > 0 ? hesitationCount / totalPoints : 0;
}

/**
 * Calculate Jitter Score
 *
 * Measures micro-corrections (small back-and-forth movements) during final approach.
 * High jitter indicates stress, uncertainty, or fine-motor difficulty.
 */
function calculateJitterScore(trajectory: RawTrajectory): number {
  if (trajectory.points.length < 5) return 0;

  const target = { x: trajectory.target.centerX, y: trajectory.target.centerY };
  let microCorrections = 0;
  let relevantSegments = 0;

  // Analyze final approach
  for (let i = 2; i < trajectory.points.length; i++) {
    const p0 = trajectory.points[i - 2];
    const p1 = trajectory.points[i - 1];
    const p2 = trajectory.points[i];
    if (!p0 || !p1 || !p2) continue;

    const distToTarget = distance(p2, target);
    if (distToTarget > FINAL_APPROACH_DISTANCE) continue;

    relevantSegments++;

    // Detect direction reversal (micro-correction)
    const dx1 = p1.x - p0.x;
    const dy1 = p1.y - p0.y;
    const dx2 = p2.x - p1.x;
    const dy2 = p2.y - p1.y;

    // Check for direction reversal with small magnitude
    const dist1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
    const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

    if (dist1 < JITTER_THRESHOLD_PX * 3 || dist2 < JITTER_THRESHOLD_PX * 3) {
      // Small movement - check for reversal
      const dotProduct = dx1 * dx2 + dy1 * dy2;
      if (dotProduct < 0) {
        microCorrections++;
      }
    }
  }

  return relevantSegments > 0 ? microCorrections / relevantSegments : 0;
}

/**
 * Calculate Trajectory Efficiency
 *
 * Ratio of ideal (straight-line) distance to actual path length.
 * 1.0 = perfectly efficient, lower values = more deviation.
 */
function calculateEfficiency(trajectory: RawTrajectory): number {
  if (trajectory.points.length < 2) return 1;

  const start = trajectory.startPoint;
  const end = { x: trajectory.target.centerX, y: trajectory.target.centerY };
  const idealDist = distance(start, end);

  // Calculate actual path length
  const firstPoint = trajectory.points[0];
  let pathLength = firstPoint ? distance(start, firstPoint) : 0;
  for (let i = 1; i < trajectory.points.length; i++) {
    const prevPoint = trajectory.points[i - 1];
    const currPoint = trajectory.points[i];
    if (prevPoint && currPoint) {
      pathLength += distance(prevPoint, currPoint);
    }
  }

  return pathLength > 0 ? idealDist / pathLength : 1;
}

/**
 * Count direction reversals in trajectory
 */
function countReversals(trajectory: RawTrajectory): number {
  if (trajectory.points.length < 3) return 0;

  let reversals = 0;

  for (let i = 2; i < trajectory.points.length; i++) {
    const p0 = trajectory.points[i - 2];
    const p1 = trajectory.points[i - 1];
    const p2 = trajectory.points[i];
    if (!p0 || !p1 || !p2) continue;

    const dx1 = p1.x - p0.x;
    const dy1 = p1.y - p0.y;
    const dx2 = p2.x - p1.x;
    const dy2 = p2.y - p1.y;

    // Check for significant direction change
    const dotProduct = dx1 * dx2 + dy1 * dy2;
    const mag1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
    const mag2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

    if (mag1 > 5 && mag2 > 5) {
      const cosAngle = dotProduct / (mag1 * mag2);
      if (cosAngle < -0.5) {
        // More than 120 degree turn
        reversals++;
      }
    }
  }

  return reversals;
}

/**
 * Calculate composite confidence score from all metrics
 *
 * Higher confidence = more direct, efficient trajectory with less hesitation
 * Lower confidence = more deviation, hesitation, and jitter
 */
function calculateConfidenceScore(metrics: Omit<TrajectoryMetrics, 'confidenceScore'>): number {
  // Weights for each metric (sum to 1.0)
  const weights = {
    mad: 0.25, // High MAD = low confidence
    efficiency: 0.25, // Low efficiency = low confidence
    hesitation: 0.25, // High hesitation = low confidence
    jitter: 0.15, // High jitter = low confidence
    auc: 0.1, // High AUC = low confidence
  };

  // Normalize metrics to 0-1 scale where 1 = confident
  const madScore = Math.max(0, 1 - metrics.mad);
  const efficiencyScore = metrics.efficiency;
  const hesitationScore = Math.max(0, 1 - metrics.hesitationIndex);
  const jitterScore = Math.max(0, 1 - metrics.jitterScore);
  const aucScore = Math.max(0, 1 - Math.min(metrics.auc, 1));

  return (
    weights.mad * madScore +
    weights.efficiency * efficiencyScore +
    weights.hesitation * hesitationScore +
    weights.jitter * jitterScore +
    weights.auc * aucScore
  );
}

/**
 * Options for trajectory analysis
 */
export interface AnalyzeTrajectoryOptions {
  /** Hover times per option ID (ms) */
  hoverTimes?: Record<string, number>;
  /** The option ID that was selected/clicked */
  selectedOptionId?: string;
}

/**
 * Analyze a complete mouse trajectory and compute all metrics
 *
 * @param trajectory - Raw trajectory data from tracking
 * @param options - Optional hover data for entropy calculation
 * @returns Computed trajectory metrics including hover entropy
 */
export function analyzeTrajectory(
  trajectory: RawTrajectory,
  options?: AnalyzeTrajectoryOptions
): TrajectoryMetrics {
  const start = trajectory.startPoint;
  const end = { x: trajectory.target.centerX, y: trajectory.target.centerY };

  const idealDistance = distance(start, end);
  const movementTime = trajectory.endTime - trajectory.startTime;

  // Calculate path length
  const firstPt = trajectory.points[0];
  let pathLength = firstPt ? distance(start, firstPt) : 0;
  for (let i = 1; i < trajectory.points.length; i++) {
    const prevPt = trajectory.points[i - 1];
    const currPt = trajectory.points[i];
    if (prevPt && currPt) {
      pathLength += distance(prevPt, currPt);
    }
  }

  const mad = calculateMAD(trajectory);
  const auc = calculateAUC(trajectory);
  const hesitationIndex = calculateHesitationIndex(trajectory);
  const jitterScore = calculateJitterScore(trajectory);
  const efficiency = calculateEfficiency(trajectory);
  const reversals = countReversals(trajectory);

  // Calculate hover metrics if hover data provided
  const hoverMetrics =
    options?.hoverTimes && options?.selectedOptionId
      ? calculateHoverMetrics(options.hoverTimes, options.selectedOptionId)
      : {
          hoverEntropy: 0,
          distractorHovers: {},
          peakDistractorHover: null,
          distractorHoverRatio: 0,
        };

  const baseMetrics = {
    mad,
    auc,
    hesitationIndex,
    jitterScore,
    efficiency,
    movementTime,
    pathLength,
    idealDistance,
    reversals,
    hoverEntropy: hoverMetrics.hoverEntropy,
    distractorHovers: hoverMetrics.distractorHovers,
    peakDistractorHover: hoverMetrics.peakDistractorHover,
    distractorHoverRatio: hoverMetrics.distractorHoverRatio,
  };

  return {
    ...baseMetrics,
    confidenceScore: calculateConfidenceScore(baseMetrics),
  };
}

/**
 * Serialized trajectory metrics including hover data
 */
export interface SerializedTrajectoryMetrics {
  mad: number;
  auc: number;
  hesitationIndex: number;
  jitterScore: number;
  efficiency: number;
  movementTime: number;
  confidenceScore: number;
  hoverEntropy: number;
  distractorHoverRatio: number;
  peakDistractorHover: string | null;
  distractorHovers: Record<string, number>;
}

/**
 * Serialize trajectory metrics for API submission
 */
export function serializeTrajectoryMetrics(
  metrics: TrajectoryMetrics
): SerializedTrajectoryMetrics {
  return {
    mad: Math.round(metrics.mad * 1000) / 1000,
    auc: Math.round(metrics.auc * 1000) / 1000,
    hesitationIndex: Math.round(metrics.hesitationIndex * 100) / 100,
    jitterScore: Math.round(metrics.jitterScore * 100) / 100,
    efficiency: Math.round(metrics.efficiency * 100) / 100,
    movementTime: Math.round(metrics.movementTime),
    confidenceScore: Math.round(metrics.confidenceScore * 100) / 100,
    hoverEntropy: Math.round(metrics.hoverEntropy * 1000) / 1000,
    distractorHoverRatio: Math.round(metrics.distractorHoverRatio * 100) / 100,
    peakDistractorHover: metrics.peakDistractorHover,
    distractorHovers: Object.fromEntries(
      Object.entries(metrics.distractorHovers).map(([k, v]) => [k, Math.round(v)])
    ),
  };
}

/**
 * Interpret trajectory metrics for FSRS rating adjustment
 *
 * @param metrics - Computed trajectory metrics
 * @param isCorrect - Whether the answer was correct
 * @returns Rating adjustment suggestion
 */
export function interpretTrajectoryForRating(
  metrics: TrajectoryMetrics,
  isCorrect: boolean
): {
  suggestedAdjustment: 'upgrade' | 'downgrade' | 'none';
  reason: string;
  trajectoryConfidence: 'high' | 'medium' | 'low';
} {
  const confidence = metrics.confidenceScore;

  // Determine confidence level
  const trajectoryConfidence: 'high' | 'medium' | 'low' =
    confidence >= 0.75 ? 'high' : confidence >= 0.5 ? 'medium' : 'low';

  if (isCorrect) {
    // Correct answer
    if (trajectoryConfidence === 'high') {
      return {
        suggestedAdjustment: 'upgrade',
        reason: 'Direct, confident mouse movement suggests strong recall',
        trajectoryConfidence,
      };
    }
    if (trajectoryConfidence === 'low') {
      return {
        suggestedAdjustment: 'downgrade',
        reason: 'Hesitant trajectory despite correct answer - possible lucky guess',
        trajectoryConfidence,
      };
    }
  } else {
    // Incorrect answer
    if (trajectoryConfidence === 'high') {
      return {
        suggestedAdjustment: 'none',
        reason: 'Confident but wrong - strong misconception detected',
        trajectoryConfidence,
      };
    }
    if (trajectoryConfidence === 'low') {
      return {
        suggestedAdjustment: 'none',
        reason: 'Uncertain and wrong - knowledge gap confirmed',
        trajectoryConfidence,
      };
    }
  }

  return {
    suggestedAdjustment: 'none',
    reason: 'Average trajectory confidence',
    trajectoryConfidence,
  };
}

export default {
  analyzeTrajectory,
  serializeTrajectoryMetrics,
  interpretTrajectoryForRating,
  SAMPLING_INTERVAL_MS,
};
