/**
 * Ghost Grader - Behavioral Biometrics for Honest FSRS History
 *
 * Overrides user-derived ratings using implicit confidence signals to preserve
 * an "Honest History" of reviews. Prevents gaming where users click "Good"
 * after hesitating or re-reading the vignette post-reveal.
 *
 * Sprint 6 enhancements:
 * - Confidence BOOST pathway: when all signals are clean and response is fast,
 *   the grader lifts grade_continuous rather than only penalizing.
 * - Elimination velocity signal: fast systematic elimination of distractors
 *   is a positive clinical reasoning indicator; absent/slow elimination is soft negative.
 * - Returns GhostGraderResult with both rating adjustment AND grade_continuous delta.
 *
 * Indecision rules (any triggers → Again when correct):
 * 1. Oscillations > 2: Hover indecision (A→B→A revisits)
 * 2. Selection drift > 3s: Time between selecting answer and Submit
 * 3. Tremor score > 0.6: Erratic mouse movement (cognitive load)
 *
 * Hint-assisted rules (correct + hint viewed):
 * 1. Hint viewed → blocks confidence boost, applies grade penalty (-0.20)
 * 2. Hint viewed > 10s → heavier penalty (-0.30, heavy reliance)
 * 3. Does NOT force Again (weaker than indecision — user still got it right)
 *
 * Confidence boost rules (all must be true):
 * 1. Zero oscillations + zero regressions
 * 2. Selection drift < 1s (or null — immediate submit)
 * 3. Tremor score < 0.2 (calm, directed movement)
 * 4. Correct answer
 * 5. Latency ratio < 0.8 (answered well under par time)
 * 6. No hint viewed
 *
 * @see hooks/useMicroKinetics.ts - Provides micro-kinetic metrics
 * @see hooks/useTouchKinetics.ts - Touch-equivalent signals
 * @see lib/implicit-metrics.ts - deriveContinuousRating (base rating)
 */
import { Rating } from '../fsrs';

// ── Thresholds ──

/** Drift threshold (ms): selection-to-submit delay indicating lack of confidence */
export const SELECTION_DRIFT_THRESHOLD_MS = 3000;
/** Drift below this (ms) = confident immediate submit */
const CONFIDENT_DRIFT_THRESHOLD_MS = 1000;

const OSCILLATION_THRESHOLD = 2;
const TREMOR_THRESHOLD = 0.6;
const CONFIDENT_TREMOR_CEILING = 0.2;

/** Elimination velocity thresholds (eliminations per second) */
const ELIM_VELOCITY_STRONG = 0.8; // Fast systematic elimination → positive signal
const ELIM_VELOCITY_WEAK = 0.2;   // Slow/absent elimination → soft negative

/** Z-score threshold: signal must be 2+ stddevs above user's personal median */
const Z_SCORE_THRESHOLD = 2.0;

/** Latency ratio below which confidence boost is eligible */
const BOOST_LATENCY_RATIO_MAX = 0.8;

/** Hint-assisted thresholds */
const HINT_GRADE_CAP = 2.0;              // Cap grade_continuous when hint was viewed (weaker than indecision cap)
const HINT_PENALTY_AMOUNT = 0.20;        // Penalty for hint-assisted correct answer
const HINT_LONG_VIEW_MS = 10_000;        // Hint viewed > 10s = relied heavily on it

/** Grade continuous adjustments */
const CONFIDENCE_BOOST_AMOUNT = 0.25;     // Lift grade_continuous when all signals clean
const ELIM_BOOST_AMOUNT = 0.15;           // Additional lift for fast elimination
const ELIM_PENALTY_AMOUNT = 0.10;         // Soft penalty for absent elimination
const INDECISION_GRADE_CAP = 1.5;         // Cap grade_continuous when Ghost Grader fires
// ── Types ──

/** Per-user behavioral baseline for z-score normalization (Sprint 7) */
export interface GhostGraderBaseline {
  /** Median oscillation count from historical reviews */
  oscillationMedian: number;
  /** Std dev of oscillation count */
  oscillationStdDev: number;
  /** Median tremor score */
  tremorMedian: number;
  /** Std dev of tremor score */
  tremorStdDev: number;
  /** Median selection drift (ms) */
  driftMedianMs: number;
  /** Std dev of selection drift */
  driftStdDevMs: number;
}

