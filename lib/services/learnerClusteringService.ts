/**
 * Learner Clustering & Early Warning Service
 *
 * Groups learners into behavioral archetypes using k-means on study behavior
 * features, then applies early-warning rules to detect at-risk trajectories.
 *
 * Archetypes (based on educational data mining literature):
 *   - CONSISTENT_REVIEWER: Regular sessions, good spacing, steady progress
 *   - CRAMMER: Burst study before exams, low spacing, high volume spikes
 *   - PERFECTIONIST: High accuracy but low throughput, excessive dwell time
 *   - DISENGAGING: Declining session frequency, dropping accuracy trend
 *   - SPRINTER: Fast responses, high volume, variable accuracy
 *   - EXPLORER: Broad system coverage, moderate depth, curious learner
 *
 * Early Warning Signals:
 *   - Accuracy decline (rolling 50 vs rolling 200)
 *   - Session frequency drop (last 7d vs prior 21d)
 *   - Burnout trajectory (fatigue onset + declining engagement)
 *   - Exam readiness gap (projected vs required by exam date)
 *   - System neglect (>14 days since any review in a blueprint system)
 *
 * All computations are pure functions — no database dependency.
 * Data fetching is the caller's responsibility.
 *
 * @module lib/services/learnerClusteringService
 */

// ─── Types ──────────────────────────────────────────────────────────────────

/** Behavioral features extracted from learner data (all normalized 0-1) */
export interface LearnerFeatures {
  /** Average daily questions over 30 days, normalized (0=0, 1=50+) */
  dailyVolume: number;
  /** Coefficient of variation of daily question counts (0=consistent, 1=spiky) */
  volumeVariability: number;
  /** Average accuracy over recent reviews (0-1) */
  accuracy: number;
  /** Average response time relative to par (0=instant, 0.5=par, 1=2×par) */
  relativeSpeed: number;
  /** Session spacing regularity (0=irregular, 1=perfectly regular) */
  spacingRegularity: number;
  /** Number of distinct systems studied / total systems (0-1) */
  systemBreadth: number;
  /** Average depth per system (reviews per system normalized) */
  systemDepth: number;
  /** Engagement trend: slope of 7-day rolling session count (-1 to 1, mapped to 0-1) */
  engagementTrend: number;
  /** Confidence calibration (0=miscalibrated, 1=well-calibrated) */
  calibrationScore: number;
  /** Fraction of sessions completed vs started (0-1) */
  sessionCompletionRate: number;
}

/** Feature dimension count */
export const FEATURE_DIM = 10;

/** Learner archetype labels */
export type LearnerArchetype =
  | 'CONSISTENT_REVIEWER'
  | 'CRAMMER'
  | 'PERFECTIONIST'
  | 'DISENGAGING'
  | 'SPRINTER'
  | 'EXPLORER';

/** Archetype assignment result */
export interface ClusterAssignment {
  /** Assigned archetype */
  archetype: LearnerArchetype;
  /** Confidence in assignment (0-1) — based on distance to centroid vs others */
  confidence: number;
  /** Distance to each archetype centroid */
  distances: Record<LearnerArchetype, number>;
  /** Raw feature vector used for clustering */
  features: LearnerFeatures;
}

/** Early warning severity levels */
export type WarningSeverity = 'info' | 'warning' | 'critical';

/** A single early warning signal */
export interface EarlyWarning {
  /** Warning type identifier */
  type: EarlyWarningType;
  /** Human-readable description */
  message: string;
  /** Severity level */
  severity: WarningSeverity;
  /** Quantitative value backing this warning */
  value: number;
  /** Threshold that triggered this warning */
  threshold: number;
  /** Suggested intervention */
  recommendation: string;
}

export type EarlyWarningType =
  | 'accuracy_decline'
  | 'session_frequency_drop'
  | 'burnout_trajectory'
  | 'exam_readiness_gap'
  | 'system_neglect'
  | 'speed_regression'
  | 'engagement_cliff';

