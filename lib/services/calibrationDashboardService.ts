/**
 * Calibration Dashboard Service (Tier 2, Feature 3)
 *
 * Provides comprehensive calibration analytics for the student-facing
 * Calibration Dashboard. Computes two complementary calibration measures:
 *
 * 1. **FSRS Calibration** — compares FSRS predicted retrievability against
 *    actual recall outcomes, measuring algorithm accuracy.
 * 2. **Metacognitive Calibration** — compares student implicit/self-reported
 *    confidence against actual performance, measuring self-awareness.
 *
 * Key Metrics:
 * - Brier Score: gold-standard proper scoring rule (0=perfect, 1=worst)
 * - ECE (Expected Calibration Error): intuitive visualization metric
 * - Per-domain breakdowns by PANCE organ system
 * - Weekly trend tracking for longitudinal improvement
 *
 * Research basis:
 * - Brier (1950): Proper scoring rule for probabilistic calibration
 * - Nixon et al. (2019): Adaptive binning for reliable ECE estimation
 * - Dunlosky & Nelson (1992): JOL calibration varies by individual
 *
 * @see lib/jol-calibration.ts — Existing JOL system (implicit confidence)
 * @see lib/services/calibrationService.ts — Core user calibration
 * @see lib/services/retrievabilityCalibrationService.ts — FSRS R calibration
 */

// ─── Types ────────────────────────────────────────────────────────

/** A single review observation for calibration computation */
export interface CalibrationObservation {
  /** Predicted probability of recall (FSRS retrievability or confidence) */
  predicted: number;
  /** Actual outcome: 1 = correct, 0 = incorrect */
  actual: number;
  /** PANCE organ system (e.g., 'Cardiovascular', 'Pulmonary') */
  domain?: string;
  /** Review timestamp (ISO string) */
  reviewedAt: string;
  /** Self-reported confidence (1-5 scale, optional) */
  selfConfidence?: number;
  /** Implicit behavioral confidence (0-1) */
  implicitConfidence?: number;
}

/** A single bin in the reliability diagram */
export interface ReliabilityBin {
  /** Bin index */
  index: number;
  /** Mean predicted probability in this bin */
  meanPredicted: number;
  /** Mean actual outcome (accuracy) in this bin */
  meanActual: number;
  /** Number of observations in this bin */
  count: number;
  /** Absolute calibration error for this bin */
  calibrationError: number;
}

/** Per-domain calibration summary */
export interface DomainCalibration {
  /** PANCE organ system name */
  domain: string;
  /** Brier score for this domain */
  brierScore: number;
  /** ECE for this domain */
  ece: number;
  /** Over/under confidence direction */
  direction: 'overconfident' | 'underconfident' | 'calibrated';
  /** Mean bias (predicted - actual) */
  meanBias: number;
  /** Number of observations */
  count: number;
}

/** Weekly calibration trend point */
export interface CalibrationTrendPoint {
  /** ISO week string (e.g., '2026-W14') */
  week: string;
  /** Start date of the week */
  weekStart: string;
  /** Brier score for this week */
  brierScore: number;
  /** ECE for this week */
  ece: number;
  /** Number of reviews this week */
  reviewCount: number;
  /** Mean overconfidence bias */
  meanBias: number;
}

/** Complete calibration dashboard data */
export interface CalibrationDashboardData {
  /** FSRS model calibration */
  fsrs: {
    brierScore: number;
    ece: number;
    reliabilityBins: ReliabilityBin[];
    direction: 'overconfident' | 'underconfident' | 'calibrated';
    meanBias: number;
    totalReviews: number;
  };
  /** Metacognitive calibration (implicit behavioral confidence) */
  metacognitive: {
    brierScore: number;
    ece: number;
    reliabilityBins: ReliabilityBin[];
    direction: 'overconfident' | 'underconfident' | 'calibrated';
    meanBias: number;
    totalReviews: number;
  };
  /** Per-PANCE-domain FSRS calibration */
  domainBreakdown: DomainCalibration[];
  /** Weekly Brier score trend (last 12 weeks) */
  weeklyTrend: CalibrationTrendPoint[];
  /** Overall data sufficiency */
  hasSufficientData: boolean;
  /** When this was computed */
  computedAt: string;
}

