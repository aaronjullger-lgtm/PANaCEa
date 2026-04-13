/**
 * FIRe (Factored Item Response) Implicit Review Compression Service
 *
 * When a student reviews a high-level concept (e.g., "CHF Treatment"),
 * this service propagates partial credit to prerequisite nodes in the
 * knowledge graph (e.g., "Cardiac Physiology", "Hemodynamics",
 * "Diuretic Pharmacology").
 *
 * This reduces total review load by crediting related concepts that
 * are implicitly exercised during a review of a more complex topic.
 *
 * Credit rules:
 *   - Credit = parent_grade × edge_weight × decay_factor
 *   - Only SEMANTIC prerequisite edges carry credit
 *   - Maximum 2 hops of propagation (no infinite chains)
 *   - Penalty path: failing a child node penalizes parent stability
 *
 * Research basis:
 *   - Pavlik & Anderson (2005): FIRe model of memory strength
 *   - Knowledge Component Models in ITS literature
 *   - Yudelson et al. (2013): Bayesian Knowledge Tracing
 *
 * Architecture:
 *   Pure computation — operates on graph edges and grades.
 *   Caller provides prerequisite edges and handles FSRS stability updates.
 *
 * Sprint 25 — FIRe implicit review compression
 * @module lib/services/fireCompressionService
 */

// ─── Types ──────────────────────────────────────────────────────────────

/** A prerequisite edge in the knowledge graph */
export interface PrerequisiteEdge {
  /** Source node (prerequisite/child concept) */
  sourceId: string;
  /** Target node (dependent/parent concept) */
  targetId: string;
  /** Edge weight (0-1): how strongly the prerequisite supports the parent */
  weight: number;
  /** Edge type — only SEMANTIC edges carry credit */
  type: 'SEMANTIC' | 'TEMPORAL' | 'HIERARCHICAL' | 'CROSS_SYSTEM';
}

/** Result of a review that should be propagated */
export interface ReviewResult {
  /** The concept that was directly reviewed */
  conceptId: string;
  /** Review grade (0 = Again, 1 = Good) */
  grade: number;
  /** Current stability of the reviewed concept */
  stability: number;
}

/** A stability adjustment to apply to a related concept */
export interface StabilityCredit {
  /** The concept receiving credit */
  conceptId: string;
  /** The credit amount as a stability multiplier (e.g., 1.05 = 5% stability boost) */
  stabilityMultiplier: number;
  /** How the credit was computed */
  reason: string;
  /** Hop distance from the reviewed concept */
  hopDistance: number;
}

/** Configuration for FIRe compression */
export interface FIReConfig {
  /** Maximum hops to propagate credit */
  maxHops: number;
  /** Decay factor per hop (credit reduces each hop) */
  hopDecay: number;
  /** Minimum credit to propagate (below this, skip) */
  minCredit: number;
  /** Maximum stability multiplier for a single credit event */
  maxMultiplier: number;
  /** Penalty multiplier when parent fails (applied to child stability) */
  failurePenaltyRate: number;
  /** Only propagate along these edge types */
  eligibleEdgeTypes: Set<PrerequisiteEdge['type']>;
}

export const DEFAULT_FIRE_CONFIG: FIReConfig = {
  maxHops: 2,
  hopDecay: 0.5,    // second hop gets 50% of first hop's credit
  minCredit: 0.01,
  maxMultiplier: 1.25, // max 25% stability boost per event
  failurePenaltyRate: 0.05, // 5% stability penalty for failing a child
  eligibleEdgeTypes: new Set(['SEMANTIC']),
};

// ─── Core Algorithm ─────────────────────────────────────────────────────

/**
 * Compute stability credits to propagate after a review.
 *
 * For a successful review (grade = 1):
 *   - Find all prerequisite edges where the reviewed concept is the TARGET
 *   - Propagate credit DOWN to sources (prerequisites): "reviewing CHF
 *     implicitly reviews cardiac physiology"
 *
 * For a failed review (grade = 0):
 *   - Find all edges where the reviewed concept is the SOURCE
 *   - Propagate PENALTY UP to targets (dependents): "forgetting physiology
 *     weakens CHF treatment knowledge"
 *
 * @param review The review result to propagate
 * @param edges All prerequisite edges in the graph
 * @param config FIRe configuration
 * @returns Array of stability credits to apply
 */
export function computeCredits(
  review: ReviewResult,
  edges: PrerequisiteEdge[],
  config: FIReConfig = DEFAULT_FIRE_CONFIG
): StabilityCredit[] {
  const credits: StabilityCredit[] = [];

  if (review.grade > 0) {
    // Success: propagate credit to prerequisites (children)
    propagateSuccess(
      review.conceptId,
      review.grade,
      edges,
      config,
      1,       // first hop
      credits,
      new Set() // visited nodes to prevent cycles
    );
  } else {
    // Failure: propagate penalty to dependents (parents)
    propagateFailure(
      review.conceptId,
      edges,
      config,
      credits,
      new Set()
    );
  }

  return credits;
}

