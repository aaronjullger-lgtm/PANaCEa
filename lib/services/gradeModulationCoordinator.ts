/**
 * Grade Modulation Coordinator — Behavioral Analysis Pipeline
 *
 * Standalone service that handles ALL behavioral signal extraction and
 * grade modulation. Has ZERO knowledge of FSRS internals — it only produces
 * a modulated grade for the FSRS service to consume.
 *
 * This module implements the research-backed algorithm from the
 * PANaCEa Behavioral Analysis Audit (2026-04-07), incorporating:
 * - Response time as confidence proxy (RT zone classification)
 * - Session fatigue detection via rolling window RT/accuracy ratios
 * - Streak-based stability amplification with hard cap
 * - Confidence category delta (high/low × correct/incorrect matrix)
 *
 * All functions are pure and individually testable.
 * DB-integrated wiring lives in drillReviewService.ts.
 *
 * @module lib/services/gradeModulationCoordinator
 * @see PANaCEa_Behavioral_Analysis_Audit.md — Parts 1–3
 */

import {
  fitExGaussian,
  classifyRT,
  type ExGaussianParams,
  type RTClassification,
  MIN_SAMPLES_FOR_FIT,
} from '../confidence/exGaussianRT';

// ─── Types ──────────────────────────────────────────────────

/**
 * All contextual inputs needed for behavioral grade modulation.
 * Assembled by drillReviewService before calling modulateGrade().
 */
export interface BehavioralContext {
  /** Response time in milliseconds for this review */
  responseTimeMs: number;
  /** Whether the student answered correctly */
  isCorrect: boolean;
  /** The unmodulated discrete grade (1=Again, 3=Good in binary system) */
  rawGrade: number;
  /** Consecutive correct answers on same/similar items */
  streakCount: number;
  /** 0-based index of this question within the session */
  sessionQuestionIndex: number;
  /** Per-user historical median RT in ms, null if insufficient history */
  userMedianRtMs: number | null;
  /** Accuracy of last 10 questions in session, null if <10 questions */
  rollingWindowAccuracy: number | null;
  /** Mean RT of last 10 questions in ms, null if <10 questions */
  rollingWindowMeanRtMs: number | null;
  /** Running mean accuracy for entire session, null if first question */
  sessionMeanAccuracy: number | null;
  /** Historical RT values for ex-Gaussian fitting (optional — enables richer RT analysis) */
  userRtHistory?: number[];
}

/** Extracted behavioral signals from raw context. */
export interface BehavioralSignals {
  /** RT as fraction of user median: 0.0 = instant, 1.0 = at median, 2.0 = 2× median */
  rtRatio: number;
  /** Classified RT zone based on thresholds against user median */
  rtZone: 'fast' | 'normal' | 'slow';
  /** Session fatigue score: 0.0 = fresh, 1.0 = severely fatigued */
  fatigueScore: number;
  /** Streak-based stability multiplier */
  streakMultiplier: number;
  /** Confidence category — always 'unknown' (implicit-only, no self-rated input) */
  confidenceCategory: 'low' | 'medium' | 'high' | 'unknown';
  /** Fast RT + incorrect answer → impulsive error, not true knowledge gap */
  isImpulsiveError: boolean;
  /** Slow RT + correct answer → effortful retrieval, unstable memory */
  isEffortfulRetrieval: boolean;
  /** Ex-Gaussian RT classification when history available */
  exGaussianClassification?: RTClassification;
  /** Fitted ex-Gaussian parameters (null if insufficient history) */
  exGaussianParams?: ExGaussianParams;
  /** Whether RT signal quality was reduced due to attentional lapse */
  isRTLapse: boolean;
}

/** Complete grade modulation result with full traceability. */
export interface GradeModulation {
  /** The unmodulated input grade */
  rawGrade: number;
  /** Continuous effective grade on [1.0, 4.0] after all deltas applied */
  effectiveGrade: number;
  /** Discrete FSRS grade (1=Again, 2=Hard, 3=Good, 4=Easy) */
  discreteGrade: 1 | 2 | 3 | 4;
  /** Individual delta contributions for debugging/telemetry */
  deltas: {
    rtDelta: number;
    confidenceDelta: number;
    streakDelta: number;
    fatigueDelta: number;
    exGaussianDelta: number;
    total: number;
  };
  /** The extracted signals that produced these deltas */
  signals: BehavioralSignals;
}