/** Input data for early warning detection */
export interface WarningInput {
  /** Accuracy over last 50 questions */
  recentAccuracy: number;
  /** Accuracy over last 200 questions */
  baselineAccuracy: number;
  /** Sessions in last 7 days */
  sessionsLast7Days: number;
  /** Sessions in prior 21 days (days 8-28) */
  sessionsPrior21Days: number;
  /** Current burnout risk score (0-1) from UserStudyPhenotype */
  burnoutRisk: number;
  /** Engagement score trend (positive = improving) */
  engagementTrend: number;
  /** Days until next exam (null if no exam set) */
  daysUntilExam: number | null;
  /** Projected exam readiness (0-1) */
  projectedReadiness: number;
  /** Required readiness threshold (typically 0.70-0.85) */
  requiredReadiness: number;
  /** Systems with days since last review */
  systemLastReviewed: Record<string, number>;
  /** Active blueprint systems (the ones that matter) */
  activeBlueprintSystems: string[];
  /** Average response time trend (positive = slowing down) */
  responseTimeTrend: number;
}

/** Warning thresholds configuration */
export interface WarningThresholds {
  /** Accuracy drop (recent - baseline) that triggers warning */
  accuracyDropWarning: number;
  /** Accuracy drop that triggers critical */
  accuracyDropCritical: number;
  /** Session frequency ratio (recent/baseline) for warning */
  frequencyDropWarning: number;
  /** Session frequency ratio for critical */
  frequencyDropCritical: number;
  /** Burnout risk score for warning */
  burnoutWarning: number;
  /** Burnout risk score for critical */
  burnoutCritical: number;
  /** Days of system neglect for warning */
  systemNeglectDays: number;
  /** Readiness gap (required - projected) for warning */
  readinessGapWarning: number;
  /** Readiness gap for critical */
  readinessGapCritical: number;
}

export const DEFAULT_WARNING_THRESHOLDS: WarningThresholds = {
  accuracyDropWarning: 0.05,
  accuracyDropCritical: 0.10,
  frequencyDropWarning: 0.5,
  frequencyDropCritical: 0.25,
  burnoutWarning: 0.6,
  burnoutCritical: 0.8,
  systemNeglectDays: 14,
  readinessGapWarning: 0.10,
  readinessGapCritical: 0.20,
};

// ─── Archetype Centroids ────────────────────────────────────────────────────

/**
 * Prototype centroids for each archetype.
 * Derived from educational data mining literature + clinical education patterns.
 * Order matches LearnerFeatures fields.
 *
 * [dailyVol, volVar, accuracy, relSpeed, spacingReg, sysBreadth, sysDepth,
 *  engTrend, calibration, sessionCompletion]
 */
export const ARCHETYPE_CENTROIDS: Record<LearnerArchetype, number[]> = {
  CONSISTENT_REVIEWER: [0.5, 0.2, 0.70, 0.50, 0.85, 0.70, 0.60, 0.55, 0.75, 0.90],
  CRAMMER:            [0.8, 0.9, 0.55, 0.35, 0.15, 0.50, 0.40, 0.40, 0.45, 0.70],
  PERFECTIONIST:      [0.3, 0.3, 0.90, 0.75, 0.70, 0.40, 0.85, 0.50, 0.80, 0.95],
  DISENGAGING:        [0.2, 0.6, 0.50, 0.55, 0.30, 0.30, 0.30, 0.15, 0.40, 0.50],
  SPRINTER:           [0.9, 0.4, 0.60, 0.20, 0.60, 0.65, 0.45, 0.60, 0.50, 0.80],
  EXPLORER:           [0.5, 0.4, 0.65, 0.50, 0.55, 0.90, 0.35, 0.55, 0.60, 0.85],
};

export const ALL_ARCHETYPES: LearnerArchetype[] = [
  'CONSISTENT_REVIEWER', 'CRAMMER', 'PERFECTIONIST',
  'DISENGAGING', 'SPRINTER', 'EXPLORER',
];

// ─── Feature Vector Helpers ─────────────────────────────────────────────────

/** Convert LearnerFeatures struct to numeric array */
export function featuresToVector(f: LearnerFeatures): number[] {
  return [
    f.dailyVolume,
    f.volumeVariability,
    f.accuracy,
    f.relativeSpeed,
    f.spacingRegularity,
    f.systemBreadth,
    f.systemDepth,
    f.engagementTrend,
    f.calibrationScore,
    f.sessionCompletionRate,
  ];
}