/**
 * Propagate success credit DOWN the prerequisite graph.
 */
function propagateSuccess(
  conceptId: string,
  grade: number,
  edges: PrerequisiteEdge[],
  config: FIReConfig,
  hop: number,
  credits: StabilityCredit[],
  visited: Set<string>
): void {
  if (hop > config.maxHops) return;
  if (visited.has(conceptId)) return;
  visited.add(conceptId);

  // Find edges where this concept is the TARGET → its prerequisites are SOURCEs
  const prereqEdges = edges.filter(
    (e) => e.targetId === conceptId && config.eligibleEdgeTypes.has(e.type)
  );

  for (const edge of prereqEdges) {
    if (visited.has(edge.sourceId)) continue;

    // Credit = grade × edge_weight × hop_decay^(hop-1)
    const rawCredit = grade * edge.weight * Math.pow(config.hopDecay, hop - 1);

    if (rawCredit < config.minCredit) continue;

    // Convert credit to stability multiplier: 1.0 + credit * scaling
    // A full credit of 1.0 maps to config.maxMultiplier
    const multiplier = 1.0 + rawCredit * (config.maxMultiplier - 1.0);
    const clampedMultiplier = Math.min(multiplier, config.maxMultiplier);

    credits.push({
      conceptId: edge.sourceId,
      stabilityMultiplier: Math.round(clampedMultiplier * 1000) / 1000,
      reason: `Implicit review via ${conceptId} (hop ${hop}, edge weight ${edge.weight})`,
      hopDistance: hop,
    });

    // Recurse to next hop
    propagateSuccess(
      edge.sourceId,
      grade,
      edges,
      config,
      hop + 1,
      credits,
      visited
    );
  }
}

/**
 * Propagate failure penalty UP the dependency graph.
 * If you forget a prerequisite, dependent concepts become less reliable.
 */
function propagateFailure(
  conceptId: string,
  edges: PrerequisiteEdge[],
  config: FIReConfig,
  credits: StabilityCredit[],
  visited: Set<string>
): void {
  if (visited.has(conceptId)) return;
  visited.add(conceptId);

  // Find edges where this concept is the SOURCE → its dependents are TARGETs
  const dependentEdges = edges.filter(
    (e) => e.sourceId === conceptId && config.eligibleEdgeTypes.has(e.type)
  );

  for (const edge of dependentEdges) {
    if (visited.has(edge.targetId)) continue;

    // Penalty = 1.0 - (failurePenaltyRate × edge_weight)
    const penalty = 1.0 - (config.failurePenaltyRate * edge.weight);
    const clampedPenalty = Math.max(0.8, penalty); // never penalize more than 20%

    credits.push({
      conceptId: edge.targetId,
      stabilityMultiplier: Math.round(clampedPenalty * 1000) / 1000,
      reason: `Failure penalty from ${conceptId} (edge weight ${edge.weight})`,
      hopDistance: 1,
    });

    // Don't recurse penalties — only 1 hop for penalties to avoid cascade
  }
}

// ─── Batch Processing ───────────────────────────────────────────────────

/**
 * Compute credits for multiple reviews in a session.
 * Merges credits to the same concept (multiplicative).
 */
export function batchComputeCredits(
  reviews: ReviewResult[],
  edges: PrerequisiteEdge[],
  config: FIReConfig = DEFAULT_FIRE_CONFIG
): StabilityCredit[] {
  // Compute all individual credits
  const allCredits: StabilityCredit[] = [];
  for (const review of reviews) {
    allCredits.push(...computeCredits(review, edges, config));
  }

  // Merge credits to the same concept (multiply multipliers)
  const mergedMap = new Map<string, StabilityCredit>();
  for (const credit of allCredits) {
    const existing = mergedMap.get(credit.conceptId);
    if (existing) {
      // Multiply multipliers, keep closest hop
      existing.stabilityMultiplier = Math.round(
        Math.min(
          existing.stabilityMultiplier * credit.stabilityMultiplier,
          config.maxMultiplier
        ) * 1000
      ) / 1000;
      existing.hopDistance = Math.min(existing.hopDistance, credit.hopDistance);
      existing.reason += `; ${credit.reason}`;
    } else {
      mergedMap.set(credit.conceptId, { ...credit });
    }
  }

  return [...mergedMap.values()];
}

/**
 * Estimate the review load reduction from FIRe compression.
 * Returns the fraction of implicit reviews relative to explicit ones.
 */
export function estimateCompression(
  explicitReviewCount: number,
  credits: StabilityCredit[]
): { implicitReviews: number; compressionRatio: number } {
  // Count credits that are meaningful (multiplier > 1.01 for boosts)
  const meaningfulCredits = credits.filter((c) => c.stabilityMultiplier > 1.01);
  const implicitReviews = meaningfulCredits.length;
  const total = explicitReviewCount + implicitReviews;
  const compressionRatio = total > 0 ? implicitReviews / total : 0;

  return {
    implicitReviews,
    compressionRatio: Math.round(compressionRatio * 100) / 100,
  };
}
