/**
 * Ex-Gaussian Response Time Distribution Modeling
 *
 * Response times in cognitive tasks follow an ex-Gaussian distribution:
 * a convolution of a Gaussian (cognitive processing) and an Exponential
 * (attentional lapses / decision difficulty) component.
 *
 * Parameters:
 * - mu (μ): Mean of the Gaussian component — base cognitive processing speed
 * - sigma (σ): Std dev of the Gaussian — variability in processing
 * - tau (τ): Rate of the exponential — captures "tail" events (attentional lapses,
 *   genuine struggle, or deliberation)
 *
 * Research basis:
 * - Ratcliff (1978): Drift-diffusion model — RT distributions reveal cognitive processes
 * - Luce (1986): Response Times — ex-Gaussian is the standard parametric model
 * - Balota & Yap (2011): tau component specifically indexes executive attention
 * - Schmiedek et al. (2007): Intra-individual RT variability (tau) predicts
 *   working memory capacity
 *
 * Design:
 * - Fits ex-Gaussian to a student's RT history using method of moments (fast, O(n))
 * - Classifies individual RTs as:
 *   - "automatic": RT < mu (fast, automatic retrieval)
 *   - "normal": mu ≤ RT ≤ mu + sigma (expected processing)
 *   - "effortful": mu + sigma < RT ≤ mu + sigma + tau (genuine effort/deliberation)
 *   - "lapse": RT > mu + sigma + 2*tau (attentional lapse — discount confidence)
 * - The lapse detection is the key improvement: a lapse-flagged RT produces
 *   *lower* confidence signal quality, not lower confidence per se
 *
 * Integration:
 * - Stored in UserBehavioralBaseline alongside existing stats
 * - Used by deriveContinuousRating for more nuanced RT → confidence mapping
 */

// ── Types ──

export interface ExGaussianParams {
  /** Gaussian mean — base cognitive processing time (ms) */
  mu: number;
  /** Gaussian std dev — processing variability (ms) */
  sigma: number;
  /** Exponential rate — attentional/deliberation tail (ms) */
  tau: number;
  /** Number of RT samples used for fitting */
  n: number;
}

export type RTClassification = 'automatic' | 'normal' | 'effortful' | 'lapse';

export interface RTClassificationResult {
  /** Classification category */
  classification: RTClassification;
  /** Confidence signal quality: 1.0 for automatic/normal, reduced for lapse */
  signalQuality: number;
  /** Z-score using ex-Gaussian parameters (more accurate than Gaussian z-score) */
  exGaussianZScore: number;
  /** Normalized RT signal for confidence [0, 1] — replaces simple z-score */
  rtSignal: number;
}

// ── Constants ──

/** Minimum RT samples needed for ex-Gaussian fit */
export const MIN_SAMPLES_FOR_FIT = 30;

/** Signal quality by RT classification */
const SIGNAL_QUALITY: Record<RTClassification, number> = {
  automatic: 1.0,
  normal: 1.0,
  effortful: 0.9,  // Slightly reduced — high effort may mask true knowledge state
  lapse: 0.6,      // Substantially reduced — RT is noise, not signal
};

// ── Core functions ──

/**
 * Fit ex-Gaussian parameters using the method of moments.
 *
 * Method of moments estimators for the ex-Gaussian:
 *   E[X] = μ + τ           → mean
 *   Var[X] = σ² + τ²       → variance
 *   Skew[X] = 2τ³ / (σ² + τ²)^(3/2)  → skewness
 *
 * We solve these three equations for μ, σ, τ from the sample moments.
 *
 * @param rtValues - Array of response times in ms
 * @returns Fitted parameters, or null if insufficient data or degenerate fit
 */