/** Euclidean distance between two vectors */
export function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

/** Compute coefficient of variation (std/mean) for an array of numbers */
export function coefficientOfVariation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  if (mean === 0) return 0;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / mean;
}

/**
 * Compute spacing regularity from an array of inter-session gaps (in hours).
 * Perfect regularity (e.g., every 24h) → 1.0. High variance → 0.0.
 */
export function computeSpacingRegularity(gapHours: number[]): number {
  if (gapHours.length < 2) return 0.5; // insufficient data
  const cv = coefficientOfVariation(gapHours);
  // CV of 0 → regularity 1.0, CV of 2+ → regularity ~0
  return Math.max(0, 1 - cv / 2);
}

// ─── Core Clustering ────────────────────────────────────────────────────────

/**
 * Assign a learner to the nearest archetype centroid.
 * Uses Euclidean distance in the 10-dimensional feature space.
 */
export function assignArchetype(features: LearnerFeatures): ClusterAssignment {
  const vec = featuresToVector(features);
  const distances: Record<string, number> = {};
  let minDist = Infinity;
  let bestArchetype: LearnerArchetype = 'CONSISTENT_REVIEWER';

  for (const archetype of ALL_ARCHETYPES) {
    const centroid = ARCHETYPE_CENTROIDS[archetype];
    const dist = euclideanDistance(vec, centroid);
    distances[archetype] = Math.round(dist * 1000) / 1000;
    if (dist < minDist) {
      minDist = dist;
      bestArchetype = archetype;
    }
  }

  // Confidence: based on margin between nearest and second-nearest
  const sortedDists = Object.values(distances).sort((a, b) => a - b);
  const margin = sortedDists.length >= 2
    ? (sortedDists[1]! - sortedDists[0]!) / (sortedDists[0]! + 0.001)
    : 0;
  const confidence = Math.min(1, margin);

  return {
    archetype: bestArchetype,
    confidence: Math.round(confidence * 1000) / 1000,
    distances: distances as Record<LearnerArchetype, number>,
    features,
  };
}

/**
 * K-means clustering on a batch of learners.
 * Runs Lloyd's algorithm for the specified number of iterations.
 * Returns updated centroids + per-learner assignments.
 *
 * Used for periodic re-calibration of archetype centroids from real data.
 */
export function kMeansClustering(
  learners: LearnerFeatures[],
  k: number = 6,
  maxIterations: number = 20,
  initialCentroids?: number[][]
): { centroids: number[][]; assignments: number[]; iterations: number } {
  if (learners.length === 0) return { centroids: [], assignments: [], iterations: 0 };

  const n = learners.length;
  const vectors = learners.map(featuresToVector);

  // Initialize centroids
  let centroids: number[][] = initialCentroids
    ? initialCentroids.map((c) => [...c])
    : selectInitialCentroids(vectors, k);

  let assignments = new Array(n).fill(0);
  let iterations = 0;

  for (let iter = 0; iter < maxIterations; iter++) {
    iterations++;
    let changed = false;

    // Assignment step: each point to nearest centroid
    for (let i = 0; i < n; i++) {
      let minDist = Infinity;
      let best = 0;
      for (let j = 0; j < centroids.length; j++) {
        const dist = euclideanDistance(vectors[i]!, centroids[j]!);
        if (dist < minDist) {
          minDist = dist;
          best = j;
        }
      }
      if (assignments[i] !== best) {
        assignments[i] = best;
        changed = true;
      }
    }

    if (!changed) break;

    // Update step: recompute centroids
    const dim = vectors[0]!.length;
    const newCentroids: number[][] = Array.from({ length: centroids.length }, () =>
      new Array(dim).fill(0)
    );
    const counts = new Array(centroids.length).fill(0);

    for (let i = 0; i < n; i++) {
      const cluster = assignments[i]!;
      counts[cluster]!++;
      for (let d = 0; d < dim; d++) {
        newCentroids[cluster]![d]! += vectors[i]![d]!;
      }
    }

    for (let j = 0; j < centroids.length; j++) {
      if (counts[j]! > 0) {
        for (let d = 0; d < dim; d++) {
          newCentroids[j]![d]! /= counts[j]!;
        }
      } else {
        // Empty cluster: keep previous centroid
        newCentroids[j] = [...centroids[j]!];
      }
    }

    centroids = newCentroids;
  }

  return { centroids, assignments, iterations };
}

