/**
 * FSRS v6 Parameter Optimizer
 *
 * Implements L-BFGS optimization to personalize FSRS parameters
 * based on user review history. Minimizes Brier score to find
 * optimal w[0]-w[20] parameters for each user.
 *
 * @module fsrs-optimizer
 * @version 1.0.0
 *
 * References:
 * - FSRS v6: https://github.com/open-spaced-repetition/fsrs.js
 * - fsrs-browser WASM: https://github.com/open-spaced-repetition/fsrs-browser
 * - L-BFGS: Limited-memory Broyden–Fletcher–Goldfarb–Shanno algorithm
 */

import {
  defaultParameters,
  type FSRSParameters,
  type ReviewSnapshot,
  Rating,
  FSRSState,
} from './fsrs';

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * Result of FSRS parameter optimization
 */
export interface PersonalizedFSRSParams {
  userId: string;

  /** Optimized 21-parameter weights array */
  w: number[];

  /** Number of reviews used for optimization */
  sampleSize: number;

  /** When optimization was performed */
  lastOptimizedAt: Date;

  /** Percentage improvement in Brier score over defaults */
  improvementOverDefault: number;

  /** Brier score achieved with optimized parameters */
  brierScore: number;

  /** Brier score with default parameters (for comparison) */
  defaultBrierScore: number;

  /** Number of L-BFGS iterations performed */
  iterations: number;

  /** Per-system adjustments for fine-tuning */
  systemModifiers?: Record<string, SystemModifier>;
}

/**
 * Per-system adjustments to FSRS parameters
 */
export interface SystemModifier {
  /** Multiplier for stability (>1 = longer intervals, <1 = shorter) */
  stabilityMultiplier: number;

  /** Offset for difficulty (positive = harder, negative = easier) */
  difficultyOffset: number;

  /** Sample size for this system */
  sampleSize: number;

  /** System-specific accuracy */
  accuracy: number;
}

/**
 * Review record for optimization
 */
export interface OptimizationReview {
  /** Days since previous review */
  elapsedDays: number;

  /** Stability at time of review */
  stability: number;

  /** Difficulty at time of review */
  difficulty: number;

  /** User's rating (1-4) */
  rating: Rating;

  /** Card state at review time */
  state: FSRSState;

  /** Was this a successful recall? (rating >= 2) */
  success: boolean;

  /** Optional: organ system for per-system optimization */
  system?: string;
}

/**
 * L-BFGS optimization configuration
 */
export interface LBFGSConfig {
  /** Maximum iterations */
  maxIterations: number;

  /** Convergence tolerance for gradient */
  gradientTolerance: number;

  /** Convergence tolerance for function value */
  functionTolerance: number;

  /** Memory size for L-BFGS */
  memorySize: number;

  /** Learning rate for gradient descent fallback */
  learningRate: number;

  /** Line search parameters */
  lineSearchMaxIterations: number;

  /** Armijo condition parameter */
  c1: number;

  /** Wolfe condition parameter */
  c2: number;
}

/**
 * Bounds for FSRS parameters
 * Prevents optimization from producing unreasonable values
 */
export interface ParameterBounds {
  min: number[];
  max: number[];
}

// ============================================================================
// Constants
// ============================================================================

/** Minimum reviews required for reliable optimization */
export const MIN_REVIEWS_FOR_OPTIMIZATION = 500;

/** Minimum reviews for per-system optimization */
export const MIN_REVIEWS_PER_SYSTEM = 30;

/** Default L-BFGS configuration */
export const DEFAULT_LBFGS_CONFIG: LBFGSConfig = {
  maxIterations: 500,
  gradientTolerance: 1e-6,
  functionTolerance: 1e-8,
  memorySize: 10,
  learningRate: 0.01,
  lineSearchMaxIterations: 20,
  c1: 1e-4, // Armijo condition
  c2: 0.9, // Wolfe condition
};

/**
 * Parameter bounds for FSRS v6
 * Based on empirical analysis of large-scale Anki datasets
 */