// ─── Constants ──────────────────────────────────────────────

/**
 * Authoritative behavioral analysis constants.
 * Values derived from research audit — do not modify without
 * documenting the deviation and rationale.
 *
 * @see PANaCEa_Behavioral_Analysis_Audit.md § 2.1–2.3
 */
export const BEHAVIORAL_CONSTANTS = {
  /** Fallback median RT for users with insufficient history.
   *  Conservative for PA MCQ with vignette reading time (~40-word stems). */
  SESSION_DEFAULT_MEDIAN_RT_MS: 15_000,

  /** RT below this fraction of median = 'fast' zone */
  RT_FAST_MULTIPLIER: 0.5,
  /** RT above this fraction of median = 'slow' zone */
  RT_SLOW_MULTIPLIER: 1.5,

  /** Fatigue fires when rolling RT ratio exceeds this */
  FATIGUE_RT_RATIO_THRESHOLD: 1.3,
  /** Fatigue fires when rolling accuracy ratio drops below this */
  FATIGUE_ACCURACY_RATIO_THRESHOLD: 0.7,
  /** Minimum questions in session before fatigue detection activates */
  FATIGUE_WINDOW_MIN_QUESTIONS: 10,

  /** Minimum sessions before RT baseline is considered reliable.
   *  Below this threshold, RT deltas are zeroed (cold-start grace period). */
  RT_BASELINE_MIN_SAMPLES: 25,

  /** Per-signal delta values (exact from audit specification) */
  DELTAS: {
    /** Fast RT + correct: strong retrieval → boost grade */
    RT_FAST_CORRECT: +0.4,
    /** Fast RT + incorrect: impulsive error → reduce penalty vs deliberate fail */
    RT_FAST_INCORRECT: +0.3,
    /** Slow RT + correct: effortful retrieval → dampen stability gain */
    RT_SLOW_CORRECT: -0.3,
    /** Slow RT + incorrect: deliberate failure → no RT adjustment */
    RT_SLOW_INCORRECT: 0.0,

    /** High confidence + correct: full stability gain */
    CONF_HIGH_CORRECT: +0.3,
    /** High confidence + incorrect: overconfidence penalty */
    CONF_HIGH_INCORRECT: -0.3,
    /** Low confidence + correct: lucky guess dampener */
    CONF_LOW_CORRECT: -0.15,
    /** Low confidence + incorrect: expected error, soften blow */
    CONF_LOW_INCORRECT: +0.15,

    /** Streak 2–3 correct: mild stability amplifier */
    STREAK_2_3: +0.05,
    /** Streak 4+: hard-capped stability amplifier */
    STREAK_4_PLUS: +0.08,

    /** Maximum fatigue dampening (fatigueScore=1.0 × this value) */
    FATIGUE_MAX: -0.2,
  },

  /** Effective grade is clamped to this range */
  GRADE_BOUNDS: { MIN: 1.0, MAX: 4.0 },

  /** Ex-Gaussian noise dampener: tau/mu ratio above this threshold activates dampening.
   *  High tau relative to mu means the student has a heavy slow-tail — their RT is
   *  inconsistent, so the RT delta should be dampened. */
  EXGAUSSIAN_TAU_MU_NOISE_THRESHOLD: 0.4,

  /** Maximum dampening applied to RT delta when ex-Gaussian noise is high (default: 0.5).
   *  At threshold → 1.0 (no dampening). At 2× threshold → 0.5 (50% dampening). */
  EXGAUSSIAN_NOISE_DAMPENER_MIN: 0.5,

  /** Wilson score mastery threshold (lower bound must exceed) */
  WILSON_MASTERY_THRESHOLD: 0.80,
  /** z-value for 95% confidence Wilson score */
  WILSON_CONFIDENCE_Z: 1.96,
  /** Attempts within this window (days) receive 2× weight in weighted Wilson */
  WILSON_RECENT_DAYS_CUTOFF: 30,
  /** Weight multiplier for recent attempts */
  WILSON_RECENT_WEIGHT_MULTIPLIER: 2.0,
} as const;