export interface GhostGraderInput {
  /** FSRS rating from implicit or explicit input (1-4) */
  userRating: Rating;
  /** Whether the answer was correct */
  isCorrect: boolean;
  /** Hover oscillations (A→B→A revisits) from useMicroKinetics */
  oscillations?: number;
  /** Scroll direction reversals after answer reveal (vignette regression) */
  vignetteRegressions?: number;
  /** Time from answer selection to submit (ms). High = lack of confidence. */
  selectionDriftMs?: number | null;
  /** Mouse tremor score 0-1. High = cognitive load, frustration. */
  tremorScore?: number;
  /** Latency ratio: effectiveLatency / parTime. < 1.0 = faster than par. */
  latencyRatio?: number;
  /** Elimination velocity: eliminations per second (from telemetry). */
  eliminationVelocity?: number;
  /** Number of answer options available (typically 4 for MCQ) */
  optionCount?: number;
  /** Per-user behavioral baseline for z-score normalization (Sprint 7) */
  baseline?: GhostGraderBaseline | null;
  /** Whether the user viewed a hint before answering */
  hintViewed?: boolean;
  /** How long the hint was displayed (ms). Longer = heavier reliance. */
  hintDurationMs?: number | null;
}

export interface GhostGraderResult {
  /** Adjusted discrete rating */
  rating: Rating;
  /** Adjustment to apply to grade_continuous (can be positive or negative) */
  gradeContinuousAdjustment: number;
  /** Which rule fired (for logging/telemetry) */
  rule: 'indecision' | 'hint_assisted' | 'confidence_boost' | 'elimination_boost' | 'elimination_penalty' | 'none';
  /** Number of indecision signals that fired */
  indecisionSignalCount: number;
  /** Whether confidence boost criteria were all met */
  confidenceBoostEligible: boolean;
}
// ── Core function ──

/**
 * Apply honest-history override with bidirectional adjustment.
 *
 * DOWNGRADE path: any indecision signal → Again + cap grade_continuous at 1.5
 * HINT path: hint viewed on correct → keep rating, penalize grade_continuous by 0.20–0.30
 * BOOST path: all signals clean + fast response + no hint → lift grade_continuous by 0.25
 * ELIMINATION path: fast elimination → additional +0.15; absent → -0.10
 *
 * @param input - Current rating, correctness, and behavioral metrics
 * @returns GhostGraderResult with rating, grade adjustment, and diagnostics
 */
export function applyHonestRating(input: GhostGraderInput): Rating {
  return applyHonestRatingWithDetail(input).rating;
}

/**
 * Full Ghost Grader with detailed result (for grade_continuous adjustment).
 * Call this from drillReviewService to get both rating and grade delta.
 */