export const PARAMETER_BOUNDS: ParameterBounds = {
  min: [
    0.1, // w[0]: Initial stability (Again) - min 0.1 days
    0.5, // w[1]: Initial stability (Hard) - min 0.5 days
    1.0, // w[2]: Initial stability (Good) - min 1 day
    4.0, // w[3]: Initial stability (Easy) - min 4 days
    4.0, // w[4]: Initial difficulty base - min 4
    0.1, // w[5]: Difficulty change per grade - min 0.1
    0.5, // w[6]: Difficulty adjustment rate - min 0.5
    0.0, // w[7]: Mean reversion strength - min 0
    0.5, // w[8]: Base growth factor - min 0.5
    0.01, // w[9]: Stability decay exponent - min 0.01
    0.5, // w[10]: Retrievability growth factor - min 0.5
    0.5, // w[11]: Forget base - min 0.5
    0.1, // w[12]: Forget difficulty factor - min 0.1
    0.1, // w[13]: Forget stability factor - min 0.1
    0.01, // w[14]: Forget retrievability factor - min 0.01
    0.5, // w[15]: Hard penalty - min 0.5
    0.0, // w[16]: Easy bonus multiplier - min 0
    0.1, // w[17]: Short-term decay rate - min 0.1
    0.0, // w[18]: Grade offset for short-term - min 0
    5.0, // w[19]: Retrievability factor - min 5
    0.5, // w[20]: Retrievability decay exponent - min 0.5
  ],
  max: [
    2.0, // w[0]: Initial stability (Again) - max 2 days
    5.0, // w[1]: Initial stability (Hard) - max 5 days
    10.0, // w[2]: Initial stability (Good) - max 10 days
    60.0, // w[3]: Initial stability (Easy) - max 60 days
    10.0, // w[4]: Initial difficulty base - max 10
    2.0, // w[5]: Difficulty change per grade - max 2
    3.0, // w[6]: Difficulty adjustment rate - max 3
    0.5, // w[7]: Mean reversion strength - max 0.5
    3.0, // w[8]: Base growth factor - max 3
    0.5, // w[9]: Stability decay exponent - max 0.5
    2.0, // w[10]: Retrievability growth factor - max 2
    5.0, // w[11]: Forget base - max 5
    1.0, // w[12]: Forget difficulty factor - max 1
    2.0, // w[13]: Forget stability factor - max 2
    0.5, // w[14]: Forget retrievability factor - max 0.5
    1.5, // w[15]: Hard penalty - max 1.5
    1.0, // w[16]: Easy bonus multiplier - max 1
    1.5, // w[17]: Short-term decay rate - max 1.5
    1.0, // w[18]: Grade offset for short-term - max 1
    15.0, // w[19]: Retrievability factor - max 15
    2.0, // w[20]: Retrievability decay exponent - max 2
  ],
};

// ============================================================================
// Core Optimization Functions
// ============================================================================

/**
 * Compute retrievability (probability of recall) using FSRS v6 formula
 * R = (1 + factor * t / S) ^ -decay
 *
 * @param elapsedDays - Days since last review
 * @param stability - Current stability
 * @param w - FSRS parameters (needs w[19] and w[20])
 * @returns Probability of recall (0-1)
 */
export function computeRetrievability(elapsedDays: number, stability: number, w: number[]): number {
  if (stability <= 0 || elapsedDays < 0) return 0;

  const factor = w[19] ?? 9;
  const decay = w[20] ?? 1;

  return Math.pow(1 + (factor * elapsedDays) / stability, -decay);
}

/**
 * Compute Brier score for a set of reviews given parameters
 * Brier score = mean((predicted - actual)^2)
 * Lower is better (0 = perfect calibration)
 *
 * @param w - FSRS parameters to evaluate
 * @param reviews - Review history
 * @returns Brier score (0-1)
 */
export function computeBrierScore(w: number[], reviews: OptimizationReview[]): number {
  if (reviews.length === 0) return 1;

  let sumSquaredError = 0;
  let validReviews = 0;

  for (const review of reviews) {
    // Skip new cards (no retrievability to predict)
    if (review.state === FSRSState.New) continue;

    // Skip same-day reviews (short-term stability applies differently)
    if (review.elapsedDays < 1) continue;

    // Compute predicted probability of recall
    const predicted = computeRetrievability(review.elapsedDays, review.stability, w);

    // Actual outcome: 1 if success (rating >= 2), 0 if failure
    const actual = review.success ? 1 : 0;

    // Squared error
    sumSquaredError += Math.pow(predicted - actual, 2);
    validReviews++;
  }

  if (validReviews === 0) return 1;

  return sumSquaredError / validReviews;
}

/**
 * Compute gradient of Brier score with respect to parameters
 * Uses numerical differentiation (central difference)
 *
 * @param w - Current parameters
 * @param reviews - Review history
 * @param epsilon - Step size for numerical differentiation
 * @returns Gradient vector
 */