// ─── Signal Extraction Functions ────────────────────────────

/**
 * Classify response time into a behavioral zone.
 *
 * Uses per-user median RT with 0.5×/1.5× thresholds (self-calibrating).
 * Falls back to SESSION_DEFAULT_MEDIAN_RT_MS when no user history exists.
 *
 * @param responseTimeMs - Actual response time for this review
 * @param userMedianRtMs - Per-user historical median RT, null if unavailable
 * @returns Zone classification and RT ratio
 *
 * @example
 *   classifyRtZone(5000, 15000) → { zone: 'fast', rtRatio: 0.33 }
 *   classifyRtZone(15000, 15000) → { zone: 'normal', rtRatio: 1.0 }
 *   classifyRtZone(30000, 15000) → { zone: 'slow', rtRatio: 2.0 }
 *   classifyRtZone(8000, null)   → { zone: 'normal', rtRatio: 0.53 } // uses 15000ms fallback
 */
export function classifyRtZone(
  responseTimeMs: number,
  userMedianRtMs: number | null
): { zone: 'fast' | 'normal' | 'slow'; rtRatio: number } {
  const medianRt = userMedianRtMs ?? BEHAVIORAL_CONSTANTS.SESSION_DEFAULT_MEDIAN_RT_MS;
  const rtRatio = medianRt > 0 ? responseTimeMs / medianRt : 1.0;

  const fastThreshold = BEHAVIORAL_CONSTANTS.RT_FAST_MULTIPLIER;
  const slowThreshold = BEHAVIORAL_CONSTANTS.RT_SLOW_MULTIPLIER;

  if (rtRatio < fastThreshold) {
    return { zone: 'fast', rtRatio };
  }
  if (rtRatio > slowThreshold) {
    return { zone: 'slow', rtRatio };
  }
  return { zone: 'normal', rtRatio };
}

/**
 * Compute session fatigue score from rolling window statistics.
 *
 * Fatigue is detected when BOTH conditions are met:
 * 1. Rolling mean RT > 1.3× user historical median (slowing down)
 * 2. Rolling accuracy < 0.7× session mean accuracy (getting worse)
 *
 * Returns 0.0 for the first 10 questions (insufficient data).
 *
 * @param sessionQuestionIndex - 0-based index of current question in session
 * @param rollingWindowMeanRtMs - Mean RT of last 10 questions, null if <10
 * @param userMedianRtMs - User historical median RT, null if unavailable
 * @param rollingWindowAccuracy - Accuracy of last 10 questions, null if <10
 * @param sessionMeanAccuracy - Running session accuracy, null if first question
 * @returns Fatigue score in [0.0, 1.0]
 *
 * @example
 *   computeFatigueScore(5, null, null, null, null) → 0.0 // too early
 *   computeFatigueScore(15, 22500, 15000, 0.4, 0.8) → 0.4 // fatigued
 *   computeFatigueScore(15, 16000, 15000, 0.7, 0.8) → 0.0 // RT ratio under threshold
 */