export function applyHonestRatingWithDetail(input: GhostGraderInput): GhostGraderResult {
  const {
    userRating,
    isCorrect,
    oscillations = 0,
    vignetteRegressions = 0,
    selectionDriftMs = null,
    tremorScore = 0,
    latencyRatio,
    eliminationVelocity,
    optionCount = 4,
    baseline = null,
    hintViewed = false,
    hintDurationMs = null,
  } = input;
  const neutralResult: GhostGraderResult = {
    rating: userRating,
    gradeContinuousAdjustment: 0,
    rule: 'none',
    indecisionSignalCount: 0,
    confidenceBoostEligible: false,
  };

  // Incorrect answers: no adjustment (FSRS already handles via Again)
  if (!isCorrect) return neutralResult;

  // Already Again — can't downgrade further, but elimination boost can still apply
  if (userRating <= Rating.Again) {
    return neutralResult;
  }

  // ── Count indecision signals (z-score when baseline available, absolute otherwise) ──
  let signalCount = 0;
  const effectiveOscillations = oscillations + Math.min(vignetteRegressions, 2);

  if (baseline && baseline.oscillationStdDev > 0) {
    // Z-score: how many stddevs above the user's personal median?
    const oscZ = (effectiveOscillations - baseline.oscillationMedian) / baseline.oscillationStdDev;
    if (oscZ > Z_SCORE_THRESHOLD) signalCount++;
  } else {
    if (effectiveOscillations > OSCILLATION_THRESHOLD) signalCount++;
  }

  if (selectionDriftMs != null) {
    if (baseline && baseline.driftStdDevMs > 0) {
      const driftZ = (selectionDriftMs - baseline.driftMedianMs) / baseline.driftStdDevMs;
      if (driftZ > Z_SCORE_THRESHOLD) signalCount++;
    } else {
      if (selectionDriftMs > SELECTION_DRIFT_THRESHOLD_MS) signalCount++;
    }
  }

  if (baseline && baseline.tremorStdDev > 0) {
    const tremorZ = (tremorScore - baseline.tremorMedian) / baseline.tremorStdDev;
    if (tremorZ > Z_SCORE_THRESHOLD) signalCount++;
  } else {
    if (tremorScore >= TREMOR_THRESHOLD) signalCount++;
  }

  // ── DOWNGRADE path: any indecision → Again ──
  if (signalCount > 0) {
    return {
      rating: Rating.Again,
      gradeContinuousAdjustment: -99, // Signal to cap at INDECISION_GRADE_CAP
      rule: 'indecision',
      indecisionSignalCount: signalCount,
      confidenceBoostEligible: false,
    };
  }
  // ── HINT-ASSISTED path: hint viewed on correct answer → weaker recall ──
  // Hint-assisted retrieval is not true free recall — memory trace is weaker.
  // This is a softer penalty than indecision (doesn't force Again), but blocks
  // confidence boost and penalizes grade_continuous.
  if (hintViewed) {
    const longHintView = hintDurationMs != null && hintDurationMs >= HINT_LONG_VIEW_MS;
    const penalty = longHintView ? HINT_PENALTY_AMOUNT * 1.5 : HINT_PENALTY_AMOUNT;
    return {
      rating: userRating, // keep original rating (not forced to Again)
      gradeContinuousAdjustment: -penalty,
      rule: 'hint_assisted',
      indecisionSignalCount: 0,
      confidenceBoostEligible: false,
    };
  }

  // ── BOOST path: all signals clean + fast response ──
  const zeroOscillations = oscillations === 0 && vignetteRegressions === 0;
  const fastDrift = selectionDriftMs == null || selectionDriftMs < CONFIDENT_DRIFT_THRESHOLD_MS;
  const calmMovement = tremorScore < CONFIDENT_TREMOR_CEILING;
  const fastResponse = latencyRatio != null && latencyRatio < BOOST_LATENCY_RATIO_MAX;
  const boostEligible = zeroOscillations && fastDrift && calmMovement && fastResponse;

  let adjustment = 0;
  let rule: GhostGraderResult['rule'] = 'none';

  // Confidence boost: genuinely knew it
  if (boostEligible) {
    adjustment += CONFIDENCE_BOOST_AMOUNT;
    rule = 'confidence_boost';
  }

  // ── Elimination velocity signal ──
  // Fast, systematic elimination is a positive clinical reasoning indicator.
  // Only meaningful for MCQs with 3+ options.
  if (eliminationVelocity != null && optionCount >= 3) {
    if (eliminationVelocity >= ELIM_VELOCITY_STRONG) {
      // Fast elimination: strong clinical reasoning signal
      adjustment += ELIM_BOOST_AMOUNT;
      if (rule === 'none') rule = 'elimination_boost';
    } else if (eliminationVelocity < ELIM_VELOCITY_WEAK && !boostEligible) {
      // Slow/absent elimination on MCQ (only penalize when not already boosted)
      adjustment -= ELIM_PENALTY_AMOUNT;
      if (rule === 'none') rule = 'elimination_penalty';
    }
  }

  return {
    rating: userRating,
    gradeContinuousAdjustment: adjustment,
    rule,
    indecisionSignalCount: 0,
    confidenceBoostEligible: boostEligible,
  };
}

// ── Exported constants for testing ──
export const GHOST_GRADER_CONSTANTS = {
  SELECTION_DRIFT_THRESHOLD_MS,
  CONFIDENT_DRIFT_THRESHOLD_MS,
  OSCILLATION_THRESHOLD,
  TREMOR_THRESHOLD,
  CONFIDENT_TREMOR_CEILING,
  Z_SCORE_THRESHOLD,
  ELIM_VELOCITY_STRONG,
  ELIM_VELOCITY_WEAK,
  BOOST_LATENCY_RATIO_MAX,
  CONFIDENCE_BOOST_AMOUNT,
  ELIM_BOOST_AMOUNT,
  ELIM_PENALTY_AMOUNT,
  INDECISION_GRADE_CAP,
  HINT_GRADE_CAP,
  HINT_PENALTY_AMOUNT,
  HINT_LONG_VIEW_MS,
} as const;