export function computeGradient(
  w: number[],
  reviews: OptimizationReview[],
  epsilon: number = 1e-5
): number[] {
  const gradient: number[] = new Array(w.length).fill(0);

  for (let i = 0; i < w.length; i++) {
    const wPlus = [...w];
    const wMinus = [...w];

    const currentVal = wPlus[i] ?? 0;
    wPlus[i] = currentVal + epsilon;
    wMinus[i] = currentVal - epsilon;

    // Central difference: (f(x+h) - f(x-h)) / 2h
    const fPlus = computeBrierScore(wPlus, reviews);
    const fMinus = computeBrierScore(wMinus, reviews);

    gradient[i] = (fPlus - fMinus) / (2 * epsilon);
  }

  return gradient;
}

/**
 * Project parameters onto bounds (box constraints)
 *
 * @param w - Parameters to project
 * @param bounds - Parameter bounds
 * @returns Projected parameters
 */
export function projectOntoBounds(w: number[], bounds: ParameterBounds): number[] {
  return w.map((val, i) => {
    const min = bounds.min[i] ?? -Infinity;
    const max = bounds.max[i] ?? Infinity;
    return Math.max(min, Math.min(max, val));
  });
}

/**
 * Compute dot product of two vectors
 */
function dot(a: number[], b: number[]): number {
  return a.reduce((sum, val, i) => sum + val * (b[i] ?? 0), 0);
}

/**
 * Vector subtraction
 */
function subtract(a: number[], b: number[]): number[] {
  return a.map((val, i) => val - (b[i] ?? 0));
}

/**
 * Vector addition
 */
function add(a: number[], b: number[]): number[] {
  return a.map((val, i) => val + (b[i] ?? 0));
}

/**
 * Scalar multiplication
 */
function scale(a: number[], s: number): number[] {
  return a.map((val) => val * s);
}

/**
 * Vector L2 norm
 */
function norm(a: number[]): number {
  return Math.sqrt(dot(a, a));
}

/**
 * L-BFGS optimization algorithm
 * Limited-memory BFGS for large-scale optimization
 *
 * @param objective - Function to minimize (returns [value, gradient])
 * @param x0 - Initial parameters
 * @param config - Optimization configuration
 * @param bounds - Parameter bounds
 * @returns Optimized parameters and metadata
 */
export function lbfgsOptimize(
  objective: (x: number[]) => { value: number; gradient: number[] },
  x0: number[],
  config: LBFGSConfig = DEFAULT_LBFGS_CONFIG,
  bounds?: ParameterBounds
): { params: number[]; value: number; iterations: number; converged: boolean } {
  const n = x0.length;
  let x = [...x0];

  // L-BFGS memory (stores s and y vectors)
  const s: number[][] = [];
  const y: number[][] = [];
  const rho: number[] = [];

  let { value, gradient } = objective(x);
  let iterations = 0;
  let converged = false;

  for (let iter = 0; iter < config.maxIterations; iter++) {
    iterations = iter + 1;

    // Check gradient convergence
    const gradNorm = norm(gradient);
    if (gradNorm < config.gradientTolerance) {
      converged = true;
      break;
    }

    // Compute search direction using L-BFGS two-loop recursion
    let q = [...gradient];
    const alpha: number[] = new Array(s.length).fill(0);

    // First loop (backward)
    for (let i = s.length - 1; i >= 0; i--) {
      const sVec = s[i];
      const yVec = y[i];
      const rhoVal = rho[i];
      if (!sVec || !yVec || rhoVal === undefined) continue;
      alpha[i] = rhoVal * dot(sVec, q);
      q = subtract(q, scale(yVec, alpha[i] ?? 0));
    }

    // Initial Hessian approximation (scaled identity)
    let gamma = 1;
    if (s.length > 0) {
      const lastIdx = s.length - 1;
      const lastS = s[lastIdx];
      const lastY = y[lastIdx];
      if (lastS && lastY) {
        const yDotY = dot(lastY, lastY);
        gamma = yDotY > 0 ? dot(lastS, lastY) / yDotY : 1;
      }
    }
    let r = scale(q, gamma);

    // Second loop (forward)
    for (let i = 0; i < s.length; i++) {
      const sVec = s[i];
      const yVec = y[i];
      const rhoVal = rho[i];
      if (!sVec || !yVec || rhoVal === undefined) continue;
      const beta = rhoVal * dot(yVec, r);
      r = add(r, scale(sVec, (alpha[i] ?? 0) - beta));
    }

    // Search direction (negative gradient direction)
    const direction = scale(r, -1);

    // Line search (backtracking with Armijo condition)
    let stepSize = 1.0;
    const dirGrad = dot(direction, gradient);

    for (let ls = 0; ls < config.lineSearchMaxIterations; ls++) {
      const xNew = add(x, scale(direction, stepSize));

      // Project onto bounds if specified
      const xProjected = bounds ? projectOntoBounds(xNew, bounds) : xNew;

      const { value: newValue } = objective(xProjected);

      // Armijo condition: f(x + α*d) <= f(x) + c1*α*∇f(x)·d
      if (newValue <= value + config.c1 * stepSize * dirGrad) {
        break;
      }

      stepSize *= 0.5;
    }

    // Update position
    const xOld = x;
    const gradOld = gradient;

    x = add(x, scale(direction, stepSize));
    if (bounds) {
      x = projectOntoBounds(x, bounds);
    }

    const result = objective(x);

    // Check function value convergence
    if (Math.abs(result.value - value) < config.functionTolerance) {
      converged = true;
      value = result.value;
      break;
    }

    gradient = result.gradient;
    value = result.value;

    // Update L-BFGS memory
    const sNew = subtract(x, xOld);
    const yNew = subtract(gradient, gradOld);
    const ys = dot(yNew, sNew);

    // Only update if curvature condition is satisfied
    if (ys > 1e-10) {
      if (s.length >= config.memorySize) {
        s.shift();
        y.shift();
        rho.shift();
      }
      s.push(sNew);
      y.push(yNew);
      rho.push(1 / ys);
    }
  }

  return { params: x, value, iterations, converged };
}