export function computeFatigueScore(
  sessionQuestionIndex: number,
  rollingWindowMeanRtMs: number | null,
  userMedianRtMs: number | null,
  rollingWindowAccuracy: number | null,
  sessionMeanAccuracy: number | null
): number {
  // Not enough data for fatigue detection
  if (sessionQuestionIndex < BEHAVIORAL_CONSTANTS.FATIGUE_WINDOW_MIN_QUESTIONS) {
    return 0.0;
  }

  // Need all rolling window stats
  if (
    rollingWindowMeanRtMs === null ||
    rollingWindowAccuracy === null ||
    sessionMeanAccuracy === null
  ) {
    return 0.0;
  }

  const medianRt = userMedianRtMs ?? BEHAVIORAL_CONSTANTS.SESSION_DEFAULT_MEDIAN_RT_MS;
  const rtRatio = medianRt > 0 ? rollingWindowMeanRtMs / medianRt : 1.0;
  const accuracyRatio = sessionMeanAccuracy > 0
    ? rollingWindowAccuracy / sessionMeanAccuracy
    : 1.0;

  // Both conditions must be true for fatigue detection
  if (
    rtRatio > BEHAVIORAL_CONSTANTS.FATIGUE_RT_RATIO_THRESHOLD &&
    accuracyRatio < BEHAVIORAL_CONSTANTS.FATIGUE_ACCURACY_RATIO_THRESHOLD
  ) {
    // Scale fatigue from 0.0 at threshold to 1.0 at 2× threshold
    return Math.min(
      1.0,
      (rtRatio - BEHAVIORAL_CONSTANTS.FATIGUE_RT_RATIO_THRESHOLD) * 2.0
    );
  }

  return 0.0;
}

/**
 * Map raw confidence rating to categorical level.
 *
 * @param rating - 0=unknown, 1=low, 2=medium, 3=high
 * @returns Confidence category
 */
export function mapConfidenceCategory(
  rating?: 0 | 1 | 2 | 3
): 'low' | 'medium' | 'high' | 'unknown' {
  if (rating === undefined || rating === 0) return 'unknown';
  if (rating === 1) return 'low';
  if (rating === 2) return 'medium';
  return 'high';
}

// ─── Delta Calculation Functions ────────────────────────────

/**
 * Calculate response time delta.
 *
 * | RT Zone | isCorrect | delta |
 * |---------|-----------|-------|
 * | fast    | true      | +0.4  |
 * | fast    | false     | +0.3  |
 * | slow    | true      | -0.3  |
 * | slow    | false     |  0.0  |
 * | normal  | any       |  0.0  |
 *
 * @param zone - Classified RT zone
 * @param isCorrect - Whether the answer was correct
 * @returns Delta value to add to raw grade
 */
export function calculateRtDelta(
  zone: 'fast' | 'normal' | 'slow',
  isCorrect: boolean
): number {
  if (zone === 'fast' && isCorrect) return BEHAVIORAL_CONSTANTS.DELTAS.RT_FAST_CORRECT;
  if (zone === 'fast' && !isCorrect) return BEHAVIORAL_CONSTANTS.DELTAS.RT_FAST_INCORRECT;
  if (zone === 'slow' && isCorrect) return BEHAVIORAL_CONSTANTS.DELTAS.RT_SLOW_CORRECT;
  if (zone === 'slow' && !isCorrect) return BEHAVIORAL_CONSTANTS.DELTAS.RT_SLOW_INCORRECT;
  return 0.0;
}

/**
 * Calculate confidence-based delta.
 *
 * Based on the 2×2 matrix from calibration research:
 * high + correct → +0.3, high + incorrect → -0.3 (overconfidence penalty),
 * low + correct → -0.15 (lucky guess dampener), low + incorrect → +0.15.
 *
 * @param category - Confidence category
 * @param isCorrect - Whether the answer was correct
 * @returns Delta value
 */
export function calculateConfidenceDelta(
  category: 'low' | 'medium' | 'high' | 'unknown',
  isCorrect: boolean
): number {
  if (category === 'high' && isCorrect) return BEHAVIORAL_CONSTANTS.DELTAS.CONF_HIGH_CORRECT;
  if (category === 'high' && !isCorrect) return BEHAVIORAL_CONSTANTS.DELTAS.CONF_HIGH_INCORRECT;
  if (category === 'low' && isCorrect) return BEHAVIORAL_CONSTANTS.DELTAS.CONF_LOW_CORRECT;
  if (category === 'low' && !isCorrect) return BEHAVIORAL_CONSTANTS.DELTAS.CONF_LOW_INCORRECT;
  // 'medium' and 'unknown' produce zero delta
  return 0.0;
}

