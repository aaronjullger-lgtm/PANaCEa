/**
 * Shadow-mode FSRS Calibration Validator
 *
 * Consumes CalibrationLog rows (see lib/scheduling/calibrationLogger.ts) and
 * scores the scheduler's predicted retrievability against realized outcomes.
 *
 * All math is pure and deterministic so the admin endpoint can call it edge-side
 * without side effects. No Prisma types are required — the validator operates on
 * a simple `{ predictedRetrievability: number; actualOutcome: boolean }` shape.
 *
 * Metrics reported:
 *  - Brier score (MSE of probability) — lower is better, 0 is perfect
 *  - Log-loss (cross-entropy) — lower is better, 0 is perfect
 *  - Expected Calibration Error (ECE) — weighted |predicted − observed| across bins
 *  - Reliability diagram bins — predicted range, mean predicted, observed rate, count
 *  - Overall accuracy for sanity
 *
 * Research basis:
 *  - Brier (1950): "Verification of forecasts expressed in terms of probability"
 *  - Guo, Pleiss, Sun, Weinberger (2017): "On Calibration of Modern Neural Networks"
 *    — ECE with 10 equally-spaced bins is the reference calibration metric
 *  - FSRS v6 spec assumes a well-calibrated predictor of recall probability,
 *    so we can measure whether the scheduler's implicit belief matches reality.
 *
 * @see lib/scheduling/calibrationLogger.ts — emission site
 * @see functions/api/admin/calibration-report.ts — consumer
 */

export interface CalibrationSample {
  /** Predicted probability of recall at review time, in [0, 1] */
  predictedRetrievability: number;
  /** Whether the student actually recalled the item correctly */
  actualOutcome: boolean;
}

export interface ReliabilityBin {
  /** Bin index, 0-based */
  index: number;
  /** Lower bound of predicted probability (inclusive) */
  lowerBound: number;
  /** Upper bound of predicted probability (exclusive, except last bin) */
  upperBound: number;
  /** Number of samples falling in this bin */
  count: number;
  /** Mean predicted probability of samples in this bin */
  meanPredicted: number;
  /** Observed recall rate in this bin (ground truth) */
  observedRate: number;
  /** Absolute gap between mean predicted and observed rate */
  gap: number;
}

export interface CalibrationReport {
  /** Total number of samples scored */
  n: number;
  /** Brier score = (1/n) Σ (p_i − y_i)² — 0 perfect, 0.25 random, higher is worse */
  brier: number;
  /** Log-loss = −(1/n) Σ [y_i log p_i + (1−y_i) log(1−p_i)] — 0 perfect */
  logLoss: number;
  /** Expected Calibration Error — Σ (|bin|/n) · |meanPredicted − observedRate| */
  ece: number;
  /** Max calibration error across non-empty bins — useful for tail risk */
  maxCalibrationError: number;
  /** Overall observed recall rate */
  overallAccuracy: number;
  /** Mean of predicted retrievabilities — if far from overallAccuracy, bias is present */
  meanPredicted: number;
  /** Reliability diagram bins (10 by default) */
  bins: ReliabilityBin[];
  /** Number of bins used */
  binCount: number;
}

/** Guard against log(0). */
const LOG_EPS = 1e-9;

/** Clamp a probability to [eps, 1 − eps] so log-loss is finite. */
function clampP(p: number): number {
  if (!Number.isFinite(p)) return 0.5;
  if (p < LOG_EPS) return LOG_EPS;
  if (p > 1 - LOG_EPS) return 1 - LOG_EPS;
  return p;
}

/**
 * Compute Brier score: mean squared error of predicted probabilities.
 *
 * Brier = (1/n) Σ (p_i − y_i)²
 *
 * Range: [0, 1]. 0 = perfect. 0.25 = constantly predicting 0.5 for 50/50 data.
 * Reference for a well-tuned FSRS: ~0.10–0.18 is typical per Open Spaced Repetition research.
 */
export function brierScore(samples: CalibrationSample[]): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (const s of samples) {
    const p = clampP(s.predictedRetrievability);
    const y = s.actualOutcome ? 1 : 0;
    const d = p - y;
    sum += d * d;
  }
  return sum / samples.length;
}

/**
 * Compute log-loss (binary cross-entropy).
 *
 * Log-loss = −(1/n) Σ [y_i log p_i + (1−y_i) log(1−p_i)]
 *
 * 0 = perfect. Unlike Brier, log-loss penalizes confident wrong predictions
 * heavily (log(eps) → −∞), so it's more sensitive to overconfidence.
 */
export function logLoss(samples: CalibrationSample[]): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (const s of samples) {
    const p = clampP(s.predictedRetrievability);
    if (s.actualOutcome) {
      sum -= Math.log(p);
    } else {
      sum -= Math.log(1 - p);
    }
  }
  return sum / samples.length;
}