// ============================================================================
// Main Optimization API
// ============================================================================

/**
 * Shape of Prisma ReviewLog for optimization (algorithm-facing fields)
 */
export interface ReviewLogRow {
  rating: number;
  state: number;
  stability: number;
  difficulty: number;
  elapsedDays: number | null;
  wasCorrect: boolean;
  system?: string | null;
}

/**
 * Convert ReviewLog rows to OptimizationReview array
 * Use when optimizing from ReviewLog (MAIN/real sessions only)
 *
 * @param rows - ReviewLog rows from prisma.reviewLog.findMany()
 * @returns Optimization-ready review records
 */
export function convertReviewLogRows(rows: ReviewLogRow[]): OptimizationReview[] {
  return rows.map((r) => ({
    elapsedDays: r.elapsedDays ?? 0,
    stability: r.stability,
    difficulty: r.difficulty,
    rating: r.rating as Rating,
    state: r.state as FSRSState,
    success: r.rating >= 2 || r.wasCorrect,
    system: r.system ?? undefined,
  }));
}

/**
 * Convert ReviewSnapshot array to OptimizationReview array
 *
 * @param snapshots - Review snapshots from UserProgress.reviewHistory
 * @param systemCode - Optional system code for per-system analysis
 * @returns Optimization-ready review records
 */
export function convertSnapshots(
  snapshots: ReviewSnapshot[],
  systemCode?: string
): OptimizationReview[] {
  const reviews: OptimizationReview[] = [];

  for (let i = 1; i < snapshots.length; i++) {
    const prevIdx = i - 1;
    const prev = snapshots[prevIdx];
    const curr = snapshots[i];
    
    if (!prev || !curr) continue;

    const prevDate = new Date(prev.date);
    const currDate = new Date(curr.date);
    const elapsedDays = (currDate.getTime() - prevDate.getTime()) / 86400000;

    reviews.push({
      elapsedDays: Math.max(0, elapsedDays),
      stability: prev.stability,
      difficulty: prev.difficulty,
      rating: curr.rating,
      state: prev.state,
      success: curr.rating >= Rating.Hard, // Hard (2) or better is success
      system: systemCode,
    });
  }

  return reviews;
}

/**
 * Optimize FSRS parameters for a user based on their review history
 *
 * @param userId - User identifier
 * @param reviews - User's review history as OptimizationReview[]
 * @param config - Optional L-BFGS configuration
 * @returns Personalized FSRS parameters
 */