/**
 * Calculate streak-based stability delta.
 *
 * Streak amplification is capped to prevent massed-repetition inflation.
 * Only applies to correct answers (incorrect breaks the streak signal).
 *
 * @param streakCount - Number of consecutive correct answers
 * @param isCorrect - Whether the current answer was correct
 * @returns Delta value (0.0 if incorrect)
 */
export function calculateStreakDelta(
  streakCount: number,
  isCorrect: boolean
): number {
  if (!isCorrect) return 0.0;
  if (streakCount <= 1) return 0.0;
  if (streakCount <= 3) return BEHAVIORAL_CONSTANTS.DELTAS.STREAK_2_3;
  return BEHAVIORAL_CONSTANTS.DELTAS.STREAK_4_PLUS; // hard cap at 4+
}

/**
 * Calculate fatigue dampening delta.
 *
 * Fatigue dampens the grade signal toward baseline — it never amplifies.
 * Maximum dampening is -0.2 when fatigueScore = 1.0.
 *
 * @param fatigueScore - Score in [0.0, 1.0] from computeFatigueScore()
 * @returns Negative delta (or 0.0 if no fatigue)
 */
export function calculateFatigueDelta(fatigueScore: number): number {
  return fatigueScore * BEHAVIORAL_CONSTANTS.DELTAS.FATIGUE_MAX;
}

// ─── Master Modulation Function ─────────────────────────────

/**
 * Extract behavioral signals and compute modulated grade.
 *
 * This is the main entry point. It:
 * 1. Classifies RT zone from user median
 * 2. Computes fatigue score from rolling window
 * 3. Applies implicit confidence category (always 'unknown' — no self-rated input)
 * 4. Computes all four deltas (RT, confidence, streak, fatigue)
 * 5. Clamps effective grade to [1.0, 4.0]
 * 6. Maps continuous grade to discrete FSRS grade
 *
 * If the user has insufficient RT baseline history (< RT_BASELINE_MIN_SAMPLES),
 * the RT delta is zeroed to avoid cold-start noise.
 *
 * @param context - All behavioral context for this review
 * @returns Complete grade modulation with signals and deltas
 *
 * @example
 *   // Fast-correct with reliable baseline:
 *   modulateGrade({
 *     responseTimeMs: 5000, isCorrect: true, rawGrade: 3,
 *     streakCount: 2, sessionQuestionIndex: 15,
 *     userMedianRtMs: 15000, rollingWindowAccuracy: 0.8,
 *     rollingWindowMeanRtMs: 14000, sessionMeanAccuracy: 0.75,
 *   })
 *   // → effectiveGrade ≈ 3.45, discreteGrade: 3 (Good)
 */