/** Select initial centroids using k-means++ style (spread-out selection) */
function selectInitialCentroids(vectors: number[][], k: number): number[][] {
  if (vectors.length <= k) return vectors.map((v) => [...v]);

  const centroids: number[][] = [];

  // First centroid: pick the one closest to origin (most "average")
  let bestIdx = 0;
  let bestDist = Infinity;
  const origin = new Array(vectors[0]!.length).fill(0.5); // center of [0,1] space
  for (let i = 0; i < vectors.length; i++) {
    const d = euclideanDistance(vectors[i]!, origin);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  centroids.push([...vectors[bestIdx]!]);

  // Subsequent centroids: pick the point farthest from existing centroids
  while (centroids.length < k) {
    let maxMinDist = -1;
    let nextIdx = 0;
    for (let i = 0; i < vectors.length; i++) {
      let minDist = Infinity;
      for (const c of centroids) {
        minDist = Math.min(minDist, euclideanDistance(vectors[i]!, c));
      }
      if (minDist > maxMinDist) {
        maxMinDist = minDist;
        nextIdx = i;
      }
    }
    centroids.push([...vectors[nextIdx]!]);
  }

  return centroids;
}

// ─── Early Warning Detection ────────────────────────────────────────────────

/**
 * Detect early warning signals from learner metrics.
 * Returns an array of warnings sorted by severity (critical first).
 */
export function detectWarnings(
  input: WarningInput,
  thresholds: WarningThresholds = DEFAULT_WARNING_THRESHOLDS
): EarlyWarning[] {
  const warnings: EarlyWarning[] = [];

  // 1. Accuracy decline
  const accuracyDrop = input.baselineAccuracy - input.recentAccuracy;
  if (accuracyDrop >= thresholds.accuracyDropCritical) {
    warnings.push({
      type: 'accuracy_decline',
      message: `Accuracy dropped ${(accuracyDrop * 100).toFixed(0)}% from baseline (${(input.baselineAccuracy * 100).toFixed(0)}% → ${(input.recentAccuracy * 100).toFixed(0)}%)`,
      severity: 'critical',
      value: accuracyDrop,
      threshold: thresholds.accuracyDropCritical,
      recommendation: 'Focus on review-only sessions for weak systems before adding new material.',
    });
  } else if (accuracyDrop >= thresholds.accuracyDropWarning) {
    warnings.push({
      type: 'accuracy_decline',
      message: `Accuracy trending down ${(accuracyDrop * 100).toFixed(0)}% from baseline`,
      severity: 'warning',
      value: accuracyDrop,
      threshold: thresholds.accuracyDropWarning,
      recommendation: 'Consider reducing new card intake and focusing on spaced review.',
    });
  }

  // 2. Session frequency drop
  const baselineWeeklyRate = input.sessionsPrior21Days / 3; // 3 weeks → weekly rate
  const frequencyRatio = baselineWeeklyRate > 0
    ? input.sessionsLast7Days / baselineWeeklyRate
    : 1;
  if (frequencyRatio <= thresholds.frequencyDropCritical) {
    warnings.push({
      type: 'session_frequency_drop',
      message: `Study sessions dropped to ${(frequencyRatio * 100).toFixed(0)}% of baseline`,
      severity: 'critical',
      value: frequencyRatio,
      threshold: thresholds.frequencyDropCritical,
      recommendation: 'Even 10 minutes of review prevents forgetting. Try a quick drill session.',
    });
  } else if (frequencyRatio <= thresholds.frequencyDropWarning) {
    warnings.push({
      type: 'session_frequency_drop',
      message: `Study frequency lower than usual (${(frequencyRatio * 100).toFixed(0)}% of baseline)`,
      severity: 'warning',
      value: frequencyRatio,
      threshold: thresholds.frequencyDropWarning,
      recommendation: 'Try to maintain your review schedule to preserve long-term retention.',
    });
  }

  // 3. Burnout trajectory
  if (input.burnoutRisk >= thresholds.burnoutCritical) {
    warnings.push({
      type: 'burnout_trajectory',
      message: 'High burnout risk detected — fatigue markers elevated',
      severity: 'critical',
      value: input.burnoutRisk,
      threshold: thresholds.burnoutCritical,
      recommendation: 'Take a rest day. Shorter, more frequent sessions outperform marathon study.',
    });
  } else if (input.burnoutRisk >= thresholds.burnoutWarning) {
    warnings.push({
      type: 'burnout_trajectory',
      message: 'Moderate burnout indicators — consider shorter sessions',
      severity: 'warning',
      value: input.burnoutRisk,
      threshold: thresholds.burnoutWarning,
      recommendation: 'Try 25-minute focused sessions with breaks between.',
    });
  }

  // 4. Exam readiness gap
  if (input.daysUntilExam != null && input.daysUntilExam > 0) {
    const gap = input.requiredReadiness - input.projectedReadiness;
    if (gap >= thresholds.readinessGapCritical) {
      warnings.push({
        type: 'exam_readiness_gap',
        message: `Readiness ${(gap * 100).toFixed(0)}% below target with ${input.daysUntilExam} days until exam`,
        severity: 'critical',
        value: gap,
        threshold: thresholds.readinessGapCritical,
        recommendation: 'Prioritize high-weight PANCE blueprint systems. Focus on weak areas first.',
      });
    } else if (gap >= thresholds.readinessGapWarning) {
      warnings.push({
        type: 'exam_readiness_gap',
        message: `Readiness gap of ${(gap * 100).toFixed(0)}% with ${input.daysUntilExam} days remaining`,
        severity: 'warning',
        value: gap,
        threshold: thresholds.readinessGapWarning,
        recommendation: 'Increase daily question count for under-performing systems.',
      });
    }
  }

  // 5. System neglect
  for (const system of input.activeBlueprintSystems) {
    const daysSince = input.systemLastReviewed[system];
    if (daysSince != null && daysSince >= thresholds.systemNeglectDays) {
      warnings.push({
        type: 'system_neglect',
        message: `${system}: no review in ${daysSince} days`,
        severity: daysSince >= thresholds.systemNeglectDays * 2 ? 'critical' : 'warning',
        value: daysSince,
        threshold: thresholds.systemNeglectDays,
        recommendation: `Schedule a focused ${system} drill session to prevent forgetting.`,
      });
    }
  }

  // 6. Engagement cliff
  if (input.engagementTrend < -0.3) {
    warnings.push({
      type: 'engagement_cliff',
      message: 'Sharp decline in study engagement detected',
      severity: input.engagementTrend < -0.6 ? 'critical' : 'warning',
      value: input.engagementTrend,
      threshold: -0.3,
      recommendation: 'Mix in drill types you enjoy. Variety prevents study fatigue.',
    });
  }

  // Sort: critical first, then warning, then info
  const severityOrder: Record<WarningSeverity, number> = {
    critical: 0,
    warning: 1,
    info: 2,
  };
  warnings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return warnings;
}

// ─── Combined Analysis ──────────────────────────────────────────────────────

/** Full learner analysis result */
export interface LearnerAnalysis {
  cluster: ClusterAssignment;
  warnings: EarlyWarning[];
  riskScore: number; // 0-1 composite risk
}

/**
 * Compute a composite risk score from warnings.
 * Critical = 0.4, Warning = 0.15, Info = 0.05 each, capped at 1.0.
 */
export function computeRiskScore(warnings: EarlyWarning[]): number {
  const weights: Record<WarningSeverity, number> = {
    critical: 0.4,
    warning: 0.15,
    info: 0.05,
  };

  let score = 0;
  for (const w of warnings) {
    score += weights[w.severity];
  }

  return Math.min(1, Math.round(score * 100) / 100);
}

/**
 * Full analysis: cluster assignment + early warnings + risk score.
 */
export function analyzeLearner(
  features: LearnerFeatures,
  warningInput: WarningInput,
  thresholds?: WarningThresholds
): LearnerAnalysis {
  const cluster = assignArchetype(features);
  const warnings = detectWarnings(warningInput, thresholds);
  const riskScore = computeRiskScore(warnings);

  return { cluster, warnings, riskScore };
}
