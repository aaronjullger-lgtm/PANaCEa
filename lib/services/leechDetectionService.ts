/**
 * Leech Detection Service — Tier 3 Experimental Feature
 *
 * Identifies "leech cards" — items that consume disproportionate review time
 * without achieving stable long-term retention. These cards benefit from
 * alternative encoding strategies like visual mnemonics (dual coding theory).
 *
 * Leech identification uses FSRS state variables rather than Anki's simple
 * lapse-count heuristic:
 *   - High difficulty (D approaching 10)
 *   - Low stability despite multiple reviews (S failing to grow)
 *   - Repeated lapses resetting stability via post-lapse formula
 *   - High review count relative to stability achieved
 *
 * Research basis:
 *   - Anki leech detection: 8 lapses threshold (configurable)
 *   - FSRS v6 post-lapse: S'_f = w11 × D^(−w12) × ((S+1)^w13 − 1) × e^(w14×(1−R))
 *   - Paivio (1986): Dual coding theory — visual + verbal encoding
 *   - Meenu et al. (2022): Mnemonic students scored 8.4 vs 4.8 controls
 *
 * @module lib/services/leechDetectionService
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type LeechSeverity = 'none' | 'emerging' | 'leech' | 'severe_leech';

export interface LeechAssessment {
  /** Whether this card qualifies as a leech */
  isLeech: boolean;
  /** Severity classification */
  severity: LeechSeverity;
  /** Composite leech score [0, 1] */
  leechScore: number;
  /** Whether a visual mnemonic is recommended */
  mnemonicRecommended: boolean;
  /** Individual signal contributions */
  signals: LeechSignals;
  /** Human-readable reason for the classification */
  reason: string;
}

export interface LeechSignals {
  /** Normalized lapse rate (lapses / reviews) [0, 1] */
  lapseRate: number;
  /** Normalized difficulty signal [0, 1] */
  difficultySignal: number;
  /** Normalized stability stagnation [0, 1] */
  stabilityStagnation: number;
  /** Normalized review inefficiency (many reviews, low stability) [0, 1] */
  reviewInefficiency: number;
}