export function modulateGrade(context: BehavioralContext): GradeModulation {
  // Step 1: Extract signals
  const { zone: rtZone, rtRatio } = classifyRtZone(
    context.responseTimeMs,
    context.userMedianRtMs
  );

  const fatigueScore = computeFatigueScore(
    context.sessionQuestionIndex,
    context.rollingWindowMeanRtMs,
    context.userMedianRtMs,
    context.rollingWindowAccuracy,
    context.sessionMeanAccuracy
  );

  // Confidence is implicit-only (no self-rated input) → always 'unknown', zero delta.
  const confidenceCategory: 'unknown' = 'unknown';

  const isImpulsiveError = rtZone === 'fast' && !context.isCorrect;
  const isEffortfulRetrieval = rtZone === 'slow' && context.isCorrect;

  const streakMultiplier = context.streakCount <= 1
    ? 1.0
    : context.streakCount <= 3
      ? 1.05
      : 1.08;

  // ── Step 1b: Ex-Gaussian RT analysis (when history available) ──
  let exGaussianParams: ExGaussianParams | null = null;
  let exGaussianClassification: RTClassification | undefined;
  let isRTLapse = false;
  let exGaussianNoiseDampener = 1.0;

  if (context.userRtHistory && context.userRtHistory.length >= MIN_SAMPLES_FOR_FIT) {
    exGaussianParams = fitExGaussian(context.userRtHistory);
    if (exGaussianParams) {
      const rtResult = classifyRT(context.responseTimeMs, exGaussianParams);
      exGaussianClassification = rtResult.classification;
      isRTLapse = rtResult.classification === 'lapse';

      // Compute noise dampener from tau/mu ratio
      // High tau = heavy slow-tail = inconsistent RT = dampen the RT delta
      if (exGaussianParams.mu > 0) {
        const tauMuRatio = exGaussianParams.tau / exGaussianParams.mu;
        if (tauMuRatio > BEHAVIORAL_CONSTANTS.EXGAUSSIAN_TAU_MU_NOISE_THRESHOLD) {
          const normalized = Math.min(
            1.0,
            (tauMuRatio - BEHAVIORAL_CONSTANTS.EXGAUSSIAN_TAU_MU_NOISE_THRESHOLD) /
              BEHAVIORAL_CONSTANTS.EXGAUSSIAN_TAU_MU_NOISE_THRESHOLD
          );
          exGaussianNoiseDampener =
            1.0 - normalized * (1.0 - BEHAVIORAL_CONSTANTS.EXGAUSSIAN_NOISE_DAMPENER_MIN);
        }
      }
    }
  }

  const signals: BehavioralSignals = {
    rtRatio,
    rtZone,
    fatigueScore,
    streakMultiplier,
    confidenceCategory,
    isImpulsiveError,
    isEffortfulRetrieval,
    exGaussianClassification,
    exGaussianParams: exGaussianParams ?? undefined,
    isRTLapse,
  };

  // Step 2: Calculate deltas
  // Zero RT delta during cold-start grace period
  const hasReliableBaseline = context.userMedianRtMs !== null;
  let rtDelta = hasReliableBaseline
    ? calculateRtDelta(rtZone, context.isCorrect)
    : 0.0;

  // Apply ex-Gaussian noise dampener to RT delta
  rtDelta *= exGaussianNoiseDampener;

  // Compute ex-Gaussian delta: lapse detection overrides RT zone classification
  // A lapse-classified RT should reduce confidence signal even if zone says "fast"
  let exGaussianDelta = 0.0;
  if (isRTLapse && exGaussianParams) {
    // Lapse = attentional lapse → RT is noise, not signal
    // Zero out the RT delta and apply a small negative adjustment
    rtDelta = 0.0;
    exGaussianDelta = -0.1;
  } else if (exGaussianClassification === 'automatic' && context.isCorrect && exGaussianParams) {
    // Ex-Gaussian confirms automatic (well below mu) → stronger confidence
    exGaussianDelta = 0.1;
  }

  const confidenceDelta = calculateConfidenceDelta(confidenceCategory, context.isCorrect);
  const streakDelta = calculateStreakDelta(context.streakCount, context.isCorrect);
  const fatigueDelta = calculateFatigueDelta(fatigueScore);

  const totalDelta = rtDelta + confidenceDelta + streakDelta + fatigueDelta + exGaussianDelta;

  // Step 3: Clamp effective grade
  const effectiveGrade = Math.max(
    BEHAVIORAL_CONSTANTS.GRADE_BOUNDS.MIN,
    Math.min(
      BEHAVIORAL_CONSTANTS.GRADE_BOUNDS.MAX,
      context.rawGrade + totalDelta
    )
  );

  // Step 4: Map to discrete grade
  let discreteGrade: 1 | 2 | 3 | 4;
  if (effectiveGrade < 1.5) {
    discreteGrade = 1; // Again
  } else if (effectiveGrade < 2.5) {
    discreteGrade = 2; // Hard
  } else if (effectiveGrade < 3.5) {
    discreteGrade = 3; // Good
  } else {
    discreteGrade = 4; // Easy
  }

  return {
    rawGrade: context.rawGrade,
    effectiveGrade,
    discreteGrade,
    deltas: {
      rtDelta,
      confidenceDelta,
      streakDelta,
      fatigueDelta,
      exGaussianDelta,
      total: totalDelta,
    },
    signals,
  };
}