/**
 * Bucket samples into equally-spaced probability bins and compute reliability.
 *
 * Following Guo et al. (2017), bins are equally-spaced on [0, 1]. Sample falls
 * in bin i iff p ∈ [i/B, (i+1)/B), with the last bin inclusive on the right.
 */
export function reliabilityBins(
  samples: CalibrationSample[],
  binCount: number = 10
): ReliabilityBin[] {
  if (binCount < 1) binCount = 1;
  const bins: ReliabilityBin[] = [];
  // Buckets of raw accumulators
  const sums = Array.from({ length: binCount }, () => ({ predSum: 0, obsSum: 0, count: 0 }));

  for (const s of samples) {
    const p = clampP(s.predictedRetrievability);
    let idx = Math.floor(p * binCount);
    if (idx >= binCount) idx = binCount - 1;
    if (idx < 0) idx = 0;
    const bucket = sums[idx];
    if (!bucket) continue;
    bucket.predSum += p;
    bucket.obsSum += s.actualOutcome ? 1 : 0;
    bucket.count += 1;
  }

  for (let i = 0; i < binCount; i++) {
    const b = sums[i];
    if (!b) continue;
    const lowerBound = i / binCount;
    const upperBound = (i + 1) / binCount;
    const meanPredicted = b.count > 0 ? b.predSum / b.count : 0;
    const observedRate = b.count > 0 ? b.obsSum / b.count : 0;
    bins.push({
      index: i,
      lowerBound,
      upperBound,
      count: b.count,
      meanPredicted,
      observedRate,
      gap: Math.abs(meanPredicted - observedRate),
    });
  }
  return bins;
}

/**
 * Expected Calibration Error: weighted average gap across non-empty bins.
 *
 * ECE = Σ_b (|B_b|/n) · |mean(p ∈ B_b) − mean(y ∈ B_b)|
 *
 * 0 = perfectly calibrated. Sensitive to binning; 10 bins is convention.
 */
export function expectedCalibrationError(
  samples: CalibrationSample[],
  binCount: number = 10
): number {
  if (samples.length === 0) return 0;
  const bins = reliabilityBins(samples, binCount);
  let ece = 0;
  for (const b of bins) {
    if (b.count === 0) continue;
    ece += (b.count / samples.length) * b.gap;
  }
  return ece;
}

/**
 * Full calibration report for a batch of samples.
 *
 * Typical PANaCEa usage:
 *   const samples = calibrationLogs.map(log => ({
 *     predictedRetrievability: log.predictedRetrievability,
 *     actualOutcome: log.actualOutcome,
 *   }));
 *   const report = computeCalibrationReport(samples);
 */
export function computeCalibrationReport(
  samples: CalibrationSample[],
  binCount: number = 10
): CalibrationReport {
  const n = samples.length;
  if (n === 0) {
    return {
      n: 0,
      brier: 0,
      logLoss: 0,
      ece: 0,
      maxCalibrationError: 0,
      overallAccuracy: 0,
      meanPredicted: 0,
      bins: [],
      binCount,
    };
  }

  const brier = brierScore(samples);
  const ll = logLoss(samples);
  const bins = reliabilityBins(samples, binCount);
  let ece = 0;
  let maxGap = 0;
  let correct = 0;
  let predSum = 0;
  for (const s of samples) {
    if (s.actualOutcome) correct++;
    predSum += clampP(s.predictedRetrievability);
  }
  for (const b of bins) {
    if (b.count === 0) continue;
    ece += (b.count / n) * b.gap;
    if (b.gap > maxGap) maxGap = b.gap;
  }

  return {
    n,
    brier,
    logLoss: ll,
    ece,
    maxCalibrationError: maxGap,
    overallAccuracy: correct / n,
    meanPredicted: predSum / n,
    bins,
    binCount,
  };
}

/**
 * Stratified calibration report — splits samples by a key function and
 * returns a per-stratum report alongside the overall report.
 *
 * Useful for breaking down calibration by telemetry quality, session type,
 * ghost-grader rule, or any other categorical dimension stored on the log.
 *
 * Example:
 *   stratifiedReport(samples, s => s.telemetryQuality ?? 'unknown')
 *   // → { overall: CalibrationReport, strata: Map<string, CalibrationReport> }
 */
export interface StratifiedCalibrationReport {
  overall: CalibrationReport;
  strata: Map<string, CalibrationReport>;
}

export function stratifiedReport(
  samples: CalibrationSample[],
  keyFn: (s: CalibrationSample) => string,
  binCount: number = 10
): StratifiedCalibrationReport {
  const groups = new Map<string, CalibrationSample[]>();
  for (const s of samples) {
    const key = keyFn(s);
    let bucket = groups.get(key);
    if (!bucket) {
      bucket = [];
      groups.set(key, bucket);
    }
    bucket.push(s);
  }

  const strata = new Map<string, CalibrationReport>();
  for (const [key, bucket] of groups) {
    strata.set(key, computeCalibrationReport(bucket, binCount));
  }

  return {
    overall: computeCalibrationReport(samples, binCount),
    strata,
  };
}