export interface CardFsrsState {
  /** Card difficulty D ∈ [1, 10] */
  difficulty: number;
  /** Card stability S in days */
  stability: number;
  /** Total number of reviews */
  reviewCount: number;
  /** Number of lapses (failures after initial learning) */
  lapseCount: number;
  /** Current retrievability R ∈ [0, 1] */
  retrievability: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** Minimum reviews before leech detection is meaningful */
export const MIN_REVIEWS_FOR_DETECTION = 5;

/** Weights for composite leech score */
export const LEECH_WEIGHTS = {
  lapseRate: 0.35,
  difficultySignal: 0.25,
  stabilityStagnation: 0.25,
  reviewInefficiency: 0.15,
} as const;

/** Leech severity thresholds */
export const LEECH_THRESHOLDS = {
  emerging: 0.40,
  leech: 0.60,
  severe: 0.80,
} as const;

/** Stability floor: if S is below this after MIN_REVIEWS, it's stagnating */
export const STABILITY_FLOOR_DAYS = 3;

/** Expected stability growth per review (ideal: S grows ~2x per successful review) */
export const EXPECTED_STABILITY_PER_REVIEW = 2.0;

// ─── Signal Computation ──────────────────────────────────────────────────────

/**
 * Compute the normalized lapse rate signal.
 * High lapses relative to reviews → closer to 1.0.
 */
export function computeLapseRate(lapseCount: number, reviewCount: number): number {
  if (reviewCount < MIN_REVIEWS_FOR_DETECTION) return 0;
  const rate = lapseCount / reviewCount;
  // Normalize: 50%+ lapse rate → signal = 1.0
  return clamp01(rate / 0.50);
}

/**
 * Compute the normalized difficulty signal.
 * D ∈ [1, 10], high difficulty → closer to 1.0.
 */
export function computeDifficultySignal(difficulty: number): number {
  // Normalize from [1, 10] to [0, 1], with emphasis on high difficulty
  return clamp01((difficulty - 1) / 9);
}

/**
 * Compute stability stagnation signal.
 * Many reviews but stability still low → closer to 1.0.
 */
export function computeStabilityStagnation(
  stability: number,
  reviewCount: number
): number {
  if (reviewCount < MIN_REVIEWS_FOR_DETECTION) return 0;

  // Expected stability after N reviews (rough heuristic)
  const expectedStability = EXPECTED_STABILITY_PER_REVIEW * reviewCount;
  if (expectedStability <= 0) return 0;

  const ratio = stability / expectedStability;
  // ratio < 1 means underperforming; invert so low ratio → high signal
  return clamp01(1 - ratio);
}

/**
 * Compute review inefficiency signal.
 * High review count with low stability = wasted effort.
 */
export function computeReviewInefficiency(
  stability: number,
  reviewCount: number,
  lapseCount: number
): number {
  if (reviewCount < MIN_REVIEWS_FOR_DETECTION) return 0;

  // Stability-per-review ratio
  const stabilityPerReview = stability / reviewCount;
  // If each review is only yielding <1 day of stability, that's very inefficient
  const efficiency = stabilityPerReview / EXPECTED_STABILITY_PER_REVIEW;

  // Factor in lapse rate for compound inefficiency
  const lapseMultiplier = 1 + (lapseCount / reviewCount);

  return clamp01((1 - efficiency) * lapseMultiplier * 0.5);
}

// ─── Composite Assessment ────────────────────────────────────────────────────

/**
 * Assess whether a card is a leech and whether it needs a visual mnemonic.
 *
 * @param state - FSRS state for the card
 * @returns Complete leech assessment with score, severity, and recommendation
 */
export function assessLeech(state: CardFsrsState): LeechAssessment {
  const NO_LEECH: LeechAssessment = {
    isLeech: false,
    severity: 'none',
    leechScore: 0,
    mnemonicRecommended: false,
    signals: { lapseRate: 0, difficultySignal: 0, stabilityStagnation: 0, reviewInefficiency: 0 },
    reason: 'Insufficient review history for leech detection',
  };

  if (state.reviewCount < MIN_REVIEWS_FOR_DETECTION) return NO_LEECH;

  const signals: LeechSignals = {
    lapseRate: computeLapseRate(state.lapseCount, state.reviewCount),
    difficultySignal: computeDifficultySignal(state.difficulty),
    stabilityStagnation: computeStabilityStagnation(state.stability, state.reviewCount),
    reviewInefficiency: computeReviewInefficiency(state.stability, state.reviewCount, state.lapseCount),
  };

  const leechScore = clamp01(
    LEECH_WEIGHTS.lapseRate * signals.lapseRate +
    LEECH_WEIGHTS.difficultySignal * signals.difficultySignal +
    LEECH_WEIGHTS.stabilityStagnation * signals.stabilityStagnation +
    LEECH_WEIGHTS.reviewInefficiency * signals.reviewInefficiency
  );

  const severity = classifyLeechSeverity(leechScore);
  const isLeech = severity === 'leech' || severity === 'severe_leech';

  return {
    isLeech,
    severity,
    leechScore,
    mnemonicRecommended: isLeech || severity === 'emerging',
    signals,
    reason: getLeechReason(severity, signals),
  };
}

/**
 * Classify leech severity from composite score.
 */
export function classifyLeechSeverity(score: number): LeechSeverity {
  if (score >= LEECH_THRESHOLDS.severe) return 'severe_leech';
  if (score >= LEECH_THRESHOLDS.leech) return 'leech';
  if (score >= LEECH_THRESHOLDS.emerging) return 'emerging';
  return 'none';
}

/**
 * Generate a human-readable reason for the leech classification.
 */
function getLeechReason(severity: LeechSeverity, signals: LeechSignals): string {
  if (severity === 'none') return 'Card is progressing normally.';

  const dominant = getDominantSignal(signals);
  switch (dominant) {
    case 'lapseRate':
      return 'This card has a high failure rate despite repeated reviews. A visual mnemonic may help create a stronger memory trace.';
    case 'difficultySignal':
      return 'This card has consistently high difficulty. Alternative encoding (visual association) may break through the difficulty barrier.';
    case 'stabilityStagnation':
      return 'Memory stability isn\'t growing despite reviews. Dual coding with a visual mnemonic can provide an additional retrieval pathway.';
    case 'reviewInefficiency':
      return 'Many reviews have been invested with limited retention gain. A mnemonic would make each future review more efficient.';
  }
}

function getDominantSignal(signals: LeechSignals): keyof LeechSignals {
  const weighted: Record<keyof LeechSignals, number> = {
    lapseRate: signals.lapseRate * LEECH_WEIGHTS.lapseRate,
    difficultySignal: signals.difficultySignal * LEECH_WEIGHTS.difficultySignal,
    stabilityStagnation: signals.stabilityStagnation * LEECH_WEIGHTS.stabilityStagnation,
    reviewInefficiency: signals.reviewInefficiency * LEECH_WEIGHTS.reviewInefficiency,
  };

  let max = -1;
  let dominant: keyof LeechSignals = 'lapseRate';
  for (const [key, val] of Object.entries(weighted)) {
    if (val > max) { max = val; dominant = key as keyof LeechSignals; }
  }
  return dominant;
}

// ─── Mnemonic Image Prompt Generation ────────────────────────────────────────

/**
 * Generate a two-step mnemonic pipeline prompt per tier3.md spec.
 *
 * Step 1: LLM designs the mnemonic concept and crafts an image prompt
 * Step 2: Image model generates the PNG (handled by caller)
 *
 * This function produces the Step 1 LLM prompt.
 *
 * @param concept - The medical concept to create a mnemonic for
 * @param context - Additional context (e.g., what the student keeps confusing)
 * @returns System prompt and user prompt for the mnemonic concept generation
 */
export function buildMnemonicConceptPrompt(
  concept: string,
  context?: string
): { systemPrompt: string; userPrompt: string } {
  const systemPrompt = `You are a medical mnemonic designer specializing in visual dual-coding mnemonics for PA students preparing for the PANCE exam. Your job is to create a memorable visual association that encodes the key clinical features of a medical concept.

OUTPUT FORMAT (JSON):
{
  "mnemonic_concept": "A brief description of the visual scene (1-2 sentences)",
  "key_associations": ["feature1 → visual element", "feature2 → visual element"],
  "image_prompt": "A detailed image generation prompt (DALL-E/Imagen style) describing the scene. Use cartoon/illustration style, bright colors, medical education appropriate. Include specific visual details for each key association.",
  "memory_hook": "A one-sentence memorable phrase tying the visual to the concept"
}

RULES:
1. Use concrete, vivid visual imagery — not abstract diagrams
2. Create UNEXPECTED associations (surprise improves memory encoding)
3. Include at least 3 key clinical features encoded as visual elements
4. Keep the image prompt family-friendly and educational
5. Cartoon/illustration style works best for memory (not photorealistic)`;

  const contextNote = context ? `\nAdditional context: ${context}` : '';
  const userPrompt = `Create a visual mnemonic for: ${concept}${contextNote}

Design a memorable visual scene that encodes the key distinguishing features of this concept. The student keeps failing this card despite repeated reviews — the mnemonic needs to be vivid and unexpected enough to break through.`;

  return { systemPrompt, userPrompt };
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