// ─── Constants ────────────────────────────────────────────────────

/** Minimum observations for reliable calibration */
export const MIN_OBSERVATIONS_RELIABLE = 50;

/** Minimum observations per domain to show */
export const MIN_DOMAIN_OBSERVATIONS = 30;

/** Number of quantile bins for ECE computation */
export const NUM_QUANTILE_BINS = 10;

/** Number of weeks to include in trend */
export const TREND_WEEKS = 12;

/** Minimum reviews in a week to include in trend */
export const MIN_WEEKLY_REVIEWS = 10;

/** Direction thresholds */
const BIAS_THRESHOLD = 0.05;

// ─── Pure Computation Functions (exported for testing) ────────────

/**
 * Compute Brier Score from prediction-outcome pairs.
 * BS = (1/N) × Σ(predicted_i - outcome_i)²
 *
 * Range: [0, 1], lower is better.
 * 0.25 = random baseline for binary outcomes with 50% base rate.
 */
export function computeBrierScore(
  observations: ReadonlyArray<{ predicted: number; actual: number }>
): number {
  if (observations.length === 0) return 0.25;
  const sum = observations.reduce(
    (acc, obs) => acc + (obs.predicted - obs.actual) ** 2,
    0
  );
  return sum / observations.length;
}

/**
 * Compute Expected Calibration Error using adaptive quantile binning.
 *
 * ECE = Σ (|B_i|/N) × |accuracy(B_i) - confidence(B_i)|
 *
 * Uses quantile binning (equal samples per bin) rather than fixed-width
 * bins, following Nixon et al. (2019) recommendation that fixed-width
 * binning is gameable and statistically unreliable.
 *
 * @param observations - Array of {predicted, actual} pairs
 * @param numBins - Number of quantile bins (default 10)
 * @returns ECE value in [0, 1], lower is better
 */
export function computeECE(
  observations: ReadonlyArray<{ predicted: number; actual: number }>,
  numBins: number = NUM_QUANTILE_BINS
): number {
  if (observations.length < numBins) return 0;

  // Sort by predicted for quantile binning
  const sorted = [...observations].sort((a, b) => a.predicted - b.predicted);
  const binSize = Math.floor(sorted.length / numBins);
  let ece = 0;
  const n = sorted.length;

  for (let i = 0; i < numBins; i++) {
    const start = i * binSize;
    const end = i === numBins - 1 ? n : start + binSize;
    const bin = sorted.slice(start, end);

    if (bin.length === 0) continue;

    const avgPredicted = bin.reduce((s, o) => s + o.predicted, 0) / bin.length;
    const avgActual = bin.reduce((s, o) => s + o.actual, 0) / bin.length;

    ece += (bin.length / n) * Math.abs(avgActual - avgPredicted);
  }

  return ece;
}

/**
 * Build reliability bins for the reliability diagram.
 * Uses quantile binning for equal-count bins.
 *
 * Returns bins suitable for plotting: each bin has meanPredicted (x-axis)
 * and meanActual (y-axis). Perfect calibration = points on the diagonal.
 */
