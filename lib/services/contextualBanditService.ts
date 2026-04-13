/**
 * Contextual Bandit Service — LinUCB for Item Selection
 *
 * Implements the LinUCB (Li et al., 2010) disjoint model for question selection.
 * Instead of selecting questions purely by overdue ratio or blueprint weight,
 * the bandit optimizes for cumulative learning by balancing:
 *
 *   - Exploitation: questions predicted to yield high learning gain
 *   - Exploration: uncertain questions that might reveal better learning paths
 *
 * Architecture:
 *   - Context vector: [topicMastery, overdueRatio, difficulty, systemWeakness,
 *     blueprintWeight, timeSinceLastReview, sessionPosition]
 *   - Arms: candidate questions from the qualified pool
 *   - Reward: binary correct(1)/incorrect(0) + learning-progress bonus
 *   - Parameters: stored per-system (not per-question) to handle cold start
 *
 * Integration:
 *   Called after conceptQuestionSelector assembles the candidate pool.
 *   Re-ranks candidates by UCB score rather than simple overdue ordering.
 *
 * Edge runtime compatible — no heavy ML dependencies, pure linear algebra.
 *
 * @module lib/services/contextualBanditService
 */

// ─── Types ──────────────────────────────────────────────────────────────────

/** Dimensionality of the context feature vector */
export const CONTEXT_DIM = 7;

/** Features describing the user×question context at selection time */
export interface BanditContext {
  /** Normalized mastery in this question's topic (0=new, 1=mastered) */
  topicMastery: number;
  /** How overdue this review is (0=not due, 1+=overdue by N intervals) */
  overdueRatio: number;
  /** Question difficulty normalized to [0,1] (from 1-5 scale) */
  difficulty: number;
  /** How weak the user is in this question's system (0=strong, 1=weakest) */
  systemWeakness: number;
  /** Blueprint weight for this system (0-1, typically 0.03-0.20) */
  blueprintWeight: number;
  /** Days since last review of this specific item, capped at 1.0 */
  timeSinceLastReview: number;
  /** Position in session normalized to [0,1] (0=start, 1=end) */
  sessionPosition: number;
}

/** A candidate question with metadata needed for bandit scoring */
export interface BanditArm {
  questionId: string;
  system: string;
  context: BanditContext;
}

/** LinUCB parameters for one arm group (per-system in our case) */
export interface ArmParameters {
  /** A matrix (d×d) — accumulated outer products of context vectors */
  A: number[][];
  /** b vector (d×1) — accumulated context × reward products */
  b: number[];
  /** Number of times this arm group has been pulled */
  pullCount: number;
}

/** Result of bandit scoring for one candidate */
export interface ScoredArm {
  questionId: string;
  system: string;
  /** Expected reward (exploitation component) */
  expectedReward: number;
  /** Uncertainty bonus (exploration component) */
  explorationBonus: number;
  /** Total UCB score = expectedReward + alpha * explorationBonus */
  ucbScore: number;
}

/** Reward signal after the student answers */
export interface BanditReward {
  questionId: string;
  system: string;
  context: BanditContext;
  /** Binary: 1 = correct, 0 = incorrect */
  correct: number;
  /** Optional learning-progress bonus (ΔP(correct) for this topic) */
  learningProgressBonus?: number;
}

/** Serialized state for persistence (Prisma Json field or KV) */
export interface BanditState {
  /** Per-system arm parameters */
  armParams: Record<string, ArmParameters>;
  /** Total selections made */
  totalSelections: number;
  /** Cumulative reward */
  cumulativeReward: number;
  /** Last updated timestamp */
  updatedAt: string;
}

/** Configuration for the bandit */
export interface BanditConfig {
  /** Exploration parameter (higher = more exploration). Default: 0.5 */
  alpha: number;
  /** Minimum pulls before arm params are trusted. Default: 10 */
  coldStartThreshold: number;
  /** Fraction of selections that should be pure random (ε-greedy fallback). Default: 0.05 */
  epsilonFloor: number;
  /** Maximum number of candidates to score (performance bound). Default: 100 */
  maxCandidates: number;
}

export const DEFAULT_BANDIT_CONFIG: BanditConfig = {
  alpha: 0.5,
  coldStartThreshold: 10,
  epsilonFloor: 0.05,
  maxCandidates: 100,
};

// ─── Linear Algebra Helpers (no dependencies) ───────────────────────────────

/** Create a d×d identity matrix */
export function identityMatrix(d: number): number[][] {
  const M: number[][] = [];
  for (let i = 0; i < d; i++) {
    M[i] = new Array(d).fill(0);
    M[i]![i] = 1;
  }
  return M;
}