export function optimizeFSRSParameters(
  userId: string,
  reviews: OptimizationReview[],
  config: LBFGSConfig = DEFAULT_LBFGS_CONFIG
): PersonalizedFSRSParams {
  // Validate minimum sample size
  if (reviews.length < MIN_REVIEWS_FOR_OPTIMIZATION) {
    // Return default parameters with no optimization
    return {
      userId,
      w: [...defaultParameters.w],
      sampleSize: reviews.length,
      lastOptimizedAt: new Date(),
      improvementOverDefault: 0,
      brierScore: computeBrierScore(defaultParameters.w, reviews),
      defaultBrierScore: computeBrierScore(defaultParameters.w, reviews),
      iterations: 0,
      systemModifiers: undefined,
    };
  }

  // Compute Brier score with default parameters (baseline)
  const defaultBrierScore = computeBrierScore(defaultParameters.w, reviews);

  // Create objective function for L-BFGS
  const objective = (w: number[]) => {
    const value = computeBrierScore(w, reviews);
    const gradient = computeGradient(w, reviews);
    return { value, gradient };
  };

  // Run L-BFGS optimization
  const result = lbfgsOptimize(objective, [...defaultParameters.w], config, PARAMETER_BOUNDS);

  // Compute improvement
  const improvement =
    defaultBrierScore > 0 ? ((defaultBrierScore - result.value) / defaultBrierScore) * 100 : 0;

  return {
    userId,
    w: result.params,
    sampleSize: reviews.length,
    lastOptimizedAt: new Date(),
    improvementOverDefault: Math.max(0, improvement),
    brierScore: result.value,
    defaultBrierScore,
    iterations: result.iterations,
    systemModifiers: undefined,
  };
}

/**
 * Optimize parameters with per-system modifiers
 * Computes system-specific adjustments for stability and difficulty
 *
 * @param userId - User identifier
 * @param reviewsBySystem - Reviews grouped by organ system
 * @param baseParams - Base optimized parameters (from optimizeFSRSParameters)
 * @returns Parameters with system modifiers
 */
export function optimizeWithSystemModifiers(
  userId: string,
  reviewsBySystem: Record<string, OptimizationReview[]>,
  baseParams: PersonalizedFSRSParams
): PersonalizedFSRSParams {
  const systemModifiers: Record<string, SystemModifier> = {};

  for (const [system, systemReviews] of Object.entries(reviewsBySystem)) {
    // Skip systems with insufficient data
    if (systemReviews.length < MIN_REVIEWS_PER_SYSTEM) continue;

    // Compute system-specific metrics
    const successCount = systemReviews.filter((r) => r.success).length;
    const accuracy = successCount / systemReviews.length;

    // Compute average stability and difficulty for this system
    const avgStability =
      systemReviews.reduce((sum, r) => sum + r.stability, 0) / systemReviews.length;
    const avgDifficulty =
      systemReviews.reduce((sum, r) => sum + r.difficulty, 0) / systemReviews.length;

    // Compute Brier score for this system with base params
    const systemBrier = computeBrierScore(baseParams.w, systemReviews);
    const globalBrier = baseParams.brierScore;

    // Derive modifiers based on performance difference
    // If system has higher Brier (worse), reduce stability (shorter intervals)
    // If system has lower Brier (better), increase stability (longer intervals)
    const brierRatio = globalBrier > 0 ? systemBrier / globalBrier : 1;

    // Stability multiplier: inverse relationship with Brier ratio
    // Range: 0.7 to 1.3
    const stabilityMultiplier = Math.max(0.7, Math.min(1.3, 2 - brierRatio));

    // Difficulty offset based on accuracy vs global accuracy
    // Higher accuracy = negative offset (make it seem easier)
    // Lower accuracy = positive offset (make it seem harder)
    const globalAccuracy =
      baseParams.sampleSize > 0
        ? (reviewsBySystem[system]?.filter((r) => r.success).length ?? 0) / baseParams.sampleSize
        : 0.85;
    const difficultyOffset = (globalAccuracy - accuracy) * 2; // Scale factor of 2

    systemModifiers[system] = {
      stabilityMultiplier: Math.round(stabilityMultiplier * 1000) / 1000,
      difficultyOffset: Math.round(difficultyOffset * 1000) / 1000,
      sampleSize: systemReviews.length,
      accuracy: Math.round(accuracy * 1000) / 1000,
    };
  }

  return {
    ...baseParams,
    systemModifiers: Object.keys(systemModifiers).length > 0 ? systemModifiers : undefined,
  };
}