export function buildReliabilityBins(
  observations: ReadonlyArray<{ predicted: number; actual: number }>,
  numBins: number = NUM_QUANTILE_BINS
): ReliabilityBin[] {
  if (observations.length < numBins) return [];

  const sorted = [...observations].sort((a, b) => a.predicted - b.predicted);
  const binSize = Math.floor(sorted.length / numBins);
  const bins: ReliabilityBin[] = [];

  for (let i = 0; i < numBins; i++) {
    const start = i * binSize;
    const end = i === numBins - 1 ? sorted.length : start + binSize;
    const bin = sorted.slice(start, end);

    if (bin.length === 0) continue;

    const meanPredicted = bin.reduce((s, o) => s + o.predicted, 0) / bin.length;
    const meanActual = bin.reduce((s, o) => s + o.actual, 0) / bin.length;

    bins.push({
      index: i,
      meanPredicted: round(meanPredicted, 4),
      meanActual: round(meanActual, 4),
      count: bin.length,
      calibrationError: round(Math.abs(meanPredicted - meanActual), 4),
    });
  }

  return bins;
}

/**
 * Compute mean bias (predicted - actual).
 * Positive = overconfident, Negative = underconfident.
 */
export function computeMeanBias(
  observations: ReadonlyArray<{ predicted: number; actual: number }>
): number {
  if (observations.length === 0) return 0;
  const sum = observations.reduce(
    (acc, obs) => acc + (obs.predicted - obs.actual),
    0
  );
  return sum / observations.length;
}

/**
 * Determine calibration direction from mean bias.
 */
export function classifyDirection(
  meanBias: number
): 'overconfident' | 'underconfident' | 'calibrated' {
  if (meanBias > BIAS_THRESHOLD) return 'overconfident';
  if (meanBias < -BIAS_THRESHOLD) return 'underconfident';
  return 'calibrated';
}

/**
 * Compute per-domain calibration breakdowns.
 * Only returns domains with sufficient observations.
 */
export function computeDomainBreakdown(
  observations: ReadonlyArray<CalibrationObservation>,
  minCount: number = MIN_DOMAIN_OBSERVATIONS
): DomainCalibration[] {
  // Group by domain
  const byDomain = new Map<string, CalibrationObservation[]>();

  for (const obs of observations) {
    const domain = obs.domain || 'Unknown';
    if (!byDomain.has(domain)) byDomain.set(domain, []);
    byDomain.get(domain)!.push(obs);
  }

  const results: DomainCalibration[] = [];

  for (const [domain, domainObs] of byDomain) {
    if (domainObs.length < minCount) continue;

    const pairs = domainObs.map(o => ({ predicted: o.predicted, actual: o.actual }));
    const brierScore = computeBrierScore(pairs);
    const ece = computeECE(pairs);
    const meanBias = computeMeanBias(pairs);

    results.push({
      domain,
      brierScore: round(brierScore, 4),
      ece: round(ece, 4),
      direction: classifyDirection(meanBias),
      meanBias: round(meanBias, 4),
      count: domainObs.length,
    });
  }

  // Sort by count descending (most data first)
  return results.sort((a, b) => b.count - a.count);
}

/**
 * Compute weekly calibration trend from observations.
 * Returns one data point per week for the last N weeks.
 */
export function computeWeeklyTrend(
  observations: ReadonlyArray<CalibrationObservation>,
  weeks: number = TREND_WEEKS,
  minWeeklyReviews: number = MIN_WEEKLY_REVIEWS
): CalibrationTrendPoint[] {
  if (observations.length === 0) return [];

  // Group observations by ISO week
  const byWeek = new Map<string, CalibrationObservation[]>();

  for (const obs of observations) {
    const date = new Date(obs.reviewedAt);
    const weekKey = getISOWeek(date);

    if (!byWeek.has(weekKey)) byWeek.set(weekKey, []);
    byWeek.get(weekKey)!.push(obs);
  }

  // Sort weeks and take the last N
  const sortedWeeks = Array.from(byWeek.keys()).sort();
  const recentWeeks = sortedWeeks.slice(-weeks);

  const trend: CalibrationTrendPoint[] = [];

  for (const week of recentWeeks) {
    const weekObs = byWeek.get(week)!;
    if (weekObs.length < minWeeklyReviews) continue;

    const pairs = weekObs.map(o => ({ predicted: o.predicted, actual: o.actual }));
    const brierScore = computeBrierScore(pairs);
    const ece = computeECE(pairs, Math.min(NUM_QUANTILE_BINS, Math.floor(pairs.length / 5)));
    const meanBias = computeMeanBias(pairs);

    trend.push({
      week,
      weekStart: getWeekStartDate(week),
      brierScore: round(brierScore, 4),
      ece: round(ece, 4),
      reviewCount: weekObs.length,
      meanBias: round(meanBias, 4),
    });
  }

  return trend;
}