/** Create a zero vector of length d */
export function zeroVector(d: number): number[] {
  return new Array(d).fill(0);
}

/** Matrix-vector multiply: A (d×d) × x (d×1) → result (d×1) */
export function matVecMul(A: number[][], x: number[]): number[] {
  const d = x.length;
  const result = new Array(d).fill(0);
  for (let i = 0; i < d; i++) {
    let sum = 0;
    const row = A[i]!;
    for (let j = 0; j < d; j++) {
      sum += row[j]! * x[j]!;
    }
    result[i] = sum;
  }
  return result;
}

/** Dot product of two vectors */
export function dotProduct(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i]! * b[i]!;
  }
  return sum;
}

/** Add outer product x·xᵀ to matrix A (in-place) */
export function addOuterProduct(A: number[][], x: number[]): void {
  const d = x.length;
  for (let i = 0; i < d; i++) {
    for (let j = 0; j < d; j++) {
      A[i]![j]! += x[i]! * x[j]!;
    }
  }
}

/** Add scaled vector to b (in-place): b += scale * x */
export function addScaledVector(b: number[], x: number[], scale: number): void {
  for (let i = 0; i < b.length; i++) {
    b[i]! += scale * x[i]!;
  }
}

/**
 * Solve A·x = b via Cholesky decomposition.
 * Falls back to regularized solve if A is near-singular.
 * Returns x = A⁻¹·b
 */
export function solveLinearSystem(A: number[][], b: number[]): number[] {
  const d = b.length;

  // Add small regularization for numerical stability
  const reg = 1e-6;
  const Areg: number[][] = A.map((row, i) =>
    row.map((val, j) => val + (i === j ? reg : 0))
  );

  // Cholesky decomposition: Areg = L·Lᵀ
  const L: number[][] = Array.from({ length: d }, () => new Array(d).fill(0));

  for (let i = 0; i < d; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = 0;
      for (let k = 0; k < j; k++) {
        sum += L[i]![k]! * L[j]![k]!;
      }
      if (i === j) {
        const diag = Areg[i]![i]! - sum;
        // If diagonal is non-positive, matrix isn't positive definite
        // Fall back to diagonal solve
        if (diag <= 0) {
          return diagonalSolve(A, b);
        }
        L[i]![j] = Math.sqrt(diag);
      } else {
        L[i]![j] = (Areg[i]![j]! - sum) / L[j]![j]!;
      }
    }
  }

  // Forward substitution: L·y = b
  const y = new Array(d).fill(0);
  for (let i = 0; i < d; i++) {
    let sum = 0;
    for (let j = 0; j < i; j++) {
      sum += L[i]![j]! * y[j]!;
    }
    y[i] = (b[i]! - sum) / L[i]![i]!;
  }

  // Back substitution: Lᵀ·x = y
  const x = new Array(d).fill(0);
  for (let i = d - 1; i >= 0; i--) {
    let sum = 0;
    for (let j = i + 1; j < d; j++) {
      sum += L[j]![i]! * x[j]!;
    }
    x[i] = (y[i]! - sum) / L[i]![i]!;
  }

  return x;
}

/** Fallback diagonal solve when Cholesky fails */
function diagonalSolve(A: number[][], b: number[]): number[] {
  const d = b.length;
  const x = new Array(d).fill(0);
  for (let i = 0; i < d; i++) {
    const diag = A[i]![i]!;
    x[i] = diag > 1e-10 ? b[i]! / diag : 0;
  }
  return x;
}

/**
 * Compute xᵀ·A⁻¹·x (the uncertainty term in LinUCB).
 * Uses the same Cholesky solver.
 */
export function quadraticForm(A: number[][], x: number[]): number {
  const Ainv_x = solveLinearSystem(A, x);
  return Math.max(0, dotProduct(x, Ainv_x));
}

// ─── Context Vector Construction ────────────────────────────────────────────

