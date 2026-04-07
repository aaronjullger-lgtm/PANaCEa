/**
 * Composite Fatigue Service — Tier 3 Experimental Feature
 *
 * Replaces the simple question-number-based fatigue detection with a
 * multi-signal composite scoring system per tier3.md research spec.
 *
 * Four behavioral signals are combined into a continuous FatigueScore [0, 1]:
 *   FatigueScore = w1×RT_drift + w2×RT_variability + w3×accuracy_decline + w4×duration_factor
 *
 * Each signal is independently normalized to [0, 1] before weighting.
 *
 * Fatigue levels:
 *   none     [0.0, 0.3)  — No intervention
 *   mild     [0.3, 0.5)  — Shift to easier cards, UI hint
 *   moderate [0.5, 0.7)  — Suggest 5–10 min break
 *   severe   [0.7, 1.0]  — Strongly recommend session end
 *
 * Research basis:
 *   - Mackworth (1948): Vigilance decrement after 30 min sustained attention
 *   - TDCommons (2025): RT drift >35% over baseline is robust fatigue indicator
 *   - Warm (1984), Helton & Russell (2015): Sustained attention declines ~Q15
 *   - Pattyn et al. (2008): RT variability increases with time-on-task
 *   - Frontiers in Psychology (2025): Micro-breaks explain 30–32% of quiz improvement
 *
 * @module lib/services/compositeFatigueService
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type CompositeFatigueLevel = 'none' | 'mild' | 'moderate' | 'severe';

export interface FatigueSignals {
  /** Normalized RT drift [0, 1]: how much response times are trending up */
  rtDrift: number;
  /** Normalized RT variability [0, 1]: increasing trial-to-trial inconsistency */
  rtVariability: number;
  /** Normalized accuracy decline [0, 1]: rolling accuracy vs session baseline */
  accuracyDecline: number;
  /** Normalized duration factor [0, 1]: sigmoid ramp after 15–20 minutes */
  durationFactor: number;
}

export interface CompositeFatigueResult {
  /** Composite fatigue score [0, 1] */
  score: number;
  /** Classified fatigue level */
  level: CompositeFatigueLevel;
  /** Individual signal contributions (each [0, 1]) */
  signals: FatigueSignals;
  /** Whether this assessment is reliable (needs ≥ MIN_QUESTIONS) */
  reliable: boolean;
  /** Suggested break duration in minutes (0 if none needed) */
  suggestedBreakMinutes: number;
  /** Strategy-framed message (null if level is 'none') */
  message: string | null;
  /** Estimated session position where fatigue onset began (question index, or null) */
  fatigueOnsetIndex: number | null;
}