/**
 * Build the complete calibration dashboard dataset from raw observations.
 *
 * Computes both FSRS calibration (using retrievability as predicted)
 * and metacognitive calibration (using implicit confidence as predicted).
 */
export function buildCalibrationDashboard(
  fsrsObservations: ReadonlyArray<CalibrationObservation>,
  metacognitiveObservations: ReadonlyArray<CalibrationObservation>
): CalibrationDashboardData {
  const now = new Date().toISOString();

  // FSRS model calibration
  const fsrsPairs = fsrsObservations.map(o => ({ predicted: o.predicted, actual: o.actual }));
  const fsrsBrier = computeBrierScore(fsrsPairs);
  const fsrsEce = computeECE(fsrsPairs);
  const fsrsBins = buildReliabilityBins(fsrsPairs);
  const fsrsBias = computeMeanBias(fsrsPairs);

  // Metacognitive calibration
  const metaPairs = metacognitiveObservations.map(o => ({
    predicted: o.predicted,
    actual: o.actual,
  }));
  const metaBrier = computeBrierScore(metaPairs);
  const metaEce = computeECE(metaPairs);
  const metaBins = buildReliabilityBins(metaPairs);
  const metaBias = computeMeanBias(metaPairs);

  // Domain breakdown (using FSRS observations for PANCE alignment)
  const domainBreakdown = computeDomainBreakdown(fsrsObservations);

  // Weekly trend (using FSRS observations for consistency)
  const weeklyTrend = computeWeeklyTrend(fsrsObservations);

  const hasSufficientData =
    fsrsObservations.length >= MIN_OBSERVATIONS_RELIABLE ||
    metacognitiveObservations.length >= MIN_OBSERVATIONS_RELIABLE;

  return {
    fsrs: {
      brierScore: round(fsrsBrier, 4),
      ece: round(fsrsEce, 4),
      reliabilityBins: fsrsBins,
      direction: classifyDirection(fsrsBias),
      meanBias: round(fsrsBias, 4),
      totalReviews: fsrsObservations.length,
    },
    metacognitive: {
      brierScore: round(metaBrier, 4),
      ece: round(metaEce, 4),
      reliabilityBins: metaBins,
      direction: classifyDirection(metaBias),
      meanBias: round(metaBias, 4),
      totalReviews: metacognitiveObservations.length,
    },
    domainBreakdown,
    weeklyTrend,
    hasSufficientData,
    computedAt: now,
  };
}

// ─── Utility Functions ────────────────────────────────────────────

/** Round to N decimal places */
function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Get ISO week string (e.g., '2026-W14') from a Date */
function getISOWeek(date: Date): string {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  // Thursday of current week determines the year
  d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

/** Get the Monday start date for an ISO week string */
function getWeekStartDate(isoWeek: string): string {
  const [yearStr, weekStr] = isoWeek.split('-W');
  const year = parseInt(yearStr, 10);
  const week = parseInt(weekStr, 10);

  // January 4 is always in week 1
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7; // 1=Mon, 7=Sun
  const mondayOfWeek1 = new Date(jan4);
  mondayOfWeek1.setUTCDate(jan4.getUTCDate() - dayOfWeek + 1);

  const targetMonday = new Date(mondayOfWeek1);
  targetMonday.setUTCDate(mondayOfWeek1.getUTCDate() + (week - 1) * 7);

  return targetMonday.toISOString().split('T')[0];
}