/** Convert BanditContext to a normalized feature vector */
export function contextToVector(ctx: BanditContext): number[] {
  return [
    clamp01(ctx.topicMastery),
    clamp01(Math.min(ctx.overdueRatio, 3.0) / 3.0), // cap at 3× overdue
    clamp01(ctx.difficulty),
    clamp01(ctx.systemWeakness),
    clamp01(Math.min(ctx.blueprintWeight * 5, 1.0)), // scale up (typical 0.03-0.20)
    clamp01(ctx.timeSinceLastReview),
    clamp01(ctx.sessionPosition),
  ];
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

// ─── Core LinUCB Algorithm ──────────────────────────────────────────────────

/** Initialize fresh arm parameters */
export function initArmParams(): ArmParameters {
  return {
    A: identityMatrix(CONTEXT_DIM),
    b: zeroVector(CONTEXT_DIM),
    pullCount: 0,
  };
}

/** Initialize empty bandit state */
export function initBanditState(): BanditState {
  return {
    armParams: {},
    totalSelections: 0,
    cumulativeReward: 0,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Score a single arm given its context and parameters.
 *
 * UCB = θ̂ᵀx + α√(xᵀA⁻¹x)
 *
 * where θ̂ = A⁻¹b is the ridge regression estimate of the reward model.
 */
export function scoreArm(
  arm: BanditArm,
  params: ArmParameters,
  alpha: number
): ScoredArm {
  const x = contextToVector(arm.context);

  // θ̂ = A⁻¹b — estimated reward weights
  const theta = solveLinearSystem(params.A, params.b);

  // Expected reward = θ̂ᵀx
  const expectedReward = dotProduct(theta, x);

  // Exploration bonus = √(xᵀA⁻¹x)
  const explorationBonus = Math.sqrt(quadraticForm(params.A, x));

  // UCB = expected + α × exploration
  const ucbScore = expectedReward + alpha * explorationBonus;

  return {
    questionId: arm.questionId,
    system: arm.system,
    expectedReward,
    explorationBonus,
    ucbScore,
  };
}

/**
 * Score and rank all candidate arms. Returns sorted by UCB score (descending).
 *
 * Handles cold start: if an arm's system has < coldStartThreshold pulls,
 * it gets a bonus to encourage exploration of unseen systems.
 */
export function rankCandidates(
  candidates: BanditArm[],
  state: BanditState,
  config: BanditConfig = DEFAULT_BANDIT_CONFIG
): ScoredArm[] {
  const { alpha, coldStartThreshold, epsilonFloor, maxCandidates } = config;

  // Limit candidates for performance
  const pool = candidates.length > maxCandidates
    ? candidates.slice(0, maxCandidates)
    : candidates;

  const scored: ScoredArm[] = pool.map((arm) => {
    const params = state.armParams[arm.system] ?? initArmParams();

    // Cold start bonus: unseen systems get extra exploration
    const coldStartBonus = params.pullCount < coldStartThreshold
      ? alpha * (1 - params.pullCount / coldStartThreshold)
      : 0;

    const base = scoreArm(arm, params, alpha);

    return {
      ...base,
      explorationBonus: base.explorationBonus + coldStartBonus,
      ucbScore: base.ucbScore + coldStartBonus,
    };
  });

  // ε-greedy floor: randomly promote a fraction of arms to the top
  // Uses a separate promotions set to avoid mutating scores during iteration
  if (epsilonFloor > 0 && scored.length > 0) {
    const promotedIndices = new Set<number>();
    const numRandom = Math.max(1, Math.floor(scored.length * epsilonFloor));
    for (let i = 0; i < numRandom; i++) {
      const randomIdx = Math.floor(deterministicRandom(
        state.totalSelections + i
      ) * scored.length);
      if (randomIdx < scored.length) {
        promotedIndices.add(randomIdx);
      }
    }
    // Find the max UCB score, then set promoted arms above it
    const maxScore = scored.reduce((m, s) => Math.max(m, s.ucbScore), -Infinity);
    for (const idx of promotedIndices) {
      const arm = scored[idx];
      if (arm) {
        arm.ucbScore = maxScore + 1 + idx * 0.001; // deterministic tie-breaking
      }
    }
  }

  // Sort by UCB score descending
  scored.sort((a, b) => b.ucbScore - a.ucbScore);

  return scored;
}

/**
 * Select the top-N questions from candidates using LinUCB ranking.
 * Returns question IDs in optimal order.
 */
export function selectQuestions(
  candidates: BanditArm[],
  state: BanditState,
  count: number,
  config: BanditConfig = DEFAULT_BANDIT_CONFIG
): ScoredArm[] {
  const ranked = rankCandidates(candidates, state, config);
  return ranked.slice(0, count);
}

// ─── Parameter Updates ──────────────────────────────────────────────────────

/**
 * Update arm parameters after observing a reward.
 * This is the LinUCB parameter update step:
 *   A ← A + x·xᵀ
 *   b ← b + r·x
 *
 * Returns new state (does not mutate input).
 */
export function updateBanditState(
  state: BanditState,
  reward: BanditReward
): BanditState {
  const system = reward.system;
  const x = contextToVector(reward.context);

  // Get or init arm params for this system
  const existing = state.armParams[system] ?? initArmParams();

  // Deep copy A and b
  const newA = existing.A.map((row) => [...row]);
  const newB = [...existing.b];

  // Compute total reward (correct + optional learning progress bonus)
  const totalReward = reward.correct + (reward.learningProgressBonus ?? 0);

  // A ← A + x·xᵀ
  addOuterProduct(newA, x);

  // b ← b + r·x
  addScaledVector(newB, x, totalReward);

  return {
    armParams: {
      ...state.armParams,
      [system]: {
        A: newA,
        b: newB,
        pullCount: existing.pullCount + 1,
      },
    },
    totalSelections: state.totalSelections + 1,
    cumulativeReward: state.cumulativeReward + totalReward,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Batch update from multiple rewards (e.g., end-of-session).
 * Applies updates sequentially to maintain consistency.
 */
export function batchUpdateBanditState(
  state: BanditState,
  rewards: BanditReward[]
): BanditState {
  let current = state;
  for (const reward of rewards) {
    current = updateBanditState(current, reward);
  }
  return current;
}

// ─── Convenience: Build BanditArm from Question Metadata ────────────────────

export interface QuestionMetadata {
  questionId: string;
  system: string | null;
  difficulty: string | null;
  topic: string | null;
  /** From UserProgress or conceptMastery */
  topicMastery?: number;
  /** From FSRS: days overdue / interval */
  overdueRatio?: number;
  /** User's weakness score for this system (from strengthProfile) */
  systemWeakness?: number;
  /** Blueprint weight for this system */
  blueprintWeight?: number;
  /** Days since last review */
  daysSinceReview?: number;
  /** Current position in session (0-based index) */
  sessionIndex?: number;
  /** Total session size */
  sessionSize?: number;
}

/**
 * Build a BanditArm from question metadata + user context.
 * Fills missing values with reasonable defaults for cold start.
 */
export function buildBanditArm(meta: QuestionMetadata): BanditArm {
  const difficulty = parseDifficulty(meta.difficulty);

  return {
    questionId: meta.questionId,
    system: meta.system ?? 'Unknown',
    context: {
      topicMastery: meta.topicMastery ?? 0.5,
      overdueRatio: meta.overdueRatio ?? 0.0,
      difficulty,
      systemWeakness: meta.systemWeakness ?? 0.5,
      blueprintWeight: meta.blueprintWeight ?? 0.08,
      timeSinceLastReview: Math.min((meta.daysSinceReview ?? 7) / 30, 1.0),
      sessionPosition: meta.sessionSize
        ? (meta.sessionIndex ?? 0) / Math.max(1, meta.sessionSize - 1)
        : 0,
    },
  };
}

/** Parse difficulty string (1-5) to [0,1] range */
function parseDifficulty(d: string | null | undefined): number {
  if (!d) return 0.5;
  const num = parseInt(d, 10);
  if (isNaN(num)) return 0.5;
  return clamp01((num - 1) / 4); // 1→0, 3→0.5, 5→1
}

// ─── Diagnostics ────────────────────────────────────────────────────────────

/** Get summary statistics for a bandit state */
export function getBanditDiagnostics(state: BanditState): {
  totalSelections: number;
  cumulativeReward: number;
  avgReward: number;
  systemStats: Record<string, { pulls: number; avgRewardEstimate: number }>;
} {
  const systemStats: Record<string, { pulls: number; avgRewardEstimate: number }> = {};

  for (const [system, params] of Object.entries(state.armParams)) {
    const theta = params.pullCount > 0
      ? solveLinearSystem(params.A, params.b)
      : zeroVector(CONTEXT_DIM);

    // Average of theta components gives rough reward estimate
    const avgTheta = theta.reduce((s, v) => s + v, 0) / CONTEXT_DIM;

    systemStats[system] = {
      pulls: params.pullCount,
      avgRewardEstimate: Math.round(avgTheta * 1000) / 1000,
    };
  }

  return {
    totalSelections: state.totalSelections,
    cumulativeReward: state.cumulativeReward,
    avgReward: state.totalSelections > 0
      ? Math.round((state.cumulativeReward / state.totalSelections) * 1000) / 1000
      : 0,
    systemStats,
  };
}

// ─── Deterministic PRNG (for reproducible ε-greedy) ─────────────────────────

/**
 * Simple deterministic hash-based random for ε-greedy.
 * Not cryptographically secure — just needs to be reproducible and uniform-ish.
 */
function deterministicRandom(seed: number): number {
  let x = seed + 1;
  x = ((x >> 16) ^ x) * 0x45d9f3b;
  x = ((x >> 16) ^ x) * 0x45d9f3b;
  x = (x >> 16) ^ x;
  return (Math.abs(x) % 10000) / 10000;
}