/**
 * Full optimization pipeline: optimize base parameters + per-system modifiers
 *
 * @param userId - User identifier
 * @param reviewHistory - User's complete review history
 * @param systemCodes - Optional map of review index to system code
 * @returns Fully optimized parameters
 */
export async function runFullOptimization(
  userId: string,
  reviewHistory: ReviewSnapshot[],
  systemCodes?: Record<number, string>
): Promise<PersonalizedFSRSParams> {
  // Convert snapshots to optimization format
  const allReviews = convertSnapshots(reviewHistory);

  // Assign system codes if provided
  if (systemCodes) {
    for (let i = 0; i < allReviews.length; i++) {
      if (systemCodes[i]) {
        allReviews[i].system = systemCodes[i];
      }
    }
  }

  // Step 1: Optimize base parameters on all reviews
  const baseParams = optimizeFSRSParameters(userId, allReviews);

  // Step 2: If we have system information, compute per-system modifiers
  if (systemCodes && Object.keys(systemCodes).length > 0) {
    const reviewsBySystem: Record<string, OptimizationReview[]> = {};

    for (const review of allReviews) {
      if (review.system) {
        if (!reviewsBySystem[review.system]) {
          reviewsBySystem[review.system] = [];
        }
        reviewsBySystem[review.system].push(review);
      }
    }

    return optimizeWithSystemModifiers(userId, reviewsBySystem, baseParams);
  }

  return baseParams;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Validate that parameters are within acceptable bounds
 */
export function validateParameters(w: number[]): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (w.length < 21) {
    errors.push(`Expected 21 parameters, got ${w.length}`);
  }

  for (let i = 0; i < Math.min(w.length, 21); i++) {
    const val = w[i];
    const min = PARAMETER_BOUNDS.min[i];
    const max = PARAMETER_BOUNDS.max[i];

    if (val < min || val > max) {
      errors.push(`w[${i}] = ${val} is outside bounds [${min}, ${max}]`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Compute expected retention for a card at a given interval
 * Useful for displaying to users
 */
export function getExpectedRetention(
  stability: number,
  interval: number,
  w: number[] = defaultParameters.w
): number {
  return computeRetrievability(interval, stability, w);
}

/**
 * Check if user has enough data for optimization
 */
export function canOptimize(reviewCount: number): {
  canOptimize: boolean;
  reviewsNeeded: number;
  message: string;
} {
  const reviewsNeeded = Math.max(0, MIN_REVIEWS_FOR_OPTIMIZATION - reviewCount);

  return {
    canOptimize: reviewCount >= MIN_REVIEWS_FOR_OPTIMIZATION,
    reviewsNeeded,
    message:
      reviewsNeeded > 0
        ? `${reviewsNeeded} more reviews needed for personalized optimization`
        : 'Ready for personalized optimization',
  };
}

/**
 * Generate a summary of optimization results
 */
export function summarizeOptimization(params: PersonalizedFSRSParams): string {
  const lines: string[] = [
    `FSRS Optimization Summary for User: ${params.userId}`,
    `─────────────────────────────────────`,
    `Sample Size: ${params.sampleSize} reviews`,
    `Optimized: ${params.lastOptimizedAt.toISOString()}`,
    `Iterations: ${params.iterations}`,
    ``,
    `Performance:`,
    `  Default Brier Score: ${params.defaultBrierScore.toFixed(4)}`,
    `  Optimized Brier Score: ${params.brierScore.toFixed(4)}`,
    `  Improvement: ${params.improvementOverDefault.toFixed(1)}%`,
  ];

  if (params.systemModifiers) {
    lines.push('', 'Per-System Modifiers:');
    for (const [system, mod] of Object.entries(params.systemModifiers)) {
      lines.push(
        `  ${system}: stability×${mod.stabilityMultiplier}, difficulty${mod.difficultyOffset >= 0 ? '+' : ''}${mod.difficultyOffset} (n=${mod.sampleSize}, acc=${(mod.accuracy * 100).toFixed(1)}%)`
      );
    }
  }

  return lines.join('\n');
}

// ============================================================================
// Export Type Guards
// ============================================================================

export function isPersonalizedFSRSParams(obj: unknown): obj is PersonalizedFSRSParams {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'userId' in obj &&
    'w' in obj &&
    Array.isArray((obj as PersonalizedFSRSParams).w) &&
    (obj as PersonalizedFSRSParams).w.length >= 19
  );
}