export function fitExGaussian(rtValues: number[]): ExGaussianParams | null {
  if (rtValues.length < MIN_SAMPLES_FOR_FIT) return null;

  // Filter outliers: remove top/bottom 2% for robustness
  const sorted = [...rtValues].sort((a, b) => a - b);
  const trimLow = Math.floor(sorted.length * 0.02);
  const trimHigh = Math.ceil(sorted.length * 0.98);
  const trimmed = sorted.slice(trimLow, trimHigh);

  if (trimmed.length < 20) return null;

  const n = trimmed.length;
  const mean = trimmed.reduce((s, v) => s + v, 0) / n;
  const variance = trimmed.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1);
  const stdDev = Math.sqrt(variance);

  if (stdDev < 1) return null; // Degenerate — all same value

  // Third central moment for skewness
  const m3 = trimmed.reduce((s, v) => s + (v - mean) ** 3, 0) / n;
  const skewness = m3 / (stdDev ** 3);

  // Ex-Gaussian requires positive skewness (right tail)
  // If data is not right-skewed, it's more Gaussian than ex-Gaussian
  if (skewness <= 0.1) {
    // Nearly symmetric — treat as pure Gaussian (tau ≈ 0)
    return {
      mu: mean,
      sigma: stdDev,
      tau: 0,
      n: rtValues.length,
    };
  }

  // Method of moments: solve for tau from skewness
  // skewness = 2 * tau^3 / (sigma^2 + tau^2)^(3/2)
  // This doesn't have a clean closed form, so we use an approximation:
  // tau ≈ stdDev * (skewness / 2)^(1/3) when skewness is moderate
  //
  // More robust approach: use the relationship:
  // tau = (m3 / 2)^(1/3) when m3 > 0
  // sigma^2 = variance - tau^2
  // mu = mean - tau

  const tauCubed = m3 / 2;
  const tau = Math.cbrt(Math.max(0, tauCubed));

  const sigmaSquared = variance - tau * tau;
  const sigma = sigmaSquared > 0 ? Math.sqrt(sigmaSquared) : stdDev * 0.5;

  const mu = mean - tau;

  // Sanity checks
  if (mu <= 0 || sigma <= 0 || tau < 0) {
    // Fallback to Gaussian-only interpretation
    return {
      mu: mean,
      sigma: stdDev,
      tau: 0,
      n: rtValues.length,
    };
  }

  return {
    mu: Math.round(mu),
    sigma: Math.round(sigma),
    tau: Math.round(tau),
    n: rtValues.length,
  };
}

/**
 * Classify a single RT using fitted ex-Gaussian parameters.
 *
 * @param rt - Response time in ms
 * @param params - Fitted ex-Gaussian parameters
 * @returns Classification, signal quality, and normalized RT signal
 */
export function classifyRT(
  rt: number,
  params: ExGaussianParams
): RTClassificationResult {
  const { mu, sigma, tau } = params;

  // Effective standard deviation of the full ex-Gaussian
  const effectiveSigma = Math.sqrt(sigma * sigma + tau * tau) || 1;

  // Z-score relative to full ex-Gaussian distribution
  const exGaussianZScore = (rt - (mu + tau)) / effectiveSigma;

  // Classification thresholds
  let classification: RTClassification;
  if (rt < mu) {
    classification = 'automatic';
  } else if (rt <= mu + sigma) {
    classification = 'normal';
  } else if (rt <= mu + sigma + 2 * tau) {
    classification = 'effortful';
  } else {
    classification = 'lapse';
  }

  // For distributions with tau ≈ 0 (no tail), use simpler classification
  if (tau < 100) {
    if (rt < mu - sigma) {
      classification = 'automatic';
    } else if (rt <= mu + sigma) {
      classification = 'normal';
    } else if (rt <= mu + 2 * sigma) {
      classification = 'effortful';
    } else {
      classification = 'lapse';
    }
  }

  const signalQuality = SIGNAL_QUALITY[classification];

  // Normalized RT signal [0, 1] for confidence
  // Uses the ex-Gaussian z-score but maps to a sigmoid for bounded output
  // z = -2 → signal ≈ 1.0 (very fast)
  // z = 0 → signal ≈ 0.67 (at mean)
  // z = +2 → signal ≈ 0.33 (slow)
  // z = +3 → signal ≈ 0.0 (very slow / lapse)
  const rtSignal = Math.max(0, Math.min(1, 1 - exGaussianZScore / 3));

  return {
    classification,
    signalQuality,
    exGaussianZScore: Math.round(exGaussianZScore * 100) / 100,
    rtSignal: Math.round(rtSignal * 1000) / 1000,
  };
}

/**
 * Compute an enhanced RT confidence signal using ex-Gaussian parameters.
 * Replaces the simple z-score in deriveContinuousRating when ex-Gaussian
 * params are available.
 *
 * Key improvement: attentional lapses are detected and their signal quality
 * is reduced, preventing random slowness from being interpreted as weak memory.
 *
 * @param rt - Response time in ms
 * @param params - Fitted ex-Gaussian parameters
 * @returns Object with rtSignal for confidence and quality discount
 */
export function exGaussianRTSignal(
  rt: number,
  params: ExGaussianParams
): { signal: number; quality: number; classification: RTClassification } {
  const result = classifyRT(rt, params);
  return {
    signal: result.rtSignal,
    quality: result.signalQuality,
    classification: result.classification,
  };
}