export interface SessionDataPoint {
  /** Response time in milliseconds */
  responseTimeMs: number;
  /** Whether the answer was correct */
  wasCorrect: boolean;
  /** Timestamp of this response */
  timestamp: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** Minimum questions before composite fatigue scoring is reliable */
export const MIN_QUESTIONS = 10;

/** Baseline window: first N questions establish the student's "fresh" baseline */
export const BASELINE_WINDOW = 8;

/** Rolling window size for recent performance comparison */
export const ROLLING_WINDOW = 5;

/** Signal weights — must sum to 1.0 */
export const WEIGHTS = {
  rtDrift: 0.30,
  rtVariability: 0.25,
  accuracyDecline: 0.25,
  durationFactor: 0.20,
} as const;

/** RT drift: percentage increase over baseline that maps to max signal */
export const RT_DRIFT_MAX_PERCENT = 0.50; // 50% increase → signal = 1.0

/** RT variability: CoV ratio (recent/baseline) that maps to max signal */
export const RT_VARIABILITY_MAX_RATIO = 2.5; // 2.5× increase in variability → signal = 1.0

/** Accuracy decline: absolute drop from baseline that maps to max signal */
export const ACCURACY_DECLINE_MAX_DROP = 0.30; // 30pp drop → signal = 1.0

/** Duration sigmoid: midpoint in minutes (where duration_factor = 0.5) */
export const DURATION_SIGMOID_MIDPOINT = 25;

/** Duration sigmoid: steepness (higher = sharper transition) */
export const DURATION_SIGMOID_STEEPNESS = 0.15;

/** Fatigue level thresholds */
export const THRESHOLDS = {
  mild: 0.30,
  moderate: 0.50,
  severe: 0.70,
} as const;

// ─── Signal Computation ──────────────────────────────────────────────────────

/**
 * Compute the normalized RT drift signal [0, 1].
 *
 * Measures how much the recent rolling-window mean RT has increased
 * relative to the baseline window mean RT.
 *
 * @param responseTimes - Array of all response times in session order
 * @returns Normalized drift signal [0, 1]
 */
export function computeRtDrift(responseTimes: number[]): number {
  if (responseTimes.length < BASELINE_WINDOW + ROLLING_WINDOW) return 0;

  const baseline = responseTimes.slice(0, BASELINE_WINDOW);
  const recent = responseTimes.slice(-ROLLING_WINDOW);

  const baselineMean = mean(baseline);
  const recentMean = mean(recent);

  if (baselineMean <= 0) return 0;

  const driftPercent = (recentMean - baselineMean) / baselineMean;
  // Only positive drift (slowing down) counts
  return clamp01(Math.max(0, driftPercent) / RT_DRIFT_MAX_PERCENT);
}

/**
 * Compute the normalized RT variability signal [0, 1].
 *
 * Uses the coefficient of variation (CV = stdev/mean) as a scale-invariant
 * measure of trial-to-trial inconsistency. Compares recent CV to baseline CV.
 *
 * @param responseTimes - Array of all response times in session order
 * @returns Normalized variability signal [0, 1]
 */
export function computeRtVariability(responseTimes: number[]): number {
  if (responseTimes.length < BASELINE_WINDOW + ROLLING_WINDOW) return 0;

  const baseline = responseTimes.slice(0, BASELINE_WINDOW);
  const recent = responseTimes.slice(-ROLLING_WINDOW);

  const baselineCv = coefficientOfVariation(baseline);
  const recentCv = coefficientOfVariation(recent);

  if (baselineCv <= 0.01) {
    // Baseline is extremely consistent — any increase is meaningful
    return clamp01(recentCv / 0.5);
  }

  const ratio = recentCv / baselineCv;
  // Ratio of 1.0 = no change, >1 = more variable
  return clamp01(Math.max(0, ratio - 1.0) / (RT_VARIABILITY_MAX_RATIO - 1.0));
}

/**
 * Compute the normalized accuracy decline signal [0, 1].
 *
 * Compares rolling-window accuracy to baseline accuracy.
 *
 * @param correctnessArray - Array of booleans (true = correct) in session order
 * @returns Normalized accuracy decline signal [0, 1]
 */
export function computeAccuracyDecline(correctnessArray: boolean[]): number {
  if (correctnessArray.length < BASELINE_WINDOW + ROLLING_WINDOW) return 0;

  const baselineCorrect = correctnessArray.slice(0, BASELINE_WINDOW);
  const recentCorrect = correctnessArray.slice(-ROLLING_WINDOW);

  const baselineAcc = baselineCorrect.filter(Boolean).length / baselineCorrect.length;
  const recentAcc = recentCorrect.filter(Boolean).length / recentCorrect.length;

  const decline = baselineAcc - recentAcc;
  // Only positive decline (getting worse) counts
  return clamp01(Math.max(0, decline) / ACCURACY_DECLINE_MAX_DROP);
}

/**
 * Compute the normalized duration factor [0, 1].
 *
 * Uses a sigmoid function that ramps up after 15–20 minutes, reflecting
 * research on vigilance decrement timing (Mackworth, 1948).
 *
 * sigmoid(t) = 1 / (1 + e^(-k * (t - midpoint)))
 *
 * @param sessionDurationMinutes - Total session time in minutes
 * @returns Normalized duration factor [0, 1]
 */
export function computeDurationFactor(sessionDurationMinutes: number): number {
  if (sessionDurationMinutes <= 0) return 0;

  const raw = 1 / (1 + Math.exp(-DURATION_SIGMOID_STEEPNESS * (sessionDurationMinutes - DURATION_SIGMOID_MIDPOINT)));
  // Subtract the sigmoid value at t=0 and rescale so signal starts near 0
  const atZero = 1 / (1 + Math.exp(-DURATION_SIGMOID_STEEPNESS * (0 - DURATION_SIGMOID_MIDPOINT)));
  const normalized = (raw - atZero) / (1 - atZero);

  return clamp01(normalized);
}

// ─── Fatigue Onset Detection ─────────────────────────────────────────────────

/**
 * Estimate the question index where fatigue onset began.
 *
 * Uses a sliding window approach: scans the session data and finds
 * the first window where the local fatigue signal exceeds the mild threshold.
 *
 * @param responseTimes - Array of all response times in session order
 * @param correctnessArray - Parallel array of correctness booleans
 * @returns Question index of estimated onset, or null if no fatigue detected
 */
export function estimateFatigueOnset(
  responseTimes: number[],
  correctnessArray: boolean[]
): number | null {
  const n = Math.min(responseTimes.length, correctnessArray.length);
  if (n < BASELINE_WINDOW + ROLLING_WINDOW) return null;

  const baselineRts = responseTimes.slice(0, BASELINE_WINDOW);
  const baselineMeanRt = mean(baselineRts);
  const baselineAcc = baselineRts.length > 0
    ? correctnessArray.slice(0, BASELINE_WINDOW).filter(Boolean).length / BASELINE_WINDOW
    : 0;

  if (baselineMeanRt <= 0) return null;

  // Slide a window across the session
  for (let i = BASELINE_WINDOW; i <= n - ROLLING_WINDOW; i++) {
    const windowRts = responseTimes.slice(i, i + ROLLING_WINDOW);
    const windowCorrectness = correctnessArray.slice(i, i + ROLLING_WINDOW);

    const windowMeanRt = mean(windowRts);
    const windowAcc = windowCorrectness.filter(Boolean).length / ROLLING_WINDOW;

    const rtDriftLocal = Math.max(0, (windowMeanRt - baselineMeanRt) / baselineMeanRt);
    const accDeclineLocal = Math.max(0, baselineAcc - windowAcc);

    // Simple local fatigue check: significant drift OR accuracy drop
    if (rtDriftLocal > 0.15 || accDeclineLocal > 0.15) {
      return i;
    }
  }

  return null;
}

// ─── Composite Scoring ───────────────────────────────────────────────────────

/**
 * Compute the composite fatigue score and classification.
 *
 * This is the main entry point. Accepts the full session data and returns
 * a rich fatigue assessment including all signal breakdowns.
 *
 * @param dataPoints - Ordered array of session responses
 * @returns CompositeFatigueResult with score, level, signals, and recommendations
 */
export function computeCompositeFatigue(
  dataPoints: SessionDataPoint[]
): CompositeFatigueResult {
  const NO_FATIGUE: CompositeFatigueResult = {
    score: 0,
    level: 'none',
    signals: { rtDrift: 0, rtVariability: 0, accuracyDecline: 0, durationFactor: 0 },
    reliable: false,
    suggestedBreakMinutes: 0,
    message: null,
    fatigueOnsetIndex: null,
  };

  if (dataPoints.length < MIN_QUESTIONS) return NO_FATIGUE;

  const responseTimes = dataPoints.map(d => d.responseTimeMs);
  const correctnessArray = dataPoints.map(d => d.wasCorrect);

  // Session duration from timestamps
  const sessionDurationMs = dataPoints[dataPoints.length - 1]!.timestamp - dataPoints[0]!.timestamp;
  const sessionDurationMinutes = sessionDurationMs / 60000;

  // Compute individual signals
  const signals: FatigueSignals = {
    rtDrift: computeRtDrift(responseTimes),
    rtVariability: computeRtVariability(responseTimes),
    accuracyDecline: computeAccuracyDecline(correctnessArray),
    durationFactor: computeDurationFactor(sessionDurationMinutes),
  };

  // Weighted composite
  const score = clamp01(
    WEIGHTS.rtDrift * signals.rtDrift +
    WEIGHTS.rtVariability * signals.rtVariability +
    WEIGHTS.accuracyDecline * signals.accuracyDecline +
    WEIGHTS.durationFactor * signals.durationFactor
  );

  // Classify
  const level = classifyFatigueLevel(score);

  // Fatigue onset detection
  const fatigueOnsetIndex = level !== 'none'
    ? estimateFatigueOnset(responseTimes, correctnessArray)
    : null;

  return {
    score,
    level,
    signals,
    reliable: true,
    suggestedBreakMinutes: getSuggestedBreakMinutes(level),
    message: getFatigueMessage(level, signals, sessionDurationMinutes, dataPoints.length),
    fatigueOnsetIndex,
  };
}

// ─── Classification & Messaging ──────────────────────────────────────────────

/**
 * Classify a composite fatigue score into a named level.
 */
export function classifyFatigueLevel(score: number): CompositeFatigueLevel {
  if (score >= THRESHOLDS.severe) return 'severe';
  if (score >= THRESHOLDS.moderate) return 'moderate';
  if (score >= THRESHOLDS.mild) return 'mild';
  return 'none';
}

/**
 * Get the suggested break duration for a fatigue level.
 */
function getSuggestedBreakMinutes(level: CompositeFatigueLevel): number {
  switch (level) {
    case 'severe': return 15;
    case 'moderate': return 5;
    case 'mild': return 2;
    case 'none': return 0;
  }
}

/**
 * Generate a strategy-framed fatigue message.
 *
 * Philosophy: Frame rest as STRATEGY, not weakness. Never say "you should
 * take a break" — say "your retention will be better if you pause."
 */
function getFatigueMessage(
  level: CompositeFatigueLevel,
  signals: FatigueSignals,
  sessionMinutes: number,
  questionCount: number
): string | null {
  if (level === 'none') return null;

  // Identify the dominant signal for a targeted message
  const dominant = getDominantSignal(signals);

  if (level === 'mild') {
    switch (dominant) {
      case 'rtDrift':
        return `You're slowing down slightly — a 2-minute stretch would help your next ${Math.min(10, questionCount)} questions land better.`;
      case 'rtVariability':
        return `Your response rhythm is getting inconsistent — a quick pause helps your focus reset.`;
      case 'accuracyDecline':
        return `Your recent accuracy dipped below your session average. A micro-break can reverse that.`;
      case 'durationFactor':
        return `${Math.round(sessionMinutes)} minutes of focused study — shifting to easier cards would optimize your remaining time.`;
    }
  }

  if (level === 'moderate') {
    switch (dominant) {
      case 'rtDrift':
        return `Your response times have increased noticeably. A 5-minute break would help lock in what you've covered.`;
      case 'accuracyDecline':
        return `Your accuracy has dropped from your session start. Taking 5 minutes to rest will improve retention of everything you've reviewed.`;
      default:
        return `${Math.round(sessionMinutes)} minutes of focused study — research shows a 5-minute break now improves 24-hour retention by up to 30%.`;
    }
  }

  // severe
  return `You've been studying for ${Math.round(sessionMinutes)} minutes and your performance signals suggest diminishing returns. The reviews you lock in from a break will stick better than pushing through.`;
}

/**
 * Identify which signal is contributing most to the composite score.
 */
function getDominantSignal(signals: FatigueSignals): keyof FatigueSignals {
  const weighted: Record<keyof FatigueSignals, number> = {
    rtDrift: signals.rtDrift * WEIGHTS.rtDrift,
    rtVariability: signals.rtVariability * WEIGHTS.rtVariability,
    accuracyDecline: signals.accuracyDecline * WEIGHTS.accuracyDecline,
    durationFactor: signals.durationFactor * WEIGHTS.durationFactor,
  };

  let max = -1;
  let dominant: keyof FatigueSignals = 'rtDrift';
  for (const [key, val] of Object.entries(weighted)) {
    if (val > max) {
      max = val;
      dominant = key as keyof FatigueSignals;
    }
  }
  return dominant;
}

// ─── Utility Functions ───────────────────────────────────────────────────────

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  let sumSq = 0;
  for (const v of values) sumSq += (v - m) ** 2;
  return Math.sqrt(sumSq / (values.length - 1)); // Sample stdev
}

function coefficientOfVariation(values: number[]): number {
  const m = mean(values);
  if (m <= 0) return 0;
  return standardDeviation(values) / m;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
